(() => {
  // ── Configuration defaults ────────────────────────────────────────────────
  const STORAGE_KEY = "scrollNotifierThreshold";
  const TEXT_STORAGE_KEY = "scrollNotifierText";
  const OVERRIDES_KEY = "scrollNotifierSiteOverrides";
  const DEFAULT_THRESHOLD_SCREENS = 7;
  const DEFAULT_TEXT = browser.i18n.getMessage("defaultNotificationText");
  const THROTTLE_MS = 100;
  const NOTIFICATION_ID = "surfaced-notification-host";

  // ── State ─────────────────────────────────────────────────────────────────
  let threshold = DEFAULT_THRESHOLD_SCREENS;
  let notificationText = DEFAULT_TEXT;
  let notificationVisible = false;
  let shadowHost = null;

  // Depth Zones
  const ZONES = [
    { multiplier: 1, color: "#00d4ff", messageKey: "defaultNotificationText" },
    { multiplier: 2, color: "#f0a500", messageKey: "notificationMid" },
    { multiplier: 3, color: "#ff4f4f", messageKey: "notificationDeep" }
  ];
  let currentZoneIndex = -1;
  let dismissedZoneIndex = -1;

  // New global state flags
  let isGlobalEnabled = true;
  let disabledDomains = [];
  let siteOverrides = {};

  // Virtual scrolling & SPA state
  let totalDistanceScrolled = 0;
  let lastScrollTop = 0;
  let currentScrollTarget = null;
  let lastUrl = window.location.href;

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
        const scrollTop = window.scrollY || document.documentElement.scrollTop || (currentScrollTarget ? currentScrollTarget.scrollTop : 0);
        const nearTop = scrollTop < 500;

        if (pathChanged || nearTop) {
          resetScrollTracking();
        }
      } catch (e) {
        // Fallback for invalid URLs: reset to be safe
        resetScrollTracking();
      }
    }
  }, 500);

  function resetScrollTracking() {
    totalDistanceScrolled = 0;
    lastScrollTop = 0;
    currentScrollTarget = null;
    currentZoneIndex = -1;
    dismissedZoneIndex = -1;
    // Calling removeNotification works here due to function hoisting
    removeNotification();
    browser.runtime.sendMessage({ type: "SCROLL_DEPTH", value: 0 }).catch(() => { });
  }

  // ── Load threshold and text from storage ──────────────────────────────────
  browser.storage.local.get([
    STORAGE_KEY,
    TEXT_STORAGE_KEY,
    "scrollNotifierEnabled",
    "scrollNotifierDisabledDomains",
    OVERRIDES_KEY
  ]).then((result) => {
    if (result[STORAGE_KEY] !== undefined) {
      threshold = result[STORAGE_KEY];
    }
    if (result[TEXT_STORAGE_KEY] !== undefined) {
      notificationText = result[TEXT_STORAGE_KEY];
    }
    if (result.scrollNotifierEnabled !== undefined) {
      isGlobalEnabled = result.scrollNotifierEnabled;
    }
    if (result.scrollNotifierDisabledDomains !== undefined) {
      disabledDomains = result.scrollNotifierDisabledDomains;
    }
    if (result[OVERRIDES_KEY] !== undefined) {
      siteOverrides = result[OVERRIDES_KEY];
    }
    evaluateActiveState();
  });

  // ── Listen for updates from popup ─────────────────────────────────────────
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "SET_THRESHOLD") {
      threshold = message.value;
      if (message.text !== undefined) {
        notificationText = message.text;
      }
      if (message.enabled !== undefined) {
        isGlobalEnabled = message.enabled;
      }
      if (message.disabledDomains !== undefined) {
        disabledDomains = message.disabledDomains;
      }
      if (message.siteOverrides !== undefined) {
        siteOverrides = message.siteOverrides;
      }

      evaluateActiveState();
    }
  });

  let isEnabledOnSite = true;

  function evaluateActiveState() {
    const myHostname = window.location.hostname;
    isEnabledOnSite = isGlobalEnabled && !disabledDomains.includes(myHostname);

    // Apply site override if present
    if (isEnabledOnSite && siteOverrides[myHostname] !== undefined) {
      threshold = siteOverrides[myHostname];
    } else {
      // Fallback to global threshold
      browser.storage.local.get(STORAGE_KEY).then(res => {
        if (res[STORAGE_KEY] !== undefined) threshold = res[STORAGE_KEY];
      });
    }

    if (isEnabledOnSite) {
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
      @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500&family=Space+Mono:wght@700&display=swap');

      .notification {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;

        position: relative;
        margin: 0 auto 24px auto;
        min-width: 340px;
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

        font-family: 'Rubik', system-ui, sans-serif;
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
        font-family: 'Space Mono', monospace;
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
    dismissedZoneIndex = zoneIdx;
    removeNotification();
  }

  // ── Scroll logic ──────────────────────────────────────────────────────────
  function handleScroll(event) {
    if (!isEnabledOnSite) return;

    let target = event ? event.target : document;
    let scrollTop = 0;

    if (target === document || target === window) {
      target = document.documentElement;
      scrollTop = window.scrollY;
    } else if (target && target.nodeType === Node.ELEMENT_NODE) {
      // Ignore tiny scrolling areas (like small code blocks or dropdowns)
      if (!target.clientHeight || target.clientHeight < window.innerHeight * 0.5) {
        return;
      }
      scrollTop = target.scrollTop;
    } else {
      return;
    }

    // Context switch: if user starts scrolling a new container, reset our relative lastScrollTop
    if (currentScrollTarget !== target) {
      currentScrollTarget = target;
      lastScrollTop = scrollTop;
    }

    const delta = scrollTop - lastScrollTop;
    lastScrollTop = scrollTop;

    // Ignore massive sudden jumps (e.g., clicking "Back to top", or virtual list aggressive recycle)
    // 2x screen height is a safe heuristic for a programmatic jump vs a smooth scroll
    if (Math.abs(delta) > window.innerHeight * 2) {
      return;
    }

    totalDistanceScrolled += delta;

    // Clamp to 0 so we don't go negative if a user scrolls up slightly past origin
    if (totalDistanceScrolled < 0) {
      totalDistanceScrolled = 0;
    }

    const scrolledScreens = totalDistanceScrolled / window.innerHeight;

    // Determine current zone
    let targetZoneIndex = -1;
    for (let i = ZONES.length - 1; i >= 0; i--) {
      if (scrolledScreens >= threshold * ZONES[i].multiplier) {
        targetZoneIndex = i;
        break;
      }
    }

    const isPastThreshold = targetZoneIndex >= 0;

    // Update the extension badge with current depth only if past threshold
    const badgeValue = isPastThreshold ? scrolledScreens : 0;
    browser.runtime.sendMessage({ type: "SCROLL_DEPTH", value: badgeValue }).catch(() => { });

    // Handle zone visibility and triggering
    if (isPastThreshold) {
      if (!notificationVisible) {
        // Only trigger if we are in a higher zone than the one last dismissed
        if (targetZoneIndex > dismissedZoneIndex) {
          currentZoneIndex = targetZoneIndex;
          createNotification(targetZoneIndex);
        }
      } else {
        // If already visible, check if we've moved to a DEEPER zone
        // This allows auto-updating the notification if they scroll even deeper without dismissing
        if (targetZoneIndex > currentZoneIndex) {
          currentZoneIndex = targetZoneIndex;
          removeNotification();
          createNotification(targetZoneIndex);
        }
      }
    } else if (notificationVisible) {
      // If user scrolls back up below threshold entirely, hide
      removeNotification();
      currentZoneIndex = -1;
      // Also reset dismissed index if they come all the way back up? 
      // Roadmap doesn't specify, but usually "reset" happens on surface.
      dismissedZoneIndex = -1;
    }
  }

  // ── Throttle ──────────────────────────────────────────────────────────────
  function throttle(fn, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn.apply(this, args);
      }
    };
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  const throttledScroll = throttle(handleScroll, THROTTLE_MS);

  // Use capture: true so we intercept scrolling on ANY element, not just the window.
  window.addEventListener("scroll", throttledScroll, { passive: true, capture: true });
})();