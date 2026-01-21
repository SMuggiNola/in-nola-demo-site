# Contact Form Setup Guide

## How It Works
- Form submits to `/api/contact` (Cloudflare Pages Function)
- Function sends email via MailChannels API (free for CF Workers/Pages)
- Email delivered to configured recipient

## Environment Variables (Cloudflare Dashboard)

Set these in **Pages > Settings > Environment Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `CONTACT_TO_EMAIL` | Where to receive emails | `sean.muggivan@gmail.com` |
| `CONTACT_TO_NAME` | Recipient display name | `Irish Network NOLA` |
| `CONTACT_FROM_EMAIL` | Sender address | `noreply@in-nola.org` |
| `CONTACT_FROM_NAME` | Sender display name | `IN-NOLA Contact Form` |

## DNS Records for Email Deliverability

Once you have the `in-nola.org` domain in Cloudflare, add these DNS records:

### 1. SPF Record (Required)
Authorizes MailChannels to send on behalf of your domain.

| Type | Name | Content |
|------|------|---------|
| TXT | `@` | `v=spf1 include:_spf.mx.cloudflare.net include:relay.mailchannels.net ~all` |

### 2. Domain Lockdown TXT Record (Required for MailChannels)
Tells MailChannels which CF worker/pages project can send from your domain.

| Type | Name | Content |
|------|------|---------|
| TXT | `_mailchannels` | `v=mc1 cfid=YOUR-PAGES-PROJECT-NAME` |

Replace `YOUR-PAGES-PROJECT-NAME` with your actual Cloudflare Pages project name (e.g., `in-nola-demo`).

### 3. DKIM Record (Recommended)
Improves deliverability. Generate via MailChannels dashboard or use Cloudflare's Email Routing DKIM.

## Testing

1. Deploy to Cloudflare Pages
2. Go to `/contact_form.html`
3. Submit a test message
4. Check your inbox (and spam folder initially)

## Troubleshooting

- **Emails going to spam**: Add SPF and DKIM records
- **"Failed to send"**: Check Cloudflare Pages function logs
- **CORS errors**: The function handles OPTIONS requests automatically

## Future: Custom Domain Email

Once domain transfers:
1. Set up Cloudflare Email Routing
2. Create `contact@in-nola.org` → forwards to Gmail
3. Update `CONTACT_TO_EMAIL` environment variable
