# ADR-001: Dual-platform repository structure

**Date:** 2026-04-02  
**Status:** Accepted

## Context

Surfaced started as a desktop-only Firefox extension. We decided to add Firefox for Android (Fenix) support. The two platforms share core logic (scroll tracking, notifications, background service worker) but differ significantly in settings UI: the desktop popup is a fixed-size floating window with hover interactions; Android opens extensions as a sidebar/fullscreen view and requires touch-friendly, responsive design.

Three structural options were considered:

1. **Single flat structure with runtime platform detection** — add `if (isAndroid)` branching throughout the code. Simple to start, accumulates complexity with every change.

2. **Separate branches (main / android)** — diverges over time; changes to shared logic (content.js, background.js) require manual porting between branches.

3. **Shared directory + platform-specific directories, assembled by build script** — explicit separation between what is common and what is platform-specific. Changes to shared logic apply to both platforms automatically.

## Decision

Option 3. Directory layout:

```
shared/     content.js, background.js, content.css, _locales/, icons/
desktop/    manifest.json, popup/
android/    manifest.json, popup/
```

`build.sh` merges `shared/` + `desktop/` (or `android/`) into a flat package and zips it for AMO submission. The zip structure matches what Firefox expects — no subdirectory prefixes.

## Consequences

- Shared logic changes automatically apply to both platforms.
- Adding a third platform (e.g. Chrome) is straightforward: new directory, new manifest, `build.sh` learns one new case.
- Platform-specific popup rewrites are fully isolated; no risk of desktop regression during Android UI work.
- `docs/` and `dist/` are gitignored — ADRs stay local, build artifacts don't pollute the repo.
- Loading the extension for quick iteration still works by pointing `about:debugging` at a platform's `manifest.json` directly (paths in manifest are relative to the manifest file, and the build script replicates that flat structure in dist/).
