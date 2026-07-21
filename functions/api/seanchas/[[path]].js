// Seanchas API — Cloudflare Pages Function (catch-all router)
//
// An Seanchas — the community's holding of stories. Each entry is a scéal.
// Scéalta have per-story visibility:
//   'public'  — anyone visiting the site may read (default)
//   'members' — any logged-in IN-NOLA member may read
//   'shared'  — the author + the specific members they granted read access
//   'private' — only the author (and the site owner/architect)
//
// Authors may open a scéal to member discussion (commentsOpen). When open, any
// logged-in member who can read the scéal may comment.
//
// Routes:
//   GET    /api/seanchas               → list PUBLIC scéalta (summaries)
//   POST   /api/seanchas               → add a scéal (logged-in active member)
//   POST   /api/seanchas/feed          → scéalta the logged-in viewer may read
//   POST   /api/seanchas/get           → one scéal (full, with comments)
//   POST   /api/seanchas/directory     → member list for the "share with" picker
//   POST   /api/seanchas/comment       → add a comment
//   POST   /api/seanchas/comment/delete→ remove a comment
//   POST   /api/seanchas/activity      → recent activity feed (scéalta + comments)
//   PUT    /api/seanchas               → edit a scéal (author, or board/architect)
//   DELETE /api/seanchas               → remove a scéal (author, or board/architect)
//
// Requires KV bindings: SEANCHAS_KV (stories) and BOARD_KV (member identities).

const SEANCHAS_KEY = 'all_scealta';
const ADMIN_USERS_KEY = 'admin_users';
const ADMIN_PASSWORD = 'innola2026!';
const MAX_COMMENT = 2000;
const ACTIVITY_LIMIT = 25;

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
// Unguessable token for "anyone with the link" sharing.
function makeToken() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── identity ──────────────────────────────────────────────────────────
async function getViewer(env, body) {
  if (!body || !body.apiToken || body.apiToken !== ADMIN_PASSWORD) return null;
  if (!body.username || !env.BOARD_KV) return null;
  const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
  const users = raw ? JSON.parse(raw) : [];
  const u = users.find(x => x.username === String(body.username).toLowerCase().trim());
  if (!u) return null;
  if (!['member', 'board', 'architect'].includes(u.role)) return null;
  return {
    memberId: u.memberId || null, role: u.role,
    displayName: u.displayName || '', username: u.username,
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
  if (vis === 'public') return true;
  if (!viewer) return false;
  if (viewer.role === 'architect') return true;
  if (sceal.memberId && sceal.memberId === viewer.memberId) return true;
  if (vis === 'members') return true;
  if (vis === 'shared' && Array.isArray(sceal.sharedWith) && sceal.sharedWith.includes(viewer.memberId)) return true;
  return false;
}
function canEdit(sceal, viewer) {
  if (!viewer) return false;
  if (!canRead(sceal, viewer)) return false;
  if (viewer.role === 'architect' || viewer.role === 'board') return true;
  if (sceal.memberId && sceal.memberId === viewer.memberId) return true;
  return false;
}
function canComment(sceal, viewer) {
  if (!viewer || !canRead(sceal, viewer)) return false;
  if (viewer.role === 'board' || viewer.role === 'architect') return true;
  if (sceal.memberId && sceal.memberId === viewer.memberId) return true;
  return !!sceal.commentsOpen;
}

function present(sceal, viewer, full) {
  const comments = Array.isArray(sceal.comments) ? sceal.comments : [];
  const editable = canEdit(sceal, viewer);
  const out = {
    id: sceal.id,
    title: sceal.title,
    contributor: sceal.contributor,
    story: sceal.story,
    people: sceal.people || '',
    place: sceal.place || '',
    era: sceal.era || '',
    nextSteps: sceal.nextSteps || '',
    image: sceal.image || '',
    visibility: sceal.visibility || 'public',
    authorId: sceal.memberId || null,
    seanchasName: sceal.seanchasName || ('Scéalta ' + sceal.contributor),
    commentsOpen: !!sceal.commentsOpen,
    commentCount: comments.length,
    createdAt: sceal.createdAt,
    updatedAt: sceal.updatedAt || null,
    _owner: !!(viewer && sceal.memberId && sceal.memberId === viewer.memberId),
    _canEdit: editable,
    _canComment: canComment(sceal, viewer)
  };
  if (editable) {
    out.sharedWith = Array.isArray(sceal.sharedWith) ? sceal.sharedWith : [];
    out.shareToken = sceal.shareToken || '';   // only the author/board can see the secret link
  }
  if (full) out.comments = comments;
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
  if (path === '/api/seanchas/get' && method === 'POST') return getOne(request, env);
  if (path === '/api/seanchas/directory' && method === 'POST') return directory(request, env);
  if (path === '/api/seanchas/share' && method === 'POST') return share(request, env);
  if (path === '/api/seanchas/comment' && method === 'POST') return addComment(request, env);
  if (path === '/api/seanchas/comment/delete' && method === 'POST') return delComment(request, env);
  if (path === '/api/seanchas/activity' && method === 'POST') return activity(request, env);
  if (path === '/api/seanchas' && method === 'POST') return create(request, env);
  if (path === '/api/seanchas' && method === 'PUT') return edit(request, env);
  if (path === '/api/seanchas' && method === 'DELETE') return remove(request, env);

  return json({ error: 'Not found' }, 404);
}

async function readAll(env) {
  const data = await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json');
  return (data && data.scealta) || [];
}
function byNewest(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }

// Per-member personal-seanchas titles (e.g. "Scéalta Sheáin Uí Mhongabháin").
const TITLES_KEY = 'member_titles';
async function loadTitles(env) { return (await env.SEANCHAS_KV.get(TITLES_KEY, 'json')) || {}; }
async function saveTitle(env, memberId, title) {
  if (!memberId) return;
  const t = await loadTitles(env);
  if (title) t[memberId] = title.slice(0, 120); else delete t[memberId];
  await env.SEANCHAS_KV.put(TITLES_KEY, JSON.stringify(t));
}
function withTitle(p, titles) { p.authorTitle = titles[p.authorId] || ''; return p; }

// GET /api/seanchas — public summaries
async function listPublic(env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured', scealta: [] });
  const titles = await loadTitles(env);
  const scealta = (await readAll(env))
    .filter(s => (s.visibility || 'public') === 'public')
    .sort(byNewest)
    .map(s => withTitle(present(s, null, false), titles));
  return json({ scealta });
}

// POST /api/seanchas/feed — viewer-filtered summaries
async function feed(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured', scealta: [] });
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return listPublic(env);
  const titles = await loadTitles(env);
  const scealta = (await readAll(env))
    .filter(s => canRead(s, viewer))
    .sort(byNewest)
    .map(s => withTitle(present(s, viewer, false), titles));
  return json({ scealta, viewer: { memberId: viewer.memberId, role: viewer.role, displayName: viewer.displayName } });
}

// POST /api/seanchas/get — one scéal, full (with comments)
async function getOne(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Missing scéal ID' }, 400);
  const viewer = await getViewer(env, body);
  const sceal = (await readAll(env)).find(s => s.id === body.id);
  // A valid share key grants read access to this one scéal, whatever its visibility.
  const viaKey = !!(body.key && sceal && sceal.shareToken && body.key === sceal.shareToken);
  if (!sceal || (!canRead(sceal, viewer) && !viaKey)) return json({ error: 'Scéal not found' }, 404);
  const titles = await loadTitles(env);
  return json({ sceal: withTitle(present(sceal, viewer, true), titles) });
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
    .filter(u => u.memberId !== viewer.memberId)
    .filter(u => u.role !== 'member' || (u.expirationDate && new Date(u.expirationDate) >= today))
    .map(u => ({ memberId: u.memberId, name: u.displayName || u.username }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return json({ members });
}

// POST /api/seanchas — add a scéal
async function create(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured. Please set up the SEANCHAS_KV binding in Cloudflare Pages.' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in as a member to add a scéal.' }, 401);
  if (!isActive(viewer)) return json({ error: 'Your membership is not active. Renew to add a scéal.' }, 403);

  for (const field of ['title', 'contributor', 'story']) {
    if (!body[field] || !body[field].trim()) return json({ error: `Missing required field: ${field}` }, 400);
  }
  const visibility = normalizeVisibility(body.visibility);
  const sharedWith = visibility === 'shared' && Array.isArray(body.sharedWith)
    ? [...new Set(body.sharedWith.filter(x => typeof x === 'string' && x))] : [];

  const newSceal = {
    id: makeId(),
    title: body.title.trim(),
    contributor: body.contributor.trim(),
    story: body.story.trim(),
    people: body.people?.trim() || '',
    place: body.place?.trim() || '',
    era: body.era?.trim() || '',
    nextSteps: body.nextSteps?.trim() || '',
    seanchasName: (body.seanchasName && body.seanchasName.trim()) || ('Scéalta ' + body.contributor.trim()),
    image: body.image || '',
    visibility, sharedWith,
    commentsOpen: !!body.commentsOpen,
    comments: [],
    memberId: viewer.memberId,
    createdAt: new Date().toISOString()
  };
  const data = (await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json')) || { scealta: [] };
  data.scealta.push(newSceal);
  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
  if (body.seanchasTitle !== undefined) await saveTitle(env, viewer.memberId, (body.seanchasTitle || '').trim());
  const titles = await loadTitles(env);
  return json({ success: true, sceal: withTitle(present(newSceal, viewer, true), titles), message: 'Go raibh maith agat — your scéal has been added.' }, 201);
}

// PUT /api/seanchas — edit a scéal
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
    sharedWith = Array.isArray(body.sharedWith) ? [...new Set(body.sharedWith.filter(x => typeof x === 'string' && x))] : [];
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
    nextSteps: body.nextSteps?.trim() ?? existing.nextSteps ?? '',
    seanchasName: (body.seanchasName !== undefined && body.seanchasName.trim()) ? body.seanchasName.trim() : (existing.seanchasName || ('Scéalta ' + (existing.contributor || ''))),
    image: body.image !== undefined ? body.image : (existing.image || ''),
    visibility, sharedWith,
    commentsOpen: body.commentsOpen !== undefined ? !!body.commentsOpen : !!existing.commentsOpen,
    comments: Array.isArray(existing.comments) ? existing.comments : [],
    updatedAt: new Date().toISOString()
  };
  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
  if (body.seanchasTitle !== undefined) await saveTitle(env, existing.memberId || viewer.memberId, (body.seanchasTitle || '').trim());
  const titles = await loadTitles(env);
  return json({ success: true, sceal: withTitle(present(data.scealta[idx], viewer, true), titles), message: 'Scéal updated.' });
}

// DELETE /api/seanchas — remove a scéal
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

// POST /api/seanchas/share — create / regenerate / disable a scéal's share link (author or board)
async function share(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in.' }, 401);
  if (!body.id) return json({ error: 'Missing scéal ID' }, 400);

  const data = (await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json')) || { scealta: [] };
  const idx = data.scealta.findIndex(s => s.id === body.id);
  if (idx === -1) return json({ error: 'Scéal not found' }, 404);
  const s = data.scealta[idx];
  if (!canEdit(s, viewer)) return json({ error: 'You do not have permission to share this scéal.' }, 403);

  const action = body.action || 'enable';
  if (action === 'disable') s.shareToken = '';
  else if (action === 'regenerate' || !s.shareToken) s.shareToken = makeToken();

  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
  return json({ success: true, shareToken: s.shareToken });
}

// POST /api/seanchas/comment — add a comment
async function addComment(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in as a member to comment.' }, 401);
  if (!body.id) return json({ error: 'Missing scéal ID' }, 400);
  const text = (body.text || '').trim();
  if (!text) return json({ error: 'Comment cannot be empty.' }, 400);

  const data = (await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json')) || { scealta: [] };
  const idx = data.scealta.findIndex(s => s.id === body.id);
  if (idx === -1) return json({ error: 'Scéal not found' }, 404);
  const sceal = data.scealta[idx];
  if (!canComment(sceal, viewer)) return json({ error: 'Comments are not open on this scéal.' }, 403);

  if (!Array.isArray(sceal.comments)) sceal.comments = [];
  const comment = {
    id: makeId(),
    memberId: viewer.memberId,
    name: viewer.displayName || 'Member',
    text: text.slice(0, MAX_COMMENT),
    createdAt: new Date().toISOString()
  };
  sceal.comments.push(comment);
  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
  return json({ success: true, comment, sceal: present(sceal, viewer, true) }, 201);
}

// POST /api/seanchas/comment/delete — remove a comment
async function delComment(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in.' }, 401);
  if (!body.id || !body.commentId) return json({ error: 'Missing ids' }, 400);

  const data = (await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json')) || { scealta: [] };
  const sceal = data.scealta.find(s => s.id === body.id);
  if (!sceal || !Array.isArray(sceal.comments)) return json({ error: 'Not found' }, 404);
  const comment = sceal.comments.find(c => c.id === body.commentId);
  if (!comment) return json({ error: 'Comment not found' }, 404);

  const allowed = comment.memberId === viewer.memberId || canEdit(sceal, viewer);
  if (!allowed) return json({ error: 'You cannot remove this comment.' }, 403);

  sceal.comments = sceal.comments.filter(c => c.id !== body.commentId);
  await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
  return json({ success: true, sceal: present(sceal, viewer, true) });
}

// POST /api/seanchas/activity — recent scéalta + comments the viewer may read
async function activity(request, env) {
  if (!env.SEANCHAS_KV) return json({ items: [] });
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  const readable = (await readAll(env)).filter(s => canRead(s, viewer));

  const items = [];
  for (const s of readable) {
    items.push({
      type: 'sceal', scealId: s.id, scealTitle: s.title,
      who: s.contributor, at: s.createdAt
    });
    (Array.isArray(s.comments) ? s.comments : []).forEach(c => {
      items.push({
        type: 'comment', scealId: s.id, scealTitle: s.title,
        who: c.name, snippet: (c.text || '').slice(0, 140), at: c.createdAt
      });
    });
  }
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  return json({ items: items.slice(0, ACTIVITY_LIMIT) });
}
