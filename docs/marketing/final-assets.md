# Final Marketing Assets

**Status:** Accepted assets for the current listing refresh  
**Last updated:** 2026-11-05

This document is the release-facing inventory for the current Surfaced marketing assets.

## Repository policy

Track these in git:

- final approved listing screenshots in `screenshots/`
- final approved animations in `screenshots/animations/`
- capture fixtures and tooling in `fixtures/marketing/` and `tools/capture/`
- supporting copy and planning docs in `docs/marketing/`

Keep these out of git:

- generated frame sequences in `output/playwright/`
- transient encoded files in `output/animations/`
- build artifacts in `dist/`

In short: `output/` is the working area, `screenshots/` is the canonical checked-in asset set.

## Accepted listing screenshots

| File | Purpose | Source scene |
|---|---|---|
| `screenshots/amo-s1-desktop-reminder-context.png` | Hero reminder shown in page context | `desktop-reminder-context` |
| `screenshots/amo-s2-desktop-threshold-control.png` | Threshold controls in the desktop popup | `desktop-threshold-control` |
| `screenshots/amo-s3-desktop-custom-preview.png` | Editable first reminder text with live preview | `desktop-custom-preview` |
| `screenshots/amo-s4-desktop-site-settings.png` | Per-site enablement and threshold override | `desktop-site-settings` |
| `screenshots/amo-s5-android-popup.png` | Android popup layout in the dark theme | `android-popup` |

AMO uses s1–s5. Chrome Web Store uses s1–s4, because the Chrome package has no Android popup.

The optional `reminder-escalation` (s6) and `site-settings-list` (s7) scenes can still be rendered, but they are not part of the accepted set.

## Accepted promo tile

| File | Purpose | Source scene |
|---|---|---|
| `screenshots/chrome-small-promo-tile.png` | Chrome Web Store small promo tile, `440x280` | `chrome-small-promo-tile` |

The tile is dark on purpose, unlike the light screenshots: Chrome's image guidelines ask to avoid large white and light gray areas.

## Accepted animations

| File | Purpose | Source scene |
|---|---|---|
| `screenshots/animations/anim-preview-edit.mp4` | Editing the first reminder text in the popup | `anim-preview-edit` |
| `screenshots/animations/anim-preview-edit.gif` | Editing the first reminder text in the popup | `anim-preview-edit` |
| `screenshots/animations/anim-reminder-depth.mp4` | Reminder escalation across depth zones | `anim-reminder-depth` |
| `screenshots/animations/anim-reminder-depth.gif` | Reminder escalation across depth zones | `anim-reminder-depth` |
| `screenshots/animations/anim-site-override.mp4` | Enabling and tuning a site-specific threshold override | `anim-site-override` |
| `screenshots/animations/anim-site-override.gif` | Enabling and tuning a site-specific threshold override | `anim-site-override` |

`anim-reminder-depth.gif` is about 2.7 MB, because the softened page compresses poorly as a GIF. That size is accepted: the README is the only place that uses it, and `build.sh` does not package these files. Dithering options do not help, and a smaller palette loses the accent color at 32 colors.

## Refresh workflow

1. Render stills or frame sequences into `output/` with `tools/capture/capture-assets.mjs`.
2. Encode motion sequences with `tools/capture/encode-animations.sh`.
3. Review the generated output.
4. Promote approved assets into `screenshots/` or `screenshots/animations/`.
5. Update this document if the accepted set changes.
