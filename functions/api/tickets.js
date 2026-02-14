// Tickets API - Cloudflare Pages Function
// Handles GET (list), POST (create), PUT (update), DELETE (remove)
// Requires KV binding: TICKETS_KV

const TICKETS_KEY = 'all_tickets';

// Shared admin password for all board member actions
const ADMIN_PASSWORD = 'innola2026!';

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function sanitizeTicket(ticket) {
  return {
    ...ticket,
    title: escapeHtml(ticket.title),
    description: escapeHtml(ticket.description),
    submittedBy: escapeHtml(ticket.submittedBy),
    comments: (ticket.comments || []).map(c => ({
      ...c,
      text: escapeHtml(c.text),
      author: escapeHtml(c.author)
    }))
  };
}

export async function onRequestGet(context) {
  // GET /api/tickets?adminPassword=X - Return all tickets (admin only)
  try {
    const { env } = context;
    const url = new URL(context.request.url);
    const password = url.searchParams.get('adminPassword');

    if (!password || password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!env.TICKETS_KV) {
      return new Response(JSON.stringify({
        error: 'KV not configured',
        tickets: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ticketsData = await env.TICKETS_KV.get(TICKETS_KEY, 'json');

    if (!ticketsData) {
      return new Response(JSON.stringify({ tickets: [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sort: open first (newest), then in-progress, then completed (newest first)
    const statusOrder = { 'open': 0, 'in-progress': 1, 'completed': 2 };
    const tickets = (ticketsData.tickets || [])
      .map(sanitizeTicket)
      .sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    return new Response(JSON.stringify({ tickets }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch tickets',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  // POST /api/tickets - Create a new ticket (admin only)
  try {
    const { request, env } = context;

    if (!env.TICKETS_KV) {
      return new Response(JSON.stringify({
        error: 'KV not configured. Please set up TICKETS_KV binding in Cloudflare Pages.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Check admin password
    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate required fields
    const required = ['title', 'description'];
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

    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    const priority = validPriorities.includes(body.priority) ? body.priority : 'medium';

    // Create ticket object
    const newTicket = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: body.title.trim(),
      description: body.description.trim(),
      priority: priority,
      status: 'open',
      submittedBy: body.submittedBy?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: []
    };

    // Get existing tickets
    let ticketsData = await env.TICKETS_KV.get(TICKETS_KEY, 'json');
    if (!ticketsData) {
      ticketsData = { tickets: [] };
    }

    // Add new ticket
    ticketsData.tickets.push(newTicket);

    // Save back to KV
    await env.TICKETS_KV.put(TICKETS_KEY, JSON.stringify(ticketsData));

    // Send email notification
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const NOTIFY_EMAIL = env.CONTACT_TO_EMAIL || 'irishnetworknola@gmail.com';
    if (RESEND_API_KEY) {
      try {
        const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
        const submitterName = newTicket.submittedBy || 'Unknown';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'IN-NOLA Tech Requests <contact@in-nola.org>',
            to: [NOTIFY_EMAIL],
            subject: `[Tech Request] ${newTicket.title} (${priorityLabel})`,
            html: `
              <h2>New Tech Request</h2>
              <p><strong>Title:</strong> ${escapeHtml(newTicket.title)}</p>
              <p><strong>Priority:</strong> ${priorityLabel}</p>
              <p><strong>Submitted by:</strong> ${escapeHtml(submitterName)}</p>
              <hr>
              <p><strong>Description:</strong></p>
              <p>${escapeHtml(newTicket.description).replace(/\n/g, '<br>')}</p>
              <hr>
              <p style="color: #666; font-size: 12px;">View and manage at <a href="https://in-nola.org/admin-portal/tickets.html">Admin Portal</a></p>
            `,
            text: `New Tech Request\n\nTitle: ${newTicket.title}\nPriority: ${priorityLabel}\nSubmitted by: ${submitterName}\n\nDescription:\n${newTicket.description}\n\n---\nView at https://in-nola.org/admin-portal/tickets.html`,
          }),
        });
      } catch (emailErr) {
        // Don't fail the ticket creation if email fails
        console.error('Failed to send ticket notification:', emailErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ticket: sanitizeTicket(newTicket),
      message: 'Ticket created successfully!'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to create ticket',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context) {
  // PUT /api/tickets - Update a ticket (admin only)
  try {
    const { request, env } = context;

    if (!env.TICKETS_KV) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Check admin password
    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body.ticketId) {
      return new Response(JSON.stringify({ error: 'Missing ticket ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get existing tickets
    let ticketsData = await env.TICKETS_KV.get(TICKETS_KEY, 'json');
    if (!ticketsData || !ticketsData.tickets) {
      return new Response(JSON.stringify({ error: 'No tickets found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find ticket
    const ticketIndex = ticketsData.tickets.findIndex(t => t.id === body.ticketId);
    if (ticketIndex === -1) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existing = ticketsData.tickets[ticketIndex];

    // Handle adding a comment
    if (body.addComment) {
      if (!body.addComment.text || !body.addComment.text.trim()) {
        return new Response(JSON.stringify({ error: 'Comment text is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const comment = {
        text: body.addComment.text.trim(),
        author: body.addComment.author?.trim() || 'Board Member',
        createdAt: new Date().toISOString()
      };
      existing.comments = existing.comments || [];
      existing.comments.push(comment);
    }

    // Update fields
    const validStatuses = ['open', 'in-progress', 'completed'];
    const validPriorities = ['low', 'medium', 'high'];

    ticketsData.tickets[ticketIndex] = {
      id: existing.id,
      title: body.title?.trim() || existing.title,
      description: body.description?.trim() || existing.description,
      priority: validPriorities.includes(body.priority) ? body.priority : existing.priority,
      status: validStatuses.includes(body.status) ? body.status : existing.status,
      submittedBy: body.submittedBy?.trim() ?? existing.submittedBy,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      comments: existing.comments || []
    };

    // Save back to KV
    await env.TICKETS_KV.put(TICKETS_KEY, JSON.stringify(ticketsData));

    return new Response(JSON.stringify({
      success: true,
      message: body.addComment ? 'Comment added successfully' : 'Ticket updated successfully',
      ticket: sanitizeTicket(ticketsData.tickets[ticketIndex])
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to update ticket',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  // DELETE /api/tickets - Remove a ticket (admin only)
  try {
    const { request, env } = context;

    if (!env.TICKETS_KV) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Check admin password
    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Invalid admin password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body.ticketId) {
      return new Response(JSON.stringify({ error: 'Missing ticket ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get existing tickets
    let ticketsData = await env.TICKETS_KV.get(TICKETS_KEY, 'json');
    if (!ticketsData || !ticketsData.tickets) {
      return new Response(JSON.stringify({ error: 'No tickets found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove ticket
    const originalLength = ticketsData.tickets.length;
    ticketsData.tickets = ticketsData.tickets.filter(t => t.id !== body.ticketId);

    if (ticketsData.tickets.length === originalLength) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save back to KV
    await env.TICKETS_KV.put(TICKETS_KEY, JSON.stringify(ticketsData));

    return new Response(JSON.stringify({
      success: true,
      message: 'Ticket deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to delete ticket',
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
