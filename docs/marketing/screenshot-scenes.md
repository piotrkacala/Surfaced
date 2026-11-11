# Screenshot Scenes

**Status:** Approved implementation target for the AMO and Chrome Web Store screenshots\
**Last updated:** 2026-11-11

This file is the human-readable companion to [tools/capture/scene-definitions.mjs](../../tools/capture/scene-definitions.mjs).

AMO uses these five primary scenes. Chrome Web Store uses the first four, because the Chrome package has no Android popup.

All compositions use a light background from the palette. The set is built to stay readable as a small listing thumbnail: the reminder and the popup are shown enlarged, and each frame has one subject.

## Primary set

### 1. `desktop-reminder-context`

- Output: `amo-s1-desktop-reminder-context.png`
- Goal: one-frame explanation of the product
- Composition: a close-up of the feed fixture, captured at half the viewport and double pixel density, so the reminder spans most of the frame; the page is softened with `softPage`, while the title card and the reminder stay sharp
- AMO caption EN: `A gentle reminder helps you notice how far you’ve scrolled.`
- AMO caption PL: `Dyskretne przypomnienie pomaga zauważyć, jak daleko przewijasz.`
- AMO caption FR: `Un rappel discret vous aide à remarquer jusqu’où vous avez fait défiler la page.`

### 2. `reminder-depths`

- Output: `amo-s2-reminder-depths.png`
- Goal: show the three reminder levels and when each appears
- Composition: the real reminder card rendered once per depth zone with the product's own messages, on a depth line labeled with the default threshold and its multiples (7, 14, and 21 screens)
- AMO caption EN: `Follow-up reminders appear at twice and three times your chosen depth.`
- AMO caption PL: `Kolejne przypomnienia pojawiają się przy dwu- i trzykrotności wybranego progu.`
- AMO caption FR: `Les rappels suivants apparaissent à deux puis trois fois la profondeur choisie.`

### 3. `desktop-site-settings`

- Output: `amo-s3-desktop-site-settings.png`
- Goal: show the reminder depth and per-site control in one popup view
- Composition: the enlarged popup as a whole window; the saved-site manager stays closed and the custom threshold is expanded
- AMO caption EN: `Choose your reminder depth, then adjust it or turn Surfaced off on any site.`
- AMO caption PL: `Wybierz próg przypomnienia, a potem zmień go lub wyłącz Surfaced na dowolnej stronie.`
- AMO caption FR: `Choisissez votre seuil, puis ajustez-le ou désactivez Surfaced sur n’importe quel site.`

### 4. `desktop-custom-preview`

- Output: `amo-s4-desktop-custom-preview.png`
- Goal: show the editable first reminder and live preview
- Composition: the enlarged popup window scrolled to its end, so the text field and the preview are in view
- AMO caption EN: `Write your own first reminder and preview how it will look.`
- AMO caption PL: `Napisz własną treść pierwszego przypomnienia i sprawdź, jak będzie wyglądać.`
- AMO caption FR: `Personnalisez le texte du premier rappel et prévisualisez son apparence.`

### 5. `android-popup`

- Output: `amo-s5-android-popup.png`
- Goal: prove real Android support
- Composition: the Android popup in the dark theme as a phone-height window on the same light background, rendered in the capture harness rather than on a device
- AMO caption EN: `Adjust your reminders in Firefox for Android, too.`
- AMO caption PL: `Dopasuj przypomnienia do siebie także w Firefoksie na Androidzie.`
- AMO caption FR: `Réglez aussi vos rappels dans Firefox pour Android.`

## Optional scene

### 6. `site-settings-list`

- Output: `amo-s6-site-settings-list.png`
- Goal: show saved per-site settings management

## Other assets

### `chrome-small-promo-tile`

- Output: `chrome-small-promo-tile.png`
- Goal: `440x280` small promo tile
- Needs `promo-tile-backdrop` rendered first: a softened long page with no caption, which the tile uses as its background

### `github-social-preview`

- Output: `github-social-preview.png`
- Goal: `1280x640` repository social preview, using the hero composition

## Runner usage

List scenes:

```bash
node tools/capture/capture-assets.mjs list
```

Render one scene:

```bash
node tools/capture/capture-assets.mjs shot reminder-depths
```

Render the primary static set:

```bash
node tools/capture/capture-assets.mjs shots-primary
```

Render the promo tile:

```bash
node tools/capture/capture-assets.mjs shots promo-tile-backdrop chrome-small-promo-tile
```

## Source of truth

If captions, filenames, or scene parameters diverge, the canonical source is:

- [tools/capture/scene-definitions.mjs](../../tools/capture/scene-definitions.mjs)
