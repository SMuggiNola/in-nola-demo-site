// Members API - Cloudflare Pages Function
// Handles member import, verification, and QR generation
// Uses BOARD_KV (admin_users) as the unified auth store
// Login removed — all login goes through /api/auth

const ADMIN_USERS_KEY = 'admin_users';

// Shared admin password for all board member actions
const ADMIN_PASSWORD = 'innola2026!';

// CORS headers helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ── Password hashing (same as auth.js) ──────────────────────────────

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

// Generate username from name (e.g., "John Murphy" -> "mur.joh")
function generateUsername(name, existingUsernames) {
  // Clean and split name
  const parts = name.trim().toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  if (parts.length === 0) return 'member' + Date.now();

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const last3 = lastName.slice(0, 3);
  const first3 = firstName.slice(0, 3);
  let baseUsername = last3 + '.' + first3;

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

// Parse CSV line handling quoted values
function parseCSVLine(line) {
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
  return values;
}

// Parse date from various formats (Google Form timestamps, ISO dates, etc.)
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Try parsing as-is first (ISO format)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // Try MM/DD/YYYY format (Google Forms)
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    // Assume M/D/Y format
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;

    date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  return dateStr; // Return as-is if we can't parse
}

// Extract year from membership column header (e.g., "Annual Membership 2026" -> 2026)
function extractYearFromHeader(header) {
  const match = header.match(/20\d{2}/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
}

// Parse CSV data - supports both standard format and Google Form export
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header row and at least one data row');
  }

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => h.trim().toLowerCase());

  // Detect format: Google Form vs Standard
  const isGoogleForm = headers.some(h => h.includes('first name') || h === 'first name') &&
                       headers.some(h => h.includes('last name') || h === 'last name');

  const isStandardFormat = headers.includes('name') && headers.includes('membertype');

  if (!isGoogleForm && !isStandardFormat) {
    throw new Error('Unrecognized CSV format. Expected either Google Form export (Timestamp, Email, First Name, Last Name, Membership) or standard format (name, email, memberType, joinDate, expirationDate)');
  }

  // Find membership year from header if Google Form format
  let membershipYear = new Date().getFullYear();
  if (isGoogleForm) {
    const membershipHeader = rawHeaders.find(h =>
      h.toLowerCase().includes('membership') ||
      h.toLowerCase().includes('annual')
    );
    if (membershipHeader) {
      membershipYear = extractYearFromHeader(membershipHeader);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    const rawRow = {};
    headers.forEach((header, idx) => {
      rawRow[header] = values[idx] || '';
    });

    // Normalize to standard format
    let row;
    if (isGoogleForm) {
      // Find the relevant columns (flexible matching)
      const timestamp = rawRow['timestamp'] || rawRow['submitted'] || '';
      const email = rawRow['email'] || rawRow['email address'] || '';
      const firstName = rawRow['first name'] || '';
      const lastName = rawRow['last name'] || '';

      // Find membership type column (might have year in name)
      let memberType = 'Individual';
      for (const [key, value] of Object.entries(rawRow)) {
        if (key.includes('membership') || key.includes('annual')) {
          memberType = value || 'Individual';
          break;
        }
      }

      // Map common membership values
      if (memberType.toLowerCase().includes('student')) {
        memberType = 'Student';
      } else if (memberType.toLowerCase().includes('adult')) {
        memberType = 'Member';
      } else if (memberType.toLowerCase().includes('family')) {
        memberType = 'Family';
      } else if (memberType.toLowerCase().includes('lifetime')) {
        memberType = 'Lifetime';
      }

      row = {
        name: `${firstName} ${lastName}`.trim(),
        email: email,
        membertype: memberType,
        joindate: parseDate(timestamp) || new Date().toISOString().split('T')[0],
        expirationdate: `${membershipYear}-12-31`
      };
    } else {
      // Standard format - just normalize keys
      row = {
        name: rawRow['name'] || '',
        email: rawRow['email'] || '',
        membertype: rawRow['membertype'] || 'Individual',
        joindate: rawRow['joindate'] || new Date().toISOString().split('T')[0],
        expirationdate: rawRow['expirationdate'] || `${new Date().getFullYear()}-12-31`
      };
    }

    // Skip rows without required fields
    if (!row.name || !row.email) {
      continue;
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error('No valid member rows found in CSV');
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

  // Login removed — all login goes through /api/auth

  if (path === '/api/members/verify' && request.method === 'GET') {
    return handleVerify(request, env);
  }

  if (path === '/api/members' && request.method === 'GET') {
    return handleList(request, env);
  }

  if (path === '/api/members/qr/batch' && request.method === 'POST') {
    return handleBatchQR(request, env);
  }

  if (path === '/api/members/send-credentials' && request.method === 'POST') {
    return handleSendCredentials(request, env);
  }

  if (path === '/api/members/admin-update' && request.method === 'POST') {
    return handleAdminUpdate(request, env);
  }

  if (path === '/api/members/roster' && request.method === 'POST') {
    return handleRosterAdd(request, env);
  }

  if (path === '/api/members/roster' && request.method === 'DELETE') {
    return handleRosterDelete(request, env);
  }

  if (path === '/api/members/send-setup' && request.method === 'POST') {
    return handleSendSetup(request, env);
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: corsHeaders
  });
}

// POST /api/members/import - Import members from CSV into BOARD_KV
async function handleImport(request, env) {
  try {
    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({ error: 'BOARD_KV not configured' }), {
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

    // Verify admin password
    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
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

    // Load existing users from BOARD_KV
    let raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    let users = raw ? JSON.parse(raw) : [];

    // Build sets of existing usernames, member IDs, and emails
    const existingUsernames = new Set(users.map(u => u.username));
    const existingMemberIds = new Set(users.filter(u => u.memberId).map(u => u.memberId));
    const existingEmails = new Set(users.filter(u => u.email).map(u => u.email.toLowerCase()));

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
      const memberId = generateMemberId(existingMemberIds);
      const username = generateUsername(row.name, existingUsernames);
      const pin = generatePin();
      const qrSignature = await generateSignature(memberId, env.MEMBER_SECRET);

      // Hash the PIN (not stored in plaintext)
      const salt = generateSalt();
      const passwordHash = await hashPassword(pin, salt);

      const user = {
        username,
        passwordHash,
        salt,
        role: 'member',
        displayName: row.name.trim(),
        boardId: null,
        email,
        memberId,
        memberType: row.membertype.trim(),
        joinDate: row.joindate.trim(),
        expirationDate: row.expirationdate.trim(),
        qrSignature,
        createdAt: new Date().toISOString(),
      };

      users.push(user);
      existingUsernames.add(username);
      existingMemberIds.add(memberId);
      existingEmails.add(email);

      imported.push({
        name: user.displayName,
        email: user.email,
        username: user.username,
        pin,  // Return plaintext PIN only in import response
        id: user.memberId
      });
    }

    // Save to BOARD_KV
    await env.BOARD_KV.put(ADMIN_USERS_KEY, JSON.stringify(users));

    const memberCount = users.filter(u => u.memberId).length;

    return new Response(JSON.stringify({
      success: true,
      imported,
      skipped,
      totalMembers: memberCount
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

// GET /api/members/verify?id=MEM-2025-001&sig=abc123 - Verify QR code
async function handleVerify(request, env) {
  try {
    if (!env.BOARD_KV || !env.MEMBER_SECRET) {
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

    // Get user from BOARD_KV by memberId
    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    if (!raw) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'invalid',
        message: 'Member not found'
      }), {
        headers: corsHeaders
      });
    }

    const users = JSON.parse(raw);
    const user = users.find(u => u.memberId === id);
    if (!user) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'invalid',
        message: 'Member not found in database'
      }), {
        headers: corsHeaders
      });
    }

    // Check expiration
    const expirationDate = new Date(user.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expirationDate < today) {
      return new Response(JSON.stringify({
        valid: false,
        status: 'expired',
        message: 'Membership has expired',
        member: {
          id: user.memberId,
          name: user.displayName,
          type: user.memberType,
          expiredOn: user.expirationDate
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
        id: user.memberId,
        name: user.displayName,
        type: user.memberType,
        validUntil: user.expirationDate
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

// GET /api/members?adminPassword=xxx - List all members (admin only)
async function handleList(request, env) {
  try {
    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({ error: 'BOARD_KV not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const adminPassword = url.searchParams.get('adminPassword');

    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    if (!raw) {
      return new Response(JSON.stringify({ members: [] }), {
        headers: corsHeaders
      });
    }

    const users = JSON.parse(raw);

    // Return only users with memberId (all roles that have membership)
    const members = users
      .filter(u => u.memberId)
      .map(u => ({
        id: u.memberId,
        username: u.username,
        name: u.displayName,
        email: u.email,
        memberType: u.memberType,
        joinDate: u.joinDate,
        expirationDate: u.expirationDate,
        qrSignature: u.qrSignature,
        paid: u.paid || false,
        setupEmailSent: u.setupEmailSent || false
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
    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({ error: 'BOARD_KV not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
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

    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'No members found' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const users = JSON.parse(raw);

    const qrData = [];
    for (const id of body.memberIds) {
      const user = users.find(u => u.memberId === id);
      if (user) {
        qrData.push({
          id: user.memberId,
          name: user.displayName,
          memberType: user.memberType,
          qrString: JSON.stringify({
            v: 1,
            id: user.memberId,
            sig: user.qrSignature
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

// POST /api/members/send-credentials - Email credentials to member
async function handleSendCredentials(request, env) {
  try {
    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Always return same message regardless of whether email exists
    const genericResponse = new Response(JSON.stringify({
      success: true,
      message: 'If this email is registered, your credentials have been sent.'
    }), { headers: corsHeaders });

    // Look up member by email in BOARD_KV (flat array of users)
    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    if (!raw) {
      return genericResponse;
    }

    const users = JSON.parse(raw);
    const member = users.find(
      u => u.email && u.email.toLowerCase() === email && u.memberId
    );

    if (!member) {
      return genericResponse;
    }

    // Never overwrite password-auth users (e.g. mug.sea)
    if (member.authMethod === 'password') {
      return genericResponse;
    }

    // Generate a fresh PIN and hash it
    const newPin = generatePin();
    const salt = generateSalt();
    member.passwordHash = await hashPassword(newPin, salt);
    member.salt = salt;
    member.pin = newPin;

    // Save updated users
    await env.BOARD_KV.put(ADMIN_USERS_KEY, JSON.stringify(users));

    // Send email via Resend
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const FROM_EMAIL = 'IN-NOLA Tech <tech@in-nola.org>';

    if (RESEND_API_KEY) {
      const loginUrl = 'https://in-nola.org/membership-tools/';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [member.email],
          subject: 'Your IN-NOLA Login Credentials',
          html: `
            <h2>Your IN-NOLA Member Login</h2>
            <p>Hi ${member.displayName},</p>
            <p>Here are your login credentials for the IN-NOLA Member Portal:</p>
            <table style="margin: 20px 0; border-collapse: collapse;">
              <tr><td style="padding: 8px 16px; font-weight: bold;">Username:</td><td style="padding: 8px 16px;">${member.username}</td></tr>
              <tr><td style="padding: 8px 16px; font-weight: bold;">PIN:</td><td style="padding: 8px 16px; font-size: 1.2em; letter-spacing: 2px;">${newPin}</td></tr>
            </table>
            <p><a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background: #d4a726; color: #071a0e; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In Now</a></p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">This PIN replaces any previous PIN. If you did not request this, you can ignore this email.</p>
          `,
          text: `Your IN-NOLA Member Login\n\nHi ${member.displayName},\n\nUsername: ${member.username}\nPIN: ${newPin}\n\nLog in at: ${loginUrl}\n\nThis PIN replaces any previous PIN. If you did not request this, you can ignore this email.`,
        }),
      });
    }

    return genericResponse;

  } catch (error) {
    return new Response(JSON.stringify({
      success: true,
      message: 'If this email is registered, your credentials have been sent.'
    }), { headers: corsHeaders });
  }
}

// POST /api/members/admin-update - Update or delete members (admin only)
async function handleAdminUpdate(request, env) {
  try {
    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({ error: 'BOARD_KV not configured' }), {
        status: 500, headers: corsHeaders
      });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401, headers: corsHeaders
      });
    }

    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'No members found' }), {
        status: 404, headers: corsHeaders
      });
    }

    let users = JSON.parse(raw);

    // Delete members by memberId
    if (body.deleteIds && Array.isArray(body.deleteIds)) {
      const deleteSet = new Set(body.deleteIds);
      users = users.filter(u => !deleteSet.has(u.memberId));
    }

    // Delete members by username
    if (body.deleteUsernames && Array.isArray(body.deleteUsernames)) {
      const deleteSet = new Set(body.deleteUsernames);
      users = users.filter(u => !deleteSet.has(u.username));
    }

    // Update member fields by memberId
    if (body.updates && Array.isArray(body.updates)) {
      for (const update of body.updates) {
        const user = users.find(u => u.memberId === update.id);
        if (user) {
          for (const [key, value] of Object.entries(update)) {
            if (key !== 'id') user[key] = value;
          }
        }
      }
    }

    // Add new users
    if (body.addUsers && Array.isArray(body.addUsers)) {
      for (const newUser of body.addUsers) {
        if (!newUser.username) continue;
        // Skip if username already exists
        if (users.some(u => u.username === newUser.username)) continue;
        const pin = newUser.pin || generatePin();
        const salt = generateSalt();
        const passwordHash = await hashPassword(pin, salt);
        users.push({
          username: newUser.username,
          passwordHash,
          salt,
          pin,
          authMethod: newUser.authMethod || 'pin',
          role: newUser.role || 'member',
          displayName: newUser.displayName || newUser.username,
          boardId: newUser.boardId || null,
          email: newUser.email || '',
          memberId: newUser.memberId || null,
          memberType: newUser.memberType || null,
          joinDate: newUser.joinDate || null,
          expirationDate: newUser.expirationDate || null,
          qrSignature: null,
          createdAt: new Date().toISOString(),
        });
      }
    }

    await env.BOARD_KV.put(ADMIN_USERS_KEY, JSON.stringify(users));

    const memberCount = users.filter(u => u.memberId).length;

    return new Response(JSON.stringify({
      success: true,
      totalMembers: memberCount
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Update failed',
      details: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

// POST /api/members/roster - Add a single member from admin portal
async function handleRosterAdd(request, env) {
  try {
    if (!env.BOARD_KV || !env.MEMBER_SECRET) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500, headers: corsHeaders
      });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401, headers: corsHeaders
      });
    }

    const name = (body.name || '').trim();
    const email = (body.email || '').toLowerCase().trim();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Name and email are required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    let users = raw ? JSON.parse(raw) : [];

    // Check for duplicate email
    if (users.some(u => u.email && u.email.toLowerCase() === email)) {
      return new Response(JSON.stringify({ error: 'A member with this email already exists' }), {
        status: 409, headers: corsHeaders
      });
    }

    const existingUsernames = new Set(users.map(u => u.username));
    const existingMemberIds = new Set(users.filter(u => u.memberId).map(u => u.memberId));

    const memberId = generateMemberId(existingMemberIds);
    const username = generateUsername(name, existingUsernames);
    const pin = generatePin();
    const qrSignature = await generateSignature(memberId, env.MEMBER_SECRET);
    const salt = generateSalt();
    const passwordHash = await hashPassword(pin, salt);
    const today = new Date().toISOString().split('T')[0];

    const user = {
      username,
      passwordHash,
      salt,
      role: 'member',
      displayName: name,
      boardId: null,
      email,
      memberId,
      memberType: body.memberType || 'Member',
      joinDate: today,
      expirationDate: '2026-12-31',
      qrSignature,
      paid: body.paid || false,
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await env.BOARD_KV.put(ADMIN_USERS_KEY, JSON.stringify(users));

    return new Response(JSON.stringify({
      success: true,
      member: { name, email, username, pin, memberId }
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to add member', details: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

// DELETE /api/members/roster - Remove a member by memberId (mug.sea only)
async function handleRosterDelete(request, env) {
  try {
    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500, headers: corsHeaders
      });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401, headers: corsHeaders
      });
    }

    // Only mug.sea can remove members
    if (!body.username || body.username !== 'mug.sea') {
      return new Response(JSON.stringify({
        error: 'Only tech admin can remove members. Please email tech@in-nola.org with the member name and reason for removal.'
      }), { status: 403, headers: corsHeaders });
    }

    // Require a reason/comment for removal
    if (!body.comment || !body.comment.trim()) {
      return new Response(JSON.stringify({ error: 'A reason for removal is required' }), {
        status: 400, headers: corsHeaders
      });
    }

    if (!body.memberId) {
      return new Response(JSON.stringify({ error: 'memberId is required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'No members found' }), {
        status: 404, headers: corsHeaders
      });
    }

    let users = JSON.parse(raw);
    const target = users.find(u => u.memberId === body.memberId);

    if (!target) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404, headers: corsHeaders
      });
    }

    // Safety: only delete role=member users (not board members)
    if (target.role !== 'member') {
      return new Response(JSON.stringify({ error: 'Cannot remove board members from roster' }), {
        status: 403, headers: corsHeaders
      });
    }

    users = users.filter(u => u.memberId !== body.memberId);
    await env.BOARD_KV.put(ADMIN_USERS_KEY, JSON.stringify(users));

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to remove member', details: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

// POST /api/members/send-setup - Send welcome/setup email to a member
async function handleSendSetup(request, env) {
  try {
    if (!env.BOARD_KV) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500, headers: corsHeaders
      });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401, headers: corsHeaders
      });
    }

    if (!body.memberId) {
      return new Response(JSON.stringify({ error: 'memberId is required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'No members found' }), {
        status: 404, headers: corsHeaders
      });
    }

    const users = JSON.parse(raw);
    const member = users.find(u => u.memberId === body.memberId);

    if (!member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404, headers: corsHeaders
      });
    }

    // Never overwrite password-auth users (e.g. mug.sea)
    if (member.authMethod === 'password') {
      return new Response(JSON.stringify({ error: 'This account uses password auth and cannot be sent a setup email' }), {
        status: 400, headers: corsHeaders
      });
    }

    // Generate a fresh PIN
    const newPin = generatePin();
    const salt = generateSalt();
    member.passwordHash = await hashPassword(newPin, salt);
    member.salt = salt;

    // Mark setup email as sent
    member.setupEmailSent = true;
    member.setupEmailSentAt = new Date().toISOString();

    await env.BOARD_KV.put(ADMIN_USERS_KEY, JSON.stringify(users));

    // Send welcome email via Resend
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const FROM_EMAIL = 'IN-NOLA Tech <tech@in-nola.org>';

    if (RESEND_API_KEY) {
      const siteUrl = 'https://in-nola.org';
      const loginUrl = 'https://in-nola.org/membership-tools/';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [member.email],
          subject: '\u2618\uFE0F Welcome to IN-NOLA \u2014 You\u2019re In!',
          html: `
            <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; background: #0d2818; border-radius: 16px; overflow: hidden;">
              <!-- Header banner -->
              <div style="background: linear-gradient(135deg, #0d2818 0%, #1a4d2e 50%, #0d2818 100%); padding: 35px 30px; text-align: center; border-bottom: 3px solid #d4a726;">
                <div style="font-size: 42px; line-height: 1;">&#9752;&#65039;</div>
                <h1 style="color: #d4a726; font-size: 28px; margin: 12px 0 4px; font-family: Georgia, serif; letter-spacing: 1px;">C\u00e9ad M\u00edle F\u00e1ilte!</h1>
                <p style="color: #8fbc8f; font-size: 14px; margin: 0; font-style: italic;">A Hundred Thousand Welcomes</p>
              </div>

              <!-- Body -->
              <div style="padding: 30px; color: #e8e8e8; line-height: 1.6;">
                <p style="font-size: 18px; margin-top: 0;">Hi <strong style="color: #d4a726;">${member.displayName}</strong>,</p>
                <p>Welcome to the <strong>Irish Network New Orleans</strong> family! Your member portal is set up and ready to go.</p>

                <!-- Credentials card -->
                <div style="background: linear-gradient(135deg, #1a4d2e, #2d6b45); border: 2px solid #d4a726; border-radius: 12px; padding: 20px 25px; margin: 25px 0; text-align: center;">
                  <div style="font-size: 20px; margin-bottom: 8px;">&#9752;&#65039; Your Login Credentials &#9752;&#65039;</div>
                  <table style="margin: 15px auto; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 15px; text-align: right; color: #8fbc8f; font-size: 14px;">Username</td>
                      <td style="padding: 8px 15px; text-align: left; font-family: 'Courier New', monospace; font-size: 20px; color: #fff; letter-spacing: 1px; font-weight: bold;">${member.username}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 15px; text-align: right; color: #8fbc8f; font-size: 14px;">PIN</td>
                      <td style="padding: 8px 15px; text-align: left; font-family: 'Courier New', monospace; font-size: 24px; color: #d4a726; letter-spacing: 4px; font-weight: bold;">${newPin}</td>
                    </tr>
                  </table>
                </div>

                <!-- How to log in -->
                <h3 style="color: #d4a726; font-family: Georgia, serif; font-size: 18px; margin-bottom: 8px;">&#9752;&#65039; How to Log In</h3>
                <p>Visit <a href="${siteUrl}" style="color: #d4a726; text-decoration: underline;">in-nola.org</a> and look for the <strong style="color: #4ade80;">shamrock &#9752;&#65039; &ldquo;Member Login&rdquo; button</strong> in the bottom-right corner. Or go straight there:</p>
                <p style="text-align: center; margin: 20px 0;">
                  <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: #d4a726; color: #0d2818; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; font-family: Georgia, serif; letter-spacing: 0.5px;">&#9752;&#65039; Open Member Portal</a>
                </p>

                <!-- What you'll find -->
                <h3 style="color: #d4a726; font-family: Georgia, serif; font-size: 18px; margin-bottom: 8px;">&#9752;&#65039; What You&rsquo;ll Find</h3>
                <table style="margin: 10px 0 20px; border-collapse: collapse;">
                  <tr><td style="padding: 6px 10px; font-size: 20px; vertical-align: middle;">&#127891;</td><td style="padding: 6px 10px; color: #e8e8e8;">Your <strong>digital membership card</strong></td></tr>
                  <tr><td style="padding: 6px 10px; font-size: 20px; vertical-align: middle;">&#128242;</td><td style="padding: 6px 10px; color: #e8e8e8;">Your <strong>personal QR code</strong> for event check-ins</td></tr>
                </table>

                <!-- PIN replacement -->
                <h3 style="color: #d4a726; font-family: Georgia, serif; font-size: 18px; margin-bottom: 8px;">&#9752;&#65039; Need a New PIN?</h3>
                <p>No worries! Visit the login page and tap <strong style="color: #4ade80;">&ldquo;Replace My PIN&rdquo;</strong>. A fresh one will be emailed to you instantly &mdash; no need to contact anyone.</p>

                <!-- Divider -->
                <div style="border-top: 1px solid #2d6b45; margin: 30px 0 20px;"></div>

                <!-- Shamrock row -->
                <p style="text-align: center; font-size: 24px; margin: 0 0 15px; letter-spacing: 12px;">&#9752;&#65039;&#9752;&#65039;&#9752;&#65039;</p>

                <p style="text-align: center; color: #8fbc8f; font-size: 13px; font-style: italic; margin: 0;">&ldquo;There are no strangers here, only friends you haven&rsquo;t yet met.&rdquo;</p>
                <p style="text-align: center; color: #6b8f6b; font-size: 12px; margin: 4px 0 20px;">&mdash; W.B. Yeats</p>

                <p style="text-align: center; color: #6b8f6b; font-size: 12px; margin: 0;">Questions? Email <a href="mailto:tech@in-nola.org" style="color: #d4a726;">tech@in-nola.org</a></p>
              </div>
            </div>
          `,
          text: `Cead Mile Failte! (A Hundred Thousand Welcomes)\n\nHi ${member.displayName},\n\nWelcome to the Irish Network New Orleans family! Your member portal is set up and ready.\n\nYour Login Credentials:\n  Username: ${member.username}\n  PIN: ${newPin}\n\nHow to Log In:\nVisit ${siteUrl} and look for the shamrock "Member Login" button in the bottom-right corner, or go directly to ${loginUrl}\n\nWhat You'll Find:\n- Your digital membership card\n- Your personal QR code for event check-ins\n\nNeed a New PIN?\nVisit the login page and click "Replace My PIN". A new PIN will be emailed to you right away.\n\n"There are no strangers here, only friends you haven't yet met." - W.B. Yeats\n\nQuestions? Email tech@in-nola.org`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to send setup email', details: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}
