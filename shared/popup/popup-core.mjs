import "../settings.js";
import "../session-pause.js";
import "../permission-health.js";

const DEFAULT_PLATFORM_CONFIG = {
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

  const {
    KEYS,
    MESSAGE_TYPES,
    SETTINGS_IMPORT_MAX_BYTES,
    applySiteSettingsIntent,
    createDefaults,
    createSettingsExport,
    getManagedSiteEntries,
    normalizeHostname,
    normalizeSettings,
    parseSettingsImport,
    parseThresholdInput,
  } = globalThis.SurfacedSettings;
  const { MESSAGE_TYPES: SESSION_MESSAGE_TYPES } = globalThis.SurfacedSessionPause;
  const {
    ACCESS_STATES,
    REQUEST_OUTCOMES,
    checkHostAccess,
    getCurrentPageContext,
    requestHostAccess,
  } = globalThis.SurfacedPermissionHealth;

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

  const schemaDefaults = createDefaults(msg("defaultNotificationText"));
  const DEFAULTS = {
    threshold: schemaDefaults[KEYS.threshold],
    enabled: schemaDefaults[KEYS.enabled],
    disabledDomains: schemaDefaults[KEYS.disabledDomains],
    text: schemaDefaults[KEYS.text],
    siteOverrides: schemaDefaults[KEYS.siteOverrides],
  };

  function normalizeThresholdInput(value) {
    return String(value ?? "").trim().replace(",", ".");
  }

  function parsePositiveThreshold(value) {
    return parseThresholdInput(normalizeThresholdInput(value));
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
      position: relative;
      ${toggleBaseStyles}
    }

    .switch input {
      position: absolute;
      inset: 0;
      z-index: 2;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      ${pointerStyles}
    }

    .switch__track {
      width: 38px;
      height: 22px;
      position: relative;
      border-radius: 999px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
      pointer-events: none;
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

    .switch input:focus-visible + .switch__track {
      outline: 3px solid #8ceeff;
      outline-offset: 3px;
      box-shadow: 0 0 0 5px rgba(0, 212, 255, 0.2);
    }

    button:focus-visible,
    input:focus-visible {
      outline: 3px solid #8ceeff;
      outline-offset: 2px;
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

    .persistent-settings {
      display: flex;
      flex-direction: column;
      gap: ${config.isTouch ? "14px" : "12px"};
      transition: opacity 0.25s, filter 0.25s;
    }

    .session-section {
      gap: 10px;
    }

    .permission-section {
      gap: 10px;
    }

    .permission-status:focus-visible {
      outline: 3px solid #8ceeff;
      outline-offset: 3px;
    }

    .permission-section[data-state="missing"],
    .permission-section[data-state="partial"],
    .permission-section[data-state="unavailable"],
    .permission-section[data-state="denied"],
    .permission-section[data-state="exception"],
    .permission-section[data-state="unverified"] {
      border-color: rgba(240, 165, 0, 0.34);
      background: rgba(67, 43, 5, 0.3);
    }

    .permission-section[data-state="restored"] {
      border-color: rgba(0, 212, 255, 0.3);
      background: rgba(0, 82, 110, 0.18);
    }

    .permission-action {
      align-self: flex-start;
      min-height: var(--control-height);
      max-width: 100%;
      padding: ${config.isTouch ? "10px 18px" : "8px 14px"};
      border-radius: var(--control-radius);
      border: 1px solid rgba(240, 165, 0, 0.44);
      background: rgba(240, 165, 0, 0.1);
      color: #ffd884;
      font: 600 ${config.isTouch ? "13px" : "11px"}/1.3 var(--font-ui);
      white-space: normal;
      text-align: center;
      ${pointerStyles}
    }

    .permission-action:${interactionPseudoClass}:not(:disabled) {
      border-color: rgba(240, 165, 0, 0.66);
      background: rgba(240, 165, 0, 0.18);
    }

    .permission-action:disabled {
      opacity: 0.55;
      ${config.isTouch ? "" : "cursor: default;"}
    }

    .permission-fallback,
    .permission-reload {
      margin: 0;
      color: var(--text-muted);
      font-size: ${config.isTouch ? "12px" : "10px"};
      line-height: 1.45;
    }

    .session-section[data-state="paused"] {
      border-color: rgba(0, 212, 255, 0.3);
      background:
        linear-gradient(180deg, rgba(0, 82, 110, 0.22) 0%, rgba(3, 18, 35, 0.92) 100%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 0 20px rgba(0, 212, 255, 0.07);
    }

    .session-section[data-state="error"] {
      border-color: rgba(255, 79, 79, 0.28);
      background: rgba(60, 18, 28, 0.3);
    }

    .session-action {
      align-self: flex-start;
      max-width: 100%;
      min-height: var(--control-height);
      padding: ${config.isTouch ? "10px 18px" : "8px 14px"};
      border-radius: var(--control-radius);
      border: 1px solid rgba(0, 212, 255, 0.28);
      background: rgba(0, 212, 255, 0.08);
      color: var(--accent);
      font: 600 ${config.isTouch ? "13px" : "11px"}/1.3 var(--font-ui);
      white-space: normal;
      text-align: center;
      transition: background 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s;
      ${pointerStyles}
    }

    .session-section[data-state="paused"] .session-action {
      background: var(--accent);
      border-color: var(--accent);
      color: #02111f;
    }

    .session-section[data-state="error"] .session-action {
      color: #ffd7d7;
      border-color: rgba(255, 79, 79, 0.34);
      background: rgba(255, 79, 79, 0.08);
    }

    .session-action:${interactionPseudoClass}:not(:disabled) {
      border-color: rgba(0, 212, 255, 0.5);
      background: rgba(0, 212, 255, 0.16);
    }

    .session-section[data-state="paused"] .session-action:${interactionPseudoClass}:not(:disabled) {
      background: #5ee7ff;
      border-color: #5ee7ff;
    }

    .session-action:disabled {
      opacity: 0.55;
      ${config.isTouch ? "" : "cursor: default;"}
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

    .site-manager {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 212, 255, 0.08);
    }

    .site-manager__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .site-manager__title {
      margin: 0;
      color: #eefaff;
      font-size: ${config.isTouch ? "14px" : "13px"};
      line-height: 1.35;
    }

    .site-manager__list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: ${config.isTouch ? "420px" : "290px"};
      overflow-y: auto;
      scrollbar-gutter: stable;
    }

    .site-manager__item {
      display: flex;
      flex-direction: column;
      gap: 9px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(0, 212, 255, 0.04);
      border: 1px solid rgba(0, 212, 255, 0.08);
    }

    .site-manager__summary {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .site-manager__host {
      color: #dff5ff;
      font-weight: 650;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .site-manager__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      color: var(--text-muted);
      font-size: ${config.isTouch ? "12px" : "10px"};
      line-height: 1.4;
    }

    .site-manager__state[data-enabled="false"] {
      color: #ffd0d0;
    }

    .site-manager__threshold {
      color: var(--accent);
      font-family: var(--font-mono);
    }

    .site-manager__actions,
    .site-manager__confirmation,
    .site-manager__editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .site-manager__action {
      min-height: ${config.isTouch ? "44px" : "32px"};
      padding: 7px 10px;
      border-radius: 9px;
      border: 1px solid rgba(0, 212, 255, 0.2);
      background: rgba(0, 212, 255, 0.06);
      color: var(--text);
      font: 600 ${config.isTouch ? "12px" : "10px"}/1.25 var(--font-ui);
      white-space: normal;
      ${pointerStyles}
    }

    .site-manager__action:${interactionPseudoClass} {
      border-color: rgba(0, 212, 255, 0.38);
      background: rgba(0, 212, 255, 0.12);
    }

    .site-manager__action--danger {
      border-color: rgba(255, 79, 79, 0.25);
      background: rgba(255, 79, 79, 0.06);
      color: #ffb8b8;
    }

    .site-manager__editor,
    .site-manager__confirmation {
      padding: 9px;
      border-radius: 10px;
      background: rgba(2, 13, 26, 0.58);
      border: 1px solid rgba(0, 212, 255, 0.12);
    }

    .site-manager__editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .site-manager__editor-label,
    .site-manager__confirmation-text {
      color: var(--text-muted);
      font-size: ${config.isTouch ? "12px" : "10px"};
      line-height: 1.4;
    }

    .site-manager__editor-input {
      width: 100%;
      min-height: var(--control-height);
      padding: 8px 10px;
      border-radius: 9px;
      border: 1px solid rgba(0, 212, 255, 0.22);
      background: rgba(0, 212, 255, 0.04);
      color: var(--accent);
      font: 700 ${config.isTouch ? "16px" : "14px"}/1 var(--font-mono);
    }

    .site-manager__editor-input[aria-invalid="true"] {
      border-color: var(--danger);
    }

    .site-manager__confirmation {
      flex-direction: column;
    }

    .site-manager__empty {
      padding: 14px 12px;
      border-radius: 12px;
      text-align: center;
      color: var(--text-muted);
      font-size: ${config.isTouch ? "12px" : "11px"};
      font-style: italic;
      background: rgba(0, 212, 255, 0.03);
      border: 1px dashed rgba(0, 212, 255, 0.1);
    }

    .site-manager__empty:focus {
      font-style: normal;
      outline: 3px solid #8ceeff;
      outline-offset: -3px;
    }

    .site-manager__host,
    .site-manager__threshold {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .backup-section {
      gap: 10px;
    }

    .backup-actions,
    .import-preview__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .backup-action {
      min-height: var(--control-height);
      padding: ${config.isTouch ? "10px 16px" : "8px 13px"};
      border-radius: var(--control-radius);
      border: 1px solid rgba(0, 212, 255, 0.24);
      background: rgba(0, 212, 255, 0.07);
      color: var(--text);
      font: 600 ${config.isTouch ? "13px" : "11px"}/1.3 var(--font-ui);
      text-align: center;
      white-space: normal;
      ${pointerStyles}
    }

    .backup-action:${interactionPseudoClass}:not(:disabled) {
      border-color: rgba(0, 212, 255, 0.46);
      background: rgba(0, 212, 255, 0.14);
    }

    .backup-action--primary {
      border-color: rgba(0, 212, 255, 0.5);
      background: var(--accent);
      color: #02111f;
    }

    .backup-action--primary:${interactionPseudoClass}:not(:disabled) {
      background: #5ee7ff;
      border-color: #5ee7ff;
    }

    .backup-action:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .settings-file-input {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }

    .import-error {
      margin: 0;
      padding: 9px 10px;
      border-radius: 9px;
      border: 1px solid rgba(255, 79, 79, 0.3);
      background: rgba(255, 79, 79, 0.08);
      color: #ffd7d7;
      font-size: ${config.isTouch ? "12px" : "10px"};
      line-height: 1.45;
    }

    .import-preview {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 11px;
      border-radius: 12px;
      border: 1px solid rgba(0, 212, 255, 0.18);
      background: rgba(2, 13, 26, 0.58);
    }

    .import-preview__title {
      margin: 0;
      color: #eefaff;
      font-size: ${config.isTouch ? "14px" : "12px"};
      line-height: 1.35;
    }

    .import-preview__summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px 12px;
      margin: 0;
      color: var(--text-muted);
      font-size: ${config.isTouch ? "12px" : "10px"};
      line-height: 1.4;
    }

    .import-preview__summary dt,
    .import-preview__summary dd {
      margin: 0;
    }

    .import-preview__summary dd {
      max-width: ${config.isTouch ? "220px" : "180px"};
      color: var(--text);
      text-align: right;
      overflow-wrap: anywhere;
    }

    .storage-state {
      position: relative;
      z-index: 1;
      flex: 1 1 auto;
      min-height: ${config.isTouch ? "180px" : "220px"};
      padding: ${config.isTouch ? "24px 18px" : "22px 16px"};
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .storage-state__panel {
      width: min(100%, 340px);
      padding: ${config.isTouch ? "18px" : "16px"};
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
      border-radius: 14px;
      color: var(--text-muted);
      background: rgba(4, 24, 46, 0.84);
      border: 1px solid rgba(0, 212, 255, 0.16);
    }

    .storage-state[data-phase="error"] .storage-state__panel {
      color: #ffd7d7;
      border-color: rgba(255, 79, 79, 0.34);
      background: rgba(60, 18, 28, 0.34);
    }

    .storage-state__message {
      margin: 0;
      font-size: ${config.isTouch ? "14px" : "12px"};
      line-height: 1.5;
    }

    .storage-state__retry {
      min-height: var(--control-height);
      padding: 0 18px;
      border-radius: var(--control-radius);
      border: 1px solid rgba(0, 212, 255, 0.34);
      background: rgba(0, 212, 255, 0.12);
      color: var(--accent);
      font: 600 ${config.isTouch ? "13px" : "11px"}/1 var(--font-ui);
      ${pointerStyles}
    }

    .storage-state__retry:${interactionPseudoClass} {
      background: rgba(0, 212, 255, 0.2);
      border-color: rgba(0, 212, 255, 0.5);
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

    @media (prefers-reduced-motion: reduce) {
      .shell,
      .shell::before,
      .shell::after,
      .preview-card::before,
      .preview-card::after {
        animation: none !important;
        transform: none !important;
      }

      .shell {
        opacity: 1;
      }

      .bubbles {
        display: none;
      }

      .bubble {
        display: none;
        animation: none !important;
      }

      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
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
      role: "switch",
      "aria-label": ariaLabel,
    });
    const track = el("span", "switch__track");
    const thumb = el("span", "switch__thumb");
    track.appendChild(thumb);
    wrap.append(input, track);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.click();
      }
    });
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

  const storageStateEl = el("section", "storage-state", {
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true",
    "data-phase": "loading",
  });
  const storageStatePanel = el("div", "storage-state__panel");
  const storageStateMessage = el("p", "storage-state__message");
  storageStateMessage.textContent = msg("storageLoading");
  const storageRetryButton = el("button", "storage-state__retry", { type: "button" });
  storageRetryButton.textContent = msg("storageRetry");
  storageRetryButton.hidden = true;
  storageStatePanel.append(storageStateMessage, storageRetryButton);
  storageStateEl.appendChild(storageStatePanel);

  const content = el("main", "content");
  content.hidden = true;
  headerToggle.hidden = true;

  const permissionSection = el("section", "section permission-section", {
    "data-state": "loading",
    "aria-busy": "true",
  });
  const permissionHeader = el("div", "section__header");
  const permissionTitle = el("h2", "section__title");
  permissionTitle.textContent = msg("permissionHealthTitle");
  const permissionDescription = el("p", "section__description permission-status", {
    role: "status",
    tabindex: "-1",
    "aria-live": "polite",
    "aria-atomic": "true",
  });
  permissionDescription.textContent = msg("permissionHealthLoading");
  permissionHeader.append(permissionTitle, permissionDescription);
  const permissionActionButton = el("button", "permission-action", {
    type: "button",
    "aria-label": msg("ariaRestorePageAccess"),
  });
  permissionActionButton.textContent = msg("permissionRestoreAction");
  permissionActionButton.hidden = true;
  const permissionReload = el("p", "permission-reload");
  permissionReload.textContent = msg("permissionReloadHint");
  permissionReload.hidden = true;
  const permissionFallback = el("p", "permission-fallback");
  permissionFallback.textContent = msg("permissionPanelFallback");
  permissionFallback.hidden = true;
  permissionSection.append(
    permissionHeader,
    permissionActionButton,
    permissionReload,
    permissionFallback
  );

  const sessionSection = el("section", "section session-section", {
    "data-state": "loading",
    "aria-live": "polite",
    "aria-busy": "true",
  });
  const sessionHeader = el("div", "section__header");
  const sessionTitle = el("h2", "section__title");
  const sessionDescription = el("p", "section__description");
  sessionTitle.textContent = msg("sessionStateLoadingTitle");
  sessionDescription.textContent = msg("sessionStateLoadingDescription");
  sessionHeader.append(sessionTitle, sessionDescription);
  const sessionActionButton = el("button", "session-action", {
    type: "button",
    "aria-label": msg("ariaSessionPause"),
  });
  sessionActionButton.textContent = msg("sessionStateLoadingAction");
  sessionActionButton.disabled = true;
  sessionSection.append(sessionHeader, sessionActionButton);

  const persistentSettings = el("div", "persistent-settings");

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
    "aria-controls": "siteSettingsManager",
    "aria-expanded": "false",
  });
  manageButton.textContent = msg("manageSites");
  const siteManager = el("div", "site-manager", {
    id: "siteSettingsManager",
    role: "region",
    "aria-labelledby": "siteSettingsManagerTitle",
  });
  siteManager.hidden = true;
  const siteManagerHeader = el("div", "site-manager__header");
  const siteManagerTitle = el("h3", "site-manager__title", { id: "siteSettingsManagerTitle" });
  siteManagerTitle.textContent = msg("siteManagerTitle");
  const siteManagerCloseButton = el("button", "icon-button", {
    type: "button",
    "aria-label": msg("siteManagerClose"),
  });
  siteManagerCloseButton.textContent = "✕";
  siteManagerHeader.append(siteManagerTitle, siteManagerCloseButton);
  const siteManagerList = el("div", "site-manager__list");
  siteManager.append(siteManagerHeader, siteManagerList);

  siteSection.append(
    siteHeader,
    siteUnavailableNote,
    siteEnabledRow,
    siteOverrideRow,
    siteOverridePanel,
    manageButton,
    siteManager,
  );

  textSection.append(textHeader, textInput, previewBlock);

  const backupSection = el("section", "section backup-section");
  const backupHeader = el("div", "section__header");
  const backupTitle = el("h2", "section__title");
  backupTitle.textContent = msg("settingsBackupTitle");
  const backupDescription = el("p", "section__description");
  backupDescription.textContent = msg("settingsBackupDescription");
  backupHeader.append(backupTitle, backupDescription);
  const backupActions = el("div", "backup-actions");
  const exportButton = el("button", "backup-action", {
    type: "button",
    id: "settingsExport",
    "aria-label": msg("ariaExportSettings"),
  });
  exportButton.textContent = msg("settingsExportAction");
  const importButton = el("button", "backup-action", {
    type: "button",
    id: "settingsImport",
    "aria-label": msg("ariaImportSettings"),
  });
  importButton.textContent = msg("settingsImportAction");
  const importFileInput = el("input", "settings-file-input", {
    type: "file",
    id: "settingsImportFile",
    accept: ".json,application/json",
    tabindex: "-1",
    "aria-label": msg("ariaImportSettingsFile"),
  });
  backupActions.append(exportButton, importButton, importFileInput);

  const importError = el("p", "import-error", {
    role: "alert",
    "aria-live": "assertive",
  });
  importError.hidden = true;

  const importPreview = el("div", "import-preview", {
    role: "region",
    "aria-labelledby": "settingsImportPreviewTitle",
  });
  importPreview.hidden = true;
  const importPreviewTitle = el("h3", "import-preview__title", {
    id: "settingsImportPreviewTitle",
  });
  importPreviewTitle.textContent = msg("settingsImportPreviewTitle");
  const importSummary = el("dl", "import-preview__summary");
  const importSummaryValues = {};
  [
    ["threshold", "settingsImportPreviewThreshold"],
    ["text", "settingsImportPreviewText"],
    ["enabled", "settingsImportPreviewEnabled"],
    ["disabledDomains", "settingsImportPreviewDisabledDomains"],
    ["siteOverrides", "settingsImportPreviewOverrides"],
  ].forEach(([name, messageKey]) => {
    const term = el("dt");
    term.textContent = msg(messageKey);
    const description = el("dd");
    importSummaryValues[name] = description;
    importSummary.append(term, description);
  });
  const importPreviewActions = el("div", "import-preview__actions");
  const replaceSettingsButton = el("button", "backup-action backup-action--primary", {
    type: "button",
    id: "settingsImportReplace",
    "aria-label": msg("ariaReplaceSettings"),
  });
  replaceSettingsButton.textContent = msg("settingsImportReplaceAction");
  const cancelImportButton = el("button", "backup-action", {
    type: "button",
    id: "settingsImportCancel",
    "aria-label": msg("ariaCancelSettingsImport"),
  });
  cancelImportButton.textContent = msg("settingsImportCancelAction");
  importPreviewActions.append(replaceSettingsButton, cancelImportButton);
  importPreview.append(importPreviewTitle, importSummary, importPreviewActions);
  backupSection.append(backupHeader, backupActions, importError, importPreview);

  persistentSettings.append(thresholdSection, siteSection, textSection, backupSection);
  content.append(permissionSection, sessionSection, persistentSettings);

  const footer = el("footer", "footer");
  const statusEl = el("span", "status");
  statusEl.setAttribute("aria-live", "polite");
  footer.appendChild(statusEl);

  shell.append(bubblesEl, header, storageStateEl, content, footer);
  shadow.appendChild(shell);

  let activeHostname = "";
  let currentThreshold = DEFAULTS.threshold;
  let currentSiteThreshold = DEFAULTS.threshold;
  let isSiteManagerOpen = false;
  let editingOverrideHost = "";
  let pendingConfirmation = null;
  let statusTimer = null;
  let storageErrorPhase = null;
  let uiWriteRevision = 0;
  let settingsState = normalizeSettings(schemaDefaults, { defaultText: DEFAULTS.text });
  let sessionUiPhase = "loading";
  let isSessionPaused = false;
  let sessionRequestRevision = 0;
  let importReadRevision = 0;
  let pendingImportedSettings = null;
  let permissionRequestRevision = 0;

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

  function setStorageUiState(phase, errorPhase = null) {
    const isReady = phase === "ready";
    const isError = phase === "error";
    const activeElement = shadow.activeElement;
    const settingsFocusWillBeHidden = Boolean(
      isError
      && activeElement
      && (content.contains(activeElement) || headerToggle.contains(activeElement))
    );

    storageErrorPhase = isError ? errorPhase : null;
    storageStateEl.hidden = isReady;
    content.hidden = !isReady;
    headerToggle.hidden = !isReady;
    storageRetryButton.hidden = !isError;
    storageStateEl.dataset.phase = phase;
    storageStateEl.setAttribute("role", isError ? "alert" : "status");

    if (isReady) {
      shell.removeAttribute("aria-busy");
      return;
    }

    shell.setAttribute("aria-busy", phase === "loading" ? "true" : "false");
    storageStateMessage.textContent = phase === "loading"
      ? msg("storageLoading")
      : msg(errorPhase === "read" ? "storageReadError" : "storageWriteError");

    if (settingsFocusWillBeHidden) {
      storageRetryButton.focus();
    }
  }

  function syncGlobalState() {
    const off = !globalSwitch.input.checked;
    persistentSettings.style.opacity = off ? "0.62" : "1";
    persistentSettings.style.filter = off ? "grayscale(0.45)" : "none";
  }

  function syncSiteAvailability() {
    const hasHost = Boolean(activeHostname);
    siteUnavailableNote.hidden = hasHost;
    siteDescription.hidden = !hasHost;
    siteEnabledRow.hidden = !hasHost;
    siteOverrideRow.hidden = !hasHost;
    siteSwitch.input.disabled = !hasHost;
    overrideSwitch.input.disabled = !hasHost;
    syncOverrideVisibility();
    syncSiteManagerVisibility();

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
    const pageContext = getCurrentPageContext(activeTab?.url);
    activeHostname = pageContext.available
      ? normalizeHostname(pageContext.hostname) || ""
      : "";
  }

  function syncPermissionUi(state, outcome = null) {
    const requesting = state === "requesting";
    const restored = outcome === REQUEST_OUTCOMES.restored;
    const missingState = [
      ACCESS_STATES.missing,
      ACCESS_STATES.partial,
      ACCESS_STATES.unavailable,
    ].includes(state);
    const failedOutcome = outcome && outcome !== REQUEST_OUTCOMES.restored;

    permissionSection.dataset.state = restored ? "restored" : outcome || state;
    permissionSection.setAttribute("aria-busy", String(state === "loading" || requesting));
    permissionActionButton.hidden = !(missingState || failedOutcome || requesting);
    permissionActionButton.disabled = requesting;
    permissionActionButton.textContent = msg(
      requesting ? "permissionRequestingAction" : "permissionRestoreAction"
    );
    permissionReload.hidden = !restored;
    permissionFallback.hidden = !failedOutcome && state !== ACCESS_STATES.unavailable;

    if (outcome) {
      const outcomeMessage = {
        [REQUEST_OUTCOMES.restored]: "permissionRestored",
        [REQUEST_OUTCOMES.denied]: "permissionRequestDenied",
        [REQUEST_OUTCOMES.partial]: "permissionRequestPartial",
        [REQUEST_OUTCOMES.exception]: "permissionRequestException",
        [REQUEST_OUTCOMES.unverified]: "permissionRequestUnverified",
      }[outcome];
      permissionDescription.textContent = msg(outcomeMessage);
      return;
    }

    const stateMessage = {
      loading: "permissionHealthLoading",
      requesting: "permissionHealthRequesting",
      [ACCESS_STATES.granted]: "permissionHealthGranted",
      [ACCESS_STATES.missing]: "permissionHealthMissing",
      [ACCESS_STATES.partial]: "permissionHealthPartial",
      [ACCESS_STATES.unavailable]: "permissionHealthUnavailable",
    }[state];
    permissionDescription.textContent = msg(stateMessage);
  }

  async function loadPermissionHealth() {
    const revision = ++permissionRequestRevision;
    syncPermissionUi("loading");
    const health = await checkHostAccess(browser.permissions);
    if (revision === permissionRequestRevision) {
      syncPermissionUi(health.state);
    }
    return health;
  }

  function sendSettingsMessage(message) {
    return browser.runtime.sendMessage(message).then((response) => {
      if (!response || typeof response.ok !== "boolean") {
        throw new Error("SETTINGS_BACKGROUND_UNAVAILABLE");
      }
      return response;
    });
  }

  function sendSessionMessage(message) {
    return browser.runtime.sendMessage(message).then((response) => {
      if (!response || typeof response.ok !== "boolean") {
        throw new Error("SESSION_BACKGROUND_UNAVAILABLE");
      }
      return response;
    });
  }

  function syncSessionUi(phase, paused = isSessionPaused, { preserveActionFocus = false } = {}) {
    sessionUiPhase = phase;
    isSessionPaused = paused === true;
    sessionSection.setAttribute("aria-busy", String(phase === "loading"));
    sessionActionButton.disabled = phase === "loading" && !preserveActionFocus;

    if (phase === "loading") {
      sessionSection.dataset.state = "loading";
      sessionTitle.textContent = msg("sessionStateLoadingTitle");
      sessionDescription.textContent = msg("sessionStateLoadingDescription");
      sessionActionButton.textContent = msg("sessionStateLoadingAction");
      sessionActionButton.setAttribute("aria-label", msg("sessionStateLoadingAction"));
      return;
    }

    if (phase === "error") {
      sessionSection.dataset.state = "error";
      sessionTitle.textContent = msg("sessionStateErrorTitle");
      sessionDescription.textContent = msg("sessionStateErrorDescription");
      sessionActionButton.textContent = msg("sessionStateRetryAction");
      sessionActionButton.setAttribute("aria-label", msg("ariaSessionRetry"));
      return;
    }

    sessionSection.dataset.state = isSessionPaused ? "paused" : "active";
    sessionTitle.textContent = msg(isSessionPaused ? "sessionPausedTitle" : "sessionPauseTitle");
    sessionDescription.textContent = msg(
      isSessionPaused ? "sessionPausedDescription" : "sessionPauseDescription"
    );
    sessionActionButton.textContent = msg(
      isSessionPaused ? "sessionResumeAction" : "sessionPauseAction"
    );
    sessionActionButton.setAttribute(
      "aria-label",
      msg(isSessionPaused ? "ariaSessionResume" : "ariaSessionPause")
    );
  }

  async function loadSessionState() {
    const revision = ++sessionRequestRevision;
    syncSessionUi("loading");

    try {
      const response = await sendSessionMessage({ type: SESSION_MESSAGE_TYPES.get });
      if (revision !== sessionRequestRevision) {
        return;
      }

      if (!response.ok) {
        throw new Error(response.error || "SESSION_STATE_UNAVAILABLE");
      }

      syncSessionUi("ready", response.paused);
    } catch (error) {
      if (revision === sessionRequestRevision) {
        syncSessionUi("error");
      }
    }
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== SESSION_MESSAGE_TYPES.changed) {
      return;
    }

    sessionRequestRevision += 1;
    syncSessionUi("ready", message.paused);
  });

  function rememberResponseSettings(response) {
    if (response?.settings) {
      settingsState = normalizeSettings(response.settings, { defaultText: DEFAULTS.text });
    }
  }

  function persistSettingsPatch(patch, successMessage = msg("statusAutoSaved")) {
    settingsState = normalizeSettings(
      { ...settingsState, ...patch },
      { defaultText: DEFAULTS.text }
    );

    const revision = ++uiWriteRevision;
    const operation = sendSettingsMessage({
      type: MESSAGE_TYPES.update,
      patch,
    });

    operation.then((response) => {
      if (revision !== uiWriteRevision) {
        return;
      }

      if (!response.ok) {
        rememberResponseSettings(response);
        setStorageUiState("error", "write");
        return;
      }

      rememberResponseSettings(response);
      showStatus(successMessage);
    }).catch(() => {
      if (revision === uiWriteRevision) {
        setStorageUiState("error", "write");
      }
    });

    return operation;
  }

  function persistSiteSettingsIntent(intent, successMessage, focusRequest = null) {
    try {
      settingsState = applySiteSettingsIntent(
        settingsState,
        intent,
        { defaultText: DEFAULTS.text }
      );
    } catch (error) {
      showStatus(msg("statusError"));
      return Promise.reject(error);
    }

    syncActiveSiteControls();
    renderSiteManager(focusRequest);

    const revision = ++uiWriteRevision;
    const operation = sendSettingsMessage({
      type: MESSAGE_TYPES.updateSite,
      intent,
    });

    operation.then((response) => {
      if (revision !== uiWriteRevision) {
        return;
      }

      if (!response.ok) {
        rememberResponseSettings(response);
        setStorageUiState("error", "write");
        return;
      }

      rememberResponseSettings(response);
      showStatus(successMessage);
    }).catch(() => {
      if (revision === uiWriteRevision) {
        setStorageUiState("error", "write");
      }
    });

    return operation;
  }

  function saveThreshold(forcedValue, { syncInput = true } = {}) {
    const value = forcedValue ?? sanitizeThreshold(globalThresholdControl.input.value);
    setGlobalThresholdValue(value, { syncInput });
    const operation = persistSettingsPatch({ [KEYS.threshold]: value });
    renderSiteManager();
    return operation;
  }

  function saveText({ syncInput = true } = {}) {
    const text = textInput.value.trim() || DEFAULTS.text;
    if (syncInput) {
      textInput.value = text;
    }
    syncPreviewText();
    syncTextResetState();

    return persistSettingsPatch({ [KEYS.text]: text });
  }

  function saveSiteOverride(
    forcedValue,
    successMessage = msg("statusAutoSaved"),
    { syncInput = true } = {}
  ) {
    if (!activeHostname) {
      return Promise.resolve();
    }

    if (overrideSwitch.input.checked) {
      const value = forcedValue ?? sanitizeThreshold(siteThresholdControl.input.value);
      setSiteThresholdValue(value, { syncInput });
      return persistSiteSettingsIntent(
        { hostname: activeHostname, override: value },
        successMessage
      );
    }

    return persistSiteSettingsIntent(
      { hostname: activeHostname, override: null },
      successMessage
    );
  }

  function adjustThresholdValue(currentValue, delta) {
    const next = normalizeThreshold(currentValue + delta);
    return next > 0 ? next : currentValue;
  }

  function syncOverrideVisibility() {
    siteOverridePanel.hidden = !activeHostname || !overrideSwitch.input.checked;
  }

  function syncActiveSiteControls() {
    if (!activeHostname) {
      siteSwitch.input.checked = false;
      overrideSwitch.input.checked = false;
      setSiteThresholdValue(currentThreshold);
      syncOverrideVisibility();
      return;
    }

    siteSwitch.input.checked = !settingsState[KEYS.disabledDomains].includes(activeHostname);
    const siteThreshold = settingsState[KEYS.siteOverrides][activeHostname];
    const hasOverride = typeof siteThreshold === "number";
    overrideSwitch.input.checked = hasOverride;
    setSiteThresholdValue(hasOverride ? siteThreshold : currentThreshold);
    syncOverrideVisibility();
  }

  function syncSiteManagerVisibility() {
    siteManager.hidden = !isSiteManagerOpen;
    manageButton.setAttribute("aria-expanded", String(isSiteManagerOpen));
  }

  function closeSiteManager({ restoreFocus = true } = {}) {
    isSiteManagerOpen = false;
    editingOverrideHost = "";
    pendingConfirmation = null;
    syncSiteManagerVisibility();
    if (restoreFocus) {
      manageButton.focus();
    }
  }

  function focusRenderedManagerControl(request, entries) {
    if (!request || !isSiteManagerOpen) {
      return;
    }

    let target = null;
    if (request.type === "host") {
      const item = Array.from(siteManagerList.querySelectorAll(".site-manager__item"))
        .find((entry) => entry.dataset.hostname === request.hostname);
      target = item?.querySelector(`[data-manager-action="${request.action}"]`)
        || item?.querySelector("button, input");
    } else if (request.type === "neighbor") {
      if (entries.length === 0) {
        target = siteManagerList.querySelector(".site-manager__empty");
      } else {
        const itemIndex = Math.min(request.index, entries.length - 1);
        target = siteManagerList.querySelectorAll(".site-manager__item")[itemIndex]
          ?.querySelector("button, input");
      }
    } else if (request.type === "empty") {
      target = siteManagerList.querySelector(".site-manager__empty");
    }

    target?.focus();
  }

  function createManagerAction(label, hostname, action, onClick, { danger = false } = {}) {
    const button = el(
      "button",
      `site-manager__action${danger ? " site-manager__action--danger" : ""}`,
      {
        type: "button",
        "data-manager-action": action,
        "aria-label": `${label}: ${hostname}`,
      }
    );
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function beginConfirmation(hostname, kind) {
    editingOverrideHost = "";
    pendingConfirmation = { hostname, kind };
    renderSiteManager({ type: "host", hostname, action: "confirm" });
  }

  function renderSiteManager(focusRequest = null) {
    siteManagerList.textContent = "";
    const entries = getManagedSiteEntries(settingsState, { defaultText: DEFAULTS.text });

    if (entries.length === 0) {
      const empty = el("div", "site-manager__empty", {
        role: "status",
        tabindex: "-1",
      });
      empty.textContent = msg("siteManagerEmpty");
      siteManagerList.appendChild(empty);
      focusRenderedManagerControl(focusRequest || { type: "empty" }, entries);
      return;
    }

    entries.forEach((entry, index) => {
      const { hostname, enabled, hasOverride, threshold } = entry;
      const item = el("article", "site-manager__item", { "data-hostname": hostname });
      const summary = el("div", "site-manager__summary");
      const hostLine = el("div", "site-manager__host");
      hostLine.textContent = hostname;
      const meta = el("div", "site-manager__meta");
      const stateLine = el("span", "site-manager__state", {
        "data-enabled": String(enabled),
      });
      stateLine.textContent = msg(enabled ? "siteManagerEnabled" : "siteManagerDisabled");
      const thresholdLine = el("span", "site-manager__threshold");
      thresholdLine.textContent = msg(
        hasOverride ? "siteManagerOverrideThreshold" : "siteManagerGlobalThreshold",
        `${formatThresholdNumber(threshold)} ${getUnitScreensMsg(threshold)}`
      );
      meta.append(stateLine, thresholdLine);
      summary.append(hostLine, meta);
      item.appendChild(summary);

      if (editingOverrideHost === hostname) {
        const editor = el("form", "site-manager__editor");
        const editorLabel = el("label", "site-manager__editor-label", {
          for: `managerOverride-${index}`,
        });
        editorLabel.textContent = msg("siteManagerOverrideInput", hostname);
        const editorInput = el("input", "site-manager__editor-input", {
          id: `managerOverride-${index}`,
          type: "number",
          step: String(THRESHOLD_STEP),
          inputmode: "decimal",
          value: String(threshold),
          "data-manager-action": "override-input",
        });
        const editorActions = el("div", "site-manager__editor-actions");
        const saveButton = createManagerAction(
          msg("siteManagerSaveOverride"),
          hostname,
          "save-override",
          () => undefined
        );
        saveButton.type = "submit";
        const cancelButton = createManagerAction(
          msg("siteManagerCancel"),
          hostname,
          "cancel-edit",
          () => {
            editingOverrideHost = "";
            renderSiteManager({ type: "host", hostname, action: hasOverride ? "edit-override" : "set-override" });
          }
        );
        editorActions.append(saveButton, cancelButton);
        editor.append(editorLabel, editorInput, editorActions);
        editor.addEventListener("submit", (event) => {
          event.preventDefault();
          const value = parsePositiveThreshold(editorInput.value);
          if (value === null) {
            editorInput.setAttribute("aria-invalid", "true");
            editorInput.focus();
            return;
          }

          editingOverrideHost = "";
          persistSiteSettingsIntent(
            { hostname, override: value },
            msg("statusOverrideEnabled", hostname),
            { type: "host", hostname, action: "edit-override" }
          );
        });
        item.appendChild(editor);
      } else if (pendingConfirmation?.hostname === hostname) {
        const kind = pendingConfirmation.kind;
        const confirmation = el("div", "site-manager__confirmation", {
          role: "group",
          "aria-label": msg(kind === "override" ? "siteManagerConfirmOverride" : "siteManagerConfirmRemove", hostname),
        });
        const confirmationText = el("span", "site-manager__confirmation-text");
        confirmationText.textContent = msg(
          kind === "override" ? "siteManagerConfirmOverride" : "siteManagerConfirmRemove",
          hostname
        );
        const confirmationActions = el("div", "site-manager__editor-actions");
        const confirmButton = createManagerAction(
          msg("siteManagerConfirmAction"),
          hostname,
          "confirm",
          () => {
            pendingConfirmation = null;
            persistSiteSettingsIntent(
              kind === "override"
                ? { hostname, override: null }
                : { hostname, remove: true },
              msg(kind === "override" ? "statusOverrideRemoved" : "statusSiteSettingsRemoved", hostname),
              { type: "neighbor", index }
            );
          },
          { danger: true }
        );
        const cancelButton = createManagerAction(
          msg("siteManagerCancel"),
          hostname,
          "cancel-confirm",
          () => {
            pendingConfirmation = null;
            renderSiteManager({
              type: "host",
              hostname,
              action: kind === "override" ? "remove-override" : "remove-site",
            });
          }
        );
        confirmationActions.append(confirmButton, cancelButton);
        confirmation.append(confirmationText, confirmationActions);
        item.appendChild(confirmation);
      } else {
        const actions = el("div", "site-manager__actions");
        actions.appendChild(createManagerAction(
          msg(enabled ? "siteManagerDisable" : "siteManagerEnable"),
          hostname,
          "toggle-enabled",
          () => persistSiteSettingsIntent(
            { hostname, enabled: !enabled },
            msg(enabled ? "statusDisabledOnHost" : "statusEnabledOnHost", hostname),
            !enabled && !hasOverride
              ? { type: "neighbor", index }
              : { type: "host", hostname, action: "toggle-enabled" }
          )
        ));

        actions.appendChild(createManagerAction(
          msg(hasOverride ? "siteManagerEditOverride" : "siteManagerSetOverride"),
          hostname,
          hasOverride ? "edit-override" : "set-override",
          () => {
            pendingConfirmation = null;
            editingOverrideHost = hostname;
            renderSiteManager({ type: "host", hostname, action: "override-input" });
          }
        ));

        if (hasOverride) {
          actions.appendChild(createManagerAction(
            msg("siteManagerRemoveOverride"),
            hostname,
            "remove-override",
            () => beginConfirmation(hostname, "override"),
            { danger: true }
          ));
        }

        actions.appendChild(createManagerAction(
          msg("siteManagerRemoveSite"),
          hostname,
          "remove-site",
          () => beginConfirmation(hostname, "site"),
          { danger: true }
        ));
        item.appendChild(actions);
      }

      siteManagerList.appendChild(item);
    });

    focusRenderedManagerControl(focusRequest, entries);
  }

  function importErrorMessage(error) {
    const code = error?.code || error?.message || "IMPORT_UNKNOWN";

    if (code === "IMPORT_FILE_TOO_LARGE") {
      return msg("settingsImportErrorTooLarge");
    }
    if (code === "IMPORT_JSON_INVALID") {
      return msg("settingsImportErrorJson");
    }
    if (code === "IMPORT_VERSION_UNSUPPORTED") {
      return msg("settingsImportErrorVersion");
    }
    if (["IMPORT_HOSTNAME_INVALID", "IMPORT_HOSTNAME_DUPLICATE"].includes(code)) {
      return msg(code === "IMPORT_HOSTNAME_DUPLICATE"
        ? "settingsImportErrorDuplicateHost"
        : "settingsImportErrorHostname");
    }
    if ([
      "IMPORT_THRESHOLD_INVALID",
      "IMPORT_TEXT_INVALID",
      "IMPORT_ENABLED_INVALID",
      "IMPORT_DISABLED_DOMAINS_INVALID",
      "IMPORT_OVERRIDES_INVALID",
      "IMPORT_OVERRIDE_INVALID",
    ].includes(code)) {
      return msg("settingsImportErrorValues");
    }
    if (["STORAGE_WRITE_FAILED", "SETTINGS_REPLACE_PENDING"].includes(code)) {
      return msg("settingsImportErrorWrite");
    }
    if (code === "IMPORT_FILE_READ_FAILED") {
      return msg("settingsImportErrorRead");
    }

    return msg("settingsImportErrorStructure");
  }

  function clearImportError() {
    importError.hidden = true;
    importError.textContent = "";
  }

  function showImportError(error) {
    importError.textContent = importErrorMessage(error);
    importError.hidden = false;
  }

  function closeImportPreview({ restoreFocus = true } = {}) {
    importReadRevision += 1;
    pendingImportedSettings = null;
    importPreview.hidden = true;
    importFileInput.value = "";
    clearImportError();
    if (restoreFocus) {
      importButton.focus();
    }
  }

  function renderImportPreview(settings) {
    importSummaryValues.threshold.textContent = `${formatThresholdNumber(settings[KEYS.threshold])} ${getUnitScreensMsg(settings[KEYS.threshold])}`;
    importSummaryValues.text.textContent = settings[KEYS.text];
    importSummaryValues.enabled.textContent = msg(
      settings[KEYS.enabled] ? "settingsImportStateEnabled" : "settingsImportStateDisabled"
    );
    importSummaryValues.disabledDomains.textContent = String(settings[KEYS.disabledDomains].length);
    importSummaryValues.siteOverrides.textContent = String(Object.keys(settings[KEYS.siteOverrides]).length);
    importPreview.hidden = false;
  }

  exportButton.addEventListener("click", () => {
    try {
      const envelope = createSettingsExport(settingsState, { defaultText: DEFAULTS.text });
      const blob = new Blob([`${JSON.stringify(envelope, null, 2)}\n`], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `surfaced-settings-${envelope.exportedAt.slice(0, 10)}.json`;
      link.hidden = true;
      shadow.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showStatus(msg("settingsExportSuccess"));
    } catch (error) {
      showStatus(msg("settingsExportError"));
    }
  });

  importButton.addEventListener("click", () => {
    importFileInput.value = "";
    importFileInput.click();
  });

  importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    if (!file) {
      return;
    }

    const revision = ++importReadRevision;
    pendingImportedSettings = null;
    importPreview.hidden = true;
    clearImportError();

    if (file.size > SETTINGS_IMPORT_MAX_BYTES) {
      showImportError({ code: "IMPORT_FILE_TOO_LARGE" });
      importFileInput.value = "";
      return;
    }

    let text;
    try {
      text = await file.text();
    } catch (error) {
      if (revision === importReadRevision) {
        showImportError({ code: "IMPORT_FILE_READ_FAILED" });
        importFileInput.value = "";
      }
      return;
    }

    if (revision !== importReadRevision) {
      return;
    }

    try {
      const parsed = parseSettingsImport(text, { byteLength: file.size });
      pendingImportedSettings = parsed.settings;
      renderImportPreview(parsed.settings);
      replaceSettingsButton.focus();
    } catch (error) {
      showImportError(error);
      importFileInput.value = "";
    }
  });

  cancelImportButton.addEventListener("click", () => closeImportPreview());

  let importWritePending = false;
  replaceSettingsButton.addEventListener("click", async () => {
    if (!pendingImportedSettings || importWritePending) {
      return;
    }

    importWritePending = true;
    replaceSettingsButton.setAttribute("aria-busy", "true");
    clearImportError();

    try {
      const response = await sendSettingsMessage({
        type: MESSAGE_TYPES.replace,
        settings: pendingImportedSettings,
      });

      if (!response.ok) {
        const error = new Error(response.error || "STORAGE_WRITE_FAILED");
        error.code = response.error || "STORAGE_WRITE_FAILED";
        showImportError(error);
        replaceSettingsButton.focus();
        return;
      }

      editingOverrideHost = "";
      pendingConfirmation = null;
      applySettingsToUi(response.settings);
      closeImportPreview({ restoreFocus: false });
      showStatus(msg("settingsImportSuccess"));
      importButton.focus();
    } catch (error) {
      showImportError({ code: "STORAGE_WRITE_FAILED" });
      replaceSettingsButton.focus();
    } finally {
      importWritePending = false;
      replaceSettingsButton.removeAttribute("aria-busy");
    }
  });

  permissionActionButton.addEventListener("click", async () => {
    const revision = ++permissionRequestRevision;
    const restoreActionFocus = shadow.activeElement === permissionActionButton;
    syncPermissionUi("requesting");

    const result = await requestHostAccess(browser.permissions);
    if (revision !== permissionRequestRevision) {
      return;
    }

    syncPermissionUi(result.health.state, result.outcome);
    if (restoreActionFocus) {
      if (result.outcome === REQUEST_OUTCOMES.restored) {
        permissionDescription.focus();
      } else {
        permissionActionButton.focus();
      }
    }
  });

  sessionActionButton.addEventListener("click", async () => {
    if (sessionUiPhase === "loading") {
      return;
    }

    if (sessionUiPhase === "error") {
      await loadSessionState();
      return;
    }

    const nextPaused = !isSessionPaused;
    const revision = ++sessionRequestRevision;
    const restoreActionFocus = shadow.activeElement === sessionActionButton;
    syncSessionUi("loading", isSessionPaused, { preserveActionFocus: restoreActionFocus });

    try {
      const response = await sendSessionMessage({
        type: SESSION_MESSAGE_TYPES.set,
        paused: nextPaused,
      });

      if (revision !== sessionRequestRevision) {
        return;
      }

      if (!response.ok) {
        throw new Error(response.error || "SESSION_STATE_UPDATE_FAILED");
      }

      syncSessionUi("ready", response.paused);
      if (restoreActionFocus) {
        sessionActionButton.focus();
      }
    } catch (error) {
      if (revision === sessionRequestRevision) {
        syncSessionUi("error", isSessionPaused);
        if (restoreActionFocus) {
          sessionActionButton.focus();
        }
      }
    }
  });

  globalSwitch.input.addEventListener("change", () => {
    syncGlobalState();
    persistSettingsPatch(
      { [KEYS.enabled]: globalSwitch.input.checked },
      globalSwitch.input.checked ? msg("statusEnabled") : msg("statusDisabled")
    );
  });

  globalThresholdControl.decrementButton.addEventListener("click", () => {
    const nextValue = adjustThresholdValue(parsePositiveThreshold(globalThresholdControl.input.value) ?? currentThreshold, -THRESHOLD_STEP);
    saveThreshold(nextValue);
  });

  globalThresholdControl.incrementButton.addEventListener("click", () => {
    const nextValue = adjustThresholdValue(parsePositiveThreshold(globalThresholdControl.input.value) ?? currentThreshold, THRESHOLD_STEP);
    saveThreshold(nextValue);
  });

  globalThresholdControl.input.addEventListener("input", () => {
    const value = parseLiveThreshold(globalThresholdControl.input.value) ?? DEFAULTS.threshold;
    saveThreshold(value, { syncInput: false });
  });

  globalThresholdControl.input.addEventListener("blur", () => {
    setGlobalThresholdValue(settingsState[KEYS.threshold]);
  });

  thresholdHelpButton.addEventListener("click", () => {
    thresholdHelper.hidden = !thresholdHelper.hidden;
    syncThresholdHelpVisibility();
  });

  textInput.addEventListener("input", () => {
    syncPreviewText();
    syncTextResetState();
    saveText({ syncInput: false });
  });

  textInput.addEventListener("blur", () => {
    textInput.value = settingsState[KEYS.text];
    syncPreviewText();
    syncTextResetState();
  });

  textResetButton.addEventListener("click", () => {
    textInput.value = DEFAULTS.text;
    syncPreviewText();
    syncTextResetState();
    saveText();
  });

  siteSwitch.input.addEventListener("change", () => {
    if (!activeHostname) {
      return;
    }

    persistSiteSettingsIntent(
      { hostname: activeHostname, enabled: siteSwitch.input.checked },
      siteSwitch.input.checked
        ? msg("statusEnabledOnHost", activeHostname)
        : msg("statusDisabledOnHost", activeHostname)
    );
  });

  overrideSwitch.input.addEventListener("change", () => {
    if (!activeHostname) {
      return;
    }

    const statusMessage = overrideSwitch.input.checked
      ? msg("statusOverrideEnabled", activeHostname)
      : msg("statusOverrideDisabled", activeHostname);

    setSiteThresholdValue(currentThreshold);
    syncOverrideVisibility();
    saveSiteOverride(
      overrideSwitch.input.checked ? currentThreshold : undefined,
      statusMessage
    );
  });

  siteThresholdControl.decrementButton.addEventListener("click", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }
    const nextValue = adjustThresholdValue(parsePositiveThreshold(siteThresholdControl.input.value) ?? currentSiteThreshold, -THRESHOLD_STEP);
    saveSiteOverride(nextValue);
  });

  siteThresholdControl.incrementButton.addEventListener("click", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }
    const nextValue = adjustThresholdValue(parsePositiveThreshold(siteThresholdControl.input.value) ?? currentSiteThreshold, THRESHOLD_STEP);
    saveSiteOverride(nextValue);
  });

  siteThresholdControl.input.addEventListener("input", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }

    const value = parseLiveThreshold(siteThresholdControl.input.value) ?? DEFAULTS.threshold;
    saveSiteOverride(value, msg("statusAutoSaved"), { syncInput: false });
  });

  siteThresholdControl.input.addEventListener("blur", () => {
    if (!overrideSwitch.input.checked) {
      return;
    }
    setSiteThresholdValue(settingsState[KEYS.siteOverrides][activeHostname] ?? currentThreshold);
  });

  manageButton.addEventListener("click", () => {
    if (isSiteManagerOpen) {
      closeSiteManager();
      return;
    }

    isSiteManagerOpen = true;
    editingOverrideHost = "";
    pendingConfirmation = null;
    syncSiteManagerVisibility();
    renderSiteManager();
    siteManagerCloseButton.focus();
  });

  siteManagerCloseButton.addEventListener("click", () => closeSiteManager());

  siteManager.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    if (editingOverrideHost) {
      const hostname = editingOverrideHost;
      const hasOverride = Object.prototype.hasOwnProperty.call(
        settingsState[KEYS.siteOverrides],
        hostname
      );
      editingOverrideHost = "";
      renderSiteManager({
        type: "host",
        hostname,
        action: hasOverride ? "edit-override" : "set-override",
      });
      return;
    }

    if (pendingConfirmation) {
      const { hostname, kind } = pendingConfirmation;
      pendingConfirmation = null;
      renderSiteManager({
        type: "host",
        hostname,
        action: kind === "override" ? "remove-override" : "remove-site",
      });
      return;
    }

    closeSiteManager();
  });

  function applySettingsToUi(settings) {
    settingsState = normalizeSettings(settings, { defaultText: DEFAULTS.text });
    const threshold = settingsState[KEYS.threshold];
    setGlobalThresholdValue(threshold);
    textInput.value = settingsState[KEYS.text];
    syncPreviewText();
    syncTextResetState();
    globalSwitch.input.checked = settingsState[KEYS.enabled];
    syncGlobalState();

    syncSiteAvailability();
    syncActiveSiteControls();
    renderSiteManager();
    syncSiteManagerVisibility();
  }

  async function loadSettings({ retry = false } = {}) {
    const response = await sendSettingsMessage({
      type: MESSAGE_TYPES.get,
      retry,
    });

    if (!response.ok) {
      rememberResponseSettings(response);
      if (response.settings) {
        applySettingsToUi(response.settings);
      }
      setStorageUiState("error", response.phase || "read");
      return false;
    }

    applySettingsToUi(response.settings);
    setStorageUiState("ready");
    return true;
  }

  storageRetryButton.addEventListener("click", async () => {
    const retryPhase = storageErrorPhase || "read";
    const retrySettings = settingsState;
    const restoreRetryFocus = shadow.activeElement === storageRetryButton;
    uiWriteRevision += 1;
    setStorageUiState("loading");

    try {
      const response = retryPhase === "read"
        ? await sendSettingsMessage({ type: MESSAGE_TYPES.get, retry: true })
        : await sendSettingsMessage({ type: MESSAGE_TYPES.update, patch: retrySettings });

      if (!response.ok) {
        rememberResponseSettings(response);
        setStorageUiState("error", response.phase || retryPhase);
        return;
      }

      applySettingsToUi(response.settings);
      setStorageUiState("ready");
      if (restoreRetryFocus) {
        globalSwitch.input.focus();
      }
      if (retryPhase === "write") {
        showStatus(msg("statusAutoSaved"));
      }
    } catch (error) {
      setStorageUiState("error", retryPhase);
    }
  });

  async function init() {
    setStorageUiState("loading");
    const sessionStatePromise = loadSessionState();
    const permissionHealthPromise = loadPermissionHealth();

    try {
      await resolveActiveTabContext();
    } catch (error) {
      activeHostname = "";
    }

    try {
      await loadSettings();
    } catch (error) {
      setStorageUiState("error", "read");
      console.error("Failed to initialize popup settings", error);
    }

    await Promise.allSettled([sessionStatePromise, permissionHealthPromise]);
  }

  syncTextResetState();
  syncPreviewText();
  syncThresholdHelpVisibility();
  setGlobalThresholdValue(DEFAULTS.threshold);
  setSiteThresholdValue(DEFAULTS.threshold);
  syncOverrideVisibility();
  syncSessionUi("loading");
  syncPermissionUi("loading");
  spawnBubbles();

  init().catch((error) => {
    console.error("Failed to initialize popup", error);
  });
}
