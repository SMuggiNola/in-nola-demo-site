# Membership Portal Demo Credentials

## Member Logins

| Email | Password | Status | Type |
|-------|----------|--------|------|
| john.murphy@example.com | demo123 | Active | Individual |
| mary.oconnor@example.com | demo456 | Active | Family |
| patrick.walsh@example.com | demo789 | Active | Lifetime |
| sean.brennan@example.com | expired1 | Expired | Individual |

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
