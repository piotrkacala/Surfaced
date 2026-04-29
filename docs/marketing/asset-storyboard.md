# Surfaced Asset Storyboard

**Status:** Draft for screenshot and animation production  
**Last updated:** 2026-04-28

This document is the source of truth for the next round of public-facing visuals for Surfaced.

It is written for:

- AMO listing screenshots
- optional animated assets for GitHub, social posts, and release notes

## Goal

Show Surfaced as:

- gentle, not punitive
- privacy-friendly and local-first
- visually polished
- useful on both Firefox desktop and Firefox for Android

The visuals should explain the product in a simple sequence:

1. You drift deeper into a long page.
2. Surfaced gives you a calm reminder.
3. You can tune when and how it reminds you.
4. You can adapt it per site.
5. The same idea works on Android too.

## Creative direction

Use real product UI, but present it with stronger marketing composition than a plain raw screenshot.

Principles:

- Keep the product state truthful. Do not fake UI that does not exist.
- Use one message per asset.
- Prefer clean, readable compositions over dense documentation.
- Let the oceanic visual language of Surfaced carry through the asset set.
- Avoid using third-party brands, logos, or copyrighted feed content in a way that becomes the focus of the image.
- If possible, use a local demo page or a neutral article/feed fixture created specifically for capture.

## Recommended production format

Primary static canvas:

- `1280x800`
- `1.6:1` aspect ratio
- PNG master export

Working assumption:

- This ratio is a safe baseline for AMO previews and aligns with Mozilla guidance published in a Mozilla Discourse announcement about larger listing images.
- Current public API docs confirm preview images and translated captions, but do not clearly document current hard size limits.

Because of that:

- produce masters at `1280x800`
- keep important UI inside a safe center area
- verify upload behavior manually in AMO before final export batch is locked

## Visual system for the new assets

Shared look:

- deep navy or midnight background
- cyan accent as primary highlight
- amber and coral only when the story specifically refers to deeper zones
- subtle gradients and glow, not loud overlays
- short headline, one supporting line at most

Composition rules:

- headline max about 6 to 9 words
- support line max about 12 to 16 words
- one UI focal point per frame
- do not stack several tiny UI crops in one image
- if using callouts, use at most one

## Asset set

Primary set:

1. Desktop in-page reminder
2. Desktop threshold control
3. Desktop custom reminder preview
4. Desktop per-site settings
5. Android popup

Optional set:

6. Mid/deep reminder escalation
7. Overrides management list

Optional animations:

A. Threshold change to preview change  
B. Scroll deeper through shallow, mid, deep  
C. Enable site override and set custom threshold

## Storyboard

### S1. Desktop reminder in context

**Priority:** Must-have  
**Platform:** Desktop Firefox  
**Purpose:** Explain the product in one frame

**What must be visible**

- a long page or feed-like page
- the Surfaced reminder anchored at the bottom
- enough surrounding page content to show that the user is deep into scrolling

**Capture setup**

- threshold set to `7`
- first reminder text left at the default
- trigger the shallow zone
- use a neutral page background with readable paragraphs or cards

**Composition**

- reminder centered in the lower third
- page content visible behind it, but softened
- optional subtle headline above or beside the UI

**Suggested headline**

- EN: `A gentle cue for endless scroll`
- PL: `Delikatny sygnał przy endless scrollu`

**Suggested support line**

- EN: `Know when the feed has gone deeper than planned.`
- PL: `Zauważ moment, gdy feed ciągnie dalej niż planowałeś.`

**Do not**

- use noisy social branding as the main background subject
- crop so tightly that the reminder looks like a popup detached from browsing

### S2. Desktop threshold control

**Priority:** Must-have  
**Platform:** Desktop Firefox  
**Purpose:** Show how fast the core setup is

**What must be visible**

- popup header
- threshold section
- numeric stepper control
- helper text expanded

**Capture setup**

- open popup on desktop
- threshold helper expanded
- value set to `7` or `8.5`

**Composition**

- crop tightly around the threshold section
- keep enough of the header to preserve brand recognition
- show the popup as product UI, not as a tiny browser artifact

**Suggested headline**

- EN: `Set your reminder depth in screens`
- PL: `Ustaw próg przypomnienia w ekranach`

**Suggested support line**

- EN: `Choose the point where scrolling stops feeling intentional.`
- PL: `Wybierz moment, w którym scroll przestaje być intencjonalny.`

**Do not**

- reference the old water-gauge UI
- imply `7–14` is a hard limit

### S3. Desktop custom reminder preview

**Priority:** Must-have  
**Platform:** Desktop Firefox  
**Purpose:** Show that the reminder can be personalized without guesswork

**What must be visible**

- first reminder text field
- reset button if it helps the composition
- live preview card

**Capture setup**

- enter a custom line that still fits the tone of the product
- example: `Take a breath. You’ve gone deep enough for now.`

**Composition**

- emphasize the preview card more than the text field
- make the connection between editing and preview obvious
- keep it calm and readable

**Suggested headline**

- EN: `Customize the first reminder`
- PL: `Dostosuj pierwsze przypomnienie`

**Suggested support line**

- EN: `See the message before it ever appears on a page.`
- PL: `Zobacz komunikat, zanim pojawi się na stronie.`

**Do not**

- use jokey or guilt-heavy custom text
- let the input field dominate the frame more than the preview

### S4. Desktop per-site settings

**Priority:** Must-have  
**Platform:** Desktop Firefox  
**Purpose:** Show practical control, not just one global setting

**What must be visible**

- "This site" section
- enabled-on-site toggle
- site override toggle
- site threshold control visible

**Capture setup**

- use a realistic host name
- site enabled
- custom site threshold active
- value visibly different from the global threshold

**Composition**

- crop around the full site section
- make the host name legible
- avoid showing too many unrelated popup sections

**Suggested headline**

- EN: `Tune Surfaced for each site`
- PL: `Dostosuj Surfaced do każdej strony`

**Suggested support line**

- EN: `Disable it here, or use a deeper threshold where you need one.`
- PL: `Wyłącz je tutaj albo ustaw głębszy próg tam, gdzie ma to sens.`

**Do not**

- show a host name you do not want frozen into public marketing
- choose values so similar that the override story becomes unclear

### S5. Android popup

**Priority:** Must-have  
**Platform:** Firefox for Android  
**Purpose:** Prove that the product is truly cross-platform

**What must be visible**

- real Android popup layout
- touch-sized controls
- at least the header and one core settings section

**Capture setup**

- capture from Firefox for Android, not desktop responsive emulation
- use the same threshold and text logic as the desktop set for consistency

**Composition**

- place the phone screenshot on a clean background
- do not over-frame it with an oversized device mockup
- keep the UI readable first, decorative framing second

**Suggested headline**

- EN: `The same calm control on Android`
- PL: `Ta sama spokojna kontrola na Androidzie`

**Suggested support line**

- EN: `Surfaced works on Firefox desktop and Firefox for Android.`
- PL: `Surfaced działa w Firefoksie na desktopie i Androidzie.`

**Do not**

- fake the Android experience with a desktop viewport
- shrink the phone UI so much that the controls become unreadable

### S6. Reminder escalation

**Priority:** Optional  
**Platform:** Desktop  
**Purpose:** Show that Surfaced escalates gently as depth increases

**What must be visible**

- two or three reminder states, ideally shallow and deep
- obvious color progression

**Capture setup**

- one frame for shallow, one for mid or deep
- same background page if possible

**Composition**

- either a side-by-side comparison or a single gradient narrative
- keep the frame simple so the color change reads instantly

**Suggested headline**

- EN: `Deeper scroll, stronger cue`
- PL: `Głębszy scroll, wyraźniejszy sygnał`

### S7. Saved site settings list

**Priority:** Optional  
**Platform:** Desktop  
**Purpose:** Show that per-site settings are manageable over time

**What must be visible**

- manage site settings button open
- at least two saved hosts
- remove action visible but not dominant

**Capture setup**

- create at least two realistic example hosts
- vary thresholds clearly

**Composition**

- focus on the list, not the entire popup
- keep host names neutral and reusable

**Suggested headline**

- EN: `Review saved site rules anytime`
- PL: `W każdej chwili sprawdź zapisane reguły`

## Animation storyboard

### A1. Threshold to preview

**Format:** short loop, 4 to 6 seconds  
**Purpose:** Explain setup speed

**Sequence**

1. Popup opens on the threshold section.
2. Threshold changes from `7` to `9.5`.
3. Focus shifts to the reminder text field.
4. Custom text is entered.
5. Preview updates live.

**Use cases**

- GitHub README later, if visuals return
- release post
- social teaser

### A2. Shallow to deep

**Format:** short loop, 4 to 6 seconds  
**Purpose:** Explain escalation behavior

**Sequence**

1. User scrolls a neutral long page.
2. Shallow reminder appears.
3. Scroll continues.
4. Mid or deep reminder replaces it.

**Key point**

- animation should feel smooth and calm, not alarming

### A3. Site-specific control

**Format:** short loop, 5 to 7 seconds  
**Purpose:** Explain practical flexibility

**Sequence**

1. Popup opens on a specific host.
2. "Use a different value on this site" is enabled.
3. Site threshold changes to a visibly different value.
4. Saved state remains visible.

## Production checklist

Before capture:

- use current product build and current popup UI only
- confirm Firefox desktop and Firefox for Android visuals from real runtime
- use a neutral, reusable capture page where possible
- decide whether the batch is pure product capture or composited marketing canvas

During capture:

- keep copy readable at thumbnail size
- avoid tiny UI text near image edges
- keep the same visual language across the whole set
- export masters before creating AMO-ready derivatives

After capture:

- verify the image sequence tells a coherent story even without reading the description
- verify screenshot captions in AMO match the scene purpose
- check upload appearance in AMO before considering the batch final

## Proposed filenames

- `amo-s1-desktop-reminder-context.png`
- `amo-s2-desktop-threshold-control.png`
- `amo-s3-desktop-custom-preview.png`
- `amo-s4-desktop-site-settings.png`
- `amo-s5-android-popup.png`
- `amo-s6-reminder-escalation.png`
- `amo-s7-site-settings-list.png`

## Suggested next step

Before producing the actual screenshots, create one dedicated capture fixture page for:

- long-form article background
- feed/card background
- predictable scroll depth triggering

That will make future screenshot refreshes faster and much more consistent.

## External references

- Mozilla add-ons API docs for previews, translated captions, and preview ordering: `https://mozilla.github.io/addons-server/topics/api/addons`
- Mozilla announcement on larger AMO images, including the `1280x800` / `1.6:1` recommendation used here as a practical baseline: `https://discourse.mozilla.org/t/larger-image-support-on-addons-mozilla-org/29819`
