# ADR-003: Threshold value policy

**Date:** 2026-04-28  
**Status:** Accepted

## Context

Surfaced visually presents the threshold control as a recommended range of `7–14` screens. That range works well for the default UX and for the water-gauge metaphor in the popup.

However, real user preferences are broader:

- some users want a much deeper threshold such as `20`, `50`, or `100`
- some users want fractional thresholds
- manual input in a number field means we must expect values outside the visual gauge range

The question is not whether to hard-limit those values for product reasons, but how to keep the runtime safe when values are entered manually or stored from older versions.

## Decision

Accept any **finite positive number** as a valid threshold value for:

- the global threshold
- site-specific threshold overrides

Do not clamp persisted threshold values to the popup's recommended `7–14` range.

Sanitize invalid values before use or persistence:

- `NaN`
- `Infinity`
- negative values
- zero
- empty or otherwise unparsable input

Invalid values fall back to the default global threshold of `7`.

The popup gauge remains a bounded visual aid:

- values below the recommended range render at the low end of the gauge
- values above the recommended range render at the high end of the gauge
- the stored value itself is preserved

## Consequences

- The product supports advanced user preferences without changing the primary UX.
- Runtime logic stays predictable because only finite positive thresholds reach the notification logic.
- The visual gauge is intentionally approximate outside the `7–14` range; it communicates relative position inside the recommended band, not exact scale for extreme values.
- Future features that consume threshold values should follow the same finite-positive sanitization rule instead of reintroducing hard UI-range clamps.
