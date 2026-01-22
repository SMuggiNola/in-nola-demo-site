# IN-NOLA Project Context

Welcome back! This file helps maintain continuity between Claude Code sessions.

## Quick Start Prompt
**Would you like to:**
1. Work on outstanding tasks from our todo lists?
2. Continue site improvements based on the diagnostic?
3. Start something new?

---

## Project Overview
Irish Network New Orleans (IN-NOLA) community website with membership management, contact forms, event tracking, and board portal. Built with vanilla HTML/CSS/JavaScript, deployed on Cloudflare Pages.

**Status:** Pre-production POC - functional for demonstration but needs significant work before going live.

---

## Outstanding Task Lists

### Task Ownership Legend
- **[SEAN]** - Technical tasks I can help with
- **[BOARD]** - Requires board member action/info
- **[TREASURER]** - Specifically needs treasurer (sister)

### High Priority

| Task | Owner | Status |
|------|-------|--------|
| Create IN-NOLA Cloudflare account | **[BOARD]** - Org account so infrastructure stays with IN-NOLA | Pending |
| Complete in-nola.org domain transfer | **[BOARD]** - Need WordPress admin access | Pending |
| - Unlock domain at WordPress | [BOARD] | Pending |
| - Get Authorization Code (EPP) | [BOARD] | Pending |
| - Initiate transfer in Cloudflare | [SEAN] once code received | Pending |

### Post-Domain Transfer (Blocked)
| Task | Owner | Status |
|------|-------|--------|
| Add custom domain to Cloudflare Pages | [SEAN] | Blocked |
| Set up email routing (contact@in-nola.org) | [SEAN] | Blocked |
| Configure Resend custom domain | [SEAN] | Blocked |

### Membership Portal - Phase 1: PayPal Setup
| Task | Owner | Status |
|------|-------|--------|
| PayPal Business account access | **[BOARD]** - Need login or upgrade | Pending |
| Set membership pricing tiers | **[BOARD]** - Need decisions on pricing | Pending |
| - Individual membership ($XX/year) | [BOARD] | Pending |
| - Family membership ($XX/year) | [BOARD] | Pending |
| - Lifetime membership ($XXX) | [BOARD] | Pending |
| Create PayPal developer app | [SEAN] once account access | Pending |
| Configure webhooks | [SEAN] | Pending |

### Phase 2: Database Setup
| Task | Owner | Status |
|------|-------|--------|
| Choose storage solution (D1/KV/external) | [SEAN] | Pending |
| Design member data schema | [SEAN] | Pending |
| Create database/tables | [SEAN] | Pending |
| Set up Cloudflare bindings | [SEAN] | Pending |

### Phase 3-5: Enrollment, Portal, Admin
All [SEAN] tasks - technical implementation

### Phase 6: QuickBooks Integration
| Task | Owner | Status |
|------|-------|--------|
| Integration approach decided | - | Done (Option B) |
| Ensure QB Online subscription | **[TREASURER]** | Pending |
| Set up Customer list structure | **[TREASURER]** | Pending |
| Create Products/Services for tiers | **[TREASURER]** | Pending |
| Set up recurring invoices template | **[TREASURER]** | Pending |
| Decide: QB Payments vs PayPal vs both | **[BOARD]** | Pending |
| QuickBooks API setup | [SEAN] once above done | Pending |
| Build sync endpoints | [SEAN] | Pending |

### Cleanup Tasks
| Task | Owner | Status |
|------|-------|--------|
| Remove debug output from contact form | [SEAN] | Pending |
| Remove old MailChannels DNS records | [SEAN] | Pending |
| Update _contact-setup.md docs | [SEAN] | Pending |

### Future Improvements (Low Priority)
| Task | Owner | Status |
|------|-------|--------|
| Add CAPTCHA/Turnstile spam protection | [SEAN] | Pending |
| Email confirmation to submitter | [SEAN] | Pending |
| Form rate limiting | [SEAN] | Pending |

---

## Site Diagnostic Summary (Pre-Production)

### Critical Issues (Must Fix Before Live)
1. **Hardcoded credentials** - Board login visible in source (`admin-portal/index.html:127-128`)
2. **Demo data exposed** - Member passwords/PINs in `membership-tools/js/members-data.js`
3. **XSS vulnerability** - Contact form email template (`functions/api/contact.js:67-75`)
4. **No real authentication** - Using localStorage/sessionStorage flags
5. **No database** - All data hardcoded or ephemeral
6. **CORS too permissive** - `Access-Control-Allow-Origin: *`

### High Priority Fixes
- Move all credentials to environment variables
- Implement real backend authentication
- Add input validation/output encoding
- Implement rate limiting on forms
- Add error logging (Sentry or similar)

### Medium Priority
- Path handling inconsistent (mix of relative/absolute)
- CSS duplicated across files
- Missing `.gitignore`, `package.json`, README
- No Content Security Policy headers
- External scripts without SRI hashes

### Good Points
- CSS custom properties well organized
- Minimal external dependencies
- Smooth transitions/animations
- Performance generally good

### Files Needing Attention
| File | Issue | Priority |
|------|-------|----------|
| `admin-portal/index.html` | Hardcoded credentials (L127-128) | CRITICAL |
| `membership-tools/js/members-data.js` | Demo passwords visible | CRITICAL |
| `functions/api/contact.js` | XSS risk, CORS open | CRITICAL |
| `js/main.js` | Path handling fragile | HIGH |
| `global.css` | Duplicate font imports (L4, L11) | MEDIUM |

---

## Board Member Action Items (for emailing)

**From Board (anyone with WordPress access):**
- Domain transfer authorization code from WordPress

**From Treasurer (sister):**
- QuickBooks Online setup (Customer list, Products/Services, invoice template)
- Decision on QB Payments vs PayPal

**From Board collectively:**
- Membership pricing decisions (Individual, Family, Lifetime amounts)
- PayPal Business account credentials or upgrade

---

## Project Structure
```
in-nola-demo/
├── admin-portal/         # Board dashboard (login + task tracking)
├── assets/               # Images, logos
├── functions/api/        # Cloudflare Pages Functions (contact form)
├── js/                   # Main site JavaScript
├── membership-tools/     # Member login, certificate, QR scanner
│   ├── css/
│   └── js/
├── Our-Village/          # Community pages
├── global.css            # Main stylesheet
├── index.html            # Homepage
└── CLAUDE.md             # This file
```

---

## Recent Session Notes
*(Add notes here as we work together)*

- Initial diagnostic completed
- Todo lists consolidated with ownership
- CLAUDE.md created for session continuity
- Dashboard updated with color-coded owner tags (Board=gold, Treasurer=purple, Tech=gray dimmed)

---

## Useful Commands
```bash
# Start local dev server (if using one)
npx serve .

# Deploy to Cloudflare Pages
# (automatic via git push to main)
```
