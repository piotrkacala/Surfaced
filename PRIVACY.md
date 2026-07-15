# Surfaced Privacy Policy

**Last updated:** 2026-07-15

Surfaced is designed to work locally in your browser.

## What Surfaced Does

Surfaced tracks cumulative scroll depth on pages where the extension is enabled. It uses that local scroll-depth measurement to show reminders when you pass the threshold you configured.

## Data Collection

Surfaced does not collect, transmit, sell, or share user data.

Surfaced does not use:

- analytics
- advertising trackers
- remote APIs
- user accounts
- synced backend storage

## Local Storage

Surfaced stores extension settings locally in your browser extension storage. These settings may include:

- the global reminder threshold
- custom reminder text
- whether Surfaced is enabled
- per-site disable settings
- per-site threshold overrides

These settings stay on your device unless your browser itself provides separate backup, sync, or migration behavior outside Surfaced.

Surfaced also stores the temporary global pause state in browser session storage. It stays on the device, is not part of persistent settings, and is cleared when the browser or extension session restarts.

Surfaced does not use `storage.sync`. The site settings manager reads and changes the same local per-site settings listed above; it does not create an online account or a separate data store.

The popup can export the five persistent settings to a local JSON file and import a local JSON backup after validation and confirmation. Exported and imported files are handled on the device and are not uploaded by Surfaced. The temporary session pause is not included in an export.

Closing a reminder with `×` dismisses only its current depth level. That temporary runtime state is not added to persistent settings; a deeper level can still show another reminder.

## Browser Permissions and Diagnostics

Surfaced checks browser host access separately from settings storage. A missing page-access permission can stop reminders on pages without deleting or resetting settings in `browser.storage.local`. If the user chooses **Restore page access**, Surfaced asks the browser to restore its already-declared access to supported pages and then verifies the result locally.

## Page Content

Surfaced does not read page content for analysis, profiling, advertising, or remote processing. It uses browser page and scroll information only to decide whether a local reminder should be shown.

## Network Access

Surfaced does not contact remote servers as part of its runtime behavior.

## Contact

For questions, bug reports, or feature requests, use the Surfaced GitHub repository:

https://github.com/piotrkacala/Surfaced
