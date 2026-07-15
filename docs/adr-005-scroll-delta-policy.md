# ADR-005: Large scroll delta policy

**Date:** 2026-07-15
**Status:** Accepted

## Context

Surfaced tracks signed, cumulative scroll depth rather than only the current
document position. Ordinary downward movement adds depth and upward movement
subtracts it. This works for long documents, custom scroll containers, and many
infinite feeds.

A single large position change is ambiguous. It can be intentional navigation
such as Home, End, an anchor, scripted focus, or dragging the scrollbar. It can
also be position churn caused by a virtual list recycling rows. Treating every
large delta as zero hides real user navigation, while applying an unbounded delta
can create a false reminder after one virtual-list rebase.

## Decision

The pure tracker in `shared/scroll-tracker.js` owns delta classification, zone
state, reminder rearming, and badge depth. The content script supplies the active
scroll target, its current `scrollTop`, and `window.innerHeight` as the common
screen unit.

The large-delta boundary is strictly more than two viewport heights:

- ordinary deltas, including exactly two viewport heights, are applied with
  their sign;
- a large positive delta contributes exactly two viewport heights at most;
- a large negative movement ending at or within half a viewport of the active
  target's beginning explicitly resets the cycle; the movement may be one
  observation or a monotonic sequence of upward observations, as produced by an
  animated Home/back-to-top action;
- a large negative delta ending farther from the beginning contributes zero,
  because it is treated as a likely virtual-list rebase.

The tracker measures a monotonic upward sequence from the position where its
first negative delta began. A positive delta ends that sequence. This makes the
decision independent of scroll-event sampling and the content script's throttle.

An explicit reset clears cumulative depth, the current and dismissed reminder
levels, any visible reminder, and the badge. A back-to-top reset retains the
active target and its new position as the baseline, so the first subsequent
downward movement counts. An SPA reset additionally clears the active target so
the next observation establishes a fresh baseline.

Switching from the document to a scrollable element, or between elements, never
charges the target's existing offset. The first observation of the new target is
only its baseline.

Returning below the first threshold always rearms all three reminder levels,
even if the last visible reminder was dismissed before the return.

## Consequences

- Home, back-to-top controls, and scrollbar drags to the beginning reliably end
  the current cycle and clear stale UI.
- End, anchors, focus-driven jumps, scripted navigation, and downward scrollbar
  drags are no longer invisible, but one event cannot contribute more than two
  screens.
- A large virtual-list rebase away from the beginning cannot erase accumulated
  depth; a positive position jump is bounded rather than trusted in full.
- A single End action may not immediately reach the user's configured threshold,
  especially at the default of seven screens. This is intentional: the tracker
  records the navigation without treating an ambiguous absolute jump as fully
  equivalent to reading every skipped screen.
- A virtual list that itself jumps to the beginning is indistinguishable from an
  intentional back-to-top action. The explicit product rule for an active target
  ending near its beginning takes precedence in that case.
