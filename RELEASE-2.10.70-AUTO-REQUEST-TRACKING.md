# Houshak 2.10.70 — Automatic customer request tracking

## Changes
- Customer request tracker refreshes status, replies, and status history every 15 seconds while its modal is open, the page is visible, the browser is online, and a request has been loaded.
- A manual refresh remains available.
- Repeated overlapping tracker fetches are prevented.
- The polling timer is stopped when the modal closes.
- A request entered manually is saved locally only after the server validates its tracking token and phone; no token is exposed to the server response beyond the existing private tracking flow.
- Client/admin service-worker cache identifiers are bumped to avoid stale UI assets.

## Validation
Run `npm test`, `node --check src/server.js`, `node --check public/app.js`, and `unzip -t` on the release archive.

No production deployment or real-device test is claimed by this release note.
