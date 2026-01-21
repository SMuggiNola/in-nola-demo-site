/**
 * Cloudflare Pages Function - Contact Form Handler
 * Sends emails via Resend API
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // Get form data
  let formData;
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      formData = await request.json();
    } else if (contentType.includes('form')) {
      const data = await request.formData();
      formData = Object.fromEntries(data);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to parse request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { name, email, message } = formData;

  // Validate required fields
  if (!name || !email || !message) {
    return new Response(JSON.stringify({
      error: 'Missing required fields',
      fields: { name: !name, email: !email, message: !message }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Configuration
  const RESEND_API_KEY = env.RESEND_API_KEY || 're_K98V95ac_JSkW4cabEQ4w1wuULXtYthf2';
  const TO_EMAIL = env.CONTACT_TO_EMAIL || 'sean.muggivan@gmail.com';

  // Build email content
  const emailHtml = `
    <h2>New Contact Form Submission</h2>
    <p><strong>From:</strong> ${name} (${email})</p>
    <hr>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
    <hr>
    <p style="color: #666; font-size: 12px;">Sent via IN-NOLA Contact Form</p>
  `;

  const emailText = `
New contact form submission from in-nola.org

Name: ${name}
Email: ${email}

Message:
${message}

---
Sent via IN-NOLA Contact Form
  `.trim();

  // Send via Resend API
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IN-NOLA Contact <onboarding@resend.dev>',
        to: [TO_EMAIL],
        reply_to: email,
        subject: `[IN-NOLA Contact] Message from ${name}`,
        html: emailHtml,
        text: emailText,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Your message has been sent. We\'ll be in touch soon!'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.error('Resend error:', response.status, result);

      return new Response(JSON.stringify({
        error: 'Failed to send message. Please try again later.',
        debug: {
          status: response.status,
          response: result
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Email send error:', error);

    return new Response(JSON.stringify({
      error: 'An unexpected error occurred. Please try again later.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle OPTIONS for CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
