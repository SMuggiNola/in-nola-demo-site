# IN-NOLA Site Todo List

## High Priority

- [ ] **Test contact form** - Verify emails arrive at sean.muggivan@gmail.com
- [ ] **Move Resend API key to environment variable** - Add `RESEND_API_KEY` in Cloudflare Pages Settings → Environment Variables (security best practice)
- [ ] **Complete in-nola.org domain transfer:**
  - [ ] Unlock domain at WordPress (Upgrades → Domains → Transfer Lock off)
  - [ ] Get Authorization Code (EPP/Auth Code) from WordPress
  - [ ] Verify domain is eligible (60+ days old, not expiring soon)
  - [ ] Copy any existing DNS records you need to keep
  - [ ] Go to Cloudflare Dashboard → Domain Registration → Transfer Domains
  - [ ] Enter `in-nola.org` and paste Authorization Code
  - [ ] Pay for 1 year renewal (Cloudflare at-cost pricing)
  - [ ] Check email for Transfer Approval and click Approve
  - [ ] Wait 1-7 days for transfer to complete

## Once Domain Transfers

- [ ] **Add domain to Cloudflare Pages** - Custom domain setup for in-nola-demo-site
- [ ] **Set up Cloudflare Email Routing** - Create contact@in-nola.org → sean.muggivan@gmail.com
- [ ] **Add Resend custom domain** - Send emails from noreply@in-nola.org instead of resend.dev
- [ ] **Update CONTACT_FROM_EMAIL** - Environment variable to use in-nola.org

## Cleanup

- [ ] **Remove debug output from contact form** - Once confirmed working, remove console.log debug info
- [ ] **Remove MailChannels DNS records** - Clean up _mailchannels TXT record from muggsofdatasci.net
- [ ] **Update _contact-setup.md** - Reflect Resend setup instead of MailChannels

## Membership Enrollment Portal

### Phase 1: PayPal Setup
- [ ] Log into PayPal Business account (or upgrade personal to business)
- [ ] Go to PayPal Developer Dashboard (developer.paypal.com)
- [ ] Create new app (get Client ID and Secret for sandbox + live)
- [ ] Set up membership pricing tiers:
  - [ ] Individual membership ($XX/year)
  - [ ] Family membership ($XX/year)
  - [ ] Lifetime membership ($XXX one-time)
- [ ] Configure PayPal webhook URL for payment notifications

### Phase 2: Database Setup
- [ ] Choose storage solution:
  - [ ] Option A: Cloudflare D1 (SQLite, free tier available)
  - [ ] Option B: Cloudflare KV (key-value, simpler)
  - [ ] Option C: External (Supabase, PlanetScale, etc.)
- [ ] Design member data schema:
  - [ ] Member ID, Name, Email
  - [ ] Username, PIN (hashed)
  - [ ] Membership type, Start date, Expiration date
  - [ ] PayPal transaction ID
  - [ ] Status (active, expired, pending)
- [ ] Create database/tables in chosen solution
- [ ] Set up Cloudflare bindings for Pages Functions

### Phase 3: Enrollment Flow
- [ ] Create membership signup page (`/join-new.html` or similar)
  - [ ] Membership tier selection
  - [ ] Personal info form (name, email, phone)
  - [ ] Terms & conditions checkbox
- [ ] Create Cloudflare Pages Function for enrollment:
  - [ ] `/api/enroll` - Initiate PayPal checkout
  - [ ] `/api/paypal-webhook` - Handle payment confirmation
  - [ ] `/api/enroll-complete` - Return URL after payment
- [ ] Integrate PayPal JavaScript SDK for checkout button
- [ ] Generate unique username (or let user choose)
- [ ] Generate random PIN (4-6 digits)
- [ ] Store member in database after successful payment
- [ ] Send welcome email with login credentials (via Resend)

### Phase 4: Member Portal Updates
- [ ] Update existing `/membership-tools/` login to use new database
- [ ] Replace demo `members-data.js` with real database queries
- [ ] Create `/api/auth` endpoint for login verification
- [ ] Update certificate page to pull real member data
- [ ] Update QR scanner to verify against database

### Phase 5: Admin Features
- [ ] Admin dashboard to view all members
- [ ] Manual member add/edit/remove
- [ ] Export member list (CSV)
- [ ] Renewal reminder emails (automated)
- [ ] Payment history view

### PayPal Integration Notes
- Sandbox testing: Use sandbox credentials first
- Webhook events to handle: `PAYMENT.CAPTURE.COMPLETED`, `BILLING.SUBSCRIPTION.ACTIVATED`
- Store PayPal transaction IDs for refund/dispute handling
- Consider PayPal Subscriptions API for recurring annual dues

---

## Future Improvements

- [ ] **Add reCAPTCHA or Turnstile** - Spam protection for contact form
- [ ] **Email confirmation** - Send confirmation email to form submitter
- [ ] **Form rate limiting** - Prevent abuse
