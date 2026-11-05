# Screenshot Scenes

**Status:** Approved implementation target for the first AMO screenshot batch  
**Last updated:** 2026-11-05

This file is the human-readable companion to [tools/capture/scene-definitions.mjs](../../tools/capture/scene-definitions.mjs).

The first AMO batch should use these five primary scenes. Chrome Web Store uses the first four, because the Chrome package has no Android popup.

All compositions use a light background from the palette, with the popup set apart by a soft outline and shadow.

## Primary AMO set

### 1. `desktop-reminder-context`

- Output: `amo-s1-desktop-reminder-context.png`
- Goal: one-frame explanation of the product
- Composition: the placeholder page is softened with `softPage`; the title card and the reminder stay sharp
- AMO caption EN: `A gentle reminder helps you notice how far you’ve scrolled.`
- AMO caption PL: `Dyskretne przypomnienie pomaga zauważyć, jak daleko przewijasz.`

### 2. `desktop-threshold-control`

- Output: `amo-s2-desktop-threshold-control.png`
- Goal: show the threshold stepper and helper copy
- AMO caption EN: `Choose how many screens to scroll before the first reminder.`
- AMO caption PL: `Wybierz, po ilu ekranach pojawi się pierwsze przypomnienie.`

### 3. `desktop-custom-preview`

- Output: `amo-s3-desktop-custom-preview.png`
- Goal: show the editable first reminder and live preview
- AMO caption EN: `Write your own first reminder and preview how it will look.`
- AMO caption PL: `Napisz własną treść pierwszego przypomnienia i sprawdź, jak będzie wyglądać.`

### 4. `desktop-site-settings`

- Output: `amo-s4-desktop-site-settings.png`
- Goal: show per-site control and a visible override
- Composition: the saved-site manager stays closed and the custom threshold is expanded; the saved list belongs to s7
- AMO caption EN: `Turn Surfaced off on a site or choose a different reminder depth for it.`
- AMO caption PL: `Wyłącz Surfaced na wybranej stronie lub ustaw dla niej osobny próg.`

### 5. `android-popup`

- Output: `amo-s5-android-popup.png`
- Goal: prove real Android support
- Composition: the Android popup in the dark theme on the same light background, rendered in the capture harness rather than on a device
- AMO caption EN: `Adjust your reminders in Firefox for Android, too.`
- AMO caption PL: `Dopasuj przypomnienia do siebie także w Firefoksie na Androidzie.`

## Optional follow-up set

### 6. `reminder-escalation`

- Output: `amo-s6-reminder-escalation.png`
- Goal: show stronger cue at deeper depth
- Composition: the placeholder page is softened with `softPage`, as in s1

### 7. `site-settings-list`

- Output: `amo-s7-site-settings-list.png`
- Goal: show saved per-site settings management

## Chrome Web Store tile

### `chrome-small-promo-tile`

- Output: `chrome-small-promo-tile.png`
- Goal: `440x280` small promo tile built around the rendered s1

## Runner usage

List scenes:

```bash
node tools/capture/capture-assets.mjs list
```

Render one scene:

```bash
node tools/capture/capture-assets.mjs shot desktop-threshold-control
```

Render the primary static set:

```bash
node tools/capture/capture-assets.mjs shots \
  desktop-reminder-context \
  desktop-threshold-control \
  desktop-custom-preview \
  desktop-site-settings \
  android-popup
```

## Source of truth

If captions, filenames, or scene parameters diverge, the canonical source is:

- [tools/capture/scene-definitions.mjs](../../tools/capture/scene-definitions.mjs)
