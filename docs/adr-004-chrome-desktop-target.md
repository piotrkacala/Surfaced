# ADR-004: Chrome desktop target

**Date:** 2026-05-28
**Status:** Accepted

## Context

Surfaced originally targeted Firefox desktop, then added Firefox for Android with a single AMO package. Chrome desktop is a natural next target because the core feature is browser-local, content-script based, and does not depend on Firefox-only product behavior.

The existing AMO package is intentionally Firefox-specific:

- it declares Gecko-specific signing and data-collection metadata
- it includes both desktop and Android Firefox popup implementations
- it uses `android/manifest.json` as the unified Firefox release manifest

Chrome has a different Manifest V3 background contract. Firefox accepts a background script list, while Chrome requires a single extension service worker.

## Decision

Add Chrome desktop as a separate package target with a dedicated manifest:

```text
chrome/
  manifest.json
```

Chrome builds are assembled from:

```text
shared/.          -> package root
desktop/popup/.   -> package popup/
chrome/.          -> package root, overriding manifest.json
```

The default build remains the unified AMO package:

```sh
./build.sh
```

Chrome is built explicitly:

```sh
./build.sh chrome
```

The Chrome manifest uses:

```json
"background": {
  "service_worker": "background.js"
}
```

The Firefox manifests keep:

```json
"background": {
  "scripts": ["extension-api.js", "background.js"]
}
```

## API Compatibility

The runtime code continues to use the `browser.*` WebExtension API shape. A local compatibility file, `shared/extension-api.js`, creates a minimal `browser` facade over `chrome.*` when `browser` is not available.

The adapter covers only the APIs used by Surfaced:

- `runtime`
- `action`
- `storage.local`
- `storage.onChanged`
- `tabs`
- `i18n`

This keeps the source code close to Firefox's Promise-based API while avoiding a dependency on an external polyfill or a bundling step.

## Versioning

For now, `android/manifest.json` remains the release version source of truth for the unified Firefox package. When bumping versions, keep these manifests in sync:

- `android/manifest.json`
- `desktop/manifest.json`
- `chrome/manifest.json`

If Chrome release cadence diverges later, revisit this decision with a separate ADR.

## Consequences

- Chrome desktop gets a store-ready package without changing the Firefox AMO artifact.
- Shared scroll tracking and popup core behavior remain single-sourced.
- Chrome's service worker requirement is isolated to `chrome/manifest.json` and a small `importScripts()` bootstrap in `shared/background.js`.
- The compatibility adapter is deliberately small; new extension API usage must update it when Chrome callback compatibility is needed.
- Chrome desktop currently reuses the Firefox desktop popup. If Chrome-specific UI behavior appears, it should be justified separately before adding another popup fork.
