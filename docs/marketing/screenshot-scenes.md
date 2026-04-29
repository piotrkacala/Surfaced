# Screenshot Scenes

**Status:** Approved implementation target for the first AMO screenshot batch  
**Last updated:** 2026-04-28

This file is the human-readable companion to [tools/capture/scene-definitions.mjs](/home/k/Projekty/Surfaced/tools/capture/scene-definitions.mjs).

The first AMO batch should use these five primary scenes:

## Primary AMO set

### 1. `desktop-reminder-context`

- Output: `amo-s1-desktop-reminder-context.png`
- Goal: one-frame explanation of the product
- AMO caption EN: `A gentle reminder appears when you scroll deeper than planned.`
- AMO caption PL: `Delikatne przypomnienie pojawia się, gdy scrollujesz głębiej niż planowałeś.`

### 2. `desktop-threshold-control`

- Output: `amo-s2-desktop-threshold-control.png`
- Goal: show the threshold stepper and helper copy
- AMO caption EN: `Set your reminder depth in screens.`
- AMO caption PL: `Ustaw próg przypomnienia w ekranach.`

### 3. `desktop-custom-preview`

- Output: `amo-s3-desktop-custom-preview.png`
- Goal: show the editable first reminder and live preview
- AMO caption EN: `Customize the first reminder and preview it before it appears.`
- AMO caption PL: `Dostosuj pierwsze przypomnienie i zobacz podgląd przed jego wyświetleniem.`

### 4. `desktop-site-settings`

- Output: `amo-s4-desktop-site-settings.png`
- Goal: show per-site control and a visible override
- AMO caption EN: `Disable Surfaced on one site or give that site a different threshold.`
- AMO caption PL: `Wyłącz Surfaced na jednej stronie albo ustaw dla niej inny próg.`

### 5. `android-popup`

- Output: `amo-s5-android-popup.png`
- Goal: prove real Android support
- AMO caption EN: `The same calm controls are available on Firefox for Android.`
- AMO caption PL: `Te same spokojne ustawienia są dostępne w Firefoksie na Androidzie.`

## Optional follow-up set

### 6. `reminder-escalation`

- Output: `amo-s6-reminder-escalation.png`
- Goal: show stronger cue at deeper depth

### 7. `site-settings-list`

- Output: `amo-s7-site-settings-list.png`
- Goal: show saved per-site settings management

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

- [tools/capture/scene-definitions.mjs](/home/k/Projekty/Surfaced/tools/capture/scene-definitions.mjs)
