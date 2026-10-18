# Houshak 2.10.60 — Customer request lifecycle

## Scope
- Adds human-readable inquiry references (`INQ-...`) and opaque tracking tokens for inquiries, reservations, and purchase offers.
- Adds idempotency keys to inquiry and reservation submissions; validates that a replayed key refers to the same asset/contact and, for reservations, the same requested dates. Offer key reuse for a different asset/contact/amount is rejected.
- Adds a minimal public status endpoint requiring both a high-entropy tracking token and the matching phone number. The response exposes only request kind, reference, status, timestamps, limited asset label, and status history; it does not return the customer's phone or tracking token.
- Stores status history when administration replies to an inquiry, changes a reservation status, or processes an offer.
- Adds a customer-facing “متابعة طلباتي” panel, remembers tracking tokens locally on the same device, and allows manual token/phone lookup.
- Bumps admin/client service-worker cache names.

## Safety
- Status lookup is read-only and does not change reservations, offers, assets, contracts, or financial records.
- Tracking tokens are secrets. They are saved in local storage on the customer's device; clearing browser storage removes the saved shortcuts. Do not share the token.
- This build is not deployed to Railway by this package step.

## Verification
- `node --check src/server.js`
- `node --check public/app.js`
- `npm test` — 61 tests passed in local isolated tests.
- ZIP integrity checked after packaging.
