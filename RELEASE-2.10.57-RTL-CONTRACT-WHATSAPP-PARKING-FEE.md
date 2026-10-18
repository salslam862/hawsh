# Houshak 2.10.57 — Contract layout, PDF sharing, optional parking fee

## Changes
- Contract paper uses explicit RTL direction and right-aligned Arabic text for the date, party details, asset details and terms, with normal (non-italic) typography, following the supplied paper-contract reference more closely.
- Contract preview includes a dedicated action to create the contract PDF and invoke the native file-share sheet; on Android the user can select WhatsApp to share the PDF file. Unsupported browsers save the PDF and explain how to attach the actual file in WhatsApp. No claim is made that a message is sent automatically.
- Sale and sale/rent assets now support an optional parking-fee toggle and amount. The fee is validated, persisted across create/edit, included in admin asset details and captured in the asset snapshot used for a sale agreement. It is not confused with daily storage fees and does not automatically create a financial transaction.
- Service-worker caches bumped to admin v36 and client v28.

## Verification
Run `npm test`, `node --check src/server.js`, and `node --check public/app.js` before release. Physical Android camera/share-sheet and production Railway behavior require separate device/deployment verification.
