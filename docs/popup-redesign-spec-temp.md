# Popup Redesign Spec (Temporary)

**Date:** 2026-04-28  
**Status:** Working draft for implementation

## Context

Surfaced already has solid runtime behavior and a notification bar that reads well in-product. The main UX problem is the settings popup: it looks atmospheric, but it does not explain the product clearly enough and it over-emphasizes the depth-gauge metaphor.

This spec defines a simpler popup focused on comprehension first:

- what Surfaced does
- when the first reminder appears
- what can be customized globally
- what can be overridden for the current site

## Product Decisions Locked In

- Keep the notification bar visually close to the current version.
- Remove the current "depth threshold" gauge as the primary control.
- Keep support for custom threshold values.
- Valid threshold values remain any finite positive number.
- Recommended quick-pick values remain `7`, `9`, `11`, `14`.
- Auto-save behavior stays.
- Global and per-site settings remain stored in `browser.storage.local`.

## UX Goals

- The popup should explain the product in the first screenful.
- The main action should be obvious within 2-3 seconds.
- The threshold control should describe the outcome, not the internal metaphor.
- The current site controls should feel grouped and local, not scattered.
- Advanced/custom values should feel supported, not like edge cases.

## Non-Goals

- No functional changes to notification timing.
- No changes to badge logic.
- No new persistence model.
- No redesign of the notification component itself beyond optional preview reuse in the popup.

## Current Problems

- The threshold is split across three different affordances: editable header badge, gauge, slider.
- "Depth threshold" is product-internal language and does not describe the effect.
- The screen does not immediately answer "what happens if I change this?"
- Global and site-level controls are visually separated in a confusing way.
- The gauge visually suggests a bounded model even though custom values outside `7-14` are valid.

## New Information Architecture

Order of sections in the popup:

1. Header
2. Main threshold section
3. Notification text section
4. Current site section
5. Footer status

## Layout Spec

### 1. Header

Purpose: identify the product and explain it in one sentence.

Content:

- Surfaced wordmark / icon
- short explainer sentence
- global on/off control with visible label

Proposed copy:

- Title: `Surfaced`
- Explainer PL: `Delikatne przypomnienie, gdy scrollujesz zbyt daleko.`
- Explainer EN: `A gentle reminder when you scroll too far.`
- Global toggle label PL: `Włączone`
- Global toggle label EN: `Enabled`

Rules:

- Remove the editable numeric badge from the header.
- The global toggle must not appear as an unlabeled lone switch.
- Header should stay compact; no large decorative control here.

### 2. Main Threshold Section

Purpose: define when the first reminder appears.

Section title:

- PL: `Pokaż pierwsze przypomnienie po`
- EN: `Show the first reminder after`

Primary control:

- central numeric input
- visible unit next to the input
- decrement button
- increment button
- quick-pick chips: `7`, `9`, `11`, `14`

Recommended behavior:

- default step: `0.5`
- decrement/increment change value by `0.5`
- direct typing allowed
- any finite positive number allowed
- invalid or empty input falls back to the previous valid value during typing preview, and to `7` on final sanitize if nothing valid remains

Helper text directly below the control:

- PL: `1 ekran = wysokość widocznej części strony.`
- EN: `1 screen = the height of the visible part of the page.`

Custom value explanation:

- PL: `Możesz też wpisać własną wartość, np. 5.5 albo 20.`
- EN: `You can also enter a custom value, for example 5.5 or 20.`

Behavior explanation:

- PL: `Kolejne przypomnienia pojawią się głębiej: po 2× i 3× tej wartości.`
- EN: `Later reminders appear deeper: at 2× and 3× this value.`

Live summary sentence:

- PL template: `Pierwsze przypomnienie pojawi się po {N} ekranach.`
- EN template: `The first reminder will appear after {N} screens.`

Rules:

- This section replaces the current gauge + slider + header badge editing model.
- A compact decorative visual is acceptable, but it must not be the main interaction model.
- If a small visual treatment is retained, it should act only as a preview, not as the source of truth.

### 3. Notification Text Section

Purpose: customize the shallow-zone message and show the effect.

Section title:

- PL: `Treść pierwszego przypomnienia`
- EN: `First reminder text`

Content:

- text input
- reset button
- optional inline preview card using the current notification visual language

Helper text:

- PL: `Ten tekst pojawia się przy pierwszym przypomnieniu.`
- EN: `This text appears in the first reminder.`

Preview:

- should reuse the current notification copy hierarchy
- does not need to animate
- should show only the shallow reminder state

Rules:

- Keep reset visible but secondary.
- Keep preview compact; it should support understanding, not dominate the screen.

### 4. Current Site Section

Purpose: manage behavior for the active hostname in one place.

Section title:

- PL template: `Ta strona: {HOST}`
- EN template: `This site: {HOST}`

Controls:

- site enable toggle
- site-specific threshold override toggle
- conditional threshold control shown only when override is enabled
- manage-all-sites button / disclosure

Site toggle copy:

- PL: `Włączone na tej stronie`
- EN: `Enabled on this site`

Override toggle copy:

- PL: `Użyj innej wartości na tej stronie`
- EN: `Use a different value on this site`

Override input label:

- PL: `Pokaż przypomnienie po`
- EN: `Show the reminder after`

Override behavior:

- when enabled and no existing override exists, prefill with current global threshold
- same validation rules as the global threshold
- same quick-pick chips as the global threshold
- same `0.5` increment/decrement step

Manage button copy:

- PL: `Zarządzaj ustawieniami stron`
- EN: `Manage site settings`

Rules:

- Merge current site toggle and site override into a single section.
- Do not keep a separate stand-alone site bar above the body.
- If active hostname cannot be resolved, disable the section and show generic fallback text.

### 5. Footer Status

Purpose: confirm auto-save without adding modal friction.

Content:

- short transient status line

Examples:

- PL: `Zapisano ✓`
- EN: `Saved ✓`

Rules:

- Keep current transient footer pattern.
- Do not introduce explicit save buttons.

## Control Behavior Spec

### Threshold Input

- Accepts integers and decimals.
- Accepts values above `14`.
- Accepts values below `7` if positive.
- Sanitization rule: any finite positive number is valid.
- Empty, zero, negative, `NaN`, and `Infinity` resolve to default fallback value `7`.

### Quick-Pick Chips

- Clicking a chip updates the numeric input immediately.
- Clicking a chip saves like any other threshold change.
- Chips are shortcuts only, not limits.

### Increment / Decrement Buttons

- Apply `0.5` step.
- Must never produce `0` or negative values after sanitize.
- Long-press behavior is optional; single tap/click is required.

### Auto-Save

- Keep debounced saves for typed changes.
- Keep immediate save on blur.
- Keep short status feedback in the footer.

### Site Override

- Disabled state hides the override value controls.
- Enabling override shows the controls immediately.
- Disabling override removes the active host entry from `scrollNotifierSiteOverrides`.

## Visual Direction

The visual style should remain consistent with Surfaced:

- dark ocean surface palette
- cyan as the main accent
- amber/coral only as secondary semantic accents
- restrained atmospheric effects

But the redesign should reduce ornamental weight in the popup:

- fewer large decorative elements
- stronger text hierarchy
- more obvious grouping with simple cards/sections
- larger, calmer main threshold control

## Copy Draft

### Polish

- `Delikatne przypomnienie, gdy scrollujesz zbyt daleko.`
- `Pokaż pierwsze przypomnienie po`
- `1 ekran = wysokość widocznej części strony.`
- `Możesz też wpisać własną wartość, np. 5.5 albo 20.`
- `Kolejne przypomnienia pojawią się głębiej: po 2× i 3× tej wartości.`
- `Pierwsze przypomnienie pojawi się po {N} ekranach.`
- `Treść pierwszego przypomnienia`
- `Ten tekst pojawia się przy pierwszym przypomnieniu.`
- `Ta strona: {HOST}`
- `Włączone na tej stronie`
- `Użyj innej wartości na tej stronie`
- `Pokaż przypomnienie po`
- `Zarządzaj ustawieniami stron`

### English

- `A gentle reminder when you scroll too far.`
- `Show the first reminder after`
- `1 screen = the height of the visible part of the page.`
- `You can also enter a custom value, for example 5.5 or 20.`
- `Later reminders appear deeper: at 2× and 3× this value.`
- `The first reminder will appear after {N} screens.`
- `First reminder text`
- `This text appears in the first reminder.`
- `This site: {HOST}`
- `Enabled on this site`
- `Use a different value on this site`
- `Show the reminder after`
- `Manage site settings`

## Implementation Notes

Primary implementation target:

- `shared/popup/popup-core.mjs`

Likely code changes:

- remove the current gauge section and slider UI
- remove threshold editing from the header badge
- add a dedicated threshold control section with numeric input, buttons, chips, helper text, and live summary
- move site toggle UI into the site settings section
- keep existing storage keys and notification messaging flow
- update locale files in `shared/_locales/en/messages.json` and `shared/_locales/pl/messages.json`

Likely reusable logic:

- `parsePositiveThreshold`
- `sanitizeThreshold`
- debounced auto-save flow
- site override persistence model

## Out of Scope For This Pass

- full redesign of the notification bar
- changing threshold semantics
- adding a secondary onboarding flow
- changing build or packaging structure
