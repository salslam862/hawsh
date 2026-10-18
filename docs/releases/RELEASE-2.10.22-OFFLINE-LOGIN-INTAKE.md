# Houshak 2.10.22 — Offline Admin Login + Intake Fix

## Scope
This release fixes only the offline admin entry path needed for offline login and offline asset intake. Existing online behavior and application features are preserved.

## Fixes
- Admin service worker scope covers `/admin` as well as `/admin/`, so an already-visited admin page can reopen while offline.
- Offline admin initialization uses locally cached settings, categories, yards, owners, and vehicle types instead of attempting required network calls.
- After a successful online login on the same device, the stored offline credential check can open the admin UI without network access.
- Offline admin mode exposes the existing asset intake action; new assets remain local until connectivity returns.
- Online synchronization continues through `/api/admin/offline/intake` and existing clientRequestId protections.

## Verification
- `node --check public/app.js` passed.
- `node --check src/server.js` passed.
- `npm test` passed: 20/20.
