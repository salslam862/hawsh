# Houshak v2.10.15 — Offline-first asset intake correction

- Corrected the offline asset-intake path for a **new owner**: the browser no longer attempts the online owner-creation API before saving the asset locally.
- A new owner can be entered completely while offline (name, phone, identity type/number), then the owner and asset are created together during automatic synchronization.
- Offline asset records are persisted in IndexedDB, while the visible queue remains in local storage for reliable restart/reload behavior.
- Selected asset images are also stored locally and uploaded automatically after the asset is synchronized.
- Duplicate protection remains based on `clientRequestId`.
- Bumped service-worker cache versions and added old-cache cleanup so updated Admin/Client JavaScript is not trapped behind an older cached build.
- Corrected server health/export version reporting to 2.10.15.
- Preserved all features from 2.10.10 through 2.10.14, including QR privacy, receipt/PDF sharing, editable owner/manager details, bids, reservations, storage, audit, and PWA behavior.
