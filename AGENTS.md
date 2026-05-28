# AGENTS.md

This is the canonical instruction file for this repository. Agent-specific files should point here instead of duplicating repository rules.

## Project Overview

Surfaced is a WebExtension (Manifest V3) that tracks cumulative infinite-scroll depth and shows gentle notifications when the user has gone too far down a page.
It targets Firefox desktop, Firefox for Android, and Chrome desktop, keeps all data local in the browser, and uses plain vanilla JavaScript/HTML/CSS with no external runtime dependencies.

## Key Invariants

- The extension stays offline: no analytics, no remote APIs, no background network features unless the product direction changes explicitly.
- Shared browsing behavior lives in `shared/` and must remain compatible with Firefox desktop, Firefox Android, and Chrome desktop builds.
- The unified AMO package is the primary Firefox release artifact; `android/manifest.json` is the source of truth for the unified Firefox manifest and version.
- Chrome desktop ships as a separate package with its own manifest in `chrome/manifest.json`.
- User settings persist only through `browser.storage.local`; do not introduce parallel persistence paths casually.
- Popup and notification UI are isolated with Shadow DOM; styling assumptions from the host page must not leak in.

## Start Here

Read these first before making significant changes:
- `README.md` — current product behavior, UX, and user-facing terminology
- `docs/adr-001-dual-platform-structure.md` — why shared logic and platform-specific UI are split this way
- `docs/adr-002-unified-package.md` — why the unified package exists and which manifest is authoritative
- `docs/adr-003-threshold-value-policy.md` — why thresholds are sanitized but not constrained to the recommended UI range
- `docs/adr-004-chrome-desktop-target.md` — why Chrome desktop is a separate package and how API compatibility is handled
- `build.sh` — packaging contract for desktop, Android, Chrome, and unified builds

## Commands

### Development

```bash
./build.sh
./build.sh desktop
./build.sh android
./build.sh chrome
./build.sh all
```

### Quality

```bash
bash -n build.sh
./build.sh
```

### Testing

```bash
# No automated test runner exists in this repo.
# Smoke-test manually in Firefox via about:debugging using:
./build.sh
./build.sh desktop
./build.sh android
./build.sh chrome
```

### Production

```bash
./build.sh
```

## Repository Structure

- `shared/` — cross-platform runtime code: content script, background script, i18n, icons, popup dispatcher
- `desktop/` — desktop-specific manifest and popup implementation
- `android/` — Android-specific manifest and popup implementation; source of truth for unified release metadata
- `chrome/` — Chrome desktop manifest; reuses the desktop popup at build time
- `docs/` — ADRs and local implementation notes that explain non-obvious decisions
- `dist/` — generated zip artifacts
- `screenshots/` — store and listing screenshots

## Architecture Notes

- `shared/content.js` owns scroll-depth tracking, zone transitions, SPA reset behavior, and notification rendering.
- `shared/background.js` only updates the browser action badge from `SCROLL_DEPTH` messages sent by the content script.
- `shared/extension-api.js` provides a small `browser.*` compatibility layer over `chrome.*` for Chromium-family builds.
- Popup changes are split by platform: `desktop/popup/*` and `android/popup/*`. The unified popup entry point is `shared/popup/popup.html` plus `shared/popup/dispatcher.js`.
- Chrome desktop reuses `desktop/popup/*`; `build.sh chrome` overlays the desktop popup into the Chrome package.
- The dispatcher selects `android/popup.html` or `desktop/popup.html` with `browser.runtime.getPlatformInfo()` and `location.replace()`. If popup routing changes, verify unified packaging as well.
- Popup CSS files are only shell/fallback styling. The actual popup UI is mounted and styled inside Shadow DOM from `popup.js`.
- Notification host positioning and internals are owned directly by `shared/content.js` inside the injected host and closed shadow root.
- Current persisted settings keys are `scrollNotifierThreshold`, `scrollNotifierText`, `scrollNotifierEnabled`, `scrollNotifierDisabledDomains`, and `scrollNotifierSiteOverrides`.
- Locales live in `shared/_locales/{en,pl}/messages.json`. Keep English and Polish in sync when changing copy or adding UI strings.

## Workflow Rules

- Prefer changing `shared/` when behavior should match across Firefox desktop, Firefox Android, and Chrome desktop. Do not fork logic into platform directories without a clear UI or manifest reason.
- Treat the desktop and Android popups as intentionally separate UIs. Similar code is acceptable if it prevents platform-specific regressions.
- Treat Chrome desktop as a packaging/browser-API target unless Chrome-specific UX behavior proves necessary.
- When changing packaging, manifests, popup routing, or versioning, update the relevant ADR or README if the contract changed.
- If you bump the extension version for release work, update `android/manifest.json` first and keep `desktop/manifest.json` and `chrome/manifest.json` in sync.
- Do not add a bundler, framework, or dependency pipeline as a convenience refactor. This repo currently relies on static files and `build.sh`.
- Do not assume `docs/` is generated or throwaway. It is part of the maintained repository history.

## Quality Gates

Before considering a change done:
- Run `bash -n build.sh` if you touched the build script.
- Run `./build.sh` for any change that can affect the unified package.
- Run `./build.sh desktop` and/or `./build.sh android` when a platform-specific manifest or popup changed.
- Run `./build.sh chrome` when Chrome manifest, API compatibility, shared runtime, or desktop popup behavior changed.
- Manually smoke-test the relevant flow in Firefox, because this repo currently has no automated lint, typecheck, or test suite.

## Environment Blockers

Before debugging runtime issues:
- Verify whether you loaded a built zip from `dist/` or a platform manifest directly in `about:debugging`; popup routing differs between those paths.
- Content script changes usually require reloading the tab, not just reopening the popup.
- Background script changes require reloading the extension.
- Popup changes usually appear only after reopening the popup; Android-specific layout issues need verification on Firefox for Android, not desktop Firefox responsive mode alone.
- If the badge or notifications look wrong, check message flow between `content.js` and `background.js` before changing UI code.

## Agent-Specific Notes

- `AGENTS.md` is the source of truth for repository instructions.
- `CODEX.md` should remain a thin adapter that points back here and does not duplicate repository rules.
- If future agent-specific files are added, keep them short and point back here.
