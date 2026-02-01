# IN-NOLA Project Context

**Do you have something new you want to work on? Or do you want to get to work on outstanding tasks?**

---

## Project Overview
Irish Network New Orleans (IN-NOLA) community website with membership management, contact forms, event tracking, and board portal. Built with vanilla HTML/CSS/JavaScript, deployed on Cloudflare Pages.

**Live Site:** https://in-nola-demo-site.pages.dev (currently on Sean's Cloudflare)
**Repo:** https://github.com/SMuggiNola/in-nola-demo-site

**Status:** Pre-production POC - Events and Membership systems are dynamic with Cloudflare KV backend.

---

## What's Working Now

### Events System (Completed This Session)
- **Dynamic events page** - Loads from Cloudflare KV storage
- **Admin add event form** - POST to `/api/events` with PIN auth
- **Inline edit/delete** - Subtle buttons on each event card
- **Facebook/Instagram links** - Icons display when social links added
- **Auto-sorting** - Events automatically move to "Past Events" when date passes
- **KV Namespace:** `INNOLA_EVENTS` (ID: 925270a52e634821b5ca2dce22c66e9e)
- **Admin PINs:** `112233`, `445566`, `778899`

### Contact Form
- Working with Resend API
- Emails to sean.muggivan@gmail.com

### Board Dashboard
- Color-coded tasks by owner (Board=gold, Treasurer=purple, Tech=gray)
- Clickable tasks open email drafts

### Membership System (Completed This Session)
- **Backend API** - `/api/members` with HMAC-SHA256 signed QR codes
- **CSV Import** - `admin-import.html` for bulk member import
- **QR Generator** - `admin-qr.html` for printable button QR codes
- **Static QR Codes** - Only contain member ID + signature (no expiration)
  - Same QR works forever - renewal just updates database
  - Real-time status lookup at scan time
- **Member Login** - Username + 6-digit PIN (auto-generated at import)
- **KV Namespace:** `MEMBERS_KV` (needs to be created)
- **Required Secret:** `MEMBER_SECRET` (32+ random chars for HMAC signing)
- **Admin PINs:** Same board member PINs as events (101010, 202020, etc.)

---

## Outstanding Tasks

### Task Ownership Legend
- **[SEAN]** - Technical tasks
- **[BOARD]** - Requires board member action/info
- **[TREASURER]** - Specifically needs treasurer (sister)

### High Priority - Blocking Everything

| Task | Owner | Status |
|------|-------|--------|
| Create IN-NOLA Cloudflare account | **[BOARD]** | Pending |
| Complete in-nola.org domain transfer | **[BOARD]** | Pending |
| - Unlock domain at WordPress | [BOARD] | Pending |
| - Get Authorization Code (EPP) | [BOARD] | Pending |
| - Initiate transfer in Cloudflare | [SEAN] | Blocked |

### Post-Domain Transfer

| Task | Owner | Status |
|------|-------|--------|
| Clone repo to org Cloudflare account | [SEAN] | Blocked |
| Add custom domain to Pages | [SEAN] | Blocked |
| Set up email routing (contact@in-nola.org) | [SEAN] | Blocked |
| Configure Resend custom domain | [SEAN] | Blocked |
| Re-create KV namespace in org account | [SEAN] | Blocked |
| Seed events to new KV | [SEAN] | Blocked |

### Membership Portal - Phase 1: PayPal Setup

| Task | Owner | Status |
|------|-------|--------|
| PayPal Business account access | **[BOARD]** | Pending |
| Set membership pricing tiers | **[BOARD]** | Pending |
| - Individual ($XX/year) | [BOARD] | Pending |
| - Family ($XX/year) | [BOARD] | Pending |
| - Lifetime ($XXX) | [BOARD] | Pending |
| Create PayPal developer app | [SEAN] | Blocked |

### Phase 2-5: Database, Enrollment, Portal, Admin
All [SEAN] technical tasks - blocked until PayPal decisions made

### Phase 6: QuickBooks Integration

| Task | Owner | Status |
|------|-------|--------|
| Integration approach | - | Done (Option B: site syncs to QB) |
| QB Online subscription (Plus/Advanced) | **[TREASURER]** | Pending |
| Set up Customer list structure | **[TREASURER]** | Pending |
| Create Products/Services for tiers | **[TREASURER]** | Pending |
| Decide: QB Payments vs PayPal vs both | **[BOARD]** | Pending |
| QuickBooks API setup | [SEAN] | Blocked |

### Cleanup Tasks (Can Do Anytime)

| Task | Owner | Status |
|------|-------|--------|
| Remove debug output from contact form | [SEAN] | Pending |
| Remove old MailChannels DNS records | [SEAN] | Pending |
| Update _contact-setup.md docs | [SEAN] | Pending |
| Delete old upcoming.html and past.html | [SEAN] | Pending |

### Future Improvements (Low Priority)

| Task | Owner | Status |
|------|-------|--------|
| Add CAPTCHA/Turnstile spam protection | [SEAN] | Pending |
| Email confirmation to form submitter | [SEAN] | Pending |
| Form rate limiting | [SEAN] | Pending |

---

## Site Diagnostic Summary

### Critical Issues (Must Fix Before Live)
1. **Hardcoded credentials** - Board login in source (`admin-portal/index.html:127-128`)
2. ~~**Demo member data** - Passwords/PINs visible~~ FIXED - moved to backend KV
3. **XSS vulnerability** - Contact form email template (`functions/api/contact.js:67-75`)
4. **No real auth** - Using localStorage/sessionStorage flags (member login now uses backend API)
5. **CORS too open** - `Access-Control-Allow-Origin: *`

### High Priority Fixes
- Move credentials to environment variables
- Implement real backend authentication
- Add input validation/output encoding
- Implement rate limiting
- Add error logging (Sentry or similar)

### Medium Priority
- Path handling inconsistent (relative/absolute mix)
- CSS duplicated across files
- Missing `.gitignore`, `package.json`, README
- No Content Security Policy headers
- External scripts without SRI hashes

### What's Good
- CSS custom properties well organized
- Minimal external dependencies
- Smooth transitions/animations
- Events system now properly dynamic with KV storage

---

## Project Structure
```
in-nola-demo/
├── admin-portal/           # Board dashboard + login
├── assets/                 # Images, logos
├── functions/api/          # Cloudflare Pages Functions
│   ├── contact.js          # Contact form handler
│   ├── events.js           # Events CRUD API
│   ├── events-seed.js      # One-time event seeding
│   └── members.js          # Members API (import, login, verify, QR batch)
├── js/                     # Main site JavaScript
├── membership-tools/       # Member login, certificate, QR scanner, admin tools
│   ├── admin-import.html   # CSV roster import
│   ├── admin-qr.html       # Printable QR code generator
├── Our-Village/
│   └── Events-Page/        # Dynamic events system
│       ├── index.html      # Main events page
│       └── add-event.html  # Admin event form
├── global.css              # Main stylesheet
├── index.html              # Homepage
├── CLAUDE.md               # This file
└── todolist.md             # Detailed task list
```

---

## Useful Commands

```bash
# Local dev (VS Code Live Server or)
npx serve .

# Deploy (automatic on push)
git push

# Seed events to KV (run in browser console on deployed site)
fetch('/api/events-seed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ adminPin: '112233' })
}).then(r => r.json()).then(console.log)

# Check events API
fetch('/api/events').then(r => r.json()).then(console.log)
```

---

## Session History

### Session: January 2025
**Completed:**
- Full site diagnostic with file:line references
- Created CLAUDE.md for session continuity
- Updated dashboard with color-coded task ownership
- Added "Create IN-NOLA Cloudflare account" to tasks
- Added Events to landing page nav cards
- Consolidated events into single dynamic page
- Built events API with Cloudflare KV (GET/POST/PUT/DELETE)
- Created admin form for adding events
- Created seed endpoint for migrating existing events
- Added inline edit/delete buttons on event cards
- Added Facebook/Instagram link fields for social media photos
- Local dev fallback so events page works without API
- Moved "Our Village" from hero button to nav card (3rd position)
- Removed old "Upcoming Events" / "Past Events" buttons from Our Village page
- Nav cards now: About → Events → Our Village → Join → Donate → Contact

**KV Setup Done:**
- Namespace created: `INNOLA_EVENTS`
- Binding configured: `EVENTS_KV`
- Events seeded via `/api/events-seed`

### Session: February 2025
**Completed:**
- Built membership backend API (`functions/api/members.js`)
  - POST `/api/members/import` - CSV roster import with auto-generated usernames/PINs
  - POST `/api/members/login` - Member authentication
  - GET `/api/members/verify?id=X&sig=Y` - QR code verification (real-time status)
  - GET `/api/members?adminPin=X` - List all members (admin)
  - POST `/api/members/qr/batch` - Generate QR data for selected members
- Created admin import page (`admin-import.html`)
- Created admin QR generator page (`admin-qr.html`)
- Updated auth.js to use backend API instead of client-side data
- Updated scanner.js to verify via API
- Updated certificate.js to use server-generated signatures
- Changed login from email/password to username/PIN
- Deleted client-side member database (`members-data.js`)

**Membership KV Setup Needed:**
1. Create KV namespace: `MEMBERS_KV`
2. Add binding in wrangler.toml or Cloudflare dashboard
3. Add secret: `MEMBER_SECRET` (32+ random chars)

**CSV Import Format:**
```csv
name,email,memberType,joinDate,expirationDate
John Murphy,john@example.com,Individual,2025-01-15,2027-01-15
```
