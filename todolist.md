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

## Future Improvements

- [ ] **Add reCAPTCHA or Turnstile** - Spam protection for contact form
- [ ] **Email confirmation** - Send confirmation email to form submitter
- [ ] **Form rate limiting** - Prevent abuse
