# Contact Form Setup Guide

## How It Works
- Form submits to `/api/contact` (Cloudflare Pages Function)
- Function sends email via Resend API
- Email delivered to configured recipient

## Environment Variables (Cloudflare Dashboard)

Set these in **Pages > Settings > Environment Variables**:

| Variable | Description | Current Value |
|----------|-------------|---------------|
| `RESEND_API_KEY` | Resend API key for sending emails | (set in dashboard) |
| `CONTACT_TO_EMAIL` | Where to receive emails | `irishnetworknola@gmail.com` |

## DNS Records

Resend requires domain verification. The following records should be set in Cloudflare DNS for `in-nola.org`:

- **SPF** — Resend's SPF include (check Resend dashboard for current record)
- **DKIM** — CNAME records provided by Resend during domain verification
- **DMARC** — Optional but recommended for deliverability

## Email Routing

- `contact@in-nola.org` is set up via Cloudflare Email Routing
- Outbound email sends from `IN-NOLA Contact <contact@in-nola.org>` via Resend
- Reply-to is set to the form submitter's email address

## Testing

1. Deploy to Cloudflare Pages
2. Go to `/contact_form.html`
3. Submit a test message
4. Check your inbox (and spam folder initially)

## Troubleshooting

- **Emails going to spam**: Verify DNS records in Resend dashboard
- **"Failed to send"**: Check Cloudflare Pages function logs (`console.error` output)
- **CORS errors**: The function handles OPTIONS requests automatically
