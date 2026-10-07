# Houshak v2.10.16

## Public/customer UI cleanup
- Removed the “فتح لوحة الإدارة” button from the public/customer home page.
- The public/customer experience no longer exposes an admin navigation action even when an authenticated admin session exists in the browser.
- Admin remains available only through `/admin/` and its authenticated admin flow.
- Existing customer preview and public navigation remain intact.
