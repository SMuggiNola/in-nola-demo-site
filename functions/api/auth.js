/**
 * Backend admin authentication endpoint.
 *
 * POST /api/auth — validate username + password/pin against BOARD_KV.
 *
 * Credentials are stored in BOARD_KV under key "admin_users" as an array of
 * user objects. On first call the default users are auto-seeded.
 *
 * Supports two auth methods:
 *   - Password: { username, password } — for mug.sea (permanent password)
 *   - PIN: { username, pin } — for board members (PIN delivered via email)
 *
 * Returns { success, user: { username, role, ... }, apiToken } on success.
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

// ── helpers ── HMAC signature for QR codes ──────────────────────────

async function generateSignature(memberId, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(memberId));
  const hashHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex.substring(0, 12);
}

// ── helpers ── generate member ID ───────────────────────────────────

function generateMemberId(existingIds, index) {
  const year = new Date().getFullYear();
  let num = index + 1;
  let id;
  do {
    id = `MEM-${year}-${String(num).padStart(3, '0')}`;
    num++;
  } while (existingIds.has(id));
  return id;
}

// ── seed default users ────────────────────────────────────────────────

async function seedDefaultUsers(kv, env) {
  const defaults = [
    { username: 'mug.sea', plaintext: 'TADGHlina22', role: 'architect', authMethod: 'password', displayName: 'Se\u00e1n Muggivan', boardId: 'sean',    email: 'sean@muggivanlcsw.me',        memberType: 'Board Member', joinDate: '2024-01-01', expirationDate: '2026-12-31' },
    { username: 'skelly',  plaintext: randomPin(),    role: 'board',     authMethod: 'pin',      displayName: 'Shannon Kelly',     boardId: 'shannon', email: 'shannonkelly.harp@gmail.com', memberType: 'Board Member', joinDate: '2024-01-01', expirationDate: '2026-12-31' },
    { username: 'ckennedy',plaintext: randomPin(),    role: 'board',     authMethod: 'pin',      displayName: 'Colm Kennedy',      boardId: 'colm',    email: 'colm.m.kennedy@gmail.com',    memberType: 'Board Member', joinDate: '2024-01-01', expirationDate: '2026-12-31' },
    { username: 'ajones',  plaintext: randomPin(),    role: 'board',     authMethod: 'pin',      displayName: 'Andrew Jones',      boardId: 'andrew',  email: 'ajones27@tulane.edu',         memberType: 'Board Member', joinDate: '2024-01-01', expirationDate: '2026-12-31' },
    { username: 'scanner',   plaintext: randomPin(),  role: 'scanner',   authMethod: 'pin',      displayName: 'Scanner',           boardId: null,      email: 'sean.muggivan@gmail.com',     memberType: null,           joinDate: null,         expirationDate: null },
  ];

  const memberSecret = env?.MEMBER_SECRET || 'default-dev-secret';
  const existingIds = new Set();
  const users = [];
  for (let i = 0; i < defaults.length; i++) {
    const d = defaults[i];
    const salt = generateSalt();
    const passwordHash = await hashPassword(d.plaintext, salt);

    // Generate membership fields for non-scanner roles
    let memberId = null;
    let qrSignature = null;
    if (d.memberType) {
      memberId = generateMemberId(existingIds, i);
      existingIds.add(memberId);
      qrSignature = await generateSignature(memberId, memberSecret);
    }

    users.push({
      username: d.username,
      passwordHash,
      salt,
      pin: d.authMethod === 'pin' ? d.plaintext : null,
      authMethod: d.authMethod,
      role: d.role,
      displayName: d.displayName,
      boardId: d.boardId,
      email: d.email || '',
      memberId,
      memberType: d.memberType || null,
      joinDate: d.joinDate || null,
      expirationDate: d.expirationDate || null,
      qrSignature,
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
    const body = await request.json();
    const { username, password, pin } = body;

    if (!username || (!password && !pin)) {
      return Response.json(
        { error: 'Username and password or PIN are required' },
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
      users = await seedDefaultUsers(kv, env);
    } else {
      users = JSON.parse(raw);

      // Migration: backfill fields, rename legacy users, ensure scanner exists
      const hasScanner = users.some(u => u.username === 'scanner' || u.username === 'smuggivan');
      const needsMigration = !hasScanner || users.some(u =>
        (u.role !== 'scanner' && u.memberId === undefined) ||
        u.role === 'admin' ||
        u.username === 'smuggivan'
      );
      if (needsMigration) {
        const memberSecret = env?.MEMBER_SECRET || 'default-dev-secret';
        const existingIds = new Set(users.filter(u => u.memberId).map(u => u.memberId));
        let idx = 0;
        for (const u of users) {
          if (u.memberId === undefined && u.role !== 'scanner') {
            u.memberId = generateMemberId(existingIds, idx);
            existingIds.add(u.memberId);
            u.qrSignature = await generateSignature(u.memberId, memberSecret);
            u.memberType = u.memberType || 'Board Member';
            u.joinDate = u.joinDate || '2024-01-01';
            u.expirationDate = u.expirationDate || '2026-12-31';
          }
          // Ensure scanner has null membership fields
          if (u.role === 'scanner' && u.memberId === undefined) {
            u.memberId = null;
            u.memberType = null;
            u.joinDate = null;
            u.expirationDate = null;
            u.qrSignature = null;
          }
          // Rename legacy 'admin' role to 'architect'
          if (u.role === 'admin') {
            u.role = 'architect';
          }
          // Rename legacy 'smuggivan' username to 'scanner'
          if (u.username === 'smuggivan') {
            u.username = 'scanner';
            u.displayName = 'Scanner';
          }
          idx++;
        }

        // Create scanner user if missing
        if (!hasScanner) {
          const pin = randomPin();
          const salt = generateSalt();
          const passwordHash = await hashPassword(pin, salt);
          users.push({
            username: 'scanner',
            passwordHash,
            salt,
            pin,
            authMethod: 'pin',
            role: 'scanner',
            displayName: 'Scanner',
            boardId: null,
            email: 'sean.muggivan@gmail.com',
            memberId: null,
            memberType: null,
            joinDate: null,
            expirationDate: null,
            qrSignature: null,
            createdAt: new Date().toISOString(),
          });
        }

        await kv.put('admin_users', JSON.stringify(users));
      }
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

    // Authenticate based on what was provided
    let authenticated = false;

    if (password) {
      // Password auth — verify against hash
      if (user.passwordHash) {
        const submittedHash = await hashPassword(password.trim(), user.salt);
        authenticated = (submittedHash === user.passwordHash);
      }
    }

    if (pin) {
      // PIN auth — verify against stored PIN
      if (user.pin && user.pin === pin.trim()) {
        authenticated = true;
      }
    }

    if (!authenticated) {
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
          memberId: user.memberId ?? null,
          memberType: user.memberType ?? null,
          joinDate: user.joinDate ?? null,
          expirationDate: user.expirationDate ?? null,
          qrSignature: user.qrSignature ?? null,
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
