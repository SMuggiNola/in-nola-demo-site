// Members API - Cloudflare Pages Function
// Handles member import, login, verification, and QR generation
// Requires KV binding: MEMBERS_KV
// Requires secret: MEMBER_SECRET (32+ chars for HMAC signing)

const MEMBERS_KEY = 'all_members';

// Board member PINs - unified across the site (same as events.js)
const BOARD_MEMBER_PINS = {
  'shannon': '101010',
  'erin': '202020',
  'andrew': '303030',
  'joni': '404040',
  'colm': '505050',
  'sean': '606060'
};
const ADMIN_PINS = Object.values(BOARD_MEMBER_PINS);

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Generate HMAC-SHA256 signature using Web Crypto API
async function generateSignature(memberId, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(memberId)
  );

  // Convert to hex string (first 12 chars for compact QR)
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 12);
}

// Verify HMAC signature
async function verifySignature(memberId, sig, secret) {
  const expectedSig = await generateSignature(memberId, secret);
  return sig === expectedSig;
}

// Generate username from name (e.g., "John Murphy" -> "jmurphy")
function generateUsername(name, existingUsernames) {
  // Clean and split name
  const parts = name.trim().toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  if (parts.length === 0) return 'member' + Date.now();

  // First initial + last name
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  let baseUsername = firstName.charAt(0) + lastName;

  // Ensure uniqueness
  let username = baseUsername;
  let counter = 1;
  while (existingUsernames.has(username)) {
    username = baseUsername + counter;
    counter++;
  }

  return username;
}

// Generate random 6-digit PIN
function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Generate member ID
function generateMemberId(existingIds) {
  const year = new Date().getFullYear();
  let num = 1;
  let id;
  do {
    id = `MEM-${year}-${String(num).padStart(3, '0')}`;
    num++;
  } while (existingIds.has(id));
  return id;
}

// Parse CSV data
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header row and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const required = ['name', 'email', 'membertype', 'joindate', 'expirationdate'];

  for (const req of required) {
    if (!headers.includes(req)) {
      throw new Error(`Missing required column: ${req}`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

// Main request handler - route based on URL path
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Route to appropriate handler
  if (path === '/api/members/import' && request.method === 'POST') {
    return handleImport(request, env);
  }

  if (path === '/api/members/login' && request.method === 'POST') {
    return handleLogin(request, env);
  }

  if (path === '/api/members/verify' && request.method === 'GET') {
    return handleVerify(request, env);
  }

  if (path === '/api/members' && request.method === 'GET') {
    return handleList(request, env);
  }

  if (path === '/api/members/qr/batch' && request.method === 'POST') {
    return handleBatchQR(request, env);
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: corsHeaders
  });
}

// POST /api/members/import - Import members from CSV
async function handleImport(request, env) {
  try {
    if (!env.MEMBERS_KV) {
      return new Response(JSON.stringify({ error: 'MEMBERS_KV not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    if (!env.MEMBER_SECRET) {
      return new Response(JSON.stringify({ error: 'MEMBER_SECRET not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const body = await request.json();

    // Verify admin PIN
    if (!body.adminPin || !ADMIN_PINS.includes(body.adminPin)) {
      return new Response(JSON.stringify({ error: 'Invalid admin PIN' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    if (!body.csv || typeof body.csv !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing CSV data' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Parse CSV
    let rows;
    try {
      rows = parseCSV(body.csv);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get existing members
    let membersData = await env.MEMBERS_KV.get(MEMBERS_KEY, 'json');
    if (!membersData) {
      membersData = { members: [] };
    }

    // Build sets of existing usernames and IDs
    const existingUsernames = new Set(membersData.members.map(m => m.username));
    const existingIds = new Set(membersData.members.map(m => m.id));
    const existingEmails = new Set(membersData.members.map(m => m.email.toLowerCase()));

    const imported = [];
    const skipped = [];

    for (const row of rows) {
      const email = row.email.toLowerCase().trim();

      // Skip if email already exists
      if (existingEmails.has(email)) {
        skipped.push({ name: row.name, email, reason: 'Email already exists' });
        continue;
      }

      // Generate credentials
      const id = generateMemberId(existingIds);
      const username = generateUsername(row.name, existingUsernames);
      const pin = generatePin();
      const qrSignature = await generateSignature(id, env.MEMBER_SECRET);

      const member = {
        id,
        username,
        pin,
        name: row.name.trim(),
        email,
        memberType: row.membertype.trim(),
        joinDate: row.joindate.trim(),
        expirationDate: row.expirationdate.trim(),
        qrSignature,
        createdAt: new Date().toISOString()
      };

      membersData.members.push(member);
      existingUsernames.add(username);
      existingIds.add(id);
      existingEmails.add(email);

      imported.push({
        name: member.name,
        email: member.email,
        username: member.username,
        pin: member.pin,
        id: member.id
      });
    }

    // Save to KV
    await env.MEMBERS_KV.put(MEMBERS_KEY, JSON.stringify(membersData));

    return new Response(JSON.stringify({
      success: true,
      imported,
      skipped,
      totalMembers: membersData.members.length
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Import failed',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// POST /api/members/login - Authenticate member
async function handleLogin(request, env) {
  try {
    if (!env.MEMBERS_KV) {
      return new Response(JSON.stringify({ error: 'MEMBERS_KV not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const body = await request.json();
    const { username, pin } = body;

    if (!username || !pin) {
      return new Response(JSON.stringify({ error: 'Username and PIN required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get members
    const membersData = await env.MEMBERS_KV.get(MEMBERS_KEY, 'json');
    if (!membersData || !membersData.members) {
      return new Response(JSON.stringify({ error: 'Invalid username or PIN' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Find member by username (case-insensitive)
    const member = membersData.members.find(
      m => m.username.toLowerCase() === username.toLowerCase()
    );

    if (!member || member.pin !== pin) {
      return new Response(JSON.stringify({ error: 'Invalid username or PIN' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Return member data (excluding sensitive fields)
    return new Response(JSON.stringify({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        memberType: member.memberType,
        joinDate: member.joinDate,
        expirationDate: member.expirationDate,
        qrSignature: member.qrSignature
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Login failed',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// GET /api/members/verify?id=MEM-2025-001&sig=abc123 - Verify QR code
async function handleVerify(request, env) {
  try {
    if (!env.MEMBERS_KV || !env.MEMBER_SECRET) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'error',
        message: 'Server not configured'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const sig = url.searchParams.get('sig');

    if (!id || !sig) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'invalid',
        message: 'Missing ID or signature'
      }), {
        headers: corsHeaders
      });
    }

    // Verify signature
    const validSig = await verifySignature(id, sig, env.MEMBER_SECRET);
    if (!validSig) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'invalid',
        message: 'Invalid QR code signature - possible tampering'
      }), {
        headers: corsHeaders
      });
    }

    // Get member from database
    const membersData = await env.MEMBERS_KV.get(MEMBERS_KEY, 'json');
    if (!membersData || !membersData.members) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'invalid',
        message: 'Member not found'
      }), {
        headers: corsHeaders
      });
    }

    const member = membersData.members.find(m => m.id === id);
    if (!member) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'invalid',
        message: 'Member not found in database'
      }), {
        headers: corsHeaders
      });
    }

    // Check expiration
    const expirationDate = new Date(member.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expirationDate < today) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'expired',
        message: 'Membership has expired',
        member: {
          id: member.id,
          name: member.name,
          type: member.memberType,
          expiredOn: member.expirationDate
        }
      }), {
        headers: corsHeaders
      });
    }

    // Valid!
    return new Response(JSON.stringify({
      valid: true,
      status: 'valid',
      message: 'Member in Good Standing',
      member: {
        id: member.id,
        name: member.name,
        type: member.memberType,
        validUntil: member.expirationDate
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      status: 'error',
      message: 'Verification failed'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// GET /api/members?adminPin=123456 - List all members (admin only)
async function handleList(request, env) {
  try {
    if (!env.MEMBERS_KV) {
      return new Response(JSON.stringify({ error: 'MEMBERS_KV not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const adminPin = url.searchParams.get('adminPin');

    if (!adminPin || !ADMIN_PINS.includes(adminPin)) {
      return new Response(JSON.stringify({ error: 'Invalid admin PIN' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const membersData = await env.MEMBERS_KV.get(MEMBERS_KEY, 'json');
    if (!membersData || !membersData.members) {
      return new Response(JSON.stringify({ members: [] }), {
        headers: corsHeaders
      });
    }

    // Return members without PINs
    const members = membersData.members.map(m => ({
      id: m.id,
      username: m.username,
      name: m.name,
      email: m.email,
      memberType: m.memberType,
      joinDate: m.joinDate,
      expirationDate: m.expirationDate,
      qrSignature: m.qrSignature
    }));

    return new Response(JSON.stringify({ members }), {
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to list members',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// POST /api/members/qr/batch - Generate QR data for selected members
async function handleBatchQR(request, env) {
  try {
    if (!env.MEMBERS_KV) {
      return new Response(JSON.stringify({ error: 'MEMBERS_KV not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const body = await request.json();

    if (!body.adminPin || !ADMIN_PINS.includes(body.adminPin)) {
      return new Response(JSON.stringify({ error: 'Invalid admin PIN' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    if (!body.memberIds || !Array.isArray(body.memberIds)) {
      return new Response(JSON.stringify({ error: 'memberIds array required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const membersData = await env.MEMBERS_KV.get(MEMBERS_KEY, 'json');
    if (!membersData || !membersData.members) {
      return new Response(JSON.stringify({ error: 'No members found' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const qrData = [];
    for (const id of body.memberIds) {
      const member = membersData.members.find(m => m.id === id);
      if (member) {
        qrData.push({
          id: member.id,
          name: member.name,
          memberType: member.memberType,
          qrString: JSON.stringify({
            v: 1,
            id: member.id,
            sig: member.qrSignature
          })
        });
      }
    }

    return new Response(JSON.stringify({ qrData }), {
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to generate QR data',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
