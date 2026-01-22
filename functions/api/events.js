// Events API - Cloudflare Pages Function
// Handles GET (list events) and POST (add event)
// Requires KV binding: EVENTS_KV

const EVENTS_KEY = 'all_events';

// Simple admin PIN check (same pattern as board portal for now)
// In production, use proper auth
const ADMIN_PINS = ['112233', '445566', '778899'];

export async function onRequestGet(context) {
  // GET /api/events - Return all events
  try {
    const { env } = context;

    if (!env.EVENTS_KV) {
      return new Response(JSON.stringify({
        error: 'KV not configured',
        events: { upcoming: [], past: [] }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const eventsData = await env.EVENTS_KV.get(EVENTS_KEY, 'json');

    if (!eventsData) {
      // Return empty structure if no events yet
      return new Response(JSON.stringify({
        upcoming: [],
        past: []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sort events and separate into upcoming/past based on current date
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = [];
    const past = [];

    (eventsData.events || []).forEach(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);

      if (eventDate >= now) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    // Sort upcoming by date ascending (soonest first)
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Sort past by date descending (most recent first)
    past.sort((a, b) => new Date(b.date) - new Date(a.date));

    return new Response(JSON.stringify({ upcoming, past }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch events',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  // POST /api/events - Add a new event (admin only)
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

    // Validate required fields
    const required = ['title', 'date', 'location', 'description'];
    for (const field of required) {
      if (!body[field] || !body[field].trim()) {
        return new Response(JSON.stringify({
          error: `Missing required field: ${field}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Create event object
    const newEvent = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: body.title.trim(),
      date: body.date,
      time: body.time?.trim() || '',
      location: body.location.trim(),
      description: body.description.trim(),
      emoji: body.emoji?.trim() || '',
      cost: body.cost?.trim() || '',
      contact: body.contact?.trim() || '',
      notes: body.notes?.trim() || '',
      createdAt: new Date().toISOString()
    };

    // Get existing events
    let eventsData = await env.EVENTS_KV.get(EVENTS_KEY, 'json');
    if (!eventsData) {
      eventsData = { events: [] };
    }

    // Add new event
    eventsData.events.push(newEvent);

    // Save back to KV
    await env.EVENTS_KV.put(EVENTS_KEY, JSON.stringify(eventsData));

    return new Response(JSON.stringify({
      success: true,
      event: newEvent,
      message: 'Event added successfully!'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to add event',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  // DELETE /api/events - Remove an event (admin only)
  try {
    const { request, env } = context;

    if (!env.EVENTS_KV) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Check admin PIN
    if (!body.adminPin || !ADMIN_PINS.includes(body.adminPin)) {
      return new Response(JSON.stringify({ error: 'Invalid admin PIN' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body.eventId) {
      return new Response(JSON.stringify({ error: 'Missing event ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get existing events
    let eventsData = await env.EVENTS_KV.get(EVENTS_KEY, 'json');
    if (!eventsData || !eventsData.events) {
      return new Response(JSON.stringify({ error: 'No events found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove event
    const originalLength = eventsData.events.length;
    eventsData.events = eventsData.events.filter(e => e.id !== body.eventId);

    if (eventsData.events.length === originalLength) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save back to KV
    await env.EVENTS_KV.put(EVENTS_KEY, JSON.stringify(eventsData));

    return new Response(JSON.stringify({
      success: true,
      message: 'Event deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to delete event',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
