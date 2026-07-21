// Seanchas API — Cloudflare Pages Function
//
// An Seanchas — the lore entire, the community's whole holding of stories.
// Each entry is a scéal (one story); together they are the scéalta.
//
// Handles:
//   GET    /api/seanchas  → list every scéal (newest first)
//   POST   /api/seanchas  → add a scéal  (OPEN to members — no admin password)
//   PUT    /api/seanchas  → edit a scéal (admin only)
//   DELETE /api/seanchas  → remove a scéal (admin only)
//
// Requires KV binding: SEANCHAS_KV

const SEANCHAS_KEY = 'all_scealta';

// Shared admin password — only needed to edit or delete, never to contribute.
const ADMIN_PASSWORD = 'innola2026!';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Verify the submitter is a logged-in, active member (or board/architect).
// The client sends the shared session apiToken plus the logged-in username;
// we look the user up in BOARD_KV (the unified auth store) and check status.
async function requireActiveMember(env, body) {
  if (!body.apiToken || body.apiToken !== ADMIN_PASSWORD) {
    return { ok: false, status: 401, error: 'Please log in as a member to add a scéal.' };
  }
  if (!body.username) {
    return { ok: false, status: 401, error: 'Missing member identity — please log in again.' };
  }
  if (!env.BOARD_KV) {
    return { ok: false, status: 500, error: 'Member directory not configured.' };
  }
  const raw = await env.BOARD_KV.get('admin_users');
  const users = raw ? JSON.parse(raw) : [];
  const u = users.find(x => x.username === String(body.username).toLowerCase().trim());
  if (!u) {
    return { ok: false, status: 401, error: 'Member not found — please log in again.' };
  }
  if (!['member', 'board', 'architect'].includes(u.role)) {
    return { ok: false, status: 403, error: 'Only members can add a scéal.' };
  }
  // Members must have a current (non-expired) membership; board/architect are always active.
  if (u.role === 'member') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (!u.expirationDate || new Date(u.expirationDate) < today) {
      return { ok: false, status: 403, error: 'Your membership is not active. Renew to add a scéal.' };
    }
  }
  return { ok: true, memberId: u.memberId || null, displayName: u.displayName || '' };
}

export async function onRequestGet(context) {
  // GET /api/seanchas — return every scéal, newest first
  try {
    const { env } = context;

    if (!env.SEANCHAS_KV) {
      return json({ error: 'KV not configured', scealta: [] });
    }

    const data = await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json');
    const scealta = (data && data.scealta) || [];

    // Newest contribution first
    scealta.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return json({ scealta });
  } catch (error) {
    return json({ error: 'Failed to fetch the seanchas', details: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  // POST /api/seanchas — add a scéal. Open to the community; no admin password.
  try {
    const { request, env } = context;

    if (!env.SEANCHAS_KV) {
      return json({ error: 'KV not configured. Please set up the SEANCHAS_KV binding in Cloudflare Pages.' }, 500);
    }

    const body = await request.json();

    // Gate: only a logged-in, active member (or board/architect) may contribute.
    const auth = await requireActiveMember(env, body);
    if (!auth.ok) {
      return json({ error: auth.error }, auth.status);
    }

    // Only the story itself and who is telling it are required.
    const required = ['title', 'contributor', 'story'];
    for (const field of required) {
      if (!body[field] || !body[field].trim()) {
        return json({ error: `Missing required field: ${field}` }, 400);
      }
    }

    const newSceal = {
      id: makeId(),
      title: body.title.trim(),          // the name of the story
      contributor: body.contributor.trim(), // who is sharing it
      story: body.story.trim(),          // the scéal itself
      people: body.people?.trim() || '', // muintir — whose seanchas (family / people)
      place: body.place?.trim() || '',   // townland, parish, city
      era: body.era?.trim() || '',       // year or time period
      image: body.image || '',           // optional photo (base64 data URL)
      memberId: auth.memberId,           // who contributed it (from the verified session)
      createdAt: new Date().toISOString()
    };

    let data = await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json');
    if (!data) data = { scealta: [] };
    data.scealta.push(newSceal);
    await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));

    return json({ success: true, sceal: newSceal, message: 'Go raibh maith agat — your scéal has been added to the seanchas.' }, 201);
  } catch (error) {
    return json({ error: 'Failed to add the scéal', details: error.message }, 500);
  }
}

export async function onRequestPut(context) {
  // PUT /api/seanchas — edit a scéal (admin only)
  try {
    const { request, env } = context;

    if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return json({ error: 'Invalid admin password' }, 401);
    }
    if (!body.id) return json({ error: 'Missing scéal ID' }, 400);

    const data = await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json');
    if (!data || !data.scealta) return json({ error: 'No scéalta found' }, 404);

    const idx = data.scealta.findIndex(s => s.id === body.id);
    if (idx === -1) return json({ error: 'Scéal not found' }, 404);

    const existing = data.scealta[idx];
    data.scealta[idx] = {
      id: existing.id,
      title: body.title?.trim() || existing.title,
      contributor: body.contributor?.trim() || existing.contributor,
      story: body.story?.trim() || existing.story,
      people: body.people?.trim() ?? existing.people ?? '',
      place: body.place?.trim() ?? existing.place ?? '',
      era: body.era?.trim() ?? existing.era ?? '',
      image: body.image !== undefined ? body.image : (existing.image || ''),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
    return json({ success: true, sceal: data.scealta[idx], message: 'Scéal updated.' });
  } catch (error) {
    return json({ error: 'Failed to update the scéal', details: error.message }, 500);
  }
}

export async function onRequestDelete(context) {
  // DELETE /api/seanchas — remove a scéal (admin only)
  try {
    const { request, env } = context;

    if (!env.SEANCHAS_KV) return json({ error: 'KV not configured' }, 500);

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return json({ error: 'Invalid admin password' }, 401);
    }
    if (!body.id) return json({ error: 'Missing scéal ID' }, 400);

    const data = await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json');
    if (!data || !data.scealta) return json({ error: 'No scéalta found' }, 404);

    const before = data.scealta.length;
    data.scealta = data.scealta.filter(s => s.id !== body.id);
    if (data.scealta.length === before) return json({ error: 'Scéal not found' }, 404);

    await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));
    return json({ success: true, message: 'Scéal removed.' });
  } catch (error) {
    return json({ error: 'Failed to delete the scéal', details: error.message }, 500);
  }
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
