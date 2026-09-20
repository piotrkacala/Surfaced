# ADR-006: In-page reminders are awareness cues, not settings surfaces

**Date:** 2026-09-20
**Status:** Accepted

## Context

Surfaced exists to interrupt automatic endless scrolling with a gentle moment
of awareness. The in-page reminder appears at the exact moment when dismissing
an interruption is the easiest response.

We considered adding **Pause** and **Disable on this site** actions directly to
the reminder. A vertical button layout would fit narrow notifications better
than a horizontal layout, and a site action could reuse the existing settings
store without adding permissions or state. However, making either action
available at every threshold crossing would reduce the effort needed to silence
Surfaced. Repeated exposure could train users to dismiss the product's purpose
automatically and gradually exclude the sites where they scroll most often.

The reminder also contained both a Surfaced icon and the visible subtitle
`Surfaced · scroll depth alert`. The subtitle competed with the actual reminder
message, while removing all source attribution could make an injected text bar
look like UI owned by the page.

## Decision

The in-page reminder is an awareness cue, not a settings surface.

- Dismiss is its only interactive action. It dismisses only the current depth
  level; a deeper level may still appear later.
- Pause, Resume, persistent site enablement, threshold overrides, site
  management, import/export, and permission actions remain in the popup.
- Surfaced does not add direct or indirect routes from the reminder to those
  controls, including secondary menus or tooltip-only actions.
- The reminder keeps a small decorative Surfaced depth-chevron icon for source
  recognition, the reminder message, and the dismiss button.
- The redundant visible product subtitle is removed from both the reminder and
  its popup preview.

The extra step of opening the popup before pausing or changing a site is
intentional beneficial friction. Future controls in the in-page reminder
require a new product decision rather than an incidental UI addition.

## Rejected alternatives

- **Pause and Disable on this site as horizontal actions:** too easy to invoke
  habitually and crowded at narrow widths.
- **The same actions in a vertical layout:** solves layout pressure but not the
  product-level habit and friction problem.
- **Only Disable on this site:** still encourages permanent exceptions at the
  moment of interruption.
- **A confirmation after Disable on this site:** adds complexity after an action
  that should not be promoted from the reminder in the first place.
- **A plain text bar with only a close button:** visually quiet, but too easy to
  mistake for page-owned UI.
- **Keeping the icon and subtitle:** source attribution is clear, but the
  duplicated label adds unnecessary visual noise.

## Consequences

- The reminder remains small, predictable, keyboard accessible, and consistent
  across Firefox desktop, Firefox for Android, and Chrome desktop.
- Persistent site exceptions stay deliberate and discoverable in the popup and
  site manager rather than becoming a reflex action.
- Session Pause remains available without becoming the default response to a
  reminder.
- The icon carries non-verbal product attribution and is excluded from the
  accessibility tree; the message remains the visual and announced focus.
- Visual measurements and responsive details remain implementation concerns in
  the relevant specification rather than permanent architectural policy.
