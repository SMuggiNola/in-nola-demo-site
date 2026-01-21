# IN-NOLA Site Todo List

## High Priority

- [ ] **Test contact form** - Verify emails arrive at sean.muggivan@gmail.com
- [ ] **Move Resend API key to environment variable** - Add `RESEND_API_KEY` in Cloudflare Pages Settings → Environment Variables (security best practice)
- [ ] **Complete in-nola.org domain transfer** - Transfer from WordPress/current registrar to Cloudflare

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
