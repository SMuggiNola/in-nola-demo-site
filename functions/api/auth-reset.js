/**
 * POST /api/auth-reset — Reset a board member's PIN and email it to them.
 *
 * Body: { email }
 *
 * Looks up the user by email, generates a new 6-digit PIN, updates the
 * hash in BOARD_KV, and sends the new PIN via Resend.
 *
 * Response is intentionally vague to prevent email enumeration.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomPin() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email } = await request.json();

    if (!email) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const kv = env.BOARD_KV;
    const resendKey = env.RESEND_API_KEY;

    if (!kv) {
      return Response.json(
        { error: 'KV not configured' },
        { status: 500, headers: corsHeaders }
      );
    }
    if (!resendKey) {
      return Response.json(
        { error: 'Email service not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Always return same message whether email found or not (prevent enumeration)
    const successMsg = { success: true, message: 'If that email is on file, a new PIN has been sent.' };

    const raw = await kv.get('admin_users');
    if (!raw) {
      return Response.json(successMsg, { headers: corsHeaders });
    }

    const users = JSON.parse(raw);
    const inputEmail = email.toLowerCase().trim();
    const userIndex = users.findIndex(u => u.email && u.email.toLowerCase() === inputEmail);

    if (userIndex === -1) {
      return Response.json(successMsg, { headers: corsHeaders });
    }

    const user = users[userIndex];

    // Generate new PIN and update hash
    const newPin = randomPin();
    const newSalt = generateSalt();
    const newHash = await hashPassword(newPin, newSalt);

    users[userIndex].passwordHash = newHash;
    users[userIndex].salt = newSalt;

    await kv.put('admin_users', JSON.stringify(users));

    // Send PIN via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IN-NOLA Tech <contact@in-nola.org>',
        to: [user.email],
        subject: 'Your IN-NOLA Admin PIN',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #0d2818;">Your New Admin PIN</h2>
            <p>Hi ${user.displayName},</p>
            <p>Here are your login credentials for the IN-NOLA Admin Portal:</p>
            <div style="background: #f0f7f0; border: 2px solid #169b62; border-radius: 8px; padding: 1.5rem; text-align: center; margin: 1.5rem 0;">
              <p style="margin: 0 0 0.5rem; color: #666;">Username</p>
              <p style="margin: 0 0 1rem; font-size: 1.4rem; font-weight: bold; color: #0d2818;">${user.username}</p>
              <p style="margin: 0 0 0.5rem; color: #666;">PIN</p>
              <p style="margin: 0; font-size: 2rem; font-weight: bold; letter-spacing: 0.3em; color: #0d2818;">${newPin}</p>
            </div>
            <p style="color: #666; font-size: 0.9rem;">Log in at the Admin Portal on the IN-NOLA website. If you didn't request this, please contact tech@in-nola.org.</p>
          </div>
        `,
        text: `Hi ${user.displayName},\n\nYour IN-NOLA Admin Portal credentials:\n\nUsername: ${user.username}\nPIN: ${newPin}\n\nIf you didn't request this, contact tech@in-nola.org.`,
      }),
    });

    return Response.json(successMsg, { headers: corsHeaders });

  } catch (err) {
    return Response.json(
      { error: 'Server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
