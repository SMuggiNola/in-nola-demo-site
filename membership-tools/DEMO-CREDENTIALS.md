# Membership Portal Demo Credentials

## Member Logins

| Email | Password | Status | Expires |
|-------|----------|--------|---------|
| john.murphy@example.com | demo123 | Active | Jan 2027 |
| mary.oconnor@example.com | demo456 | Active | Feb 2027 |
| patrick.walsh@example.com | demo789 | Lifetime | Never |
| sean.brennan@example.com | expired1 | Expired | Dec 2025 |

## Admin Scanner PINs

| PIN |
|-----|
| 112233 |
| 445566 |
| 778899 |

## Quick Start

1. **Member Login:** Open `index.html` and sign in with any credential above
2. **View Certificate:** After login, you'll see your membership certificate with QR code
3. **Admin Scanner:** Open `scanner.html`, enter an admin PIN, then scan a member's QR code

## Verification States

- **Green (Valid):** Member in good standing
- **Orange (Expired):** Membership has expired
- **Red (Invalid):** Tampered or unrecognized QR code
