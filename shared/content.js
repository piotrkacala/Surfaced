(() => {
  // ── Configuration defaults ────────────────────────────────────────────────
  const {
    KEYS,
    STORAGE_KEYS,
    createDefaults,
    normalizeHostname,
    normalizeSettings,
  } = SurfacedSettings;
  const DEFAULT_TEXT = browser.i18n.getMessage("defaultNotificationText");
  const DEFAULT_SETTINGS = createDefaults(DEFAULT_TEXT);
  const DEFAULT_THRESHOLD_SCREENS = DEFAULT_SETTINGS[KEYS.threshold];
  const { MESSAGE_TYPES: SESSION_MESSAGE_TYPES } = SurfacedSessionPause;
  const { createTrailingThrottle } = SurfacedScrollTracker;
  const THROTTLE_MS = 100;
  const SETTINGS_SETTLE_MS = 500;
  const NOTIFICATION_ID = "surfaced-notification-host";

  // ── State ─────────────────────────────────────────────────────────────────
  let globalThreshold = DEFAULT_THRESHOLD_SCREENS;
  let threshold = DEFAULT_THRESHOLD_SCREENS;
  let notificationText = DEFAULT_TEXT;
  let notificationVisible = false;
  let shadowHost = null;
  let lastSentBadgeValue = null;
  // Do not track with defaults until the persisted five-key snapshot is known.
  // The revision prevents a late startup read from replacing a newer change.
  let settingsStateKnown = false;
  let settingsStateRevision = 0;
  let settingsSettleTimer = null;
  // Unknown session state is fail-closed until the background answers. A
  // transient read failure then falls back to an unpaused, usable content script.
  let sessionPaused = true;
  let sessionStateKnown = false;
  let sessionStateRevision = 0;
  // Background resume count of the last known session state, or null if unknown.
  let sessionResumeCount = null;
  let lastScrollTarget = document.documentElement;
  let throttledScroll = null;

  // Depth Zones
  const ZONES = [
    { multiplier: 1, messageKey: "defaultNotificationText" },
    { multiplier: 2, messageKey: "notificationMid" },
    { multiplier: 3, messageKey: "notificationDeep" }
  ];
  const scrollTracker = SurfacedScrollTracker.createTracker({
    threshold: DEFAULT_THRESHOLD_SCREENS,
    viewportHeight: window.innerHeight,
    zoneMultipliers: ZONES.map((zone) => zone.multiplier),
  });

  // New global state flags
  let isGlobalEnabled = true;
  let disabledDomains = [];
  let siteOverrides = {};

  // Virtual scrolling & SPA state
  let lastUrl = window.location.href;
  let storedSettings = DEFAULT_SETTINGS;

  function getSiteThresholdOverride(hostname) {
    return siteOverrides[hostname] ?? null;
  }

  function applyStoredSettings(result, { replace = false } = {}) {
    storedSettings = normalizeSettings(
      replace ? result : { ...storedSettings, ...result },
      { defaultText: DEFAULT_TEXT }
    );
    globalThreshold = storedSettings[KEYS.threshold];
    notificationText = storedSettings[KEYS.text];
    isGlobalEnabled = storedSettings[KEYS.enabled];
    disabledDomains = storedSettings[KEYS.disabledDomains];
    siteOverrides = storedSettings[KEYS.siteOverrides];
  }

  function sendBadgeValue(value) {
    const normalizedValue = !sessionPaused && value >= 1 ? Math.floor(value) : 0;
    if (normalizedValue === lastSentBadgeValue) {
      return;
    }

    lastSentBadgeValue = normalizedValue;
    browser.runtime.sendMessage({ type: "SCROLL_DEPTH", value: normalizedValue }).catch(() => { });
  }

  setInterval(() => {
    if (window.location.href !== lastUrl) {
      const oldUrl = lastUrl;
      lastUrl = window.location.href;

      try {
        const oldObj = new URL(oldUrl);
        const newObj = new URL(lastUrl);

        // Heuristic to distinguish between SPA navigation and infinite scroll URL updates.
        // We reset tracking if:
        // 1. The pathname changed (likely a new view/page).
        // 2. OR we are near the top of the scrollable area (likely a new page load
        //    even if the pathname is the same, e.g. YouTube video changes).
        // This prevents the notification from disappearing on sites like Pepper.pl
        // where scrolling deep triggers a URL query update (?page=2) but is still the same list.
        const pathChanged = oldObj.pathname !== newObj.pathname;
        const scrollTop = window.scrollY
          || document.documentElement.scrollTop
          || scrollTracker.snapshot().scrollTop;
        const nearTop = scrollTop < window.innerHeight * 0.5;

        if (pathChanged || nearTop) {
          resetScrollTracking();
        }
      } catch (e) {
        // Fallback for invalid URLs: reset to be safe
        resetScrollTracking();
      }
    }
  }, 500);

  function resetScrollTracking({ cancelPending = true } = {}) {
    if (cancelPending) {
      throttledScroll?.cancel();
    }
    scrollTracker.reset("runtime-reset");
    removeNotification();
    sendBadgeValue(0);
  }

  // ── Load settings from storage ────────────────────────────────────────────
  function loadStoredSettings() {
    const requestRevision = settingsStateRevision;

    browser.storage.local.get(STORAGE_KEYS).then((result) => {
      if (requestRevision !== settingsStateRevision) {
        return;
      }

      applyStoredSettings(result, { replace: true });
      settingsStateKnown = true;
      evaluateActiveState();
    }).catch((error) => {
      if (requestRevision !== settingsStateRevision) {
        return;
      }

      console.error("Failed to load Surfaced settings", error);
      // A failed refresh keeps the last known snapshot; only an unknown
      // startup state must fail closed.
      if (!settingsStateKnown) {
        resetScrollTracking();
      }
    });
  }

  loadStoredSettings();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !STORAGE_KEYS.some((key) => changes[key])) {
      return;
    }

    settingsStateRevision += 1;
    if (!settingsStateKnown) {
      // A change can race the startup read. Reload the complete snapshot so
      // unchanged persisted fields are not replaced with defaults.
      loadStoredSettings();
      return;
    }

    // The popup persists every keystroke. Reload only after changes settle so
    // a partially typed threshold such as "1" on the way to "12" cannot flash
    // reminders and badges in every open tab.
    clearTimeout(settingsSettleTimer);
    settingsSettleTimer = setTimeout(() => {
      settingsSettleTimer = null;
      loadStoredSettings();
    }, SETTINGS_SETTLE_MS);
  });

  // ── Listen for updates from popup ─────────────────────────────────────────
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === SESSION_MESSAGE_TYPES.changed) {
      sessionStateRevision += 1;
      applySessionPaused(message.paused, "session-broadcast", message.resumeCount);
      return;
    }

    if (message.type === "SET_THRESHOLD") {
      settingsStateRevision += 1;
      const nextSettings = {
        [KEYS.threshold]: message.value,
      };
      if (message.text !== undefined) {
        nextSettings[KEYS.text] = message.text;
      }
      if (message.enabled !== undefined) {
        nextSettings[KEYS.enabled] = message.enabled;
      }
      if (message.disabledDomains !== undefined) {
        nextSettings[KEYS.disabledDomains] = message.disabledDomains;
      }
      if (message.siteOverrides !== undefined) {
        nextSettings[KEYS.siteOverrides] = message.siteOverrides;
      }

      applyStoredSettings(nextSettings);
      if (!settingsStateKnown) {
        loadStoredSettings();
        return;
      }
      evaluateActiveState();
    }
  });

  function loadSessionState(reason = "session-startup") {
    const requestRevision = sessionStateRevision;

    return browser.runtime.sendMessage({ type: SESSION_MESSAGE_TYPES.get })
      .then((response) => {
        if (requestRevision !== sessionStateRevision) {
          return;
        }

        if (!response?.ok) {
          throw new Error(response?.error || "SESSION_STATE_UNAVAILABLE");
        }

        applySessionPaused(response.paused, reason, response.resumeCount);
      })
      .catch((error) => {
        if (requestRevision !== sessionStateRevision) {
          return;
        }

        console.warn("Failed to load Surfaced session pause state", error);
        // A failed refresh keeps the last known state; only an unknown startup
        // state falls back to an unpaused, usable content script.
        if (!sessionStateKnown) {
          applySessionPaused(false, "session-read-failed");
        }
      });
  }

  let isEnabledOnSite = true;

  function evaluateActiveState() {
    const myHostname = normalizeHostname(window.location.hostname);
    isEnabledOnSite = isGlobalEnabled && (!myHostname || !disabledDomains.includes(myHostname));

    const siteThreshold = myHostname ? getSiteThresholdOverride(myHostname) : null;
    threshold = isEnabledOnSite && siteThreshold !== null ? siteThreshold : globalThreshold;

    if (settingsStateKnown && isEnabledOnSite && sessionStateKnown && !sessionPaused) {
      applyTrackerResult(scrollTracker.setThreshold(threshold));
      handleScroll(null);
    } else {
      resetScrollTracking();
    }
  }

  // ── Build notification ────────────────────────────────────────────────────
  function createNotification(zoneIdx) {
    const zone = ZONES[zoneIdx];
    // Use user-customized text only for the shallow zone (index 0)
    const text = zoneIdx === 0 ? notificationText : browser.i18n.getMessage(zone.messageKey);

    shadowHost = document.createElement("div");
    shadowHost.id = NOTIFICATION_ID;

    shadowHost.style.cssText = `
      all: initial;
      box-sizing: border-box;
      display: block;
      position: fixed;
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      width: 100%;
      min-width: 0;
      max-width: none;
      height: auto;
      margin: 0;
      padding: 0 0 env(safe-area-inset-bottom, 0px) 0;
      visibility: visible;
      opacity: 1;
      transform: none;
      filter: none;
      z-index: 2147483647;
      pointer-events: none;
      isolation: isolate;
      direction: ltr;
    `;

    const shadow = shadowHost.attachShadow({ mode: "closed" });

    // ── Styles ──────────────────────────────────────────────────────────────
    const style = document.createElement("style");
    style.textContent = SurfacedReminderView.createReminderStyles() + `
      .notification {
        margin: 0 auto 20px auto;
        width: calc(100% - 24px);
        max-width: 520px;
        pointer-events: all;
      }

      @media (max-width: 386px) {
        .notification {
          margin-bottom: 12px;
        }
      }

      /* A fixed host would repeat on every printed page. The shadow tree's
         !important outranks the host's inline display and any page rule. */
      @media print {
        :host {
          display: none !important;
        }
      }
    `;

    // ── Structure ────────────────────────────────────────────────────────────
    const { card } = SurfacedReminderView.createReminderCard({
      depth: zoneIdx + 1,
      text,
      dismissLabel: browser.i18n.getMessage("ariaNotificationDismiss"),
      onDismiss: () => dismissNotification(zoneIdx),
    });

    shadow.appendChild(style);
    shadow.appendChild(card);
    document.body.appendChild(shadowHost);

    notificationVisible = true;
  }

  // ── Remove notification ───────────────────────────────────────────────────
  function removeNotification() {
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
    }
    notificationVisible = false;
  }

  function dismissNotification(zoneIdx) {
    scrollTracker.dismiss(zoneIdx);
    removeNotification();
  }

  // ── Scroll logic ──────────────────────────────────────────────────────────
  function applyTrackerResult(result) {
    if (!settingsStateKnown || !sessionStateKnown || sessionPaused) {
      removeNotification();
      sendBadgeValue(0);
      return;
    }

    sendBadgeValue(result.badgeValue);

    if (result.notificationAction === "hide") {
      removeNotification();
      return;
    }

    if (result.notificationAction === "replace") {
      removeNotification();
      createNotification(result.currentZoneIndex);
      return;
    }

    if (result.notificationAction === "show") {
      createNotification(result.currentZoneIndex);
    }
  }

  function resolveScrollContext(event = null, fallbackTarget = null) {
    const rawTarget = event?.target ?? fallbackTarget ?? document;
    const scrollingElement = document.scrollingElement || document.documentElement;

    if (
      rawTarget === document
      || rawTarget === window
      || rawTarget === document.documentElement
      || rawTarget === document.body
    ) {
      return {
        target: scrollingElement,
        scrollTop: window.scrollY || scrollingElement.scrollTop || 0,
      };
    }

    if (rawTarget && rawTarget.nodeType === Node.ELEMENT_NODE) {
      // Ignore tiny scrolling areas (like small code blocks or dropdowns).
      if (!rawTarget.clientHeight || rawTarget.clientHeight < window.innerHeight * 0.5) {
        return null;
      }

      return {
        target: rawTarget,
        scrollTop: rawTarget.scrollTop,
      };
    }

    return null;
  }

  function rebaseAtCurrentPosition(reason) {
    const context = resolveScrollContext(null, lastScrollTarget)
      || resolveScrollContext();

    if (!context) {
      scrollTracker.reset(reason);
    } else {
      lastScrollTarget = context.target;
      scrollTracker.rebase({
        ...context,
        viewportHeight: window.innerHeight,
      }, reason);
    }

    removeNotification();
    sendBadgeValue(0);
  }

  function applySessionPaused(nextPaused, reason, resumeCount = null) {
    const wasKnown = sessionStateKnown;
    const wasPaused = sessionPaused;
    const nextResumeCount = Number.isSafeInteger(resumeCount) && resumeCount >= 0
      ? resumeCount
      : null;
    // Each real resume increments the count. A change this page did not see as
    // a paused-to-active transition means a complete pause and resume happened
    // while messages could not reach it, e.g. in the back/forward cache.
    const missedResume = nextResumeCount !== null
      && sessionResumeCount !== null
      && nextResumeCount !== sessionResumeCount;
    sessionStateKnown = true;
    sessionPaused = nextPaused === true;
    if (nextResumeCount !== null) {
      sessionResumeCount = nextResumeCount;
    }
    throttledScroll?.cancel();

    if (sessionPaused) {
      removeNotification();
      sendBadgeValue(0);
      return;
    }

    if (!wasKnown || wasPaused || missedResume) {
      // Resume starts from the current position of the last active target. A
      // later switch to another target establishes its own baseline as usual.
      rebaseAtCurrentPosition(reason || "session-resume");
    }

    evaluateActiveState();
  }

  function handleScroll(event) {
    if (!settingsStateKnown || !isEnabledOnSite || !sessionStateKnown || sessionPaused) {
      return;
    }

    const context = resolveScrollContext(event, lastScrollTarget);
    if (!context) return;

    lastScrollTarget = context.target;

    applyTrackerResult(scrollTracker.observe({
      ...context,
      viewportHeight: window.innerHeight,
    }));
  }

  function onScroll(event) {
    const context = resolveScrollContext(event);
    if (!context) return;

    // Remember the live target even while paused, so manual resume can rebase
    // at its current position without counting movement from the pause window.
    lastScrollTarget = context.target;

    if (!settingsStateKnown || !sessionStateKnown || sessionPaused) {
      throttledScroll.cancel();
      return;
    }

    throttledScroll(event);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  throttledScroll = createTrailingThrottle(handleScroll, THROTTLE_MS);

  // Use capture: true so we intercept scrolling on ANY element, not just the window.
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });

  // Tab messages sent while a page sits in the back/forward cache are dropped,
  // and browsers clear tab-specific badges on navigation. A restored page must
  // resynchronize settings and session pause, then republish its badge.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) {
      return;
    }

    lastSentBadgeValue = null;
    clearTimeout(settingsSettleTimer);
    settingsSettleTimer = null;
    settingsStateRevision += 1;
    sessionStateRevision += 1;
    // Settle the session first, so a skipped pause cycle is rebased before the
    // settings reload republishes the badge.
    loadSessionState("session-restore").then(() => loadStoredSettings());
  });

  loadSessionState();
})();
