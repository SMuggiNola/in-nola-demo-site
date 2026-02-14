// Village Positions API - Cloudflare Pages Function
// GET: public, returns saved cottage positions (or empty object)
// PUT: admin auth required, saves cottage positions
// Uses KV binding: BOARD_KV, key: village_positions

const POSITIONS_KEY = 'village_positions';
const ADMIN_PASSWORD = 'innola2026!';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// GET /api/village-positions — public, no auth
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.BOARD_KV) {
      return Response.json({}, { headers: corsHeaders });
    }

    const positions = await env.BOARD_KV.get(POSITIONS_KEY, 'json');
    return Response.json(positions || {}, { headers: corsHeaders });

  } catch (error) {
    return Response.json({}, { status: 500, headers: corsHeaders });
  }
}

// PUT /api/village-positions — admin auth required
export async function onRequestPut(context) {
  try {
    const { request, env } = context;

    if (!env.BOARD_KV) {
      return Response.json(
        { error: 'KV not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return Response.json(
        { error: 'Invalid admin password' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!body.positions || typeof body.positions !== 'object') {
      return Response.json(
        { error: 'Missing or invalid positions object' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate each position entry — only allow safe CSS percentage values
    for (const [key, pos] of Object.entries(body.positions)) {
      if (typeof pos !== 'object') {
        return Response.json(
          { error: `Invalid position for "${key}"` },
          { status: 400, headers: corsHeaders }
        );
      }
      for (const [prop, val] of Object.entries(pos)) {
        if (!['top', 'left', 'right', 'bottom'].includes(prop)) {
          return Response.json(
            { error: `Invalid CSS property "${prop}" for "${key}"` },
            { status: 400, headers: corsHeaders }
          );
        }
        if (val !== null && (typeof val !== 'string' || !/^\d+(\.\d+)?%$/.test(val))) {
          return Response.json(
            { error: `Invalid value "${val}" for "${key}.${prop}" — must be a percentage like "42%"` },
            { status: 400, headers: corsHeaders }
          );
        }
      }
    }

    await env.BOARD_KV.put(POSITIONS_KEY, JSON.stringify(body.positions));

    return Response.json(
      { success: true, message: 'Positions saved' },
      { headers: corsHeaders }
    );

  } catch (error) {
    return Response.json(
      { error: 'Failed to save positions', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// CORS preflight
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
