// Tasks API - Cloudflare Pages Function
// Handles GET (list), PUT (update), POST (add), DELETE (remove)
// Uses KV binding: BOARD_KV, key: dashboard_tasks

const TASKS_KEY = 'dashboard_tasks';
const ADMIN_PASSWORD = 'innola2026!';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generateId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ── default seed data ────────────────────────────────────────────────

function getDefaultPhases() {
  return [
    {
      id: generateId('phase'),
      title: "Membership Pipeline",
      description: "Goal: every member — current and future — gets access to a membership portal with their member-in-good-standing certificate and QR code. The backend infrastructure (KV database, login API, CSV import, QR system) is built. Now it's about getting real members through the pipeline.",
      tasks: [
        { id: generateId('task'), done: false, text: "<strong>Phase 1: Current Members</strong> - Import existing roster from Google Sheet", owner: "tech", subtasks: [
          { id: generateId('sub'), done: true, text: "Member database built (Cloudflare KV)", owner: "tech" },
          { id: generateId('sub'), done: true, text: "CSV import tool built", owner: "tech" },
          { id: generateId('sub'), done: true, text: "Member login system built (username + PIN)", owner: "tech" },
          { id: generateId('sub'), done: true, text: "Membership certificate page built", owner: "tech" },
          { id: generateId('sub'), done: true, text: "QR code generation and scanning built", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Create MEMBERS_KV namespace in production", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Add MEMBER_SECRET environment variable", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Send current membership roster for import", owner: "board" },
          { id: generateId('sub'), done: false, text: "Import roster and distribute login credentials", owner: "tech" }
        ]},
        { id: generateId('task'), done: false, text: "<strong>Phase 2: Google Form Enrollment</strong> - New members sign up via Google Form, get imported into system", owner: "tech", subtasks: [
          { id: generateId('sub'), done: false, text: "Define workflow: Form → Sheet → CSV export → Import", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Send welcome email with login credentials", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Document import process for board members", owner: "tech" }
        ]},
        { id: generateId('task'), done: false, text: "<strong>Phase 3: Website Enrollment</strong> - Members sign up and pay directly on in-nola.org", owner: "tech", subtasks: [
          { id: generateId('sub'), done: false, text: "Membership signup page with tier selection", owner: "tech" },
          { id: generateId('sub'), done: false, text: "PayPal payment integration", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Automatic member creation after payment", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Welcome email with login credentials", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Member self-service (renewal, profile updates)", owner: "tech" }
        ]}
      ]
    },
    {
      id: generateId('phase'),
      title: "Administration Tools & Capabilities",
      description: "Tools for board members to manage the site, events, and membership from a unified admin portal.",
      tasks: [
        { id: generateId('task'), done: true, text: "<strong>Unified admin login</strong> - Single sign-in across all admin pages", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Board dashboard</strong> - Task tracking with color-coded ownership", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Event management</strong> - Add, edit, and delete events from admin", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Member CSV import</strong> - Bulk import from spreadsheet", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>QR code generator</strong> - Printable member QR codes", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>QR verification scanner</strong> - Scan and verify member status", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Site QR code</strong> - Permanent high-res QR linking to in-nola.org, accessible from homepage", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Landing page quick-access buttons</strong> - Member Login, Admin Scanner, Board Portal, QR Download", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Dynamic next event banner</strong> - Auto-loads upcoming event from API on homepage", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Member login portal</strong> - Username + PIN login page for members", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Ticketing system</strong> - Board members submit requests, track completed work", owner: "tech", subtasks: [
          { id: generateId('sub'), done: true, text: "Submit new request form (title, description, priority)", owner: "tech" },
          { id: generateId('sub'), done: true, text: "View open and completed tickets", owner: "tech" },
          { id: generateId('sub'), done: true, text: "Status updates and comments on tickets", owner: "tech" },
          { id: generateId('sub'), done: true, text: "KV storage for ticket data", owner: "tech" }
        ]},
        { id: generateId('task'), done: true, text: "<strong>Dynamic task dashboard</strong> - KV-backed task management with live toggling", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Member management</strong> - Edit and remove individual members", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Export member list</strong> - CSV download of roster", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Renewal reminders</strong> - Automated email notifications", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Spam protection</strong> - Add CAPTCHA/Turnstile to contact form", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Contact form confirmation</strong> - Email confirmation to submitter", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Rate limiting</strong> - Prevent form abuse", owner: "tech" }
      ]
    },
    {
      id: generateId('phase'),
      title: "QuickBooks Integration",
      description: "Sync new members to QuickBooks automatically. Treasurer needs to set up QB side first.",
      tasks: [
        { id: generateId('task'), done: true, text: "<strong>Integration approach decided</strong> - Website syncs to QuickBooks automatically", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>QuickBooks setup</strong>", owner: "treasurer", subtasks: [
          { id: generateId('sub'), done: false, text: "Ensure QuickBooks Online subscription (Plus or Advanced)", owner: "treasurer" },
          { id: generateId('sub'), done: false, text: "Set up Customer list structure for members", owner: "treasurer" },
          { id: generateId('sub'), done: false, text: "Create Products/Services for membership tiers", owner: "treasurer" },
          { id: generateId('sub'), done: false, text: "Set up recurring invoices template", owner: "treasurer" },
          { id: generateId('sub'), done: false, text: "Decide: QuickBooks Payments vs PayPal vs both", owner: "board" }
        ]},
        { id: generateId('task'), done: false, text: "<strong>QuickBooks API setup</strong> - Developer portal credentials", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Build sync endpoints</strong> - Connect website to QuickBooks", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Map data fields</strong>", owner: "tech", subtasks: [
          { id: generateId('sub'), done: false, text: "Member Name to Customer DisplayName", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Email to PrimaryEmailAddr", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Membership Type to custom field", owner: "tech" },
          { id: generateId('sub'), done: false, text: "Expiration Date to custom field", owner: "tech" }
        ]}
      ]
    },
    {
      id: generateId('phase'),
      title: "Website Logistics",
      description: "Site structure, navigation flow, content cleanup, and general polish. Parking lot for things that need attention when there's bandwidth.",
      tasks: [
        { id: generateId('task'), done: false, text: "<strong>Review site navigation flow</strong> - Make sure paths between pages make sense", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Consistent page structure</strong> - Headers, footers, back links across all pages", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>CSS cleanup</strong> - Reduce duplication across stylesheets", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Mobile responsiveness audit</strong> - Test all pages on phone/tablet", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Content Security Policy</strong> - Add security headers", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Add .gitignore and package.json</strong> - Standard project housekeeping", owner: "tech" }
      ]
    },
    {
      id: generateId('phase'),
      title: "Complete: Migration to New Website",
      description: "Domain transfer from WordPress, Cloudflare infrastructure setup, email configuration, and cleanup.",
      tasks: [
        { id: generateId('task'), done: true, text: "<strong>Create IN-NOLA Cloudflare account</strong> - Organization account", owner: "board" },
        { id: generateId('task'), done: true, text: "<strong>Complete in-nola.org domain transfer</strong>", owner: "board", subtasks: [
          { id: generateId('sub'), done: true, text: "Unlock domain at WordPress", owner: "board" },
          { id: generateId('sub'), done: true, text: "Get Authorization Code from WordPress", owner: "board" },
          { id: generateId('sub'), done: true, text: "Verify domain eligibility (60+ days old)", owner: "board" },
          { id: generateId('sub'), done: true, text: "Copy existing DNS records", owner: "tech" },
          { id: generateId('sub'), done: true, text: "Initiate transfer in Cloudflare", owner: "tech" },
          { id: generateId('sub'), done: true, text: "Pay for 1 year renewal", owner: "board" },
          { id: generateId('sub'), done: true, text: "Approve transfer via email", owner: "board" },
          { id: generateId('sub'), done: true, text: "Wait for transfer to complete", owner: "tech" }
        ]},
        { id: generateId('task'), done: true, text: "<strong>Add custom domain</strong> - Connect in-nola.org to website", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Set up email routing</strong> - Create contact@in-nola.org", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Configure email sending</strong> - Send from in-nola.org via Resend", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Test contact form</strong> - Verified working", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Secure API credentials</strong> - Moved to environment variables", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Remove debug output</strong> - Cleaned up contact form error responses", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Update documentation</strong> - Reflect current Resend email setup", owner: "tech" },
        { id: generateId('task'), done: false, text: "<strong>Remove old MailChannels DNS records</strong> - Clean up unused email config in Cloudflare", owner: "tech" }
      ]
    },
    {
      id: generateId('phase'),
      title: "Complete: PayPal Setup",
      description: "PayPal configured to accept membership dues and donations.",
      tasks: [
        { id: generateId('task'), done: true, text: "<strong>PayPal Business account</strong> - Upgraded to business", owner: "board" },
        { id: generateId('task'), done: true, text: "<strong>Developer credentials</strong> - App created for payment processing", owner: "tech" },
        { id: generateId('task'), done: true, text: "<strong>Set membership pricing tiers</strong>", owner: "board", subtasks: [
          { id: generateId('sub'), done: true, text: "Individual membership", owner: "board" },
          { id: generateId('sub'), done: true, text: "Family membership", owner: "board" },
          { id: generateId('sub'), done: true, text: "Lifetime membership", owner: "board" }
        ]},
        { id: generateId('task'), done: true, text: "<strong>Configure payment notifications</strong> - Webhook setup", owner: "tech" }
      ]
    }
  ];
}

// ── helpers ───────────────────────────────────────────────────────────

async function loadOrSeedTasks(kv) {
  let data = await kv.get(TASKS_KEY, 'json');
  if (!data) {
    data = { phases: getDefaultPhases() };
    await kv.put(TASKS_KEY, JSON.stringify(data));
  }
  return data;
}

function findTaskById(phases, taskId) {
  for (const phase of phases) {
    for (const task of phase.tasks) {
      if (task.id === taskId) return task;
      if (task.subtasks) {
        for (const sub of task.subtasks) {
          if (sub.id === taskId) return sub;
        }
      }
    }
  }
  return null;
}

// ── GET /api/tasks ───────────────────────────────────────────────────

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const url = new URL(context.request.url);
    const password = url.searchParams.get('adminPassword');

    if (!password || password !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Invalid admin password' }, { status: 401, headers: corsHeaders });
    }

    if (!env.BOARD_KV) {
      return Response.json({ error: 'KV not configured', phases: [] }, { status: 200, headers: corsHeaders });
    }

    const data = await loadOrSeedTasks(env.BOARD_KV);
    return Response.json(data, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: 'Failed to fetch tasks', details: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ── PUT /api/tasks — update a task field ─────────────────────────────

export async function onRequestPut(context) {
  try {
    const { request, env } = context;

    if (!env.BOARD_KV) {
      return Response.json({ error: 'KV not configured' }, { status: 500, headers: corsHeaders });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Invalid admin password' }, { status: 401, headers: corsHeaders });
    }

    if (!body.taskId || !body.field) {
      return Response.json({ error: 'Missing taskId or field' }, { status: 400, headers: corsHeaders });
    }

    const data = await loadOrSeedTasks(env.BOARD_KV);
    const task = findTaskById(data.phases, body.taskId);

    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404, headers: corsHeaders });
    }

    // Only allow updating safe fields
    const allowedFields = ['done', 'text', 'owner'];
    if (!allowedFields.includes(body.field)) {
      return Response.json({ error: 'Invalid field' }, { status: 400, headers: corsHeaders });
    }

    task[body.field] = body.value;

    await env.BOARD_KV.put(TASKS_KEY, JSON.stringify(data));

    return Response.json({ success: true, task }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: 'Failed to update task', details: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ── POST /api/tasks — add a new task to a phase ─────────────────────

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.BOARD_KV) {
      return Response.json({ error: 'KV not configured' }, { status: 500, headers: corsHeaders });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Invalid admin password' }, { status: 401, headers: corsHeaders });
    }

    if (body.phaseIndex === undefined || !body.task || !body.task.text) {
      return Response.json({ error: 'Missing phaseIndex or task data' }, { status: 400, headers: corsHeaders });
    }

    const data = await loadOrSeedTasks(env.BOARD_KV);

    if (body.phaseIndex < 0 || body.phaseIndex >= data.phases.length) {
      return Response.json({ error: 'Invalid phase index' }, { status: 400, headers: corsHeaders });
    }

    const newTask = {
      id: generateId('task'),
      text: body.task.text,
      owner: body.task.owner || 'tech',
      done: body.task.done || false,
    };

    // If adding as a subtask of an existing task
    if (body.parentTaskId) {
      const parent = findTaskById(data.phases, body.parentTaskId);
      if (!parent) {
        return Response.json({ error: 'Parent task not found' }, { status: 404, headers: corsHeaders });
      }
      if (!parent.subtasks) parent.subtasks = [];
      newTask.id = generateId('sub');
      parent.subtasks.push(newTask);
    } else {
      data.phases[body.phaseIndex].tasks.push(newTask);
    }

    await env.BOARD_KV.put(TASKS_KEY, JSON.stringify(data));

    return Response.json({ success: true, task: newTask }, { status: 201, headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: 'Failed to add task', details: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ── DELETE /api/tasks — remove a task ────────────────────────────────

export async function onRequestDelete(context) {
  try {
    const { request, env } = context;

    if (!env.BOARD_KV) {
      return Response.json({ error: 'KV not configured' }, { status: 500, headers: corsHeaders });
    }

    const body = await request.json();

    if (!body.adminPassword || body.adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Invalid admin password' }, { status: 401, headers: corsHeaders });
    }

    if (!body.taskId) {
      return Response.json({ error: 'Missing taskId' }, { status: 400, headers: corsHeaders });
    }

    const data = await loadOrSeedTasks(env.BOARD_KV);
    let found = false;

    for (const phase of data.phases) {
      // Check top-level tasks
      const taskIndex = phase.tasks.findIndex(t => t.id === body.taskId);
      if (taskIndex !== -1) {
        phase.tasks.splice(taskIndex, 1);
        found = true;
        break;
      }
      // Check subtasks
      for (const task of phase.tasks) {
        if (task.subtasks) {
          const subIndex = task.subtasks.findIndex(s => s.id === body.taskId);
          if (subIndex !== -1) {
            task.subtasks.splice(subIndex, 1);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    if (!found) {
      return Response.json({ error: 'Task not found' }, { status: 404, headers: corsHeaders });
    }

    await env.BOARD_KV.put(TASKS_KEY, JSON.stringify(data));

    return Response.json({ success: true, message: 'Task deleted' }, { headers: corsHeaders });

  } catch (error) {
    return Response.json({ error: 'Failed to delete task', details: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ── CORS preflight ───────────────────────────────────────────────────

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
