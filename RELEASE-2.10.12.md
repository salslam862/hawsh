# Houshak 2.10.12 — QR privacy + receipt flow fix

- QR/public asset flow keeps the public page sanitized: internal asset UUID is no longer exposed; QR uses the opaque public token.
- Admin lookup still supports the human asset/receipt numbers (`AST-...` / `REC-...`) for authorized staff.
- Customer QR page exposes asset details only and contacts Houshak, never the owner directly.
- Fixed receipt page JavaScript error that prevented the receipt from rendering and disabled the action buttons.
- “إنشاء سند استلام الأصل” and “حفظ وإنشاء السند” now navigate to the receipt page in the same tab, avoiding popup blockers.
- Receipt actions simplified to: مشاركة PDF، تنزيل PDF، طباعة، إغلاق.
- PDF sharing uses the native Android/browser share sheet and can share the generated PDF file; WhatsApp can be selected from that share sheet when available.
- “إغلاق” returns to the previous admin page.
- Removed the separate vehicle “الماركة” field; vehicle company/type remains admin-managed and model is separate.
