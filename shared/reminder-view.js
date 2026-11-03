(function initializeSurfacedReminderView(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SurfacedReminderView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  // The in-page reminder and the popup preview render the same card from here.
  // Page placement stays with the content script.
  const SVG_NS = "http://www.w3.org/2000/svg";
  // The extension icon's three chevrons; one more lights up per depth zone.
  const DEPTH_CHEVRONS = Object.freeze(["3,2 8,6 13,2", "3,6 8,10 13,6", "3,10 8,14 13,10"]);

  const BASE_STYLES = `
    .notification {
      /* Light surface by default; deeper zones shift the accent toward deeper water. */
      --surface: #ffffff;
      --ink: #13293a;
      --muted: #5e7382;
      --border: rgba(19, 41, 58, 0.12);
      --hover: rgba(19, 41, 58, 0.07);
      --shadow:
        0 1px 2px rgba(10, 32, 48, 0.06),
        0 8px 20px rgba(10, 32, 48, 0.1),
        0 20px 44px -12px rgba(10, 32, 48, 0.22);
      --accent: #0b8aa3;
      --accent-tint: rgba(11, 138, 163, 0.1);
      --chevron: var(--accent);

      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      min-width: 0;
      padding: 10px 10px 10px 12px;
      border-radius: 16px;

      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      color: var(--ink);

      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: surfaced-reminder-rise 0.44s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .notification[data-depth="2"] {
      --accent: #2f63c4;
      --accent-tint: rgba(47, 99, 196, 0.18);
    }

    /* The deepest zone fills the icon tile instead of switching to alarm colors. */
    .notification[data-depth="3"] {
      --accent: #3f3d9e;
      --accent-tint: var(--accent);
      --chevron: var(--surface);
    }

    @keyframes surfaced-reminder-rise {
      from {
        opacity: 0;
        transform: translateY(14px);
      }
    }

    .notification__icon {
      box-sizing: border-box;
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: var(--accent-tint);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .notification__icon svg {
      display: block;
      width: 16px;
      height: 16px;
    }

    .notification__chevron {
      stroke: var(--chevron);
      opacity: 0.28;
      animation: surfaced-reminder-chevron 0.32s ease-out 0.16s both;
    }

    .notification__chevron:nth-child(2) {
      animation-delay: 0.24s;
    }

    .notification__chevron:nth-child(3) {
      animation-delay: 0.32s;
    }

    .notification__chevron--lit {
      opacity: 1;
    }

    @keyframes surfaced-reminder-chevron {
      from {
        opacity: 0;
        transform: translateY(-2px);
      }
    }

    .notification__text {
      flex: 1 1 auto;
      min-width: 0;
    }

    .notification__title {
      font-size: 15px;
      font-weight: 500;
      letter-spacing: -0.006em;
      color: var(--ink);
      line-height: 1.4;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .notification__close {
      box-sizing: border-box;
      flex-shrink: 0;
      appearance: none;
      width: 32px;
      height: 32px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s, color 0.15s;
    }

    .notification__close svg {
      display: block;
      width: 14px;
      height: 14px;
    }

    button.notification__close {
      cursor: pointer;
    }

    button.notification__close:hover {
      background: var(--hover);
      color: var(--ink);
    }

    button.notification__close:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      color: var(--ink);
    }
  `;

  const NARROW_STYLES = `
    .notification {
      gap: 10px;
      padding-left: 10px;
      border-radius: 14px;
    }

    .notification__title {
      font-size: 14px;
    }
  `;

  const TOUCH_STYLES = `
    .notification {
      padding-top: 6px;
      padding-right: 6px;
      padding-bottom: 6px;
    }

    .notification__close {
      width: 44px;
      height: 44px;
      border-radius: 12px;
    }
  `;

  const THEME_STYLES = `
    @media (prefers-color-scheme: dark) {
      .notification {
        --surface: #172530;
        --ink: #e6eff4;
        --muted: #9db0bc;
        --border: rgba(255, 255, 255, 0.1);
        --hover: rgba(255, 255, 255, 0.08);
        --shadow:
          0 1px 2px rgba(0, 0, 0, 0.24),
          0 8px 22px rgba(0, 0, 0, 0.3),
          0 18px 36px -16px rgba(0, 0, 0, 0.3);
        --accent: #5fcfe1;
        --accent-tint: rgba(95, 207, 225, 0.14);
      }

      .notification[data-depth="2"] {
        --accent: #84a9ff;
        --accent-tint: rgba(132, 169, 255, 0.24);
      }

      .notification[data-depth="3"] {
        --accent: #aaa7ff;
        --accent-tint: var(--accent);
      }
    }

    @media (forced-colors: active) {
      .notification__icon {
        border: 1px solid CanvasText;
      }

      .notification__chevron {
        stroke: CanvasText;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .notification,
      .notification__chevron {
        animation: none !important;
      }

      .notification__close {
        transition: none;
      }
    }
  `;

  // The desktop popup is narrower than the pages where reminders appear, so its
  // preview opts out of viewport-width adjustments and keeps the regular card.
  function createReminderStyles({ adaptToViewport = true } = {}) {
    const responsiveStyles = adaptToViewport
      ? `
        @media (max-width: 386px) {${NARROW_STYLES}}
        @media (max-width: 386px), (pointer: coarse) {${TOUCH_STYLES}}
      `
      : `
        @media (pointer: coarse) {${TOUCH_STYLES}}
      `;

    return BASE_STYLES + responsiveStyles + THEME_STYLES;
  }

  function createIconSvg(size) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    return svg;
  }

  function createDepthIcon(depth) {
    const iconWrap = document.createElement("div");
    iconWrap.className = "notification__icon";
    iconWrap.setAttribute("aria-hidden", "true");
    const svg = createIconSvg(16);

    DEPTH_CHEVRONS.forEach((points, index) => {
      const chevron = document.createElementNS(SVG_NS, "polyline");
      chevron.setAttribute(
        "class",
        index < depth ? "notification__chevron notification__chevron--lit" : "notification__chevron"
      );
      chevron.setAttribute("points", points);
      chevron.setAttribute("stroke-width", "1.8");
      chevron.setAttribute("stroke-linecap", "round");
      chevron.setAttribute("stroke-linejoin", "round");
      svg.appendChild(chevron);
    });

    iconWrap.appendChild(svg);
    return iconWrap;
  }

  function createCloseIcon() {
    const svg = createIconSvg(14);
    const cross = document.createElementNS(SVG_NS, "path");
    cross.setAttribute("d", "M3.5 3.5l7 7m0-7l-7 7");
    cross.setAttribute("stroke", "currentColor");
    cross.setAttribute("stroke-width", "1.6");
    cross.setAttribute("stroke-linecap", "round");
    svg.appendChild(cross);
    return svg;
  }

  // A preview keeps the dismiss control visible but neither focusable nor
  // announced, and its message is not a live region while the user edits it.
  function createReminderCard({ depth, text, preview = false, dismissLabel = "", onDismiss = () => { } }) {
    const card = document.createElement("div");
    card.className = "notification";
    card.dataset.depth = String(depth);

    const textBlock = document.createElement("div");
    textBlock.className = "notification__text";

    const message = document.createElement("span");
    message.className = "notification__title";
    message.textContent = text;
    textBlock.appendChild(message);

    let close;
    if (preview) {
      close = document.createElement("span");
      close.setAttribute("aria-hidden", "true");
    } else {
      textBlock.setAttribute("role", "status");
      textBlock.setAttribute("aria-live", "polite");
      textBlock.setAttribute("aria-atomic", "true");

      close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", dismissLabel);
      close.addEventListener("click", onDismiss);
    }
    close.className = "notification__close";
    close.appendChild(createCloseIcon());

    card.append(createDepthIcon(depth), textBlock, close);
    return { card, message };
  }

  return Object.freeze({
    createReminderCard,
    createReminderStyles,
  });
});
