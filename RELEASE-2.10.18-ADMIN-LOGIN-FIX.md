# Houshak 2.10.18 — Admin Login Fix

## Fix
- Admin `/admin` no longer restores a stale `houshakLastUser` session from localStorage.
- If the real admin session is missing or expired, the admin login form is rendered directly.
- If an expired session reaches the dashboard, a 401/"تسجيل الدخول مطلوب" response returns the user to the complete login form instead of leaving an error-only page.
- Login form explicitly renders username/mobile and password fields with autocomplete/input attributes.

## Preserved
- Based on the existing 2.10.18 owner-fix package, itself based on the 2.10.17 stable line.
- Owner autocomplete and owner identity/phone fields are preserved.

## Verification
- `node --check public/app.js` passed.
- `node --check src/server.js` passed.
- `npm test` passed: 20/20.
- Admin endpoint returned HTTP 200.
- Unauthenticated `/api/auth/me` returned 401 as expected.
- Seeded admin login and `/api/auth/me` both succeeded.
