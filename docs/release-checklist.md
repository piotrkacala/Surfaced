# Surfaced release checklist

Use this checklist for every release candidate. Record the exact commit, browser
versions, device versions, artifact hashes, and evidence for manual checks. A
harness using stubbed WebExtension APIs does not replace a test of the installed
extension or the browser's permission panels.

## 1. Release identity and scope

- Confirm the intended release scope and review the complete diff from the last
  released tag.
- Update `android/manifest.json` first, then repeat the same version in
  `desktop/manifest.json` and `chrome/manifest.json`.
- Confirm that the extension ID and permission model changed only when intended.
- Confirm that README, privacy policy, ADRs, locale copy, and store listing copy
  describe the shipped behavior.
- Keep generated ZIP files out of Git. Do not tag or publish before all required
  gates have an explicit result.

## 2. Automated gates

Run at least:

```sh
node --test --test-isolation=none tests/*.test.js
node tests/browser-smoke.mjs
SURFACED_BROWSER=firefox node tests/browser-smoke.mjs
node tests/chromium-extension-smoke.mjs
bash -n build.sh
git diff --check
./build.sh
./build.sh desktop
./build.sh android
./build.sh chrome
./build.sh all
```

Additionally:

- run `node --check` for every JavaScript and MJS file;
- parse every JSON file with a real JSON parser;
- verify that English and Polish locale keys and placeholders match;
- run `unzip -tq` for all four current-version ZIP files;
- inspect manifests, content/background entry points, and popup overlays in all
  artifacts;
- run `web-ext lint` on a freshly unpacked unified artifact and require zero
  errors, warnings, and notices attributable to the extension;
- run two consecutive complete builds and require identical SHA-256 for every
  artifact;
- record the final names and SHA-256 of unified, Firefox desktop test, Firefox
  Android test, and Chrome desktop artifacts.

## 3. Persistent-settings sentinel

Before upgrade and lifecycle tests, set a recognizable non-default value for
each of the five persistent settings:

1. global threshold, including a valid fractional or out-of-recommended-range
   value;
2. custom reminder text containing Unicode;
3. global enabled state;
4. at least two disabled domains;
5. at least two per-site threshold overrides.

Export the settings as a control file. After every update or restart, confirm
all five values, confirm that no sixth persistent key appeared, and verify that
session pause is not included in the export.

## 4. Firefox desktop

Test the exact unified artifact, preferably in a fresh profile and through the
same signed update channel used for release.

- Verify routed desktop popup rendering and complete Tab/Shift+Tab navigation,
  Space/Enter activation, visible focus, confirmations, retry states, permission
  restore focus, and import/export controls.
- Test global settings, current-site settings, site-manager actions, and complete
  import while closing the popup immediately and after approximately 50 ms and
  100 ms. Reopen it and confirm that every accepted operation persisted fully.
- On normal HTTP(S) pages verify window and element scrolling, all three reminder
  levels, `×`, badge, Home/back-to-top, End, an anchor or programmatic jump,
  virtual-list behavior, and SPA navigation.
- In the real Add-ons permission panel revoke all-site access, reload the page,
  and confirm that page tracking stops while the five saved settings remain
  available. Missing or partial access must not appear as a storage reset.
- Restore access from a direct popup action, handle the native permission prompt,
  reload the page, and confirm verified access, focus/status behavior, reminder,
  and badge. Test partial access when the browser exposes it.
- Pause with multiple existing tabs, open another tab, then resume. Confirm badge
  and reminder clearing, no overdue reminder on resume, fresh session state after
  extension reload/update and browser restart, and unchanged persistent settings.

## 5. Chrome desktop

Load the exact unpacked Chrome artifact in a fresh profile.

- Repeat the core popup, persistence, scrolling, reminder, badge, site-manager,
  import/export, and session-pause checks.
- In the real Site access controls test no access or On click, a single-site
  grant, and all-site access. Reload affected pages after every change.
- Confirm honest `missing`, `partial`, denied, and restored states; saved settings
  must remain available and tracking must stay inactive where access is absent.
- Exercise both denial and approval of the native restore prompt. A successful
  request must be rechecked before the popup reports restored access.
- Restart Chrome and verify that persistent settings remain while session pause
  is cleared.

## 6. Signed upgrade

- Install the previously published, signed version in a fresh profile. Do not
  substitute an unpacked or temporary extension for this gate.
- Apply the five-setting sentinel and save a control export.
- Update in place, without uninstalling or clearing storage, through a signed
  build with the same extension ID and real update path.
- Compare all five values after the update and after a browser restart. Confirm
  the site manager, import/export, permission health, tracking, reminder, and
  badge still work.
- Confirm that temporary session pause follows the documented extension
  update/reload lifecycle and never becomes a persistent sixth setting.

## 7. Physical Firefox for Android

Responsive desktop mode does not satisfy this gate. Use a supported Firefox for
Android/Fenix version on a physical device.

- Confirm routing to the Android popup, portrait/landscape layout, real widths
  around 320, 360, and 386 CSS pixels, no overflow, and appropriate touch targets.
- Test the complete popup with touch and, when available, TalkBack and a hardware
  keyboard: labels, focus order, switches, manager, confirmations, retry states,
  session pause, import/export, and permission health.
- Exercise the system file picker with a Unicode export/import and confirm that
  malformed input cannot partially replace settings.
- Test permission revoke, partial access when available, and restore through the
  real Fenix permission UI.
- Verify window and element scrolling, reminder levels, `×`, Home/back-to-top or
  equivalent, large jumps, SPA/virtual-list behavior, and reduced motion.
- Test multiple tabs, app/browser restart, and extension lifecycle: persistent
  local settings remain, while the session pause returns to active behavior.

## 8. Release completion

- Enter the result, environment, and evidence for every manual gate below.
- Rebuild from the exact intended commit after the last code change and record
  the final four SHA-256 values.
- Confirm the staging area contains only intended source, test, and maintained
  documentation files.
- Commit the release, tag that exact commit, and publish only the verified
  artifacts. Store checksums with the release notes.

| Gate | Environment/version | Result | Evidence or blocker |
|---|---|---|---|
| Automated suite and artifacts | | | |
| Firefox desktop installed extension | | | |
| Firefox permission panel | | | |
| Chrome installed extension and Site access | | | |
| Signed upgrade from previous release | | | |
| Physical Firefox Android/Fenix | | | |
