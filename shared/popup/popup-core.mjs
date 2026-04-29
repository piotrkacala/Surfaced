const DEFAULT_PLATFORM_CONFIG = {
  gaugeHeight: "128px",
  sliderHeight: "4px",
  sliderBorderRadius: "2px",
  sliderThumbSize: "16px",
  isTouch: false,
};

const THRESHOLD_STEP = 0.5;

export function mountPopup(platformConfig = {}) {
  const config = {
    ...DEFAULT_PLATFORM_CONFIG,
    ...platformConfig,
  };

  const interactionPseudoClass = config.isTouch ? "active" : "hover";
  const pointerStyles = config.isTouch ? "" : "cursor: pointer;";
  const toggleBaseStyles = config.isTouch
    ? "display: inline-flex; align-items: center; min-height: 44px;"
    : "display: inline-flex; align-items: center; cursor: pointer;";

  const KEYS = {
    threshold: "scrollNotifierThreshold",
    enabled: "scrollNotifierEnabled",
    disabledDomains: "scrollNotifierDisabledDomains",
    text: "scrollNotifierText",
    siteOverrides: "scrollNotifierSiteOverrides",
  };

  const msg = (key, ...subs) => browser.i18n.getMessage(key, subs);
  const uiLanguage = browser.i18n.getUILanguage();
  if (uiLanguage) {
    document.documentElement.lang = uiLanguage;
  }

  const pluralRules = new Intl.PluralRules(uiLanguage);
  const numberFormatter = new Intl.NumberFormat(uiLanguage, {
    maximumFractionDigits: 2,
  });

  function getUnitScreensMsg(value) {
    const form = pluralRules.select(value);
    const suffix = form.charAt(0).toUpperCase() + form.slice(1);
    const localized = msg("unitScreens" + suffix);
    return localized ? localized : msg("unitScreensOther");
  }

  function formatThresholdNumber(value) {
    return numberFormatter.format(value);
  }

  const DEFAULTS = {
    threshold: 7,
    enabled: true,
    disabledDomains: [],
    text: msg("defaultNotificationText"),
  };

  function normalizeThresholdInput(value) {
    return String(value ?? "").trim().replace(",", ".");
  }

  function parsePositiveThreshold(value) {
    const normalizedValue = normalizeThresholdInput(value);
    if (!normalizedValue) {
      return null;
    }

    const parsed = Number(normalizedValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function parseLiveThreshold(value) {
    const rawValue = String(value ?? "").trim();
    if (!rawValue || /[.,]$/.test(rawValue)) {
      return null;
    }

    return parsePositiveThreshold(rawValue);
  }

  function sanitizeThreshold(value, fallback = DEFAULTS.threshold) {
    return parsePositiveThreshold(value) ?? fallback;
  }

  function normalizeThreshold(value) {
    return Number(value.toFixed(2));
  }

  const root = document.getElementById("root");
  const shadow = root.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      box-sizing: border-box;
      --deep: #020d1a;
      --mid: #041628;
      --panel: rgba(4, 24, 46, 0.9);
      --panel-strong: rgba(4, 22, 42, 0.98);
      --accent: #00d4ff;
      --accent-soft: rgba(0, 212, 255, 0.12);
      --accent-border: rgba(0, 212, 255, 0.18);
      --text: #d7f1fb;
      --text-dim: #7fb3c8;
      --text-muted: rgba(200, 234, 247, 0.72);
      --warning: #f0a500;
      --danger: #ff4f4f;
      --font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
      --control-height: ${config.isTouch ? "44px" : "36px"};
      --control-radius: ${config.isTouch ? "12px" : "9px"};
      --chip-height: ${config.isTouch ? "38px" : "30px"};

      display: block;
      width: 100%;
      min-height: ${config.isTouch ? "0" : "auto"};
      height: ${config.isTouch ? "auto" : "100%"};
      overflow: ${config.isTouch ? "visible" : "hidden"};
      ${config.isTouch ? "touch-action: pan-y;" : ""}
      color: var(--text);
      font-family: var(--font-ui);
      font-size: ${config.isTouch ? "14px" : "12px"};
      -webkit-font-smoothing: antialiased;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    [hidden] {
      display: none !important;
    }

    .shell {
      position: relative;
      width: 100%;
      min-height: ${config.isTouch ? "100dvh" : "auto"};
      height: ${config.isTouch ? "auto" : "100%"};
      display: flex;
      flex-direction: column;
      overflow: ${config.isTouch ? "visible" : "hidden"};
      ${config.isTouch ? "touch-action: pan-y;" : ""}
      background:
        radial-gradient(circle at top left, rgba(26, 111, 168, 0.16), transparent 28%),
        radial-gradient(circle at bottom right, rgba(0, 212, 255, 0.08), transparent 32%),
        linear-gradient(135deg, rgba(4, 22, 42, 0.97) 0%, rgba(2, 14, 30, 0.99) 100%);
      border: 1px solid rgba(0, 212, 255, 0.24);
      border-radius: 10px;
      box-shadow:
        0 0 0 1px rgba(0, 212, 255, 0.08),
        0 14px 36px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(0, 212, 255, 0.08);
      animation: surface-up 0.32s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
    }

    .shell::before,
    .shell::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .shell::before {
      background:
        radial-gradient(ellipse 120px 40px at 18% 12%, rgba(0, 212, 255, 0.07) 0%, transparent 72%),
        radial-gradient(ellipse 90px 60px at 78% 22%, rgba(0, 180, 220, 0.05) 0%, transparent 72%);
      animation: caustic-shift 8s ease-in-out infinite alternate;
    }

    .shell::after {
      top: 0;
      left: 12%;
      right: 12%;
      bottom: auto;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(0, 212, 255, 0.55),
        rgba(91, 196, 245, 0.8),
        rgba(0, 212, 255, 0.55),
        transparent
      );
      animation: surface-shimmer 3s ease-in-out infinite;
    }

    @keyframes surface-up {
      from {
        opacity: 0;
        transform: translateY(14px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes caustic-shift {
      0% {
        opacity: 0.65;
        transform: scale(1) translateX(0);
      }
      100% {
        opacity: 1;
        transform: scale(1.04) translateX(6px);
      }
    }

    @keyframes surface-shimmer {
      0%, 100% {
        opacity: 0.45;
        transform: scaleX(0.94);
      }
      50% {
        opacity: 1;
        transform: scaleX(1);
      }
    }

    .header {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      column-gap: ${config.isTouch ? "16px" : "12px"};
      row-gap: 8px;
      padding: ${config.isTouch ? "16px" : "14px"};
      border-bottom: 1px solid rgba(0, 212, 255, 0.12);
      background: linear-gradient(180deg, rgba(3, 26, 50, 0.94) 0%, rgba(2, 16, 32, 0.7) 100%);
      backdrop-filter: blur(6px);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: ${config.isTouch ? "12px" : "10px"};
      min-width: 0;
    }

    .brand__icon {
      width: ${config.isTouch ? "34px" : "30px"};
      height: ${config.isTouch ? "34px" : "30px"};
      border-radius: 8px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .brand__icon svg {
      width: ${config.isTouch ? "18px" : "16px"};
      height: ${config.isTouch ? "18px" : "16px"};
    }

    .brand__name {
      margin: 0;
      font-size: ${config.isTouch ? "17px" : "15px"};
      line-height: 1;
      font-weight: 600;
      color: #edf9ff;
      letter-spacing: 0.2px;
    }

    .header-description {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--text-muted);
      line-height: 1.42;
      font-size: ${config.isTouch ? "13px" : "12px"};
      max-width: ${config.isTouch ? "30ch" : "none"};
    }

    .header__toggle {
      display: flex;
      align-items: center;
      gap: ${config.isTouch ? "10px" : "8px"};
      flex-shrink: 0;
    }

    .toggle-label {
      color: var(--text-dim);
      font-size: ${config.isTouch ? "11px" : "10px"};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      white-space: nowrap;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .switch {
      ${toggleBaseStyles}
    }

    .switch input {
      display: none;
    }

    .switch__track {
      width: 38px;
      height: 22px;
      position: relative;
      border-radius: 999px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    }

    .switch__thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: rgba(90, 143, 174, 0.82);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, box-shadow 0.2s;
    }

    .switch input:checked + .switch__track {
      background: rgba(0, 212, 255, 0.18);
      border-color: rgba(0, 212, 255, 0.48);
      box-shadow: 0 0 10px rgba(0, 212, 255, 0.18);
    }

    .switch input:checked + .switch__track .switch__thumb {
      transform: translateX(16px);
      background: var(--accent);
      box-shadow: 0 0 10px rgba(0, 212, 255, 0.45);
    }

    .content {
      position: relative;
      z-index: 1;
      flex: ${config.isTouch ? "0 0 auto" : "1 1 auto"};
      overflow-y: ${config.isTouch ? "visible" : "auto"};
      ${config.isTouch ? "touch-action: pan-y;" : ""}
      padding: ${config.isTouch ? "16px" : "14px"};
      display: flex;
      flex-direction: column;
      gap: ${config.isTouch ? "14px" : "12px"};
      transition: opacity 0.25s, filter 0.25s;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: ${config.isTouch ? "14px" : "12px"};
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(5, 26, 50, 0.78) 0%, rgba(3, 18, 35, 0.88) 100%);
      border: 1px solid rgba(0, 212, 255, 0.12);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.03),
        0 8px 20px rgba(0, 0, 0, 0.18);
    }

    .section__header {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .section__header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .section__title {
      margin: 0;
      font-size: ${config.isTouch ? "15px" : "14px"};
      line-height: 1.3;
      font-weight: 600;
      color: #eefaff;
    }

    .section__description {
      margin: 0;
      color: var(--text-muted);
      line-height: 1.45;
      font-size: ${config.isTouch ? "12px" : "11px"};
    }

    .threshold-shell {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .threshold-control {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .threshold-stepper {
      display: grid;
      grid-template-columns: ${config.isTouch ? "48px" : "44px"} minmax(0, 1fr) ${config.isTouch ? "48px" : "44px"};
      align-items: stretch;
      width: min(100%, ${config.isTouch ? "320px" : "300px"});
      margin: 0 auto;
      min-height: ${config.isTouch ? "48px" : "44px"};
      border-radius: calc(var(--control-radius) + 3px);
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(0, 212, 255, 0.09) 0%, rgba(0, 212, 255, 0.04) 100%);
      border: 1px solid rgba(0, 212, 255, 0.18);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 0 0 1px rgba(0, 212, 255, 0.04);
    }

    .stepper-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100%;
      border: none;
      border-radius: 0;
      background: rgba(0, 212, 255, 0.06);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 20px;
      line-height: 1;
      transition: transform 0.15s, background 0.2s, color 0.2s;
      ${pointerStyles}
    }

    .stepper-button[data-direction="decrement"] {
      border-right: 1px solid rgba(0, 212, 255, 0.14);
    }

    .stepper-button[data-direction="increment"] {
      border-left: 1px solid rgba(0, 212, 255, 0.14);
    }

    .stepper-button:${interactionPseudoClass} {
      background: rgba(0, 212, 255, 0.12);
      color: #effaff;
    }

    .stepper-button:active {
      transform: scale(0.98);
    }

    .stepper-display {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 6px;
      min-height: 100%;
      padding: ${config.isTouch ? "10px 12px" : "8px 10px"};
      background: transparent;
      flex: 1 1 auto;
    }

    .stepper-display:focus-within {
      box-shadow:
        inset 0 0 0 1px rgba(0, 212, 255, 0.18),
        inset 0 0 0 2px rgba(0, 212, 255, 0.12);
    }

    .threshold-input {
      width: ${config.isTouch ? "6.5ch" : "6ch"};
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: ${config.isTouch ? "28px" : "23px"};
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      text-align: center;
      outline: none;
      -moz-appearance: textfield;
      text-shadow: 0 0 14px rgba(0, 212, 255, 0.34);
    }

    .threshold-input::-webkit-outer-spin-button,
    .threshold-input::-webkit-inner-spin-button,
    .text-input::-webkit-outer-spin-button,
    .text-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .threshold-unit {
      font-family: var(--font-mono);
      font-size: ${config.isTouch ? "11px" : "10px"};
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .helper-copy {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .helper-copy p {
      margin: 0;
      color: var(--text-muted);
      line-height: 1.4;
      font-size: ${config.isTouch ? "12px" : "11px"};
    }

    .ghost-button {
      min-height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(0, 212, 255, 0.18);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-ui);
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      transition: border-color 0.2s, background 0.2s, opacity 0.2s;
      ${pointerStyles}
    }

    .ghost-button:${interactionPseudoClass} {
      border-color: rgba(0, 212, 255, 0.32);
      background: rgba(0, 212, 255, 0.08);
    }

    .ghost-button:disabled {
      opacity: 0.45;
      ${config.isTouch ? "" : "cursor: default;"}
    }

    .icon-button {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: 999px;
      border: 1px solid rgba(0, 212, 255, 0.18);
      background: rgba(0, 212, 255, 0.04);
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: 14px;
      line-height: 1;
      transition: border-color 0.2s, background 0.2s, color 0.2s;
      ${pointerStyles}
    }

    .icon-button:${interactionPseudoClass} {
      border-color: rgba(0, 212, 255, 0.32);
      background: rgba(0, 212, 255, 0.1);
      color: #effaff;
    }

    .text-input {
      width: 100%;
      box-sizing: border-box;
      min-height: var(--control-height);
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(0, 212, 255, 0.18);
      background: rgba(0, 212, 255, 0.04);
      color: var(--text);
      font-family: var(--font-ui);
      font-size: ${config.isTouch ? "13px" : "12px"};
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }

    .text-input:focus,
    .threshold-input:focus {
      box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.12);
    }

    .text-input:focus {
      border-color: rgba(0, 212, 255, 0.34);
      background: rgba(0, 212, 255, 0.08);
    }

    .preview-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preview-label {
      color: var(--text-dim);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .preview-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      position: relative;
      overflow: hidden;
      padding: 14px 16px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(4, 22, 42, 0.98) 0%, rgba(2, 14, 30, 0.98) 100%);
      border: 1px solid rgba(0, 212, 255, 0.22);
      box-shadow:
        0 0 0 1px rgba(0, 212, 255, 0.06),
        inset 0 1px 0 rgba(0, 212, 255, 0.08);
    }

    .preview-card::before,
    .preview-card::after {
      content: "";
      position: absolute;
      pointer-events: none;
    }

    .preview-card::before {
      inset: 0;
      background:
        radial-gradient(ellipse 80px 30px at 20% 50%, rgba(0, 212, 255, 0.08) 0%, transparent 70%),
        radial-gradient(ellipse 60px 40px at 75% 30%, rgba(0, 212, 255, 0.06) 0%, transparent 70%);
      animation: caustic-shift 7s ease-in-out infinite alternate;
    }

    .preview-card::after {
      top: 0;
      left: 12%;
      right: 12%;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(0, 212, 255, 0.55),
        rgba(91, 196, 245, 0.7),
        rgba(0, 212, 255, 0.55),
        transparent
      );
      animation: surface-shimmer 3s ease-in-out infinite;
    }

    .preview-card__left {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .preview-card__icon {
      width: 34px;
      height: 34px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: rgba(0, 212, 255, 0.1);
      border: 1px solid rgba(0, 212, 255, 0.22);
    }

    .preview-card__icon svg {
      width: 18px;
      height: 18px;
    }

    .preview-card__copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .preview-card__title {
      color: #c8eaf7;
      font-size: ${config.isTouch ? "14px" : "13px"};
      line-height: 1.35;
      font-weight: 500;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preview-card__sub {
      color: rgba(200, 234, 247, 0.7);
      font-family: var(--font-mono);
      font-size: ${config.isTouch ? "10px" : "9px"};
      letter-spacing: 0.35px;
    }

    .preview-card__close {
      position: relative;
      z-index: 1;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: rgba(90, 143, 174, 0.8);
      background: rgba(0, 212, 255, 0.06);
      border: 1px solid rgba(0, 212, 255, 0.14);
      font-size: 14px;
      line-height: 1;
    }

    .section-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .section-row__copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .section-row__title {
      color: #e3f7ff;
      font-size: ${config.isTouch ? "13px" : "12px"};
      line-height: 1.4;
      font-weight: 500;
    }

    .site-note {
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px dashed rgba(0, 212, 255, 0.14);
      color: var(--text-muted);
      font-size: ${config.isTouch ? "12px" : "11px"};
      line-height: 1.45;
    }

    .site-override-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 2px;
    }

    .site-override-label {
      color: var(--text-dim);
      font-size: ${config.isTouch ? "11px" : "10px"};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .overrides-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid rgba(0, 212, 255, 0.08);
      max-height: 164px;
      overflow-y: auto;
    }

    .override-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(0, 212, 255, 0.04);
      border: 1px solid rgba(0, 212, 255, 0.08);
    }

    .override-item__copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .override-item__host {
      color: #dff5ff;
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .override-item__value {
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: ${config.isTouch ? "11px" : "10px"};
    }

    .remove-button {
      min-width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: 1px solid rgba(255, 79, 79, 0.18);
      background: rgba(255, 79, 79, 0.06);
      color: var(--danger);
      font-size: 14px;
      line-height: 1;
      transition: background 0.2s, border-color 0.2s, opacity 0.2s;
      ${pointerStyles}
    }

    .remove-button:${interactionPseudoClass} {
      background: rgba(255, 79, 79, 0.12);
      border-color: rgba(255, 79, 79, 0.32);
    }

    .empty-state {
      padding: 12px;
      border-radius: 12px;
      text-align: center;
      color: var(--text-muted);
      font-size: ${config.isTouch ? "12px" : "11px"};
      font-style: italic;
      background: rgba(0, 212, 255, 0.03);
      border: 1px dashed rgba(0, 212, 255, 0.1);
    }

    .bubbles {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
      opacity: ${config.isTouch ? "0.85" : "1"};
    }

    .bubble {
      position: absolute;
      bottom: -28px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.34), rgba(0, 212, 255, 0.11));
      border: 1px solid rgba(0, 212, 255, 0.22);
      box-shadow: 0 0 12px rgba(0, 212, 255, 0.08);
      opacity: 0;
      animation: bubble-rise linear infinite;
    }

    @keyframes bubble-rise {
      0% {
        transform: translateY(0) translateX(0);
        opacity: 0;
      }
      12% {
        opacity: 0.68;
      }
      88% {
        opacity: 0.24;
      }
      100% {
        transform: translateY(-520px) translateX(var(--drift, 0px));
        opacity: 0;
      }
    }

    .footer {
      position: relative;
      z-index: 1;
      min-height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 16px;
      border-top: 1px solid rgba(0, 212, 255, 0.12);
      background: linear-gradient(0deg, rgba(2, 10, 20, 0.95) 0%, rgba(4, 22, 42, 0.8) 100%);
      backdrop-filter: blur(4px);
    }

    .status {
      opacity: 0;
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: 10px;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: opacity 0.25s;
    }

    .status.visible {
      opacity: 1;
    }
  `;

  shadow.appendChild(style);

  function el(tag, cls, attrs = {}) {
    const element = document.createElement(tag);
    if (cls) {
      element.className = cls;
    }
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  function svgEl(tag, attrs = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  function createLogoSvg(color) {
    const svg = svgEl("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
    });

    [
      { points: "3,3 8,7 13,3", opacity: "1" },
      { points: "3,7 8,11 13,7", opacity: "0.55" },
      { points: "3,11 8,15 13,11", opacity: "0.2" },
    ].forEach((polyline) => {
      svg.appendChild(svgEl("polyline", {
        points: polyline.points,
        stroke: color,
        "stroke-width": "1.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        opacity: polyline.opacity,
      }));
    });

    return svg;
  }

  function createSwitch(id, ariaLabel) {
    const wrap = el("label", "switch");
    const input = el("input", null, {
      type: "checkbox",
      id,
      "aria-label": ariaLabel,
    });
    const track = el("span", "switch__track");
    const thumb = el("span", "switch__thumb");
    track.appendChild(thumb);
    wrap.append(input, track);
    return { wrap, input };
  }

  function createThresholdControl({ inputId, inputAriaLabel, decrementAriaLabel, incrementAriaLabel }) {
    const root = el("div", "threshold-control");
    const stepper = el("div", "threshold-stepper");
    const decrementButton = el("button", "stepper-button", {
      type: "button",
      "data-direction": "decrement",
      "aria-label": decrementAriaLabel,
    });
    decrementButton.textContent = "−";

    const display = el("div", "stepper-display");
    const input = el("input", "threshold-input", {
      type: "number",
      id: inputId,
      step: String(THRESHOLD_STEP),
      inputmode: "decimal",
      "aria-label": inputAriaLabel,
    });
    const unit = el("span", "threshold-unit");
    display.append(input, unit);

    const incrementButton = el("button", "stepper-button", {
      type: "button",
      "data-direction": "increment",
      "aria-label": incrementAriaLabel,
    });
    incrementButton.textContent = "+";

    stepper.append(decrementButton, display, incrementButton);
    root.append(stepper);

    return {
      root,
      input,
      unit,
      decrementButton,
      incrementButton,
    };
  }

  const shell = el("div", "shell");
  const bubblesEl = el("div", "bubbles");

  const header = el("header", "header");
  const brand = el("div", "brand");
  const brandIcon = el("div", "brand__icon");
  brandIcon.appendChild(createLogoSvg("#00d4ff"));
  const brandName = el("h1", "brand__name");
  brandName.textContent = msg("extensionName");
  brand.append(brandIcon, brandName);
  const headerDescription = el("p", "header-description");
  headerDescription.textContent = msg("popupExplainer");

  const headerToggle = el("div", "header__toggle");
  const headerToggleLabel = el("span", "toggle-label sr-only");
  headerToggleLabel.textContent = msg("popupGlobalToggleLabel");
  const globalSwitch = createSwitch("enabled", msg("ariaToggleGlobal"));
  globalSwitch.input.checked = true;
  headerToggle.append(headerToggleLabel, globalSwitch.wrap);

  header.append(brand, headerToggle, headerDescription);

  const content = el("main", "content");

  const thresholdSection = el("section", "section");
  const thresholdHeader = el("div", "section__header");
  const thresholdHeaderRow = el("div", "section__header-row");
  const thresholdTitle = el("h2", "section__title");
  thresholdTitle.textContent = msg("popupThresholdTitle");
  const thresholdHelpButton = el("button", "icon-button", {
    type: "button",
    "aria-label": msg("ariaThresholdHelpToggle"),
    "aria-controls": "thresholdHelper",
    "aria-expanded": "false",
  });
  thresholdHelpButton.textContent = "?";
  thresholdHeaderRow.append(thresholdTitle, thresholdHelpButton);
  thresholdHeader.append(thresholdHeaderRow);

  const thresholdShell = el("div", "threshold-shell");
  const globalThresholdControl = createThresholdControl({
    inputId: "globalThresholdValue",
    inputAriaLabel: msg("ariaThresholdValue"),
    decrementAriaLabel: msg("ariaDecreaseThreshold"),
    incrementAriaLabel: msg("ariaIncreaseThreshold"),
  });
  const thresholdHelper = el("div", "helper-copy", { id: "thresholdHelper" });
  thresholdHelper.hidden = true;
  const thresholdHelperScreens = el("p");
  thresholdHelperScreens.textContent = msg("popupThresholdHelperScreens");
  const thresholdHelperCustom = el("p");
  thresholdHelperCustom.textContent = msg("popupThresholdCustomHint");
  const thresholdHelperBehavior = el("p");
  thresholdHelperBehavior.textContent = msg("popupThresholdBehaviorHint");
  thresholdHelper.append(thresholdHelperScreens, thresholdHelperCustom, thresholdHelperBehavior);
  thresholdShell.append(globalThresholdControl.root, thresholdHelper);
  thresholdSection.append(thresholdHeader, thresholdShell);

  const textSection = el("section", "section");
  const textHeader = el("div", "section__header");
  const textHeaderRow = el("div", "section__header-row");
  const textTitle = el("h2", "section__title", { id: "notificationTextLabel" });
  textTitle.textContent = msg("popupNotificationTextTitle");
  const textResetButton = el("button", "ghost-button", { type: "button" });
  textResetButton.textContent = msg("notificationTextReset");
  const textDescription = el("p", "section__description", { id: "notificationTextHint" });
  textDescription.textContent = msg("popupNotificationTextHint");
  textHeaderRow.append(textTitle, textResetButton);
  textHeader.append(textHeaderRow, textDescription);

  const textInput = el("input", "text-input", {
    type: "text",
    id: "notificationText",
    placeholder: DEFAULTS.text,
    "aria-labelledby": "notificationTextLabel",
    "aria-describedby": "notificationTextHint",
  });

  const previewBlock = el("div", "preview-block");
  const previewLabel = el("span", "preview-label");
  previewLabel.textContent = msg("popupPreviewLabel");
  const previewCard = el("div", "preview-card");
  const previewLeft = el("div", "preview-card__left");
  const previewIcon = el("div", "preview-card__icon");
  previewIcon.appendChild(createLogoSvg("#00d4ff"));
  const previewCopy = el("div", "preview-card__copy");
  const previewTitle = el("span", "preview-card__title");
  previewTitle.textContent = DEFAULTS.text;
  const previewSub = el("span", "preview-card__sub");
  previewSub.textContent = msg("notificationSub");
  previewCopy.append(previewTitle, previewSub);
  previewLeft.append(previewIcon, previewCopy);
  const previewClose = el("span", "preview-card__close", { "aria-hidden": "true" });
  previewClose.textContent = "✕";
  previewCard.append(previewLeft, previewClose);
  previewBlock.append(previewLabel, previewCard);

  const siteSection = el("section", "section");
  const siteHeader = el("div", "section__header");
  const siteTitle = el("h2", "section__title");
  siteTitle.textContent = msg("popupSiteTitleFallback");
  const siteDescription = el("p", "section__description");
  siteDescription.textContent = msg("popupSiteDescription");
  siteHeader.append(siteTitle, siteDescription);

  const siteUnavailableNote = el("div", "site-note");
  siteUnavailableNote.textContent = msg("popupCurrentSiteUnavailable");
  siteUnavailableNote.hidden = true;

  const siteEnabledRow = el("div", "section-row");
  const siteEnabledCopy = el("div", "section-row__copy");
  const siteEnabledTitle = el("span", "section-row__title");
  siteEnabledTitle.textContent = msg("enabledOnSite");
  siteEnabledCopy.appendChild(siteEnabledTitle);
  const siteSwitch = createSwitch("siteEnabled", msg("enabledOnSite"));
  siteSwitch.input.checked = true;
  siteEnabledRow.append(siteEnabledCopy, siteSwitch.wrap);

  const siteOverrideRow = el("div", "section-row");
  const siteOverrideCopy = el("div", "section-row__copy");
  const siteOverrideTitle = el("span", "section-row__title");
  siteOverrideTitle.textContent = msg("popupSiteOverrideToggleLabel");
  siteOverrideCopy.appendChild(siteOverrideTitle);
  const overrideSwitch = createSwitch("siteOverrideEnabled", msg("siteOverrideEnabled"));
  siteOverrideRow.append(siteOverrideCopy, overrideSwitch.wrap);

  const siteOverridePanel = el("div", "site-override-panel");
  siteOverridePanel.hidden = true;
  const siteOverrideLabel = el("span", "site-override-label");
  siteOverrideLabel.textContent = msg("popupSiteOverrideInputLabel");
  const siteThresholdControl = createThresholdControl({
    inputId: "siteThresholdValue",
    inputAriaLabel: msg("ariaSiteThresholdValue"),
    decrementAriaLabel: msg("ariaDecreaseSiteThreshold"),
    incrementAriaLabel: msg("ariaIncreaseSiteThreshold"),
  });
  siteOverridePanel.append(siteOverrideLabel, siteThresholdControl.root);

  const manageButton = el("button", "ghost-button", {
    type: "button",
    "aria-controls": "siteOverridesList",
    "aria-expanded": "false",
  });
  manageButton.textContent = msg("manageSites");
  const overridesList = el("div", "overrides-list", { id: "siteOverridesList" });
  overridesList.hidden = true;

  siteSection.append(
    siteHeader,
    siteUnavailableNote,
    siteEnabledRow,
    siteOverrideRow,
    siteOverridePanel,
    manageButton,
    overridesList,
  );

  textSection.append(textHeader, textInput, previewBlock);

  content.append(thresholdSection, siteSection, textSection);

  const footer = el("footer", "footer");
  const statusEl = el("span", "status");
  statusEl.setAttribute("aria-live", "polite");
  footer.appendChild(statusEl);

  shell.append(bubblesEl, header, content, footer);
  shadow.appendChild(shell);

  let activeTabId = null;
  let activeHostname = "";
  let currentThreshold = DEFAULTS.threshold;
  let currentSiteThreshold = DEFAULTS.threshold;
  let isOverridesListOpen = false;
  let statusTimer = null;

  function setGlobalThresholdValue(value, { syncInput = true } = {}) {
    currentThreshold = value;
    if (syncInput) {
      globalThresholdControl.input.value = String(value);
    }
    globalThresholdControl.unit.textContent = getUnitScreensMsg(value);

    if (!overrideSwitch.input.checked) {
      setSiteThresholdValue(value);
    }
  }

  function setSiteThresholdValue(value, { syncInput = true } = {}) {
    currentSiteThreshold = value;
    if (syncInput) {
      siteThresholdControl.input.value = String(value);
    }
    siteThresholdControl.unit.textContent = getUnitScreensMsg(value);
  }

  function syncPreviewText() {
    previewTitle.textContent = textInput.value.trim() || DEFAULTS.text;
  }

  function syncThresholdHelpVisibility() {
    const isExpanded = !thresholdHelper.hidden;
    thresholdHelpButton.setAttribute("aria-expanded", String(isExpanded));
  }

  function spawnBubbles() {
    bubblesEl.textContent = "";
    const bubbleCount = config.isTouch ? 10 : 10;

    for (let index = 0; index < bubbleCount; index += 1) {
      const bubble = el("div", "bubble");
      const size = (config.isTouch ? 3 : 3) + Math.random() * (config.isTouch ? 7 : 6);
      const left = 6 + Math.random() * 88;
      const duration = (config.isTouch ? 7 : 8) + Math.random() * 8;
      const delay = Math.random() * 10;
      const drift = (Math.random() - 0.5) * 24;

      bubble.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        animation-duration: ${duration}s;
        animation-delay: -${delay}s;
        --drift: ${drift}px;
      `;

      bubblesEl.appendChild(bubble);
    }
  }

  function syncTextResetState() {
    textResetButton.disabled = textInput.value === DEFAULTS.text;
  }

  function showStatus(message) {
    statusEl.textContent = message;
    statusEl.classList.add("visible");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusEl.classList.remove("visible"), 2200);
  }

  function syncGlobalState() {
    const off = !globalSwitch.input.checked;
    content.style.opacity = off ? "0.38" : "1";
    content.style.pointerEvents = off ? "none" : "auto";
    content.style.filter = off ? "grayscale(0.45)" : "none";
  }

  function syncSiteAvailability() {
    const hasHost = Boolean(activeHostname);
    siteUnavailableNote.hidden = hasHost;
    siteDescription.hidden = !hasHost;
    siteEnabledRow.hidden = !hasHost;
    siteOverrideRow.hidden = !hasHost;
    manageButton.hidden = !hasHost;
    siteSwitch.input.disabled = !hasHost;
    overrideSwitch.input.disabled = !hasHost;
    isOverridesListOpen = false;
    syncOverrideVisibility();
    syncOverridesListVisibility();

    if (!hasHost) {
      siteTitle.textContent = msg("popupSiteTitleFallback");
      siteEnabledTitle.textContent = msg("enabledOnSite");
      siteSwitch.input.setAttribute("aria-label", msg("enabledOnSite"));
    } else {
      siteTitle.textContent = msg("popupSiteTitle", activeHostname);
      siteDescription.textContent = msg("popupSiteDescription");
      siteEnabledTitle.textContent = msg("enabledOnHost", activeHostname);
      siteSwitch.input.setAttribute("aria-label", msg("enabledOnHost", activeHostname));
    }
  }

  async function resolveActiveTabContext() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    activeTabId = Number.isInteger(activeTab?.id) ? activeTab.id : null;
    activeHostname = "";

    if (!activeTab?.url) {
      return;
    }

    try {
      activeHostname = new URL(activeTab.url).hostname;
    } catch (error) {
      activeHostname = "";
    }
  }

  async function notifyContentScript() {
    try {
      if (activeTabId === null) {
        return;
      }

      const result = await browser.storage.local.get([
        KEYS.threshold,
        KEYS.enabled,
        KEYS.disabledDomains,
        KEYS.text,
        KEYS.siteOverrides,
      ]);

      browser.tabs.sendMessage(activeTabId, {
        type: "SET_THRESHOLD",
        value: sanitizeThreshold(result[KEYS.threshold]),
        enabled: result[KEYS.enabled] ?? DEFAULTS.enabled,
        disabledDomains: result[KEYS.disabledDomains] ?? DEFAULTS.disabledDomains,
        text: result[KEYS.text] ?? DEFAULTS.text,
        siteOverrides: result[KEYS.siteOverrides] ?? {},
      }).catch(() => { });
    } catch (error) {
      // Popup may close before this completes.
    }
  }

  function debounce(fn, delay) {
    let timer;
    const debounced = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
    debounced.cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    return debounced;
  }

  async function saveThreshold(forcedValue) {
    const value = forcedValue ?? sanitizeThreshold(globalThresholdControl.input.value);
    setGlobalThresholdValue(value);

    try {
      await browser.storage.local.set({ [KEYS.threshold]: value });
      notifyContentScript();
      showStatus(msg("statusAutoSaved"));
    } catch (error) {
      showStatus(msg("statusError"));
    }
  }

  async function saveText() {
    const text = textInput.value.trim() || DEFAULTS.text;
    textInput.value = text;
    syncPreviewText();
    syncTextResetState();

    try {
      await browser.storage.local.set({ [KEYS.text]: text });
      notifyContentScript();
      showStatus(msg("statusAutoSaved"));
    } catch (error) {
      showStatus(msg("statusError"));
    }
  }

  async function saveSiteOverride(forcedValue) {
    if (!activeHostname) {
      return;
    }

    try {
      const result = await browser.storage.local.get(KEYS.siteOverrides);
      const overrides = result[KEYS.siteOverrides] ?? {};

      if (overrideSwitch.input.checked) {
        const value = forcedValue ?? sanitizeThreshold(siteThresholdControl.input.value);
        setSiteThresholdValue(value);
        overrides[activeHostname] = value;
      } else {
        delete overrides[activeHostname];
      }

      await browser.storage.local.set({ [KEYS.siteOverrides]: overrides });
      notifyContentScript();
      renderOverridesList(overrides);
    } catch (error) {
      showStatus(msg("statusError"));
    }
  }

  const debouncedSaveThreshold = debounce(saveThreshold, 600);
  const debouncedSaveText = debounce(saveText, 800);
  const debouncedSaveSiteOverride = debounce(saveSiteOverride, 600);

  function adjustThresholdValue(currentValue, delta) {
    const next = normalizeThreshold(currentValue + delta);
    return next > 0 ? next : currentValue;
  }

  function syncOverrideVisibility() {
    siteOverridePanel.hidden = !activeHostname || !overrideSwitch.input.checked;
  }

  function syncOverridesListVisibility() {
    overridesList.hidden = !activeHostname || !isOverridesListOpen;
    manageButton.setAttribute("aria-expanded", String(!overridesList.hidden));
  }

  function renderOverridesList(overrides) {
    overridesList.textContent = "";
    const entries = Object.entries(overrides).filter(([, value]) => parsePositiveThreshold(value) !== null);

    if (entries.length === 0) {
      const empty = el("div", "empty-state");
      empty.textContent = msg("noOverrides");
      overridesList.appendChild(empty);
      return;
    }

    entries.forEach(([host, rawValue]) => {
      const value = parsePositiveThreshold(rawValue);
      const item = el("div", "override-item");
      const copy = el("div", "override-item__copy");
      const hostLine = el("span", "override-item__host");
      hostLine.textContent = host;
      const valueLine = el("span", "override-item__value");
      valueLine.textContent = `${formatThresholdNumber(value)} ${getUnitScreensMsg(value)}`;
      copy.append(hostLine, valueLine);

      const removeButton = el("button", "remove-button", {
        type: "button",
        "aria-label": msg("ariaRemoveSiteOverride", host),
      });
      removeButton.textContent = "✕";
      removeButton.addEventListener("click", async () => {
        const result = await browser.storage.local.get(KEYS.siteOverrides);
        const current = result[KEYS.siteOverrides] ?? {};
        delete current[host];
        await browser.storage.local.set({ [KEYS.siteOverrides]: current });

        if (host === activeHostname) {
          overrideSwitch.input.checked = false;
          syncOverrideVisibility();
          setSiteThresholdValue(currentThreshold);
        }

        notifyContentScript();
        renderOverridesList(current);
        showStatus(msg("statusOverrideRemoved", host));
      });

      item.append(copy, removeButton);
      overridesList.appendChild(item);
    });
  }

  globalSwitch.input.addEventListener("change", async () => {
    syncGlobalState();
    await browser.storage.local.set({ [KEYS.enabled]: globalSwitch.input.checked });
    notifyContentScript();
    showStatus(globalSwitch.input.checked ? msg("statusEnabled") : msg("statusDisabled"));
  });

  globalThresholdControl.decrementButton.addEventListener("click", () => {
    debouncedSaveThreshold.cancel();
    const nextValue = adjustThresholdValue(parsePositiveThreshold(globalThresholdControl.input.value) ?? currentThreshold, -THRESHOLD_STEP);
    setGlobalThresholdValue(nextValue);
    saveThreshold(nextValue);
  });

  globalThresholdControl.incrementButton.addEventListener("click", () => {
    debouncedSaveThreshold.cancel();
    const nextValue = adjustThresholdValue(parsePositiveThreshold(globalThresholdControl.input.value) ?? currentThreshold, THRESHOLD_STEP);
    setGlobalThresholdValue(nextValue);
    saveThreshold(nextValue);
  });

  globalThresholdControl.input.addEventListener("input", () => {
    const value = parseLiveThreshold(globalThresholdControl.input.value);
    if (value !== null) {
      setGlobalThresholdValue(value, { syncInput: false });
      debouncedSaveThreshold();
      return;
    }

    debouncedSaveThreshold.cancel();
  });

  globalThresholdControl.input.addEventListener("blur", () => {
    debouncedSaveThreshold.cancel();
    saveThreshold();
  });

  thresholdHelpButton.addEventListener("click", () => {
    thresholdHelper.hidden = !thresholdHelper.hidden;
    syncThresholdHelpVisibility();
  });

  textInput.addEventListener("input", () => {
    syncPreviewText();
    syncTextResetState();
    debouncedSaveText();
  });

  textInput.addEventListener("blur", () => saveText());

  textResetButton.addEventListener("click", async () => {
    textInput.value = DEFAULTS.text;
    syncPreviewText();
    syncTextResetState();
    await saveText();
  });

  siteSwitch.input.addEventListener("change", async () => {
    if (!activeHostname) {
      return;
    }

    const result = await browser.storage.local.get(KEYS.disabledDomains);
    let domains = result[KEYS.disabledDomains] ?? DEFAULTS.disabledDomains;

    if (siteSwitch.input.checked) {
      domains = domains.filter((domain) => domain !== activeHostname);
    } else if (!domains.includes(activeHostname)) {
      domains.push(activeHostname);
    }

    await browser.storage.local.set({ [KEYS.disabledDomains]: domains });
    notifyContentScript();
    showStatus(siteSwitch.input.checked ? msg("statusEnabledOnHost", activeHostname) : msg("statusDisabledOnHost", activeHostname));
  });

  overrideSwitch.input.addEventListener("change", async () => {
    if (!activeHostname) {
      return;
    }

    if (overrideSwitch.input.checked) {
      setSiteThresholdValue(currentThreshold);
      showStatus(msg("statusOverrideEnabled", activeHostname));
    } else {
      setSiteThresholdValue(currentThreshold);
      showStatus(msg("statusOverrideDisabled", activeHostname));
    }

    syncOverrideVisibility();
    await saveSiteOverride(overrideSwitch.input.checked ? currentThreshold : undefined);
  });

  siteThresholdControl.decrementButton.addEventListener("click", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }
    debouncedSaveSiteOverride.cancel();
    const nextValue = adjustThresholdValue(parsePositiveThreshold(siteThresholdControl.input.value) ?? currentSiteThreshold, -THRESHOLD_STEP);
    setSiteThresholdValue(nextValue);
    saveSiteOverride(nextValue);
  });

  siteThresholdControl.incrementButton.addEventListener("click", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }
    debouncedSaveSiteOverride.cancel();
    const nextValue = adjustThresholdValue(parsePositiveThreshold(siteThresholdControl.input.value) ?? currentSiteThreshold, THRESHOLD_STEP);
    setSiteThresholdValue(nextValue);
    saveSiteOverride(nextValue);
  });

  siteThresholdControl.input.addEventListener("input", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }

    const value = parseLiveThreshold(siteThresholdControl.input.value);
    if (value !== null) {
      setSiteThresholdValue(value, { syncInput: false });
      debouncedSaveSiteOverride();
      return;
    }

    debouncedSaveSiteOverride.cancel();
  });

  siteThresholdControl.input.addEventListener("blur", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }
    debouncedSaveSiteOverride.cancel();
    saveSiteOverride();
  });

  manageButton.addEventListener("click", () => {
    if (!activeHostname) {
      return;
    }

    isOverridesListOpen = !isOverridesListOpen;
    syncOverridesListVisibility();
  });

  async function init() {
    try {
      await resolveActiveTabContext();
    } catch (error) {
      activeHostname = "";
    }

    const result = await browser.storage.local.get(Object.values(KEYS));
    const threshold = sanitizeThreshold(result[KEYS.threshold]);
    const enabled = result[KEYS.enabled] ?? DEFAULTS.enabled;
    const disabledDomains = result[KEYS.disabledDomains] ?? DEFAULTS.disabledDomains;
    const text = result[KEYS.text] ?? DEFAULTS.text;
    const siteOverrides = result[KEYS.siteOverrides] ?? {};

    setGlobalThresholdValue(threshold);
    textInput.value = text;
    syncPreviewText();
    syncTextResetState();
    globalSwitch.input.checked = enabled;
    syncGlobalState();

    syncSiteAvailability();

    if (activeHostname) {
      siteSwitch.input.checked = !disabledDomains.includes(activeHostname);
      const siteThreshold = parsePositiveThreshold(siteOverrides[activeHostname]);

      if (siteThreshold !== null) {
        overrideSwitch.input.checked = true;
        setSiteThresholdValue(siteThreshold);
      } else {
        overrideSwitch.input.checked = false;
        setSiteThresholdValue(threshold);
      }
    } else {
      siteSwitch.input.checked = false;
      overrideSwitch.input.checked = false;
      setSiteThresholdValue(threshold);
    }

    syncOverrideVisibility();
    renderOverridesList(siteOverrides);
    syncOverridesListVisibility();
  }

  syncTextResetState();
  syncPreviewText();
  syncThresholdHelpVisibility();
  setGlobalThresholdValue(DEFAULTS.threshold);
  setSiteThresholdValue(DEFAULTS.threshold);
  syncOverrideVisibility();
  spawnBubbles();

  init().catch((error) => {
    console.error("Failed to initialize popup", error);
  });
}
