// One-time seed endpoint to populate initial events in KV
// Call POST /api/events-seed with admin PIN to seed data
// This migrates the existing hardcoded events to the KV store

const EVENTS_KEY = 'all_events';
const ADMIN_PINS = ['112233', '445566', '778899'];

const SEED_EVENTS = [
  // Upcoming events
  {
    id: 'seed-stpatricks-2026',
    title: "St. Patrick's Ceili",
    date: '2026-03-08',
    time: '',
    location: '600 North Broad, New Orleans, 70119',
    description: "$5 General Admission. Get ready for a lively evening of traditional Irish music, dancing, and good cheer as we celebrate St. Patrick's Day a little early!",
    emoji: '☘️',
    cost: '$5',
    contact: '',
    notes: 'More details coming soon!',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-bloomsday-2026',
    title: 'Bloomsday Celebration',
    date: '2026-06-16',
    time: '',
    location: 'TBD',
    description: 'Bloomsday is a vibrant annual celebration of the life and work of the iconic Irish writer James Joyce, observed with great enthusiasm every June 16th. This day is a tribute to Leopold Bloom, the unforgettable protagonist of Joyce\'s monumental novel, "Ulysses," which meticulously details his journey through Dublin on a single, pivotal day: June 16, 1904. Join fellow literary enthusiasts in immersing yourself in the world of "Ulysses"! Celebrations often involve participants donning period-appropriate Edwardian attire, reminiscent of the characters from the novel.',
    emoji: '📖',
    cost: '',
    contact: '',
    notes: 'More details coming soon!',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-samhain-2026',
    title: 'Oíche Shamhna (Halloween) Ceili',
    date: '2026-10-31',
    time: '',
    location: "Muggivan's School of Irish Dance Studio",
    description: 'Oíche Shamhna (pronounced "ee-ha how-na") is the Irish name for Halloween, marking the eve of the ancient Celtic festival of Samhain. Help us attempt what may be the first ever Samhain festival to be held in New Orleans. Get ready for an evening of spooky fun with costumes, lively music, traditional dance, delicious food, and refreshing drinks. We\'re even hoping for a bonfire, weather and permits permitting!',
    emoji: '🎃',
    cost: '',
    contact: '',
    notes: 'More details coming soon! Keep an eye on this space for updates.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed-holiday-2026',
    title: '2nd Annual Holiday Party',
    date: '2026-12-15',
    time: '',
    location: 'To Be Determined',
    description: 'Help us celebrate another year of working together to celebrate the rich history the Irish have helped contribute to New Orleans and its surrounding areas. Join us for an evening of camaraderie, good cheer, and reflection on our shared heritage.',
    emoji: '🎄',
    cost: '',
    contact: '',
    notes: 'More details coming soon!',
    createdAt: new Date().toISOString()
  },
  // Past events
  {
    id: 'seed-holiday-2025',
    title: '1st Annual Holiday Party',
    date: '2025-12-16',
    time: '6:00 PM',
    location: 'Ember Indian Cuisine — 5606 Canal Blvd',
    description: "Potluck dinner, cash bar, and a warm holiday evening celebrating Irish culture in New Orleans. Music & Dancing! Thank you to everyone who attended our inaugural holiday celebration!",
    emoji: '🎄',
    cost: '',
    contact: '',
    notes: '',
    createdAt: new Date().toISOString()
  }
];

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.EVENTS_KV) {
      return new Response(JSON.stringify({
        error: 'KV not configured. Please set up EVENTS_KV binding in Cloudflare Pages.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Check admin PIN
    if (!body.adminPin || !ADMIN_PINS.includes(body.adminPin)) {
      return new Response(JSON.stringify({
        error: 'Invalid admin PIN'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if events already exist
    const existing = await env.EVENTS_KV.get(EVENTS_KEY, 'json');
    if (existing && existing.events && existing.events.length > 0) {
      return new Response(JSON.stringify({
        error: 'Events already exist in KV. Delete them first if you want to reseed.',
        existingCount: existing.events.length
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Seed the events
    const eventsData = { events: SEED_EVENTS };
    await env.EVENTS_KV.put(EVENTS_KEY, JSON.stringify(eventsData));

    return new Response(JSON.stringify({
      success: true,
      message: 'Events seeded successfully!',
      count: SEED_EVENTS.length,
      events: SEED_EVENTS.map(e => ({ id: e.id, title: e.title, date: e.date }))
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to seed events',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    message: 'POST to this endpoint with { "adminPin": "XXXXXX" } to seed initial events'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
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
