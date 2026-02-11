// Members API - Cloudflare Pages Function
// Handles member import, login, verification, and QR generation
// Requires KV binding: MEMBERS_KV
// Requires secret: MEMBER_SECRET (32+ chars for HMAC signing)

const MEMBERS_KEY = 'all_members';

// Shared admin password for all board member actions
const ADMIN_PASSWORD = 'innola2026!';

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
        memberType = 'Adult';
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

// GET /api/members?adminPassword=xxx - List all members (admin only)
async function handleList(request, env) {
  try {
    if (!env.MEMBERS_KV) {
      return new Response(JSON.stringify({ error: 'MEMBERS_KV not configured' }), {
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
