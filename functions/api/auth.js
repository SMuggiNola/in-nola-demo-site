/**
 * Backend admin authentication endpoint.
 *
 * POST /api/auth — validate username + password against BOARD_KV.
 *
 * Credentials are stored in BOARD_KV under key "admin_users" as an array of
 * { username, passwordHash, salt, role, createdAt } objects.  On first call
 * the default users are auto-seeded.
 *
 * Returns { success, user: { username, role }, apiToken } on success.
 * The apiToken is the shared API password so existing endpoints keep working.
 */

const API_PASSWORD = 'innola2026!';

// ── helpers ────────────────────────────────────────────────────────────

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

// ── seed default users ────────────────────────────────────────────────

async function seedDefaultUsers(kv) {
  const defaults = [
    { username: 'mug.sea',      plaintext: 'TADGHlina22', role: 'admin' },
    { username: 'boardmember',  plaintext: 'innola2026!', role: 'board' },
  ];

  const users = [];
  for (const d of defaults) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(d.plaintext, salt);
    users.push({
      username: d.username,
      passwordHash,
      salt,
      role: d.role,
      createdAt: new Date().toISOString(),
    });
  }

  await kv.put('admin_users', JSON.stringify(users));
  return users;
}

// ── request handler ───────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: 'Username and password are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const kv = env.BOARD_KV;
    if (!kv) {
      return Response.json(
        { error: 'Server configuration error' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Load or seed admin users
    let raw = await kv.get('admin_users');
    let users;
    if (!raw) {
      users = await seedDefaultUsers(kv);
    } else {
      users = JSON.parse(raw);
    }

    // Find user (case-insensitive)
    const inputUsername = username.toLowerCase().trim();
    const user = users.find(u => u.username === inputUsername);

    if (!user) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify password
    const submittedHash = await hashPassword(password.trim(), user.salt);
    if (submittedHash !== user.passwordHash) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Success
    return Response.json(
      {
        success: true,
        user: { username: user.username, role: user.role },
        apiToken: API_PASSWORD,
      },
      { headers: corsHeaders }
    );

  } catch (err) {
    return Response.json(
      { error: 'Server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
