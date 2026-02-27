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

// ── helpers ── random 6-digit PIN ─────────────────────────────────────

function randomPin() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

// ── seed default users ────────────────────────────────────────────────

async function seedDefaultUsers(kv) {
  const defaults = [
    { username: 'mug.sea', plaintext: 'TADGHlina22', role: 'admin',   displayName: 'Seán Muggivan', boardId: 'sean',    email: 'sean@muggivanlcsw.me' },
    { username: 'kel.sha', plaintext: randomPin(),    role: 'board',   displayName: 'Shannon Kelly',  boardId: 'shannon', email: '' },
    { username: 'mar.eri', plaintext: randomPin(),    role: 'board',   displayName: 'Erin Marjorie',  boardId: 'erin',    email: '' },
    { username: 'jon.and', plaintext: randomPin(),    role: 'board',   displayName: 'Andrew Jones',   boardId: 'andrew',  email: 'ajones27@tulane.edu' },
    { username: 'mug.jon', plaintext: randomPin(),    role: 'board',   displayName: 'Joni Muggivan',  boardId: 'joni',    email: '' },
    { username: 'ken.col', plaintext: randomPin(),    role: 'board',   displayName: 'Colm Kennedy',   boardId: 'colm',    email: '' },
    { username: 'scanner', plaintext: randomPin(),    role: 'scanner', displayName: 'Scanner Kiosk',  boardId: null,      email: '' },
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
      displayName: d.displayName,
      boardId: d.boardId,
      email: d.email || '',
      createdAt: new Date().toISOString(),
    });
  }

  await kv.put('admin_users', JSON.stringify(users));

  // Save plaintext credentials so admin can retrieve them once
  const credentials = defaults.map(d => ({
    username: d.username,
    displayName: d.displayName,
    password: d.plaintext,
    role: d.role,
  }));
  await kv.put('admin_credentials', JSON.stringify(credentials));

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
        user: {
          username: user.username,
          role: user.role,
          displayName: user.displayName,
          boardId: user.boardId ?? null,
        },
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

// GET /api/auth?adminPassword=X — retrieve generated credentials (one-time, admin only)
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const url = new URL(request.url);
  const password = url.searchParams.get('adminPassword');

  if (password !== API_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const kv = env.BOARD_KV;
  if (!kv) {
    return Response.json({ error: 'Server configuration error' }, { status: 500, headers: corsHeaders });
  }

  const raw = await kv.get('admin_credentials');
  if (!raw) {
    return Response.json({ error: 'No credentials found. They may have already been retrieved and deleted.' }, { status: 404, headers: corsHeaders });
  }

  // Delete after reading so PINs aren't stored in plaintext forever
  await kv.delete('admin_credentials');

  return Response.json({ credentials: JSON.parse(raw) }, { headers: corsHeaders });
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
