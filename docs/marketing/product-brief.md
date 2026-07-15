# Surfaced Product Brief

**Status:** Working brief  
**Last updated:** 2026-07-15

## One-line summary

Surfaced is a Firefox-first browser extension, also available for Chrome desktop, that helps people notice when they have gone too deep into endless scrolling by showing a gentle reminder after a user-defined scroll depth.

## Product in one paragraph

Surfaced is for Firefox users first, with Chrome desktop support for people who want the same calm scroll-depth reminders outside Firefox. It quietly tracks cumulative scroll depth on long pages and feed-like interfaces, then surfaces a calm reminder once the browsing session has gone deeper than intended. It works on Firefox desktop, Firefox for Android, and Chrome desktop, stores everything locally, and keeps the intervention intentionally light.

## Problem

Infinite scroll removes natural stopping points. People open a page with a clear intention, then drift down the feed without noticing how much ground they have covered. The problem is not only time spent. It is the loss of orientation inside interfaces designed to make scrolling feel bottomless.

## Target audience

- Firefox users on desktop or Android who want lighter digital self-control.
- Chrome desktop users who want the same local, reminder-first experience.
- People who regularly browse feed-heavy or thread-heavy sites with long continuous scroll.
- Privacy-conscious users who prefer tools that stay fully local.

## Not the primary audience

- Users who want hard limits, blocking, or strict parental-control behavior.
- Users looking for analytics dashboards, synced accounts, or habit-tracking systems.
- Users on browsers outside Firefox and Chrome desktop, unless the product scope expands later.

## Product promise

**Come up for air.**

Surfaced gives people back a sense of depth and stopping cues inside endless scroll, without breaking the browsing flow.

## Core experience

- The user sets a reminder threshold in screens.
- Surfaced tracks signed, net cumulative scroll depth rather than relying only on raw page position.
- When the user crosses the chosen depth, a subtle bottom notification appears.
- Additional reminders appear at 2× and 3× the chosen threshold.
- Closing a reminder with `×` dismisses only the current level; a deeper level can still appear.
- The browser action badge reflects current depth once the user is past threshold.
- The user can customize the first reminder and configure per-site behavior.
- The user can manage all saved site rules, pause every tab until the browser restarts, and import or export persistent settings with a local JSON file.
- Page-access diagnostics are separate from persistent storage health, so a missing permission is not presented as lost settings.

## Key strengths to emphasize

- **Gentle by design:** reminder-first, not punishment-first.
- **Private by default:** no analytics, no remote APIs, no account, local storage only.
- **Firefox-first cross-browser support:** Firefox desktop and Android remain primary, with Chrome desktop supported as a separate package.
- **Built for modern scrolling:** signed, net cumulative depth helps with long feeds, SPA transitions, and non-trivial scroll behavior better than a simple `scrollY` threshold.
- **Flexible controls:** global threshold, custom values, complete per-site management, session pause, and local JSON import/export.

## Messaging priorities

Lead with these ideas:

- gentle reminder
- endless scroll awareness
- private and local-only
- works on Firefox desktop, Firefox for Android, and Chrome desktop
- regain orientation, not control through force

## Messaging guardrails

Avoid:

- guilt-heavy productivity framing
- medicalized or addiction-style claims
- language that suggests surveillance or tracking beyond the browser
- implying the extension blocks feeds or enforces limits
- implying settings are synchronized between devices; Surfaced only offers user-managed local JSON transfer
- describing `7–14` as a hard threshold range; it is the recommended UI range, not the allowed value range

## Tone of voice

Calm, observant, slightly poetic, and non-judgmental. Surfaced should feel like a quiet tap on the shoulder, not a scolding productivity tool.

## Canonical positioning lines

- A gentle reminder when you scroll too far.
- A depth marker for endless feeds.
- Come up for air.

## What future assets should show

- How quickly the threshold can be set.
- What the reminder looks like in context on a real page.
- That the product is subtle, not disruptive.
- That users can tune behavior for a specific site.
- When possible, that Surfaced exists on Firefox desktop, Firefox for Android, and Chrome desktop.
