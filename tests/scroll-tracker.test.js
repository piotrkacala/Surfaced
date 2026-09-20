"use strict";

const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
  DEFAULT_LARGE_DELTA_SCREENS,
  createTrailingThrottle,
  createTracker,
  zoneForScreens,
} = require("../shared/scroll-tracker.js");

const VIEWPORT = 100;
const WINDOW = "document";
const ELEMENT = "feed";

function createTestTracker(options = {}) {
  return createTracker({ threshold: 1, viewportHeight: VIEWPORT, ...options });
}

function observe(tracker, scrollTop, target = WINDOW) {
  return tracker.observe({ target, scrollTop, viewportHeight: VIEWPORT });
}

describe("zone calculation", () => {
  test("maps net depth to the three threshold levels", () => {
    assert.equal(zoneForScreens(0.99, 1, [1, 2, 3]), -1);
    assert.equal(zoneForScreens(1, 1, [1, 2, 3]), 0);
    assert.equal(zoneForScreens(2, 1, [1, 2, 3]), 1);
    assert.equal(zoneForScreens(3, 1, [1, 2, 3]), 2);
  });
});

describe("ordinary scrolling and active targets", () => {
  test("tracks ordinary window scroll and updates the badge past threshold", () => {
    const tracker = createTestTracker({ threshold: 2 });
    observe(tracker, 0);
    assert.equal(observe(tracker, 100).badgeValue, 0);

    const result = observe(tracker, 200);
    assert.equal(result.totalDistance, 200);
    assert.equal(result.zoneIndex, 0);
    assert.equal(result.notificationAction, "show");
    assert.equal(result.badgeValue, 2);
  });

  test("tracks a large scrollable element without charging its initial offset", () => {
    const tracker = createTestTracker();
    observe(tracker, 400, ELEMENT);
    const result = observe(tracker, 500, ELEMENT);

    assert.equal(result.totalDistance, 100);
    assert.equal(result.zoneIndex, 0);
    assert.equal(result.badgeValue, 1);
  });
});

describe("large delta contract", () => {
  test("Home/back-to-top explicitly resets an armed window cycle", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    observe(tracker, 100);
    observe(tracker, 200);
    const beforeReset = observe(tracker, 300);
    assert.equal(beforeReset.zoneIndex, 2);

    const reset = observe(tracker, 0);
    assert.equal(reset.reason, "large-negative-to-top-reset");
    assert.equal(reset.reset, true);
    assert.equal(reset.totalDistance, 0);
    assert.equal(reset.zoneIndex, -1);
    assert.equal(reset.notificationVisible, false);
    assert.equal(reset.dismissedZoneIndex, -1);
    assert.equal(reset.badgeValue, 0);

    const rearmed = observe(tracker, 100);
    assert.equal(rearmed.notificationAction, "show");
    assert.equal(rearmed.badgeValue, 1);
  });

  test("a large upward jump ending within half a viewport of the start resets", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    observe(tracker, 100);
    observe(tracker, 200);
    observe(tracker, 300);

    const reset = observe(tracker, 40);
    assert.equal(reset.reason, "large-negative-to-top-reset");
    assert.equal(reset.scrollTop, 40);
    assert.equal(reset.totalDistance, 0);
    assert.equal(reset.badgeValue, 0);
  });

  test("an animated Home sequence resets when its sampled upward run reaches the top", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    const jumped = observe(tracker, 5000);
    assert.equal(jumped.totalDistance, 200);

    observe(tracker, 3500);
    observe(tracker, 1900);
    observe(tracker, 180);
    const reset = observe(tracker, 0);

    assert.equal(reset.reason, "large-negative-to-top-reset");
    assert.equal(reset.reset, true);
    assert.equal(reset.totalDistance, 0);
    assert.equal(reset.notificationVisible, false);
    assert.equal(reset.badgeValue, 0);
  });

  test("back-to-top resets a scrollable element using that target's scrollTop", () => {
    const tracker = createTestTracker();
    observe(tracker, 300, ELEMENT);
    observe(tracker, 400, ELEMENT);
    observe(tracker, 500, ELEMENT);
    observe(tracker, 600, ELEMENT);

    const reset = observe(tracker, 0, ELEMENT);
    assert.equal(reset.reason, "large-negative-to-top-reset");
    assert.equal(reset.totalDistance, 0);
    assert.equal(reset.badgeValue, 0);
  });

  test("End contributes a bounded positive amount instead of disappearing", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);

    const result = observe(tracker, 5000);
    assert.equal(result.reason, "large-positive-capped");
    assert.equal(result.rawDelta, 5000);
    assert.equal(result.appliedDelta, VIEWPORT * DEFAULT_LARGE_DELTA_SCREENS);
    assert.equal(result.totalDistance, 200);
    assert.equal(result.zoneIndex, 1);
    assert.equal(result.badgeValue, 2);
  });

  test("an anchor or programmatic downward jump uses the same bounded contribution", () => {
    const tracker = createTestTracker({ threshold: 2 });
    observe(tracker, 100);

    const result = observe(tracker, 1600);
    assert.equal(result.reason, "large-positive-capped");
    assert.equal(result.appliedDelta, 200);
    assert.equal(result.zoneIndex, 0);
  });

  test("dragging the scrollbar down contributes and dragging it to the top resets", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);

    const down = observe(tracker, 1200);
    assert.equal(down.appliedDelta, 200);
    assert.equal(down.badgeValue, 2);

    const up = observe(tracker, 0);
    assert.equal(up.reason, "large-negative-to-top-reset");
    assert.equal(up.badgeValue, 0);
  });

  test("a virtual-list rebase away from the top cannot erase accumulated depth", () => {
    const tracker = createTestTracker();
    observe(tracker, 1000, ELEMENT);
    observe(tracker, 1100, ELEMENT);
    observe(tracker, 1200, ELEMENT);

    const rebased = observe(tracker, 700, ELEMENT);
    assert.equal(rebased.reason, "large-negative-away-from-top-ignored");
    assert.equal(rebased.appliedDelta, 0);
    assert.equal(rebased.totalDistance, 200);
    assert.equal(rebased.reset, false);

    const positiveRecycle = observe(tracker, 1400, ELEMENT);
    assert.equal(positiveRecycle.reason, "large-positive-capped");
    assert.equal(positiveRecycle.appliedDelta, 200);
    assert.equal(positiveRecycle.totalDistance, 400);
  });
});

describe("reminder cycle, reset, and badge state", () => {
  test("dismissing the current level still allows the next level to appear", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    assert.equal(observe(tracker, 100).notificationAction, "show");

    tracker.dismiss();
    assert.equal(tracker.snapshot().notificationVisible, false);

    const deeper = observe(tracker, 200);
    assert.equal(deeper.currentZoneIndex, 1);
    assert.equal(deeper.notificationAction, "show");
  });

  test("a threshold change replaces a visible reminder in either direction", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    observe(tracker, 100);
    observe(tracker, 200);
    const deep = observe(tracker, 300);
    assert.equal(deep.currentZoneIndex, 2);

    const shallower = tracker.setThreshold(2);
    assert.equal(shallower.zoneIndex, 0);
    assert.equal(shallower.currentZoneIndex, 0);
    assert.equal(shallower.notificationAction, "replace");
    assert.equal(shallower.notificationVisible, true);

    const deeper = tracker.setThreshold(1);
    assert.equal(deeper.zoneIndex, 2);
    assert.equal(deeper.currentZoneIndex, 2);
    assert.equal(deeper.notificationAction, "replace");
  });

  test("a threshold change hides a visible reminder when its target level was dismissed", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    observe(tracker, 100);
    tracker.dismiss();
    observe(tracker, 200);
    assert.equal(tracker.snapshot().currentZoneIndex, 1);

    const hidden = tracker.setThreshold(2);
    assert.equal(hidden.zoneIndex, 0);
    assert.equal(hidden.currentZoneIndex, 0);
    assert.equal(hidden.dismissedZoneIndex, 0);
    assert.equal(hidden.notificationAction, "hide");
    assert.equal(hidden.notificationVisible, false);
  });

  test("moving to a shallower threshold clamps dismissal and rearms deeper levels", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    observe(tracker, 100);
    observe(tracker, 200);
    observe(tracker, 300);
    tracker.dismiss();
    assert.equal(tracker.snapshot().dismissedZoneIndex, 2);

    const changed = tracker.setThreshold(3);
    assert.equal(changed.zoneIndex, 0);
    assert.equal(changed.dismissedZoneIndex, 0);
    assert.equal(changed.notificationAction, "none");

    assert.equal(observe(tracker, 400).notificationAction, "none");
    const rearmed = observe(tracker, 600);
    assert.equal(rearmed.zoneIndex, 1);
    assert.equal(rearmed.notificationAction, "show");
  });

  test("returning below threshold rearms a dismissed shallow reminder", () => {
    const tracker = createTestTracker({ threshold: 2 });
    observe(tracker, 0);
    observe(tracker, 100);
    assert.equal(observe(tracker, 200).notificationAction, "show");
    tracker.dismiss();

    const surfaced = observe(tracker, 100);
    assert.equal(surfaced.zoneIndex, -1);
    assert.equal(surfaced.dismissedZoneIndex, -1);
    assert.equal(surfaced.badgeValue, 0);

    assert.equal(observe(tracker, 200).notificationAction, "show");
  });

  test("all three levels can arm again after returning below threshold", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);

    for (const position of [100, 200, 300]) {
      const entered = observe(tracker, position);
      assert.equal(entered.notificationAction, "show");
      tracker.dismiss();
    }

    observe(tracker, 200);
    observe(tracker, 100);
    const surfaced = observe(tracker, 0);
    assert.equal(surfaced.dismissedZoneIndex, -1);
    assert.equal(surfaced.badgeValue, 0);

    for (const position of [100, 200, 300]) {
      const entered = observe(tracker, position);
      assert.equal(entered.notificationAction, "show");
      tracker.dismiss();
    }
  });

  test("SPA reset clears depth, reminder state, badge, and target baseline", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    observe(tracker, 100);
    tracker.dismiss();
    observe(tracker, 200);

    const reset = tracker.reset("spa-navigation");
    assert.equal(reset.reason, "spa-navigation");
    assert.equal(reset.totalDistance, 0);
    assert.equal(reset.currentZoneIndex, -1);
    assert.equal(reset.dismissedZoneIndex, -1);
    assert.equal(reset.notificationVisible, false);
    assert.equal(reset.badgeValue, 0);

    assert.equal(observe(tracker, 900).reason, "target-changed");
    assert.equal(observe(tracker, 1000).notificationAction, "show");
  });

  test("badge updates at threshold and clears after an ordinary return below it", () => {
    const tracker = createTestTracker({ threshold: 2 });
    observe(tracker, 0);
    observe(tracker, 100);
    assert.equal(observe(tracker, 200).badgeValue, 2);
    assert.equal(observe(tracker, 100).badgeValue, 0);
  });

  test("resume rebases at the current target without emitting overdue reminders", () => {
    const tracker = createTestTracker();
    observe(tracker, 0);
    observe(tracker, 100);
    tracker.dismiss();

    const resumed = tracker.rebase({
      target: WINDOW,
      scrollTop: 900,
      viewportHeight: VIEWPORT,
    }, "session-resume");

    assert.equal(resumed.totalDistance, 0);
    assert.equal(resumed.notificationAction, "none");
    assert.equal(resumed.badgeValue, 0);
    assert.equal(observe(tracker, 950).notificationAction, "none");
    assert.equal(observe(tracker, 1000).notificationAction, "show");

    tracker.rebase({ target: WINDOW, scrollTop: 1000, viewportHeight: VIEWPORT }, "session-resume");
    const switchedTarget = observe(tracker, 700, ELEMENT);
    assert.equal(switchedTarget.reason, "target-changed");
    assert.equal(switchedTarget.totalDistance, 0);
    assert.equal(observe(tracker, 800, ELEMENT).notificationAction, "show");
  });

  test("a pending trailing event cannot charge its old position after pause and quick resume", async () => {
    const tracker = createTestTracker();
    const throttled = createTrailingThrottle((position) => observe(tracker, position), 30);

    throttled(0);
    throttled(200);
    throttled.cancel(); // pause cancels the pre-pause trailing position

    tracker.rebase({
      target: WINDOW,
      scrollTop: 200,
      viewportHeight: VIEWPORT,
    }, "session-resume");

    await new Promise((resolve) => setTimeout(resolve, 45));
    assert.equal(tracker.snapshot().totalDistance, 0);
    assert.equal(tracker.snapshot().notificationVisible, false);

    throttled(250);
    assert.equal(tracker.snapshot().totalDistance, 50);
    assert.equal(tracker.snapshot().notificationVisible, false);
  });
});
