# Houshak v2.10.13

## PDF sharing
- Restored both PDF sharing buttons.
- The WhatsApp button uses the same native file-sharing flow as the general PDF share button.
- The generated PDF is passed as an actual `File` object to `navigator.share`, so Android can open the system share sheet with the PDF attached and the user can choose WhatsApp or another compatible app.
- Removed the hard failure caused by `navigator.canShare()` returning false; the browser is allowed to attempt `navigator.share()` directly for better Android compatibility.
- Download and print remain available.

Note: a website cannot force WhatsApp itself to accept a local PDF attachment; the reliable web/PWA mechanism is the native Android share sheet, where WhatsApp appears as a destination when supported by the device/browser.
