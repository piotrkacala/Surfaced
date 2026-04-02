# ADR-002: Single AMO package for desktop and Android

**Date:** 2026-04-02  
**Status:** Accepted

## Context

After implementing the Android popup (ADR-001), we had two separate build artifacts: `surfaced-desktop-x.y.z.zip` and `surfaced-android-x.y.z.zip`. Two separate AMO listings would mean:

- Double the review cycles on each release
- Users must know which version to install
- No single "install Surfaced" link to share
- Risk of version drift between the two listings

Firefox identifies addons by their `gecko.id`. One ID = one AMO listing. A single package can declare compatibility with both desktop Firefox and Firefox for Android via `browser_specific_settings.gecko_android`.

## Decision

Ship one unified zip (`surfaced-x.y.z.zip`) containing both platform UIs. The manifest entry point `popup/popup.html` is a thin dispatcher that detects the platform at runtime and redirects to the correct implementation:

```
popup/
  popup.html        ← dispatcher: location.replace() to desktop/ or android/
  desktop/          ← desktop UI (fixed-size, hover interactions)
  android/          ← Android UI (responsive, touch-friendly)
```

Platform detection uses `browser.runtime.getPlatformInfo()` which returns `{ os: "android" }` on Fenix. The redirect uses `location.replace()` so the platform popup.html becomes the actual history entry — the dispatcher leaves no trace.

The unified manifest is `android/manifest.json` (source of truth), which contains both `gecko` and `gecko_android` fields. The desktop manifest (`desktop/manifest.json`) is kept for platform-specific test builds only.

## Build commands

```sh
./build.sh            # unified package → dist/surfaced-x.y.z.zip  (AMO)
./build.sh desktop    # desktop-only    → dist/surfaced-desktop-x.y.z.zip  (testing)
./build.sh android    # android-only    → dist/surfaced-android-x.y.z.zip  (testing)
```

## Consequences

- One AMO listing, one review queue, one install link.
- Version bump touches `android/manifest.json` only (source of truth). `desktop/manifest.json` should be kept in sync manually.
- The dispatcher adds one async round-trip before the popup renders. In practice imperceptible — extension popups open fresh each time.
- If a third platform is ever needed, add a directory and extend the dispatcher condition.
