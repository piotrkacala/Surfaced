(function initializeSurfacedScrollTracker(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SurfacedScrollTracker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const DEFAULT_LARGE_DELTA_SCREENS = 2;
  const DEFAULT_NEAR_TOP_SCREENS = 0.5;
  const DEFAULT_ZONE_MULTIPLIERS = Object.freeze([1, 2, 3]);

  function positiveNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : fallback;
  }

  function nonNegativeNumber(value, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : fallback;
  }

  function zoneForScreens(scrolledScreens, threshold, zoneMultipliers) {
    for (let index = zoneMultipliers.length - 1; index >= 0; index -= 1) {
      if (scrolledScreens >= threshold * zoneMultipliers[index]) {
        return index;
      }
    }

    return -1;
  }

  function createTrailingThrottle(fn, delay) {
    if (typeof fn !== "function") {
      throw new TypeError("A throttled function is required");
    }

    const wait = nonNegativeNumber(delay);
    let lastCall = 0;
    let trailingTimer = null;
    let trailingArgs = null;
    let trailingContext = null;

    function invoke(context, args) {
      lastCall = Date.now();
      fn.apply(context, args);
    }

    function cancel() {
      if (trailingTimer !== null) {
        clearTimeout(trailingTimer);
      }
      trailingTimer = null;
      trailingArgs = null;
      trailingContext = null;
      // The first event after a reset or resume should establish progress
      // immediately rather than inheriting the previous throttle window.
      lastCall = 0;
    }

    function throttled(...args) {
      const now = Date.now();
      const remaining = wait - (now - lastCall);

      if (remaining <= 0) {
        cancel();
        invoke(this, args);
        return;
      }

      trailingArgs = args;
      trailingContext = this;
      if (trailingTimer === null) {
        trailingTimer = setTimeout(() => {
          const pendingArgs = trailingArgs;
          const pendingContext = trailingContext;
          trailingTimer = null;
          trailingArgs = null;
          trailingContext = null;
          invoke(pendingContext, pendingArgs);
        }, remaining);
      }
    }

    throttled.cancel = cancel;
    return throttled;
  }

  function createTracker({
    threshold = 7,
    viewportHeight = 1,
    largeDeltaScreens = DEFAULT_LARGE_DELTA_SCREENS,
    nearTopScreens = DEFAULT_NEAR_TOP_SCREENS,
    zoneMultipliers = DEFAULT_ZONE_MULTIPLIERS,
  } = {}) {
    let activeTarget = null;
    let lastScrollTop = 0;
    let upwardRunStart = null;
    let totalDistance = 0;
    let currentZoneIndex = -1;
    let dismissedZoneIndex = -1;
    let notificationVisible = false;
    let currentThreshold = positiveNumber(threshold, 7);
    let currentViewportHeight = positiveNumber(viewportHeight, 1);
    const multipliers = Array.isArray(zoneMultipliers) && zoneMultipliers.length > 0
      ? zoneMultipliers.map((value) => positiveNumber(value, 1))
      : [...DEFAULT_ZONE_MULTIPLIERS];
    const jumpScreens = positiveNumber(largeDeltaScreens, DEFAULT_LARGE_DELTA_SCREENS);
    const topScreens = nonNegativeNumber(nearTopScreens, DEFAULT_NEAR_TOP_SCREENS);

    function state(extra = {}) {
      const scrolledScreens = totalDistance / currentViewportHeight;
      const zoneIndex = zoneForScreens(scrolledScreens, currentThreshold, multipliers);

      return {
        totalDistance,
        scrolledScreens,
        scrollTop: lastScrollTop,
        hasActiveTarget: activeTarget !== null,
        zoneIndex,
        currentZoneIndex,
        dismissedZoneIndex,
        notificationVisible,
        badgeValue: zoneIndex >= 0 ? Math.floor(scrolledScreens) : 0,
        ...extra,
      };
    }

    function clearCycle({ clearTarget = false } = {}) {
      upwardRunStart = null;
      if (clearTarget) {
        activeTarget = null;
        lastScrollTop = 0;
      }
      totalDistance = 0;
      currentZoneIndex = -1;
      dismissedZoneIndex = -1;
      notificationVisible = false;
    }

    function applyZoneTransition() {
      const scrolledScreens = totalDistance / currentViewportHeight;
      const targetZoneIndex = zoneForScreens(scrolledScreens, currentThreshold, multipliers);
      let notificationAction = "none";

      if (targetZoneIndex >= 0) {
        if (!notificationVisible && targetZoneIndex > dismissedZoneIndex) {
          currentZoneIndex = targetZoneIndex;
          notificationVisible = true;
          notificationAction = "show";
        } else if (notificationVisible && targetZoneIndex > currentZoneIndex) {
          currentZoneIndex = targetZoneIndex;
          notificationAction = "replace";
        }
      } else {
        if (notificationVisible) {
          notificationAction = "hide";
        }
        notificationVisible = false;
        currentZoneIndex = -1;
        // Surfacing below the first threshold starts a fresh three-level cycle,
        // including when the previous reminder had already been dismissed.
        dismissedZoneIndex = -1;
      }

      return notificationAction;
    }

    function reset(reason = "reset") {
      const notificationAction = notificationVisible ? "hide" : "none";
      clearCycle({ clearTarget: true });
      return state({ reason, reset: true, notificationAction });
    }

    function rebase({ target, scrollTop, viewportHeight: nextViewportHeight } = {}, reason = "rebase") {
      const notificationAction = notificationVisible ? "hide" : "none";
      currentViewportHeight = positiveNumber(nextViewportHeight, currentViewportHeight);
      clearCycle({ clearTarget: true });
      activeTarget = target ?? null;
      lastScrollTop = nonNegativeNumber(scrollTop);

      return state({
        reason,
        reset: true,
        rawDelta: 0,
        appliedDelta: 0,
        notificationAction,
      });
    }

    function observe({ target, scrollTop, viewportHeight: nextViewportHeight } = {}) {
      currentViewportHeight = positiveNumber(nextViewportHeight, currentViewportHeight);
      const position = nonNegativeNumber(scrollTop);

      if (activeTarget !== target) {
        activeTarget = target;
        lastScrollTop = position;
        upwardRunStart = null;
        return state({
          reason: "target-changed",
          rawDelta: 0,
          appliedDelta: 0,
          notificationAction: "none",
        });
      }

      const previousScrollTop = lastScrollTop;
      const rawDelta = position - previousScrollTop;
      lastScrollTop = position;
      const largeDeltaPixels = currentViewportHeight * jumpScreens;
      const nearTopPixels = currentViewportHeight * topScreens;
      let appliedDelta = rawDelta;
      let reason = "ordinary-delta";

      if (rawDelta < 0) {
        if (upwardRunStart === null) {
          upwardRunStart = previousScrollTop;
        }

        if (position <= nearTopPixels && upwardRunStart - position > largeDeltaPixels) {
          // Browsers and sites may animate Home/back-to-top. Classify the whole
          // monotonic upward run so throttled samples still form one large jump.
          const notificationAction = notificationVisible ? "hide" : "none";
          clearCycle();
          return state({
            rawDelta,
            appliedDelta: 0,
            reason: "large-negative-to-top-reset",
            reset: true,
            notificationAction,
          });
        }
      } else if (rawDelta > 0) {
        upwardRunStart = null;
      }

      if (rawDelta < -largeDeltaPixels) {
        appliedDelta = 0;
        // A large negative rebase away from the beginning is commonly produced
        // when virtual lists recycle rows. It must not erase earned depth.
        reason = "large-negative-away-from-top-ignored";
      } else if (rawDelta > largeDeltaPixels) {
        // End, anchors, scripted navigation, and scrollbar drags are observable
        // user journeys. Count them, but bound one event so virtual-list position
        // churn cannot add an arbitrarily large amount of synthetic depth.
        appliedDelta = largeDeltaPixels;
        reason = "large-positive-capped";
      }

      totalDistance = Math.max(0, totalDistance + appliedDelta);
      const notificationAction = applyZoneTransition();

      return state({ rawDelta, appliedDelta, reason, reset: false, notificationAction });
    }

    function dismiss() {
      if (notificationVisible) {
        dismissedZoneIndex = currentZoneIndex;
        notificationVisible = false;
      }
      return state({ reason: "dismissed", notificationAction: "hide" });
    }

    function setThreshold(nextThreshold) {
      currentThreshold = positiveNumber(nextThreshold, currentThreshold);
      const notificationAction = applyZoneTransition();
      return state({ reason: "threshold-changed", notificationAction });
    }

    return Object.freeze({ dismiss, observe, rebase, reset, setThreshold, snapshot: state });
  }

  return Object.freeze({
    DEFAULT_LARGE_DELTA_SCREENS,
    DEFAULT_NEAR_TOP_SCREENS,
    DEFAULT_ZONE_MULTIPLIERS,
    createTrailingThrottle,
    createTracker,
    zoneForScreens,
  });
});
