# ADR-001: Dual-platform repository structure

**Date:** 2026-04-02  
**Status:** Accepted

## Context

Surfaced started as a desktop-only Firefox extension. We decided to add Firefox for Android (Fenix) support. The two platforms share core logic (scroll tracking, notifications, and background behavior) but differ significantly in settings UI: the desktop popup is a fixed-size floating window with hover interactions; Android opens extensions as a sidebar/fullscreen view and requires touch-friendly, responsive design.

Three structural options were considered:

1. **Single flat structure with runtime platform detection** — add `if (isAndroid)` branching throughout the code. Simple to start, accumulates complexity with every change.

2. **Separate branches (main / android)** — diverges over time; changes to shared logic (content.js, background.js) require manual porting between branches.

3. **Shared directory + platform-specific directories, assembled by build script** — explicit separation between what is common and what is platform-specific. Changes to shared logic apply to both platforms automatically.

## Decision

Option 3. Directory layout:

```
shared/     content.js, background.js, shared modules, _locales/, icons/
desktop/    Firefox desktop manifest and popup/
android/    unified Firefox manifest and Android popup/
chrome/     Chrome desktop manifest
```

`build.sh` merges `shared/` + `desktop/` (or `android/`) into a flat package and zips it for AMO submission. The zip structure matches what Firefox expects — no subdirectory prefixes.

## Consequences

- Shared logic changes automatically apply to both platforms.
- Adding a third platform (e.g. Chrome) is straightforward: new directory, new manifest, `build.sh` learns one new case.
- Platform-specific popup rewrites are fully isolated; no risk of desktop regression during Android UI work.
- `docs/` is tracked and maintained with the code. `dist/` is ignored so generated build artifacts do not pollute repository history.
- Platform source directories are overlays, not standalone unpacked extensions. For testing, build the relevant target and load its unpacked ZIP contents; pointing `about:debugging` directly at a platform manifest omits required files from `shared/`.
