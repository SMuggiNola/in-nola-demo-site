// Seanchas API — Cloudflare Pages Function (catch-all router)
//
// An Seanchas — the community's holding of stories. Each entry is a scéal.
// Scéalta have per-story visibility:
//   'public'  — anyone visiting the site may read (default)
//   'members' — any logged-in IN-NOLA member may read
//   'shared'  — the author + the specific members they granted read access
//   'private' — only the author (and the site owner/architect)
//
// Routes:
//   GET    /api/seanchas            → list PUBLIC scéalta only (safe for anyone)
//   POST   /api/seanchas            → add a scéal (logged-in active member)
//   POST   /api/seanchas/feed       → list scéalta the logged-in viewer may read
//   POST   /api/seanchas/directory  → member list for the "share with" picker
//   PUT    /api/seanchas            → edit a scéal (author, or board/architect)
//   DELETE /api/seanchas            → remove a scéal (author, or board/architect)
//
// Requires KV bindings: SEANCHAS_KV (stories) and BOARD_KV (member identities).

const SEANCHAS_KEY = 'all_scealta';
const ADMIN_USERS_KEY = 'admin_users';
// Shared session token issued to every logged-in user by /api/auth.
const ADMIN_PASSWORD = 'innola2026!';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ── identity ──────────────────────────────────────────────────────────

// Resolve the logged-in viewer from the shared session token + username.
// Returns { memberId, role, displayName, username, expirationDate } or null.
async function getViewer(env, body) {
  if (!body || !body.apiToken || body.apiToken !== ADMIN_PASSWORD) return null;
  if (!body.username || !env.BOARD_KV) return null;
  const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
  const users = raw ? JSON.parse(raw) : [];
  const u = users.find(x => x.username === String(body.username).toLowerCase().trim());
  if (!u) return null;
  if (!['member', 'board', 'architect'].includes(u.role)) return null;
  return {
    memberId: u.memberId || null,
    role: u.role,
    displayName: u.displayName || '',
    username: u.username,
    expirationDate: u.expirationDate || null
  };
}

function isActive(viewer) {
  if (!viewer) return false;
  if (viewer.role === 'board' || viewer.role === 'architect') return true;
  if (!viewer.expirationDate) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(viewer.expirationDate) >= today;
}

// ── access rules ──────────────────────────────────────────────────────

function canRead(sceal, viewer) {
  const vis = sceal.visibility || 'public';
  if (vis === 'public') return true;                       // anyone, even anonymous
  if (!viewer) return false;                               // members/shared/private need login
  if (viewer.role === 'architect') return true;            // site owner / tech
  if (sceal.memberId && sceal.memberId === viewer.memberId) return true; // author
  if (vis === 'members') return true;                      // any logged-in IN-NOLA member
  if (vis === 'shared' && Array.isArray(sceal.sharedWith) &&
      sceal.sharedWith.includes(viewer.memberId)) return true;
  return false;                                            // private → author only
}

function canEdit(sceal, viewer) {
  if (!viewer) return false;
  if (!canRead(sceal, viewer)) return false;               // can't touch what you can't see
  if (viewer.role === 'architect' || viewer.role === 'board') return true;
  if (sceal.memberId && sceal.memberId === viewer.memberId) return true; // author
  return false;
}

// Shape a scéal for the client. Strips sharedWith from anyone who can't edit it,
// and annotates whether the viewer owns / may edit it.
function present(sceal, viewer) {
  const owner = !!(viewer && sceal.memberId && sceal.memberId === viewer.memberId);
  const editable = canEdit(sceal, viewer);
  const out = {
    id: sceal.id,
    title: sceal.title,
    contributor: sceal.contributor,
    story: sceal.story,
    people: sceal.people || '',
    place: sceal.place || '',
    era: sceal.era || '',
    image: sceal.image || '',
    visibility: sceal.visibility || 'public',
    createdAt: sceal.createdAt,
    _owner: owner,
    _canEdit: editable
  };
  if (editable) out.sharedWith = Array.isArray(sceal.sharedWith) ? sceal.sharedWith : [];
  return out;
}

function normalizeVisibility(v) {
  return ['public', 'members', 'shared', 'private'].includes(v) ? v : 'public';
}

// ── router ────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const method = request.method;

  if (method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (path === '/api/seanchas' && method === 'GET') return listPublic(env);
  if (path === '/api/seanchas/feed' && method === 'POST') return feed(request, env);
  if (path === '/api/seanchas/directory' && method === 'POST') return directory(request, env);
  if (path === '/api/seanchas' && method === 'POST') return create(request, env);
  if (path === '/api/seanchas' && method === 'PUT') return edit(request, env);
  if (path === '/api/seanchas' && method === 'DELETE') return remove(request, env);

  return json({ error: 'Not found' }, 404);
}

async function readAll(env) {
  const data = await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json');
  return (data && data.scealta) || [];
}

// GET /api/seanchas — public scéalta only, newest first
async function listPublic(env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured', scealta: [] });
  const scealta = (await readAll(env))
    .filter(s => (s.visibility || 'public') === 'public')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(s => present(s, null));
  return json({ scealta });
}

// POST /api/seanchas/feed — scéalta the logged-in viewer may read
async function feed(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured', scealta: [] });
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) {
    // Not a valid session — fall back to public only.
    return listPublic(env);
  }
  const scealta = (await readAll(env))
    .filter(s => canRead(s, viewer))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(s => present(s, viewer));
  return json({ scealta, viewer: { memberId: viewer.memberId, role: viewer.role } });
}

// POST /api/seanchas/directory — active members for the share picker
async function directory(request, env) {
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in as a member.' }, 401);

  const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
  const users = raw ? JSON.parse(raw) : [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const members = users
    .filter(u => u.memberId && ['member', 'board', 'architect'].includes(u.role))
    .filter(u => u.memberId !== viewer.memberId)             // not yourself
    .filter(u => u.role !== 'member' || (u.expirationDate && new Date(u.expirationDate) >= today))
    .map(u => ({ memberId: u.memberId, name: u.displayName || u.username }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return json({ members });
}

// POST /api/seanchas — add a scéal (logged-in active member)
async function create(request, env) {
  if (!env.SEANCHAS_KV) {
    return json({ error: 'KV not configured. Please set up the SEANCHAS_KV binding in Cloudflare Pages.' }, 500);
  }
  const body = await request.json().catch(() => ({}));

  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in as a member to add a scéal.' }, 401);
  if (!isActive(viewer)) return json({ error: 'Your membership is not active. Renew to add a scéal.' }, 403);

  for (const field of ['title', 'contributor', 'story']) {
    if (!body[field] || !body[field].trim()) {
      return json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const visibility = normalizeVisibility(body.visibility);
  const sharedWith = visibility === 'shared' && Array.isArray(body.sharedWith)
    ? [...new Set(body.sharedWith.filter(x => typeof x === 'string' && x))]
    : [];

  const newSceal = {
    id: makeId(),
    title: body.title.trim(),
    contributor: body.contributor.trim(),
    story: body.story.trim(),
    people: body.people?.trim() || '',
    place: body.place?.trim() || '',
    era: body.era?.trim() || '',
    image: body.image || '',
    visibility,
    sharedWith,
    memberId: viewer.memberId,   // author
    createdAt: new Date().toISOString()
  };

  const data = (await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json')) || { scealta: [] };
  data.scealta.push(newSceal);
  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));

  return json({ success: true, sceal: present(newSceal, viewer), message: 'Go raibh maith agat — your scéal has been added.' }, 201);
}

// PUT /api/seanchas — edit a scéal (author, or board/architect)
async function edit(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);
  const body = await request.json().catch(() => ({}));

  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in.' }, 401);
  if (!body.id) return json({ error: 'Missing scéal ID' }, 400);

  const data = (await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json')) || { scealta: [] };
  const idx = data.scealta.findIndex(s => s.id === body.id);
  if (idx === -1) return json({ error: 'Scéal not found' }, 404);

  const existing = data.scealta[idx];
  if (!canEdit(existing, viewer)) return json({ error: 'You do not have permission to edit this scéal.' }, 403);

  const visibility = body.visibility !== undefined ? normalizeVisibility(body.visibility) : (existing.visibility || 'public');
  let sharedWith = Array.isArray(existing.sharedWith) ? existing.sharedWith : [];
  if (body.sharedWith !== undefined) {
    sharedWith = Array.isArray(body.sharedWith)
      ? [...new Set(body.sharedWith.filter(x => typeof x === 'string' && x))]
      : [];
  }
  if (visibility !== 'shared') sharedWith = [];

  data.scealta[idx] = {
    ...existing,
    title: body.title?.trim() || existing.title,
    contributor: body.contributor?.trim() || existing.contributor,
    story: body.story?.trim() || existing.story,
    people: body.people?.trim() ?? existing.people ?? '',
    place: body.place?.trim() ?? existing.place ?? '',
    era: body.era?.trim() ?? existing.era ?? '',
    image: body.image !== undefined ? body.image : (existing.image || ''),
    visibility,
    sharedWith,
    updatedAt: new Date().toISOString()
  };

  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
  return json({ success: true, sceal: present(data.scealta[idx], viewer), message: 'Scéal updated.' });
}

// DELETE /api/seanchas — remove a scéal (author, or board/architect)
async function remove(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);
  const body = await request.json().catch(() => ({}));

  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in.' }, 401);
  if (!body.id) return json({ error: 'Missing scéal ID' }, 400);

  const data = (await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json')) || { scealta: [] };
  const target = data.scealta.find(s => s.id === body.id);
  if (!target) return json({ error: 'Scéal not found' }, 404);
  if (!canEdit(target, viewer)) return json({ error: 'You do not have permission to remove this scéal.' }, 403);

  data.scealta = data.scealta.filter(s => s.id !== body.id);
  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
  return json({ success: true, message: 'Scéal removed.' });
}
