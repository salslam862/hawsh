# Houshak 2.10.81 — Large image-first detail view

- Removed the plus/zoom badge from asset gallery thumbnails; tapping a photo still opens the full-size gallery viewer.
- Expanded the gallery viewer to use a near-full-screen dialog and a large contained image, with image navigation retained.
- Rebalanced promotional-ad details so the image receives roughly three quarters of the desktop detail view and the text/contact panel roughly one quarter; on mobile, the image appears first at a large size and the details follow below.
- Adjusted the single promotional-ad banner to prioritize the image and reduce excess white space.
- Bumped client/admin service-worker caches to v49/v57.

Validation is limited to automated tests and JavaScript syntax checks; no live deployment or real-device visual test was performed.
