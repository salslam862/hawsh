# Houshak 2.10.27 — Financial transaction date and customer image gallery

- Finance transaction form defaults to the device's current local date/time and allows an authorized manager to select a prior date/time.
- Server validates a supplied transaction date and stores it as ISO timestamp; omitted dates continue to use the current server time. Audit event still records the actual creation time.
- Customer listing detail photos use a compact square grid (3 columns on larger screens, 2 on mobile) with a circular plus control on each image to open the existing image viewer.
- Updated admin and customer service-worker cache versions so the shared app.js/styles.css changes refresh.
- No changes to listing business logic, admin roles, financial calculations, customer listing data, or existing image viewer navigation.
