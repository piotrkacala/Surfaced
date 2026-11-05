# Changelog

## 1.4.0 — 2026-11-05

- Redesigned the popup, in-page reminder, and settings import page with a calmer
  look: light by default, dark when the browser prefers it.
- Reminders now show depth by lighting one more chevron and moving to a deeper
  blue, instead of amber and red; looping animations are gone.
- Reorganized the popup around the threshold and current site, with a quieter
  pause action and a compact export and import row.
- Simplified the saved site manager: each site shows its state and threshold,
  with a plain editor and a clear note that removing a site's settings returns
  it to the global ones.
- Refreshed the extension icon and toolbar badge color to match.
- Fixed pages reopened with Back or Forward missing pause and resume changes
  made on another page. Restored pages also show the toolbar badge again
  when appropriate.
- Fixed reminders and toolbar badges briefly appearing in other tabs while
  you were still typing a new threshold.

## 1.3.1 — Not published

Included in 1.4.0.

- Fixed pages restored with Back or Forward ignoring a session pause or resume
  made while they were away, including a complete pause and resume, which now
  starts a fresh cycle; restored pages now also bring back their badge.
- Fixed partially typed thresholds briefly showing reminders and badges in
  every open tab; tabs now apply settings changes once typing settles.

## 1.3.0 — 2026-09-20

- Added complete French localization for the extension, import flow, and store
  listing copy.
- Added a dedicated local page for validating, previewing, and importing a
  complete settings backup.
- Simplified in-page reminders to a smaller source icon, message, and dismiss
  control; Pause and site settings remain in the popup.
- Fixed exact fractional threshold editing and display, including decimal-safe
  `0.5` stepper changes.
- Improved settings reliability when changes, imports, and retries happen from
  multiple extension pages.
- Prevented exports larger than the import limit and refreshed settings before
  export.
- Fixed reminder zone reconciliation, trailing-dot hostname matching, and
  notification-host isolation from ordinary page CSS.
