/**
 * POST /api/auth/send-credentials
 *
 * Looks up an admin user by email, generates a fresh PIN, saves it,
 * and emails the credentials via Resend. Always returns a generic
 * success message to avoid revealing whether the email exists.
 */

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const genericResponse = Response.json(
    { success: true, message: 'If this email is registered, your credentials have been sent.' },
    { headers: corsHeaders }
  );

  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();

    if (!email) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const kv = env.BOARD_KV;
    if (!kv) return genericResponse;

    const raw = await kv.get('admin_users');
    if (!raw) return genericResponse;

    const users = JSON.parse(raw);
    const user = users.find(u => u.email && u.email.toLowerCase() === email);
    if (!user) return genericResponse;

    // Only generate PINs for PIN-auth users
    if (user.authMethod !== 'pin') return genericResponse;

    // Generate a fresh PIN and save
    const newPin = generatePin();
    user.pin = newPin;
    await kv.put('admin_users', JSON.stringify(users));

    // Send email via Resend
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const FROM_EMAIL = env.RESEND_FROM_EMAIL || 'IN-NOLA <contact@in-nola.org>';

    if (RESEND_API_KEY) {
      const loginUrl = 'https://in-nola-demo-site.pages.dev/admin-portal/';

      // Scanner role: send PIN to ALL board members so anyone at an event can scan
      if (user.role === 'scanner') {
        const boardEmails = users
          .filter(u => u.email && (u.role === 'board' || u.role === 'architect'))
          .map(u => u.email);
        // Include the scanner user's own email too
        if (user.email && !boardEmails.includes(user.email)) {
          boardEmails.push(user.email);
        }

        if (boardEmails.length > 0) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: boardEmails,
              subject: 'IN-NOLA Event Scanner PIN',
              html: `
                <h2>IN-NOLA Membership Scanner</h2>
                <p>A fresh PIN has been generated for the membership scanner at IN-NOLA events.</p>
                <p>If you're helping check memberships at an event, use these credentials to log in to the scanner on your phone:</p>
                <table style="margin: 20px 0; border-collapse: collapse;">
                  <tr><td style="padding: 8px 16px; font-weight: bold;">Username:</td><td style="padding: 8px 16px;">${user.username}</td></tr>
                  <tr><td style="padding: 8px 16px; font-weight: bold;">PIN:</td><td style="padding: 8px 16px; font-size: 1.2em; letter-spacing: 2px;">${newPin}</td></tr>
                </table>
                <h3 style="margin-top: 24px;">How to use the scanner:</h3>
                <ol style="line-height: 1.8;">
                  <li>Tap the button below to open the login page on your phone</li>
                  <li>Enter the username and PIN above</li>
                  <li>Allow camera access when prompted</li>
                  <li>Point your camera at a member's QR code to verify their membership</li>
                </ol>
                <p><a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #d4a726; color: #071a0e; text-decoration: none; border-radius: 8px; font-weight: bold;">Open Scanner Login</a></p>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">This PIN replaces any previous scanner PIN. It provides scanner-only access (no admin features).</p>
              `,
              text: `IN-NOLA Membership Scanner\n\nA fresh PIN has been generated for the membership scanner at IN-NOLA events.\n\nIf you're helping check memberships at an event, use these credentials:\n\nUsername: ${user.username}\nPIN: ${newPin}\n\nHow to use:\n1. Open the login page: ${loginUrl}\n2. Enter the username and PIN above\n3. Allow camera access when prompted\n4. Point your camera at a member's QR code to verify their membership\n\nThis PIN replaces any previous scanner PIN. It provides scanner-only access (no admin features).`,
            }),
          });
        }
      } else {
        // Regular user: send PIN only to that user
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [user.email],
            subject: 'Your IN-NOLA Login Credentials',
            html: `
              <h2>Your IN-NOLA Login</h2>
              <p>Hi ${user.displayName || user.username},</p>
              <p>Here are your login credentials for IN-NOLA:</p>
              <table style="margin: 20px 0; border-collapse: collapse;">
                <tr><td style="padding: 8px 16px; font-weight: bold;">Username:</td><td style="padding: 8px 16px;">${user.username}</td></tr>
                <tr><td style="padding: 8px 16px; font-weight: bold;">PIN:</td><td style="padding: 8px 16px; font-size: 1.2em; letter-spacing: 2px;">${newPin}</td></tr>
              </table>
              <p><a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #d4a726; color: #071a0e; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In Now</a></p>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">This PIN replaces any previous PIN. If you did not request this, you can ignore this email.</p>
            `,
            text: `Your IN-NOLA Login\n\nHi ${user.displayName || user.username},\n\nUsername: ${user.username}\nPIN: ${newPin}\n\nLog in at: ${loginUrl}\n\nThis PIN replaces any previous PIN. If you did not request this, you can ignore this email.`,
          }),
        });
      }
    }

    return genericResponse;

  } catch (err) {
    return genericResponse;
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
