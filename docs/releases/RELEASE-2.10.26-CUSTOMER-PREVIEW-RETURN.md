# Houshak 2.10.26 — Customer Preview Return

Built on the existing 2.10.25 admin-exit-login baseline.

- Added a clear “العودة إلى لوحة الإدارة” control only while `customerPreview=1` is active.
- Pressing the phone/browser back button during customer preview returns directly to `/admin` without triggering the app-exit confirmation.
- Bumped client and admin service-worker cache names so the updated shared app shell is refreshed.
- No account-system behavior, customer listing logic, financial flows, or asset-management logic was changed in this release.

Account-system follow-up: no specific new account-system change was described in this request, so existing behavior is intentionally preserved pending the exact requirement.
