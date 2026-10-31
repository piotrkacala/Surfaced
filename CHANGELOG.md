# Changelog

## 1.3.1 — 2026-10-31

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
