// Site Feedback API — Cloudflare Pages Function (catch-all router)
//
// A crowd-sourced "help improve this site" board. Members post feedback and
// reply to each other; anyone can read. tech@in-nola.org is emailed on every
// new post and reply.
//
// Routes:
//   GET    /api/feedback                → list all feedback (+ replies), newest first
//   POST   /api/feedback                → add feedback (logged-in member)
//   POST   /api/feedback/comment        → reply to a feedback item (logged-in member)
//   DELETE /api/feedback                → remove an item (author, or board/architect)
//   POST   /api/feedback/comment/delete → remove a reply (author, or board/architect)
//
// Storage: SEANCHAS_KV under key 'site_feedback'. Identities: BOARD_KV.

const FEEDBACK_KEY = 'site_feedback';
const ADMIN_USERS_KEY = 'admin_users';
const ADMIN_PASSWORD = 'innola2026!';
const MAX_LEN = 4000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
function makeId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

async function getViewer(env, body) {
  if (!body || !body.apiToken || body.apiToken !== ADMIN_PASSWORD) return null;
  if (!body.username || !env.BOARD_KV) return null;
  const raw = await env.BOARD_KV.get(ADMIN_USERS_KEY);
  const users = raw ? JSON.parse(raw) : [];
  const u = users.find(x => x.username === String(body.username).toLowerCase().trim());
  if (!u) return null;
  if (!['member', 'board', 'architect'].includes(u.role)) return null;
  return { memberId: u.memberId || null, role: u.role, displayName: u.displayName || 'Member' };
}
function canModerate(v) { return v && (v.role === 'board' || v.role === 'architect'); }

async function readAll(env) {
  const data = await env.SEANCHAS_KV.get(FEEDBACK_KEY, 'json');
  return (data && data.items) || [];
}
async function writeAll(env, items) {
  await env.SEANCHAS_KV.put(FEEDBACK_KEY, JSON.stringify({ items }));
}

// Fire-and-forget email to tech@in-nola.org via Resend.
async function notify(env, subject, lines) {
  if (!env.RESEND_API_KEY) return;
  const text = lines.join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'IN-NOLA Feedback <tech@in-nola.org>',
        to: ['tech@in-nola.org'],
        subject,
        text: text + '\n\n— View: https://in-nola.org/feedback.html'
      })
    });
  } catch (e) { /* ignore */ }
}

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const method = request.method;
  if (method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (path === '/api/feedback' && method === 'GET') return list(env);
  if (path === '/api/feedback' && method === 'POST') return add(request, env);
  if (path === '/api/feedback/comment' && method === 'POST') return reply(request, env);
  if (path === '/api/feedback' && method === 'DELETE') return removeItem(request, env);
  if (path === '/api/feedback/comment/delete' && method === 'POST') return removeReply(request, env);
  return json({ error: 'Not found' }, 404);
}

async function list(env) {
  if (!env.SEANCHAS_KV) return json({ items: [] });
  const items = (await readAll(env)).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json({ items });
}

async function add(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'Not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in as a member to post feedback.' }, 401);
  const text = (body.text || '').trim();
  if (!text) return json({ error: 'Please write your feedback.' }, 400);

  const item = {
    id: makeId(), memberId: viewer.memberId, name: viewer.displayName,
    text: text.slice(0, MAX_LEN), createdAt: new Date().toISOString(), comments: []
  };
  const items = await readAll(env);
  items.push(item);
  await writeAll(env, items);
  await notify(env, '💬 New site feedback from ' + viewer.displayName, [
    viewer.displayName + ' posted feedback:', '', item.text
  ]);
  return json({ success: true, item }, 201);
}

async function reply(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'Not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in as a member to reply.' }, 401);
  if (!body.id) return json({ error: 'Missing id' }, 400);
  const text = (body.text || '').trim();
  if (!text) return json({ error: 'Please write a reply.' }, 400);

  const items = await readAll(env);
  const item = items.find(i => i.id === body.id);
  if (!item) return json({ error: 'Feedback not found' }, 404);
  if (!Array.isArray(item.comments)) item.comments = [];
  const comment = { id: makeId(), memberId: viewer.memberId, name: viewer.displayName, text: text.slice(0, MAX_LEN), createdAt: new Date().toISOString() };
  item.comments.push(comment);
  await writeAll(env, items);
  await notify(env, '💬 New reply on site feedback', [
    viewer.displayName + ' replied to feedback from ' + item.name + ':', '', comment.text, '', '(on: "' + item.text.slice(0, 120) + '")'
  ]);
  return json({ success: true, item }, 201);
}

async function removeItem(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'Not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in.' }, 401);
  if (!body.id) return json({ error: 'Missing id' }, 400);
  let items = await readAll(env);
  const item = items.find(i => i.id === body.id);
  if (!item) return json({ error: 'Not found' }, 404);
  if (item.memberId !== viewer.memberId && !canModerate(viewer)) return json({ error: 'Not allowed' }, 403);
  items = items.filter(i => i.id !== body.id);
  await writeAll(env, items);
  return json({ success: true });
}

async function removeReply(request, env) {
  if (!env.SEANCHAS_KV) return json({ error: 'Not configured' }, 500);
  const body = await request.json().catch(() => ({}));
  const viewer = await getViewer(env, body);
  if (!viewer) return json({ error: 'Please log in.' }, 401);
  if (!body.id || !body.commentId) return json({ error: 'Missing ids' }, 400);
  const items = await readAll(env);
  const item = items.find(i => i.id === body.id);
  if (!item || !Array.isArray(item.comments)) return json({ error: 'Not found' }, 404);
  const c = item.comments.find(x => x.id === body.commentId);
  if (!c) return json({ error: 'Reply not found' }, 404);
  if (c.memberId !== viewer.memberId && !canModerate(viewer)) return json({ error: 'Not allowed' }, 403);
  item.comments = item.comments.filter(x => x.id !== body.commentId);
  await writeAll(env, items);
  return json({ success: true, item });
}
