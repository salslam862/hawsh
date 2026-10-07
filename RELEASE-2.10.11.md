# Houshak 2.10.11 — Offline-first asset intake

- Offline indicator for admin/client UI.
- Admin can register a new asset without internet after the app has been opened/logged in and required configuration has been cached.
- New offline asset records are stored locally with an idempotent clientRequestId and synced automatically when connection returns.
- Owner data for a new offline asset is included in the same sync operation, preventing duplicate owner creation.
- Existing human-readable asset/receipt codes remain server-generated after sync.
- Images selected while offline are not lost from the form, but are deferred for upload after connectivity is restored in this release; the UI explicitly informs the user.
- GET responses are opportunistically cached by the service worker for offline shell/data reuse.
