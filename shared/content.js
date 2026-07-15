(() => {
  // ── Configuration defaults ────────────────────────────────────────────────
  const { KEYS, STORAGE_KEYS, createDefaults, normalizeSettings } = SurfacedSettings;
  const DEFAULT_TEXT = browser.i18n.getMessage("defaultNotificationText");
  const DEFAULT_SETTINGS = createDefaults(DEFAULT_TEXT);
  const DEFAULT_THRESHOLD_SCREENS = DEFAULT_SETTINGS[KEYS.threshold];
  const { MESSAGE_TYPES: SESSION_MESSAGE_TYPES } = SurfacedSessionPause;
  const { createTrailingThrottle } = SurfacedScrollTracker;
  const THROTTLE_MS = 100;
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
  // Unknown session state is fail-closed until the background answers. A
  // transient read failure then falls back to an unpaused, usable content script.
  let sessionPaused = true;
  let sessionStateKnown = false;
  let sessionStateRevision = 0;
  let lastScrollTarget = document.documentElement;
  let throttledScroll = null;

  // Depth Zones
  const ZONES = [
    { multiplier: 1, color: "#00d4ff", messageKey: "defaultNotificationText" },
    { multiplier: 2, color: "#f0a500", messageKey: "notificationMid" },
    { multiplier: 3, color: "#ff4f4f", messageKey: "notificationDeep" }
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
      resetScrollTracking();
    });
  }

  loadStoredSettings();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    const nextSettings = {};

    STORAGE_KEYS.forEach((key) => {
      if (changes[key]) {
        nextSettings[key] = changes[key].newValue;
      }
    });

    if (Object.keys(nextSettings).length === 0) {
      return;
    }

    settingsStateRevision += 1;
    if (!settingsStateKnown) {
      // A change can race the startup read. Reload the complete snapshot so
      // unchanged persisted fields are not replaced with defaults.
      loadStoredSettings();
      return;
    }

    applyStoredSettings(nextSettings);
    evaluateActiveState();
  });

  // ── Listen for updates from popup ─────────────────────────────────────────
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === SESSION_MESSAGE_TYPES.changed) {
      sessionStateRevision += 1;
      applySessionPaused(message.paused, "session-broadcast");
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

  function loadSessionState() {
    const requestRevision = sessionStateRevision;

    browser.runtime.sendMessage({ type: SESSION_MESSAGE_TYPES.get })
      .then((response) => {
        if (requestRevision !== sessionStateRevision) {
          return;
        }

        if (!response?.ok) {
          throw new Error(response?.error || "SESSION_STATE_UNAVAILABLE");
        }

        applySessionPaused(response.paused, "session-startup");
      })
      .catch((error) => {
        if (requestRevision !== sessionStateRevision) {
          return;
        }

        console.warn("Failed to load Surfaced session pause state", error);
        applySessionPaused(false, "session-read-failed");
      });
  }

  let isEnabledOnSite = true;

  function evaluateActiveState() {
    const myHostname = window.location.hostname;
    isEnabledOnSite = isGlobalEnabled && !disabledDomains.includes(myHostname);

    const siteThreshold = getSiteThresholdOverride(myHostname);
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
    const color = zone.color;
    // Use user-customized text only for the shallow zone (index 0)
    const text = zoneIdx === 0 ? notificationText : browser.i18n.getMessage(zone.messageKey);

    shadowHost = document.createElement("div");
    shadowHost.id = NOTIFICATION_ID;

    Object.assign(shadowHost.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      width: "100%",
      zIndex: "2147483647",
      pointerEvents: "none",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    });

    const shadow = shadowHost.attachShadow({ mode: "closed" });

    // ── Styles ──────────────────────────────────────────────────────────────
    const style = document.createElement("style");
    style.textContent = `
      .notification {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;

        position: relative;
        margin: 0 auto 24px auto;
        width: calc(100% - 24px);
        min-width: 0;
        max-width: 580px;
        padding: 16px 22px;
        border-radius: 14px;
        pointer-events: all;
        overflow: hidden;

        /* Ocean dark background */
        background: linear-gradient(
          135deg,
          rgba(4, 22, 42, 0.98) 0%,
          rgba(2, 14, 30, 0.98) 100%
        );
        border: 1px solid ${color}40;
        box-shadow:
          0 0 0 1px ${color}14,
          0 12px 40px rgba(0, 0, 0, 0.7),
          0 0 50px ${color}14,
          inset 0 1px 0 ${color}1a;

        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: surface-up 0.4s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
      }

      @keyframes surface-up {
        from {
          opacity: 0;
          transform: translateY(20px);
          box-shadow: 0 0 0 1px ${color}14, 0 0 0 rgba(0,0,0,0);
        }
        to {
          opacity: 1;
          transform: translateY(0);
          box-shadow:
            0 0 0 1px ${color}14,
            0 8px 32px rgba(0, 0, 0, 0.6),
            0 0 40px ${color}14,
            inset 0 1px 0 ${color}1a;
        }
      }

      /* Caustic shimmer layer inside the notification */
      .notification::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse 80px 30px at 20% 50%, ${color}0d 0%, transparent 70%),
          radial-gradient(ellipse 60px 40px at 75% 30%, ${color}0a 0%, transparent 70%);
        pointer-events: none;
        animation: caustic-shift 6s ease-in-out infinite alternate;
      }

      @keyframes caustic-shift {
        0%   { opacity: 0.6; transform: scale(1) translateX(0); }
        100% { opacity: 1;   transform: scale(1.05) translateX(4px); }
      }

      /* Glowing top-edge line — like light at the water surface */
      .notification::after {
        content: '';
        position: absolute;
        top: 0;
        left: 10%;
        right: 10%;
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent,
          ${color}99,
          ${color}cc,
          ${color}99,
          transparent
        );
        animation: surface-shimmer 3s ease-in-out infinite;
      }

      @keyframes surface-shimmer {
        0%, 100% { opacity: 0.5; transform: scaleX(0.9); }
        50%       { opacity: 1.0; transform: scaleX(1.0); }
      }

      /* Left: icon + text */
      .notification__left {
        display: flex;
        align-items: center;
        gap: 10px;
        position: relative;
        z-index: 1;
        min-width: 0;
      }

      /* Depth icon */
      .notification__icon {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: ${color}14;
        border: 1px solid ${color}33;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .notification__icon svg {
        width: 18px;
        height: 18px;
      }

      /* Text block */
      .notification__text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .notification__title {
        font-size: 14px;
        font-weight: 500;
        color: #c8eaf7;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .notification__sub {
        font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
        font-size: 10px;
        color: rgba(200, 234, 247, 0.7);
        letter-spacing: 0.4px;
      }

      /* Right: close button */
      .notification__close {
        flex-shrink: 0;
        position: relative;
        z-index: 1;
        width: 30px;
        height: 30px;
        border-radius: 7px;
        background: ${color}0d;
        border: 1px solid ${color}26;
        color: rgba(90, 143, 174, 0.8);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
      }

      .notification__close:hover {
        background: ${color}1f;
        border-color: ${color}66;
        color: ${color};
        box-shadow: 0 0 10px ${color}33;
      }

      /* Bubble particles */
      .bubble {
        position: absolute;
        bottom: 4px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.35), ${color}0f);
        border: 1px solid ${color}33;
        pointer-events: none;
        animation: bubble-float linear infinite;
      }

      @keyframes bubble-float {
        0%   { transform: translateY(0) translateX(0); opacity: 0; }
        15%  { opacity: 0.7; }
        85%  { opacity: 0.4; }
        100% { transform: translateY(-60px) translateX(var(--dx, 0px)); opacity: 0; }
      }

      @media (max-width: 386px) {
        .notification {
          gap: 10px;
          margin-bottom: 12px;
          padding: 12px;
          border-radius: 12px;
        }

        .notification__left {
          gap: 8px;
        }

        .notification__icon {
          width: 32px;
          height: 32px;
        }

        .notification__close {
          width: 32px;
          height: 32px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .notification,
        .notification::before,
        .notification::after {
          animation: none !important;
          transform: none !important;
        }

        .notification {
          opacity: 1;
        }

        .notification__close {
          transition: none;
        }

        .bubble {
          display: none;
          animation: none !important;
        }
      }
    `;

    // ── Structure ────────────────────────────────────────────────────────────
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.setAttribute("role", "alert");
    notification.setAttribute("aria-live", "polite");

    // Bubbles
    for (let i = 0; i < 5; i++) {
      const b = document.createElement("div");
      b.className = "bubble";
      const size = 3 + Math.random() * 5;
      const left = 5 + Math.random() * 90;
      const delay = Math.random() * 4;
      const dur = 3 + Math.random() * 3;
      const dx = (Math.random() - 0.5) * 16;
      b.style.cssText = `
        width:${size}px; height:${size}px;
        left:${left}%;
        animation-duration:${dur}s;
        animation-delay:-${delay}s;
        --dx:${dx}px;
      `;
      notification.appendChild(b);
    }

    // Left section
    const left = document.createElement("div");
    left.className = "notification__left";

    // Icon: three chevrons (matching the extension icon concept)
    const iconWrap = document.createElement("div");
    iconWrap.className = "notification__icon";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "none");

    const polylines = [
      { points: "3,3 8,7 13,3", opacity: "1" },
      { points: "3,7 8,11 13,7", opacity: "0.55" },
      { points: "3,11 8,15 13,11", opacity: "0.2" }
    ];

    polylines.forEach(p => {
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      poly.setAttribute("points", p.points);
      poly.setAttribute("stroke", color);
      poly.setAttribute("stroke-width", "1.8");
      poly.setAttribute("stroke-linecap", "round");
      poly.setAttribute("stroke-linejoin", "round");
      poly.setAttribute("opacity", p.opacity);
      svg.appendChild(poly);
    });

    iconWrap.appendChild(svg);

    const textBlock = document.createElement("div");
    textBlock.className = "notification__text";

    const title = document.createElement("span");
    title.className = "notification__title";
    title.textContent = text;

    const sub = document.createElement("span");
    sub.className = "notification__sub";
    sub.textContent = browser.i18n.getMessage("notificationSub");

    textBlock.appendChild(title);
    textBlock.appendChild(sub);
    left.appendChild(iconWrap);
    left.appendChild(textBlock);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "notification__close";
    closeBtn.setAttribute("aria-label", browser.i18n.getMessage("ariaNotificationDismiss"));
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => dismissNotification(zoneIdx));

    notification.appendChild(left);
    notification.appendChild(closeBtn);

    shadow.appendChild(style);
    shadow.appendChild(notification);
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

  function applySessionPaused(nextPaused, reason) {
    const wasKnown = sessionStateKnown;
    const wasPaused = sessionPaused;
    sessionStateKnown = true;
    sessionPaused = nextPaused === true;
    throttledScroll?.cancel();

    if (sessionPaused) {
      removeNotification();
      sendBadgeValue(0);
      return;
    }

    if (!wasKnown || wasPaused) {
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
  loadSessionState();
})();
