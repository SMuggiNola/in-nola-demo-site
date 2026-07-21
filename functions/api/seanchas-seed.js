// Seanchas seed — one-time population of SEANCHAS_KV with the founding
// scéalta of the Muggivan Seanchas (seanchas mhuintir Mhongabháin).
//
// POST /api/seanchas-seed  { adminPassword: "..." , force?: true }
//   - Writes the founding scéalta if the collection is empty.
//   - Pass force:true to seed even if scéalta already exist (appends, skipping
//     any founding scéal whose id is already present).
//
// These mirror the fallback array in Our-Village/Our_Library/seanchas.html and
// are drawn from the fuller family archive at Paddy_Profile.html.

const SEANCHAS_KEY = 'all_scealta';
const ADMIN_PASSWORD = 'innola2026!';

const FOUNDING_SCEALTA = [
  {
    id: 'mug-paddy', title: 'Patrick “Paddy” Muggivan',
    contributor: 'The Muggivan family', people: 'Muintir Mhongabháin',
    place: 'Derrycon, East Clare', era: 'Scéal a hAon',
    story: 'Scéal coming soon.'
  },
  {
    id: 'mug-jj', title: 'John “JJ” Muggivan',
    contributor: 'The Muggivan family', people: 'Muintir Mhongabháin',
    place: 'Galway & Clare', era: 'Scéal a Dó',
    story: 'Scéal coming soon.'
  }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.SEANCHAS_KV) {
      return json({ error: 'SEANCHAS_KV not configured. Create the namespace and binding first.' }, 500);
    }

    const body = await request.json();
    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return json({ error: 'Invalid admin password' }, 401);
    }

    let data = await env.SEANCHAS_KV.get(SEANCHAS_KEY, 'json');
    if (!data) data = { scealta: [] };

    if (data.scealta.length > 0 && !body.force) {
      return json({
        error: 'The seanchas already has scéalta. Pass force:true to add the founding scéalta anyway.',
        count: data.scealta.length
      }, 409);
    }

    // Timestamps descend by index so newest-first sort preserves narrative order.
    const base = Date.now();
    const existingIds = new Set(data.scealta.map(s => s.id));
    let added = 0;

    FOUNDING_SCEALTA.forEach((s, i) => {
      if (existingIds.has(s.id)) return;
      data.scealta.push({
        ...s,
        image: '',
        createdAt: new Date(base - i * 60000).toISOString()
      });
      added++;
    });

    await env.SEANCHAS_KV.put(SEANCHAS_KEY, JSON.stringify(data));

    return json({
      success: true,
      added,
      total: data.scealta.length,
      message: `Seeded ${added} founding scéalta into the seanchas.`
    }, 201);
  } catch (error) {
    return json({ error: 'Failed to seed the seanchas', details: error.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
