# Capture Tooling

**Status:** Working notes for asset production  
**Last updated:** 2026-04-28

This repo now contains deterministic fixture pages and capture harnesses for Surfaced marketing assets.

## What is in the repo

- [fixtures/marketing/long-article.html](../../fixtures/marketing/long-article.html)
- [fixtures/marketing/feed.html](../../fixtures/marketing/feed.html)
- [fixtures/marketing/fixture-runtime.mjs](../../fixtures/marketing/fixture-runtime.mjs)
- [tools/capture/popup-harness.html](../../tools/capture/popup-harness.html)
- [tools/capture/popup-harness.mjs](../../tools/capture/popup-harness.mjs)
- [tools/capture/capture-assets.mjs](../../tools/capture/capture-assets.mjs)

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

## Popup harness

The popup harness renders the real popup UI inside a controlled `1280x800` composition. It supports:

- desktop or Android layout
- headline and subtitle copy
- threshold helper expanded state
- overrides list open state
- custom threshold and custom reminder text

The harness reads English strings directly from `shared/_locales/en/messages.json`; it does not maintain a second capture-only locale copy.

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
node tools/capture/capture-assets.mjs shot desktop-threshold-control
```

Capture animation frames:

```bash
node tools/capture/capture-assets.mjs frames anim-preview-edit
```

Encode the rendered frame sequences with `ffmpeg`:

```bash
tools/capture/encode-animations.sh
```

## Playwright requirement

The runner uses Playwright but the repo intentionally does not ship a local `package.json` for it.

The supported path is:

1. install Playwright globally
2. point the runner at the global module path

Example:

```bash
npm install -g playwright
PLAYWRIGHT_MODULE_PATH="$(npm root -g)/playwright/index.mjs" node tools/capture/capture-assets.mjs shot desktop-threshold-control
```

## Output location

Generated assets are written to:

```text
output/playwright/
```

That directory is gitignored.

Approved public assets should then be copied into:

```text
screenshots/
screenshots/animations/
```

See [final-assets.md](final-assets.md) for the current accepted set.
