/**
 * POST /api/auth/send-credentials
 *
 * Looks up an admin user by email, generates a fresh PIN, saves it,
 * and emails the credentials via Resend.
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
    if (!kv) {
      return Response.json(
        { success: false, debug: 'no_kv' },
        { headers: corsHeaders }
      );
    }

    // Load admin users
    const raw = await kv.get('admin_users');
    if (!raw) {
      return Response.json(
        { success: false, debug: 'no_admin_users_key' },
        { headers: corsHeaders }
      );
    }

    const users = JSON.parse(raw);

    // Find user by email (case-insensitive)
    const user = users.find(u => u.email && u.email.toLowerCase() === email);

    if (!user) {
      // Show what emails exist for debugging
      const emails = users.map(u => u.email || '(none)');
      return Response.json(
        { success: false, debug: 'user_not_found', searched: email, available: emails },
        { headers: corsHeaders }
      );
    }

    // Only generate PINs for PIN-auth users
    if (user.authMethod !== 'pin') {
      return Response.json(
        { success: false, debug: 'not_pin_auth', authMethod: user.authMethod, username: user.username },
        { headers: corsHeaders }
      );
    }

    // Generate a fresh PIN and save
    const newPin = generatePin();
    user.pin = newPin;
    await kv.put('admin_users', JSON.stringify(users));

    // Send email via Resend
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const FROM_EMAIL = env.RESEND_FROM_EMAIL || 'IN-NOLA <contact@in-nola.org>';

    if (!RESEND_API_KEY) {
      return Response.json(
        { success: false, debug: 'no_resend_key' },
        { headers: corsHeaders }
      );
    }

    const loginUrl = 'https://in-nola-demo-site.pages.dev/admin-portal/';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject: 'Your IN-NOLA Admin Login Credentials',
        html: `
          <h2>Your IN-NOLA Admin Login</h2>
          <p>Hi ${user.displayName || user.username},</p>
          <p>Here are your login credentials for the IN-NOLA Admin Portal:</p>
          <table style="margin: 20px 0; border-collapse: collapse;">
            <tr><td style="padding: 8px 16px; font-weight: bold;">Username:</td><td style="padding: 8px 16px;">${user.username}</td></tr>
            <tr><td style="padding: 8px 16px; font-weight: bold;">PIN:</td><td style="padding: 8px 16px; font-size: 1.2em; letter-spacing: 2px;">${newPin}</td></tr>
          </table>
          <p><a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #d4a726; color: #071a0e; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In Now</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">This PIN replaces any previous PIN. If you did not request this, you can ignore this email.</p>
        `,
        text: `Your IN-NOLA Admin Login\n\nHi ${user.displayName || user.username},\n\nUsername: ${user.username}\nPIN: ${newPin}\n\nLog in at: ${loginUrl}\n\nThis PIN replaces any previous PIN. If you did not request this, you can ignore this email.`,
      }),
    });

    const emailResult = await emailRes.json();

    return Response.json(
      { success: emailRes.ok, debug: { resendStatus: emailRes.status, resendResult: emailResult, from: FROM_EMAIL, to: user.email, username: user.username } },
      { headers: corsHeaders }
    );

  } catch (err) {
    return Response.json(
      { success: false, debug: { error: err.message } },
      { headers: corsHeaders }
    );
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
