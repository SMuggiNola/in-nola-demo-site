/**
 * Cloudflare Pages Function - Contact Form Handler
 * Sends emails via MailChannels API (free for Cloudflare Workers/Pages)
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

  // Configuration - update these values
  const TO_EMAIL = env.CONTACT_TO_EMAIL || 'sean.muggivan@gmail.com';
  const TO_NAME = env.CONTACT_TO_NAME || 'Irish Network NOLA';
  const FROM_EMAIL = env.CONTACT_FROM_EMAIL || 'noreply@in-nola.org';
  const FROM_NAME = env.CONTACT_FROM_NAME || 'IN-NOLA Contact Form';

  // Build email content
  const emailContent = `
New contact form submission from in-nola.org

Name: ${name}
Email: ${email}

Message:
${message}

---
Sent via IN-NOLA Contact Form
  `.trim();

  // Send via MailChannels API
  try {
    const mailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: TO_EMAIL, name: TO_NAME }],
            reply_to: { email: email, name: name },
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        subject: `[IN-NOLA Contact] Message from ${name}`,
        content: [
          {
            type: 'text/plain',
            value: emailContent,
          },
        ],
      }),
    });

    if (mailResponse.status === 202 || mailResponse.status === 200) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Your message has been sent. We\'ll be in touch soon!'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const errorText = await mailResponse.text();
      console.error('MailChannels error:', mailResponse.status, errorText);

      return new Response(JSON.stringify({
        error: 'Failed to send message. Please try again later.',
        debug: env.DEBUG === 'true' ? errorText : undefined
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
