# ADR-003: Threshold value policy

**Date:** 2026-04-28  
**Status:** Accepted

## Context

Surfaced presents the threshold control around a recommended range of `7–14` screens in the popup UI. That range works well for the default UX and for the current stepper-based settings flow.

However, real user preferences are broader:

- some users want a much deeper threshold such as `20`, `50`, or `100`
- some users want fractional thresholds
- manual input in a number field means we must expect values outside the recommended UI range

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

The popup UI still centers the recommended band:

- values below `7` remain valid even though they sit below the recommended default UX
- values above `14` remain valid even though they sit above the recommended default UX
- the stored value itself is preserved and shown directly in the numeric input

## Consequences

- The product supports advanced user preferences without changing the primary UX.
- Runtime logic stays predictable because only finite positive thresholds reach the notification logic.
- The popup can recommend `7–14` without turning that range into a hard product constraint.
- Future features that consume threshold values should follow the same finite-positive sanitization rule instead of reintroducing hard UI-range clamps.
