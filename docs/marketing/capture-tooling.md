# Capture Tooling

**Status:** Working notes for asset production  
**Last updated:** 2026-11-11

This repo now contains deterministic fixture pages and capture harnesses for Surfaced marketing assets.

## What is in the repo

- [fixtures/marketing/long-article.html](../../fixtures/marketing/long-article.html)
- [fixtures/marketing/feed.html](../../fixtures/marketing/feed.html)
- [fixtures/marketing/fixture-runtime.mjs](../../fixtures/marketing/fixture-runtime.mjs)
- [tools/capture/popup-harness.html](../../tools/capture/popup-harness.html)
- [tools/capture/popup-harness.mjs](../../tools/capture/popup-harness.mjs)
- [tools/capture/reminder-depths.html](../../tools/capture/reminder-depths.html)
- [tools/capture/reminder-depths.mjs](../../tools/capture/reminder-depths.mjs)
- [tools/capture/capture-assets.mjs](../../tools/capture/capture-assets.mjs)
- [tools/capture/scene-definitions.mjs](../../tools/capture/scene-definitions.mjs)
- [tools/capture/chrome-small-promo-tile.html](../../tools/capture/chrome-small-promo-tile.html)
- [tools/capture/encode-animations.sh](../../tools/capture/encode-animations.sh)

## Why this setup exists

The goal is to make screenshot and animation production:

- repeatable
- independent from third-party websites
- safe for public marketing use
- easy to refresh after UI changes

## Static fixtures

The fixture pages provide neutral long-scroll environments for reminder captures:

- `long-article.html` for editorial / reading contexts
- `feed.html` for card-based / feed-like contexts

They can render Surfaced reminder states from URL parameters.

`softPage=1` blurs and fades the placeholder page so the reminder stays the focal point; the title card and the reminder stay sharp. `desktop-reminder-context` and every `anim-reminder-depth` frame use it, so the page is already soft before the first reminder appears instead of changing with it. It is a capture-only choice: Surfaced never blurs real pages.

## Close-up scenes

A reminder is small next to a full `1280x800` page, and it nearly disappears in a store thumbnail. Close-up scenes are therefore captured with a `640x400` viewport at double pixel density. The saved image is still `1280x800`, but the page and the reminder appear twice as large, as they would at 200% browser zoom. The caption card has its own rules for that density, so it keeps the size it has in the other scenes.

## Reminder depths

`reminder-depths.html` renders the real reminder card once per depth zone, through the same `shared/reminder-view.js` API as the popup preview and with the product's own messages. The labels are the scene's `threshold` and its multiples.

## Reduced motion

`capturePageOptions` emulates reduced motion for every capture, so the reminder skips its entrance animation and each frame shows a settled state. Waiting for the animation to end is not an option, because `document.getAnimations()` does not see into the reminder's closed shadow root.

## Popup harness

The popup harness renders the real popup UI inside a controlled `1280x800` composition. It supports:

- desktop or Android layout
- headline and subtitle copy
- threshold helper expanded state
- overrides list open state
- custom threshold and custom reminder text
- `popupZoom` to enlarge the popup, and `popupHeight` to give it a window-like height, so the popup fits the frame as a whole and scrolls inside like the real one
- `popupScroll=end` to show the last sections of the desktop popup

The harness reads its strings directly from `shared/_locales/`; it does not maintain a second capture-only locale copy.

## Animation automation

Yes, animation capture can be automated.

The implemented approach is:

1. render deterministic states from query parameters
2. export a PNG frame sequence
3. optionally encode that sequence later into APNG, GIF, or MP4

This is more stable than screen recording because the timing and state are reproducible.

## Capture runner

List available scenes:

```bash
node tools/capture/capture-assets.mjs list
```

Capture the default static set:

```bash
node tools/capture/capture-assets.mjs shots
```

Capture one still:

```bash
node tools/capture/capture-assets.mjs shot reminder-depths
```

Capture animation frames:

```bash
node tools/capture/capture-assets.mjs frames anim-preview-edit
```

Encode the rendered frame sequences with `ffmpeg`:

```bash
tools/capture/encode-animations.sh
```

The Chrome tile is a static scene built around a rendered backdrop, which it names in `requires`. The runner stops with an error if `promo-tile-backdrop.png` is missing. `shots` without arguments renders scenes in definition order, so the backdrop comes first.

## Scene checks

`testStoreScenes` in `tests/browser-smoke.mjs` reads what the scenes rendered, under the same `capturePageOptions` as the runner: reminder zone, lit chevrons, opacity, blur, focus, how much of the frame the hero reminder spans, the three depth cards and their messages, and whether each popup window and the reminder preview are fully in view. To run only those checks:

```bash
SURFACED_SMOKE_SCOPE=store-scenes node tests/browser-smoke.mjs
```

## Playwright requirement

The runner uses Playwright but the repo intentionally does not ship a local `package.json` for it.

The supported path is:

1. install Playwright globally
2. point the runner at the global module path

Example:

```bash
npm install -g playwright
PLAYWRIGHT_MODULE_PATH="$(npm root -g)/playwright/index.mjs" node tools/capture/capture-assets.mjs shot reminder-depths
```

## Output location

Generated assets are written to:

```text
output/playwright/
output/animations/
```

Both directories are gitignored.

Approved public assets should then be copied into:

```text
screenshots/
screenshots/animations/
```

See [final-assets.md](final-assets.md) for the current accepted set.
