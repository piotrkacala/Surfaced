import "../settings.js";
import "../session-pause.js";
import "../permission-health.js";
import "../reminder-view.js";

const DEFAULT_PLATFORM_CONFIG = {
  isTouch: false,
  importPageMode: "new-tab",
};

const THRESHOLD_STEP = 0.5;

export async function openSettingsImportPage({
  mode,
  browserApi = globalThis.browser,
  locationApi = globalThis.location,
} = {}) {
  const url = browserApi.runtime.getURL("settings-import/index.html");

  if (mode === "new-tab") {
    return browserApi.tabs.create({ url, active: true });
  }

  if (mode === "same-tab") {
    locationApi.assign(url);
    return undefined;
  }

  throw new Error(`Unsupported settings import page mode: ${mode}`);
}

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
    applySiteSettingsIntent,
    createDefaults,
    formatThresholdForDisplay,
    getManagedSiteEntries,
    normalizeHostname,
    normalizeSettings,
    parseThresholdInput,
    serializeSettingsExport,
  } = globalThis.SurfacedSettings;
  const { MESSAGE_TYPES: SESSION_MESSAGE_TYPES } = globalThis.SurfacedSessionPause;
  const { createReminderCard, createReminderStyles } = globalThis.SurfacedReminderView;
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
  function getUnitScreensMsg(value) {
    const form = pluralRules.select(value);
    const suffix = form.charAt(0).toUpperCase() + form.slice(1);
    const localized = msg("unitScreens" + suffix);
    return localized ? localized : msg("unitScreensOther");
  }

  function formatThresholdNumber(value) {
    return formatThresholdForDisplay(value, uiLanguage);
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

  const root = document.getElementById("root");
  const shadow = root.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      box-sizing: border-box;
      color-scheme: light dark;
      /* Light by default, dark by the browser's preference, matching the in-page reminder. */
      --bg: #f3f6f8;
      --surface: #ffffff;
      --sunken: #f3f6f8;
      --ink: #13293a;
      --muted: #576c7b;
      --border: rgba(19, 41, 58, 0.11);
      --border-strong: rgba(19, 41, 58, 0.2);
      --hover: rgba(19, 41, 58, 0.05);
      --card-shadow: 0 1px 2px rgba(10, 32, 48, 0.05);
      --accent: #0b8aa3;
      --accent-ink: #0a7489;
      --accent-fill: #0a7489;
      --accent-fill-hover: #08677a;
      --on-accent: #ffffff;
      --accent-tint: rgba(11, 138, 163, 0.1);
      --accent-border: rgba(11, 138, 163, 0.34);
      --switch-off: #778a96;
      --warning-ink: #7a4a00;
      --warning-tint: #fff7e8;
      --warning-border: rgba(196, 128, 0, 0.36);
      --danger-ink: #b3261e;
      --danger-tint: #fdeeec;
      --danger-border: rgba(179, 38, 30, 0.3);
      --danger-quiet: #94524c;
      --focus: #0a7489;
      --font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --control-height: ${config.isTouch ? "44px" : "32px"};
      --control-radius: ${config.isTouch ? "12px" : "8px"};
      --button-padding: ${config.isTouch ? "10px 16px" : "6px 12px"};
      --button-size: ${config.isTouch ? "14px" : "12.5px"};
      --title-size: ${config.isTouch ? "16px" : "14px"};
      --body-size: ${config.isTouch ? "15px" : "13px"};
      --small-size: ${config.isTouch ? "13.5px" : "12px"};

      display: block;
      width: 100%;
      min-height: ${config.isTouch ? "0" : "auto"};
      height: ${config.isTouch ? "auto" : "100%"};
      overflow: ${config.isTouch ? "visible" : "hidden"};
      ${config.isTouch ? "touch-action: pan-y;" : ""}
      color: var(--ink);
      font-family: var(--font-ui);
      font-size: var(--body-size);
      -webkit-font-smoothing: antialiased;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #0f1b23;
        --surface: #172530;
        --sunken: #13212b;
        --ink: #e6eff4;
        --muted: #9db0bc;
        --border: rgba(255, 255, 255, 0.09);
        --border-strong: rgba(255, 255, 255, 0.18);
        --hover: rgba(255, 255, 255, 0.06);
        --card-shadow: none;
        --accent: #5fcfe1;
        --accent-ink: #5fcfe1;
        --accent-fill: #5fcfe1;
        --accent-fill-hover: #82dcea;
        --on-accent: #06262e;
        --accent-tint: rgba(95, 207, 225, 0.12);
        --accent-border: rgba(95, 207, 225, 0.36);
        --switch-off: #6a7f8c;
        --warning-ink: #f3cf7f;
        --warning-tint: rgba(240, 180, 60, 0.1);
        --warning-border: rgba(240, 180, 60, 0.34);
        --danger-ink: #ff9c92;
        --danger-tint: rgba(255, 110, 100, 0.1);
        --danger-border: rgba(255, 110, 100, 0.32);
        --danger-quiet: #cf8f87;
        --focus: #5fcfe1;
      }
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
      background: var(--bg);
    }

    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: ${config.isTouch ? "16px" : "12px"};
      row-gap: ${config.isTouch ? "8px" : "6px"};
      padding: ${config.isTouch ? "18px 16px 16px" : "14px 14px 12px"};
      border-bottom: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: ${config.isTouch ? "12px" : "10px"};
      min-width: 0;
    }

    .brand__icon {
      width: ${config.isTouch ? "36px" : "30px"};
      height: ${config.isTouch ? "36px" : "30px"};
      border-radius: ${config.isTouch ? "11px" : "9px"};
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-tint);
      color: var(--accent);
    }

    .brand__icon svg {
      width: ${config.isTouch ? "18px" : "16px"};
      height: ${config.isTouch ? "18px" : "16px"};
    }

    .brand__name {
      margin: 0;
      font-size: ${config.isTouch ? "18px" : "15px"};
      line-height: 1.2;
      font-weight: 650;
      letter-spacing: -0.01em;
      color: var(--ink);
    }

    .header-description {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: var(--small-size);
    }

    .header__toggle {
      display: flex;
      align-items: center;
      gap: ${config.isTouch ? "10px" : "8px"};
      flex-shrink: 0;
    }

    .toggle-label {
      color: var(--muted);
      font-size: var(--small-size);
      font-weight: 600;
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
      width: ${config.isTouch ? "42px" : "36px"};
      height: ${config.isTouch ? "24px" : "20px"};
      position: relative;
      border-radius: 999px;
      background: var(--switch-off);
      transition: background-color 0.18s;
      pointer-events: none;
    }

    .switch__thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: ${config.isTouch ? "20px" : "16px"};
      height: ${config.isTouch ? "20px" : "16px"};
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
      transition: transform 0.18s ease;
    }

    .switch input:checked + .switch__track {
      background: var(--accent-fill);
    }

    .switch input:checked + .switch__track .switch__thumb {
      transform: translateX(${config.isTouch ? "18px" : "16px"});
    }

    .switch input:disabled + .switch__track {
      opacity: 0.5;
    }

    .switch input:focus-visible + .switch__track {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }

    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }

    .content {
      flex: ${config.isTouch ? "0 0 auto" : "1 1 auto"};
      overflow-y: ${config.isTouch ? "visible" : "auto"};
      ${config.isTouch ? "touch-action: pan-y;" : ""}
      padding: ${config.isTouch ? "16px" : "12px"};
      display: flex;
      flex-direction: column;
      gap: ${config.isTouch ? "12px" : "10px"};
      transition: opacity 0.25s, filter 0.25s;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: ${config.isTouch ? "14px" : "12px"};
      padding: ${config.isTouch ? "16px" : "14px"};
      border-radius: ${config.isTouch ? "16px" : "12px"};
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--card-shadow);
    }

    .persistent-settings {
      display: flex;
      flex-direction: column;
      gap: ${config.isTouch ? "12px" : "10px"};
      transition: opacity 0.25s, filter 0.25s;
    }

    .session-section,
    .permission-section {
      gap: 10px;
    }

    .permission-status:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 3px;
    }

    .permission-section[data-state="missing"],
    .permission-section[data-state="partial"],
    .permission-section[data-state="unavailable"],
    .permission-section[data-state="denied"],
    .permission-section[data-state="exception"],
    .permission-section[data-state="unverified"] {
      border-color: var(--warning-border);
      background: var(--warning-tint);
    }

    .permission-section[data-state="restored"] {
      border-color: var(--accent-border);
      background: var(--accent-tint);
    }

    .permission-fallback,
    .permission-reload {
      margin: 0;
      color: var(--muted);
      font-size: var(--small-size);
      line-height: 1.45;
    }

    .session-section[data-state="paused"] {
      border-color: var(--accent-border);
      background: var(--accent-tint);
    }

    .session-section[data-state="error"] {
      border-color: var(--danger-border);
      background: var(--danger-tint);
    }

    /* Buttons: secondary by default, primary where a state calls for the next step. */
    .permission-action,
    .session-action,
    .ghost-button,
    .site-manager__action,
    .storage-state__retry {
      appearance: none;
      max-width: 100%;
      min-height: var(--control-height);
      padding: var(--button-padding);
      border-radius: var(--control-radius);
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--ink);
      font: 600 var(--button-size)/1.25 var(--font-ui);
      text-align: center;
      white-space: normal;
      transition: background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s;
      ${pointerStyles}
    }

    .permission-action:${interactionPseudoClass}:not(:disabled),
    .session-action:${interactionPseudoClass}:not(:disabled),
    .ghost-button:${interactionPseudoClass}:not(:disabled),
    .site-manager__action:${interactionPseudoClass}:not(:disabled),
    .storage-state__retry:${interactionPseudoClass}:not(:disabled) {
      background: var(--hover);
    }

    .permission-action,
    .storage-state__retry,
    .session-section[data-state="paused"] .session-action {
      border-color: var(--accent-fill);
      background: var(--accent-fill);
      color: var(--on-accent);
    }

    .permission-action:${interactionPseudoClass}:not(:disabled),
    .storage-state__retry:${interactionPseudoClass}:not(:disabled),
    .session-section[data-state="paused"] .session-action:${interactionPseudoClass}:not(:disabled) {
      border-color: var(--accent-fill-hover);
      background: var(--accent-fill-hover);
    }

    .session-section[data-state="error"] .session-action {
      border-color: var(--danger-border);
      color: var(--danger-ink);
    }

    .permission-action,
    .session-action {
      align-self: flex-start;
    }

    .permission-action:disabled,
    .session-action:disabled,
    .quiet-button:disabled,
    .ghost-button:disabled {
      opacity: 0.5;
      ${config.isTouch ? "" : "cursor: default;"}
    }

    .section__header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .section__header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .section__title {
      margin: 0;
      font-size: var(--title-size);
      line-height: 1.3;
      font-weight: 600;
      color: var(--ink);
    }

    .section__description {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: var(--small-size);
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
      grid-template-columns: ${config.isTouch ? "52px" : "44px"} minmax(0, 1fr) ${config.isTouch ? "52px" : "44px"};
      align-items: stretch;
      width: 100%;
      min-height: ${config.isTouch ? "56px" : "46px"};
      border-radius: calc(var(--control-radius) + 2px);
      overflow: hidden;
      background: var(--sunken);
      border: 1px solid var(--border);
    }

    .stepper-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100%;
      border: none;
      border-radius: 0;
      background: transparent;
      color: var(--ink);
      font: 500 ${config.isTouch ? "22px" : "19px"}/1 var(--font-ui);
      transition: background-color 0.15s;
      ${pointerStyles}
    }

    .stepper-button[data-direction="decrement"] {
      border-right: 1px solid var(--border);
    }

    .stepper-button[data-direction="increment"] {
      border-left: 1px solid var(--border);
    }

    .stepper-button:${interactionPseudoClass} {
      background: var(--hover);
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
      background: var(--surface);
      box-shadow: inset 0 0 0 2px var(--accent-border);
    }

    .threshold-input {
      width: ${config.isTouch ? "5ch" : "4.5ch"};
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--accent-ink);
      font: 650 ${config.isTouch ? "28px" : "24px"}/1 var(--font-ui);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
      text-align: center;
      outline: none;
      -moz-appearance: textfield;
    }

    .threshold-input::-webkit-outer-spin-button,
    .threshold-input::-webkit-inner-spin-button,
    .site-manager__editor-input::-webkit-outer-spin-button,
    .site-manager__editor-input::-webkit-inner-spin-button,
    .text-input::-webkit-outer-spin-button,
    .text-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .threshold-unit {
      color: var(--muted);
      font-size: var(--small-size);
      font-weight: 500;
    }

    .helper-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .helper-copy p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: var(--small-size);
    }

    .ghost-button {
      min-height: ${config.isTouch ? "44px" : "28px"};
      padding: ${config.isTouch ? "8px 14px" : "4px 10px"};
    }

    .icon-button {
      width: ${config.isTouch ? "44px" : "28px"};
      height: ${config.isTouch ? "44px" : "28px"};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: 999px;
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--muted);
      font: 600 ${config.isTouch ? "15px" : "13px"}/1 var(--font-ui);
      transition: background-color 0.15s, color 0.15s;
      ${pointerStyles}
    }

    .icon-button:${interactionPseudoClass} {
      background: var(--hover);
      color: var(--ink);
    }

    .text-input {
      width: 100%;
      box-sizing: border-box;
      min-height: var(--control-height);
      padding: ${config.isTouch ? "10px 12px" : "7px 10px"};
      border-radius: var(--control-radius);
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--ink);
      font: 400 var(--body-size)/1.35 var(--font-ui);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .text-input:focus {
      border-color: var(--accent-fill);
      box-shadow: 0 0 0 3px var(--accent-tint);
    }

    .preview-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preview-label {
      color: var(--muted);
      font-size: var(--small-size);
      font-weight: 600;
    }

    /* A page-like backdrop, so the floating card reads as it will over a page. */
    .preview-stage {
      padding: ${config.isTouch ? "14px 12px" : "12px 10px"};
      border-radius: var(--control-radius);
      background: var(--sunken);
    }

    /* The card itself comes from the shared reminder view; the popup does not replay its entrance. */
    .preview-block .notification {
      animation: none;
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
      color: var(--ink);
      font-size: var(--body-size);
      line-height: 1.4;
      font-weight: 500;
    }

    .site-note {
      padding: 10px 12px;
      border-radius: var(--control-radius);
      background: var(--sunken);
      border: 1px dashed var(--border-strong);
      color: var(--muted);
      font-size: var(--small-size);
      line-height: 1.45;
    }

    .site-override-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .site-override-label {
      color: var(--muted);
      font-size: var(--small-size);
      font-weight: 600;
    }

    .site-manager {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }

    .site-manager__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .site-manager__title {
      margin: 0;
      color: var(--ink);
      font-size: var(--body-size);
      font-weight: 600;
      line-height: 1.35;
    }

    .site-manager__list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: ${config.isTouch ? "420px" : "290px"};
      overflow-y: auto;
      scrollbar-gutter: stable;
    }

    .site-manager__item {
      display: flex;
      flex-direction: column;
      gap: ${config.isTouch ? "6px" : "4px"};
      padding: ${config.isTouch ? "12px" : "10px"};
      border-radius: var(--control-radius);
      background: var(--sunken);
      border: 1px solid var(--border);
    }

    .site-manager__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
    }

    .site-manager__host {
      min-width: 0;
      color: var(--ink);
      font-weight: 600;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .site-manager__toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .site-manager__state {
      color: var(--muted);
      font-size: var(--small-size);
    }

    .site-manager__threshold {
      min-width: 0;
      color: var(--ink);
      font-size: var(--small-size);
      font-variant-numeric: tabular-nums;
    }

    .site-manager__item .quiet-button {
      flex-shrink: 0;
    }

    .site-manager__row > .quiet-button {
      margin-right: ${config.isTouch ? "-10px" : "-8px"};
    }

    .site-manager__remove {
      align-self: flex-start;
    }

    /* Doubled class: the base quiet button rule comes later in this sheet. */
    .quiet-button.quiet-button--danger {
      color: var(--danger-quiet);
      font-weight: 500;
    }

    .site-manager__editor-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .site-manager__editor-actions .quiet-button {
      margin: 0;
    }

    .site-manager__action {
      min-height: ${config.isTouch ? "44px" : "28px"};
      padding: ${config.isTouch ? "8px 12px" : "4px 10px"};
      font-size: ${config.isTouch ? "13px" : "12px"};
    }

    .site-manager__action--primary {
      border-color: var(--accent-fill);
      background: var(--accent-fill);
      color: var(--on-accent);
    }

    .site-manager__action--primary:${interactionPseudoClass}:not(:disabled) {
      border-color: var(--accent-fill-hover);
      background: var(--accent-fill-hover);
    }

    .site-manager__action--danger {
      border-color: var(--danger-border);
      color: var(--danger-ink);
    }

    .site-manager__editor,
    .site-manager__confirmation {
      padding: 10px;
      border-radius: var(--control-radius);
      background: var(--surface);
      border: 1px solid var(--border);
    }

    .site-manager__editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .site-manager__editor-label,
    .site-manager__confirmation-text {
      color: var(--muted);
      font-size: var(--small-size);
      line-height: 1.4;
    }

    .site-manager__editor-input {
      width: 100%;
      min-height: var(--control-height);
      padding: 6px 10px;
      border-radius: var(--control-radius);
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--accent-ink);
      font: 650 ${config.isTouch ? "17px" : "15px"}/1 var(--font-ui);
      font-variant-numeric: tabular-nums;
      -moz-appearance: textfield;
    }

    .site-manager__editor-input[aria-invalid="true"] {
      border-color: var(--danger-ink);
    }

    .site-manager__confirmation {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .site-manager__empty {
      padding: 14px 12px;
      border-radius: var(--control-radius);
      text-align: center;
      color: var(--muted);
      font-size: var(--small-size);
      background: var(--sunken);
      border: 1px dashed var(--border-strong);
    }

    .site-manager__empty:focus {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }

    .site-manager__threshold {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Low-frequency actions sit between and below the cards, without card chrome. */
    .pause-row {
      display: flex;
      padding: 0 ${config.isTouch ? "4px" : "2px"};
      margin: ${config.isTouch ? "-6px 0" : "-4px 0"};
    }

    .quiet-button {
      appearance: none;
      max-width: 100%;
      min-height: ${config.isTouch ? "44px" : "28px"};
      margin: 0 ${config.isTouch ? "-10px" : "-8px"};
      padding: ${config.isTouch ? "8px 10px" : "4px 8px"};
      border: 0;
      border-radius: var(--control-radius);
      background: transparent;
      color: var(--accent-ink);
      font: 600 var(--button-size)/1.25 var(--font-ui);
      text-align: left;
      white-space: normal;
      transition: background-color 0.15s;
      ${pointerStyles}
    }

    .quiet-button:${interactionPseudoClass}:not(:disabled) {
      background: var(--hover);
    }

    .backup-section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      margin: 0 ${config.isTouch ? "4px" : "2px"};
      padding-top: ${config.isTouch ? "6px" : "4px"};
      border-top: 1px solid var(--border);
    }

    .backup-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0 ${config.isTouch ? "20px" : "16px"};
    }

    .backup-note {
      margin: 0;
      color: var(--muted);
      font-size: var(--small-size);
      line-height: 1.45;
    }

    .backup-section .import-error {
      margin-top: 6px;
    }

    .import-error {
      margin: 0;
      padding: 9px 10px;
      border-radius: var(--control-radius);
      border: 1px solid var(--danger-border);
      background: var(--danger-tint);
      color: var(--danger-ink);
      font-size: var(--small-size);
      line-height: 1.45;
    }

    .storage-state {
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
      border-radius: ${config.isTouch ? "16px" : "12px"};
      color: var(--muted);
      background: var(--surface);
      border: 1px solid var(--border);
    }

    .storage-state[data-phase="error"] .storage-state__panel {
      color: var(--danger-ink);
      border-color: var(--danger-border);
      background: var(--danger-tint);
    }

    .storage-state__message {
      margin: 0;
      font-size: var(--body-size);
      line-height: 1.5;
    }

    .footer {
      min-height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 16px;
      border-top: 1px solid var(--border);
    }

    .status {
      opacity: 0;
      color: var(--accent-ink);
      font-size: var(--small-size);
      font-weight: 600;
      line-height: 1.2;
      transition: opacity 0.25s;
    }

    .status.visible {
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }
  ` + createReminderStyles({ adaptToViewport: config.isTouch });

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

  function createLogoSvg() {
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
        stroke: "currentColor",
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
      step: "any",
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

  const header = el("header", "header");
  const brand = el("div", "brand");
  const brandIcon = el("div", "brand__icon");
  brandIcon.appendChild(createLogoSvg());
  const brandName = el("h1", "brand__name");
  brandName.textContent = msg("extensionShortName");
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
  sessionSection.hidden = true;

  // While reminders run, pausing is a quiet action after the current-site
  // settings; the session banner above them only appears while paused or unavailable.
  const pauseRow = el("div", "pause-row");
  const pauseActionButton = el("button", "quiet-button pause-action", {
    type: "button",
    "aria-label": msg("ariaSessionPause"),
  });
  pauseActionButton.textContent = msg("sessionPauseAction");
  pauseActionButton.disabled = true;
  pauseRow.appendChild(pauseActionButton);

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
  const { card: previewCard, message: previewTitle } = createReminderCard({
    depth: 1,
    text: DEFAULTS.text,
    preview: true,
  });
  const previewStage = el("div", "preview-stage");
  previewStage.appendChild(previewCard);
  previewBlock.append(previewLabel, previewStage);

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

  const backupSection = el("section", "backup-section", { "aria-labelledby": "settingsBackupTitle" });
  const backupTitle = el("h2", "sr-only", { id: "settingsBackupTitle" });
  backupTitle.textContent = msg("settingsBackupTitle");
  const backupDescription = el("p", "backup-note");
  backupDescription.textContent = msg("settingsBackupDescription");
  const backupActions = el("div", "backup-actions");
  const exportButton = el("button", "quiet-button backup-action", {
    type: "button",
    id: "settingsExport",
    "aria-label": msg("ariaExportSettings"),
  });
  exportButton.textContent = msg("settingsExportAction");
  const importButton = el("button", "quiet-button backup-action", {
    type: "button",
    id: "settingsImport",
    "aria-label": msg("ariaImportSettings"),
  });
  importButton.textContent = msg("settingsImportAction");
  backupActions.append(exportButton, importButton);

  const importError = el("p", "import-error", {
    role: "alert",
    "aria-live": "assertive",
    tabindex: "-1",
  });
  importError.hidden = true;
  backupSection.append(backupTitle, backupActions, backupDescription, importError);

  persistentSettings.append(thresholdSection, siteSection, pauseRow, textSection);
  content.append(permissionSection, sessionSection, persistentSettings, backupSection);

  const footer = el("footer", "footer");
  const statusEl = el("span", "status");
  statusEl.setAttribute("aria-live", "polite");
  footer.appendChild(statusEl);

  shell.append(header, storageStateEl, content, footer);
  shadow.appendChild(shell);

  let activeHostname = "";
  let currentThreshold = DEFAULTS.threshold;
  let currentSiteThreshold = DEFAULTS.threshold;
  let isSiteManagerOpen = false;
  let editingOverrideHost = "";
  // Unsaved editor text, kept while the manager list is rebuilt around it.
  let editingDraft = null;
  let pendingConfirmation = null;
  let statusTimer = null;
  let storageErrorPhase = null;
  let uiWriteRevision = 0;
  let settingsState = normalizeSettings(schemaDefaults, { defaultText: DEFAULTS.text });
  let sessionUiPhase = "loading";
  let isSessionPaused = false;
  let sessionRequestRevision = 0;
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
    // Healthy access needs no card; it appears only when access needs attention.
    permissionSection.hidden = !outcome && (state === "loading" || state === ACCESS_STATES.granted);
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
    const focusedAction = [sessionActionButton, pauseActionButton]
      .find((button) => button === shadow.activeElement);
    sessionUiPhase = phase;
    isSessionPaused = paused === true;
    sessionSection.setAttribute("aria-busy", String(phase === "loading"));
    sessionActionButton.disabled = phase === "loading" && !preserveActionFocus;
    pauseActionButton.disabled = phase === "loading" && !preserveActionFocus;

    // Visibility follows confirmed state only, so a pending toggle keeps its button in place.
    // A confirmed change, including one broadcast from another page, carries focus across.
    const showBanner = phase === "error" || isSessionPaused;
    sessionSection.hidden = !showBanner;
    pauseActionButton.hidden = showBanner;
    if (focusedAction?.closest("[hidden]")) {
      focusVisibleSessionAction();
    }

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

    syncActiveSiteControls({
      preserveFocusedThreshold: shadow.activeElement === siteThresholdControl.input,
    });
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
    // Add the displayed decimal values exactly, including scientific notation.
    // Convert back to Number only once so a half-screen step adds no binary noise.
    const parts = [currentValue, delta].map((value) => {
      const [mantissa, exponent = "0"] = String(value).split("e");
      const fractionLength = (mantissa.split(".")[1] || "").length;
      return {
        coefficient: BigInt(mantissa.replace(".", "")),
        exponent: Number(exponent) - fractionLength,
      };
    });
    const exponent = Math.min(...parts.map((part) => part.exponent));
    const sum = parts.reduce((total, part) => (
      total + part.coefficient * 10n ** BigInt(part.exponent - exponent)
    ), 0n);
    const next = Number(`${sum}e${exponent}`);
    return Number.isFinite(next) && next > 0 ? next : currentValue;
  }

  function syncOverrideVisibility() {
    siteOverridePanel.hidden = !activeHostname || !overrideSwitch.input.checked;
  }

  function syncActiveSiteControls({ preserveFocusedThreshold = false } = {}) {
    if (!activeHostname) {
      siteSwitch.input.checked = false;
      overrideSwitch.input.checked = false;
      setSiteThresholdValue(currentThreshold, { syncInput: !preserveFocusedThreshold });
      syncOverrideVisibility();
      return;
    }

    siteSwitch.input.checked = !settingsState[KEYS.disabledDomains].includes(activeHostname);
    const siteThreshold = settingsState[KEYS.siteOverrides][activeHostname];
    const hasOverride = typeof siteThreshold === "number";
    overrideSwitch.input.checked = hasOverride;
    setSiteThresholdValue(hasOverride ? siteThreshold : currentThreshold, {
      syncInput: !preserveFocusedThreshold,
    });
    syncOverrideVisibility();
  }

  function syncSiteManagerVisibility() {
    siteManager.hidden = !isSiteManagerOpen;
    manageButton.setAttribute("aria-expanded", String(isSiteManagerOpen));
  }

  function closeSiteManager({ restoreFocus = true } = {}) {
    isSiteManagerOpen = false;
    setEditingHost("");
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

  function createManagerAction(label, hostname, action, onClick, {
    className = "site-manager__action",
    ariaLabel = `${label}: ${hostname}`,
  } = {}) {
    const button = el("button", className, {
      type: "button",
      "data-manager-action": action,
      "aria-label": ariaLabel,
    });
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function setEditingHost(hostname) {
    editingOverrideHost = hostname;
    editingDraft = null;
  }

  function beginSiteRemoval(hostname) {
    setEditingHost("");
    pendingConfirmation = { hostname };
    renderSiteManager({ type: "host", hostname, action: "confirm" });
  }

  function renderSiteManager(focusRequest = null) {
    siteManagerList.textContent = "";
    const entries = getManagedSiteEntries(settingsState, { defaultText: DEFAULTS.text });
    // A row can disappear while open (enabled with nothing else saved, or changed
    // elsewhere); its editor or confirmation must not keep claiming Escape and focus.
    const hostnames = new Set(entries.map((entry) => entry.hostname));
    if (editingOverrideHost && !hostnames.has(editingOverrideHost)) {
      setEditingHost("");
    }
    if (pendingConfirmation && !hostnames.has(pendingConfirmation.hostname)) {
      pendingConfirmation = null;
    }

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
      const isEditing = editingOverrideHost === hostname;
      const isConfirming = pendingConfirmation?.hostname === hostname;
      const item = el("article", "site-manager__item", { "data-hostname": hostname });

      // Domain and state lead; the threshold and its edit action follow.
      const hostRow = el("div", "site-manager__row");
      const hostLine = el("div", "site-manager__host");
      hostLine.textContent = hostname;
      const toggle = el("div", "site-manager__toggle");
      const stateLine = el("span", "site-manager__state", {
        "data-enabled": String(enabled),
        "aria-hidden": "true",
      });
      stateLine.textContent = msg(enabled ? "siteManagerEnabled" : "siteManagerDisabled");
      const enabledSwitch = createSwitch(`managerEnabled-${index}`, msg("enabledOnHost", hostname));
      enabledSwitch.input.checked = enabled;
      enabledSwitch.input.dataset.managerAction = "toggle-enabled";
      enabledSwitch.input.addEventListener("change", () => {
        const nextEnabled = enabledSwitch.input.checked;
        persistSiteSettingsIntent(
          { hostname, enabled: nextEnabled },
          msg(nextEnabled ? "statusEnabledOnHost" : "statusDisabledOnHost", hostname),
          // An enabled site without a custom threshold has nothing left to save.
          nextEnabled && !hasOverride
            ? { type: "neighbor", index }
            : { type: "host", hostname, action: "toggle-enabled" }
        );
      });
      toggle.append(stateLine, enabledSwitch.wrap);
      hostRow.append(hostLine, toggle);

      const thresholdRow = el("div", "site-manager__row");
      const thresholdLine = el("span", "site-manager__threshold");
      thresholdLine.textContent = msg(
        hasOverride ? "siteManagerOverrideThreshold" : "siteManagerGlobalThreshold",
        `${formatThresholdNumber(threshold)} ${getUnitScreensMsg(threshold)}`
      );
      thresholdRow.appendChild(thresholdLine);
      if (!isEditing && !isConfirming) {
        thresholdRow.appendChild(createManagerAction(
          msg("siteManagerEdit"),
          hostname,
          "edit-threshold",
          () => {
            pendingConfirmation = null;
            setEditingHost(hostname);
            renderSiteManager({ type: "host", hostname, action: "override-input" });
          },
          { className: "quiet-button", ariaLabel: msg("siteManagerEditLabel", hostname) }
        ));
      }
      item.append(hostRow, thresholdRow);

      if (isEditing) {
        const editor = el("form", "site-manager__editor");
        const editorLabel = el("label", "site-manager__editor-label", {
          for: `managerOverride-${index}`,
        });
        editorLabel.textContent = msg("siteManagerOverrideInput", hostname);
        const editorInput = el("input", "site-manager__editor-input", {
          id: `managerOverride-${index}`,
          type: "number",
          step: "any",
          inputmode: "decimal",
          value: editingDraft ?? String(threshold),
          "data-manager-action": "override-input",
        });
        editorInput.addEventListener("input", () => {
          editingDraft = editorInput.value;
        });
        const editorActions = el("div", "site-manager__editor-actions");
        const saveButton = createManagerAction(
          msg("siteManagerSaveOverride"),
          hostname,
          "save-override",
          () => undefined,
          { className: "site-manager__action site-manager__action--primary" }
        );
        saveButton.type = "submit";
        const cancelButton = createManagerAction(
          msg("siteManagerCancel"),
          hostname,
          "cancel-edit",
          () => {
            setEditingHost("");
            renderSiteManager({ type: "host", hostname, action: "edit-threshold" });
          }
        );
        editorActions.append(saveButton, cancelButton);

        if (hasOverride) {
          // Only the threshold changes; the site's enabled state stays as it is.
          editorActions.appendChild(createManagerAction(
            msg("siteManagerUseGlobal"),
            hostname,
            "use-global",
            () => {
              setEditingHost("");
              persistSiteSettingsIntent(
                { hostname, override: null },
                msg("statusOverrideDisabled", hostname),
                enabled
                  ? { type: "neighbor", index }
                  : { type: "host", hostname, action: "edit-threshold" }
              );
            },
            { className: "quiet-button" }
          ));
        }

        editor.append(editorLabel, editorInput, editorActions);
        editor.addEventListener("submit", (event) => {
          event.preventDefault();
          const value = parsePositiveThreshold(editorInput.value);
          if (value === null) {
            editorInput.setAttribute("aria-invalid", "true");
            editorInput.focus();
            return;
          }

          setEditingHost("");
          persistSiteSettingsIntent(
            { hostname, override: value },
            msg("statusOverrideEnabled", hostname),
            { type: "host", hostname, action: "edit-threshold" }
          );
        });
        item.appendChild(editor);
      } else if (isConfirming) {
        const confirmation = el("div", "site-manager__confirmation", {
          role: "group",
          "aria-label": msg("siteManagerConfirmRemove", hostname),
        });
        const confirmationText = el("span", "site-manager__confirmation-text");
        confirmationText.textContent = msg("siteManagerConfirmRemove", hostname);
        const confirmationActions = el("div", "site-manager__editor-actions");
        const confirmButton = createManagerAction(
          msg("siteManagerConfirmAction"),
          hostname,
          "confirm",
          () => {
            pendingConfirmation = null;
            persistSiteSettingsIntent(
              { hostname, remove: true },
              msg("statusSiteSettingsRemoved", hostname),
              { type: "neighbor", index }
            );
          },
          { className: "site-manager__action site-manager__action--danger" }
        );
        const cancelButton = createManagerAction(
          msg("siteManagerCancel"),
          hostname,
          "cancel-confirm",
          () => {
            pendingConfirmation = null;
            renderSiteManager({ type: "host", hostname, action: "remove-site" });
          }
        );
        confirmationActions.append(confirmButton, cancelButton);
        confirmation.append(confirmationText, confirmationActions);
        item.appendChild(confirmation);
      } else {
        item.appendChild(createManagerAction(
          msg("siteManagerRemoveSite"),
          hostname,
          "remove-site",
          () => beginSiteRemoval(hostname),
          { className: "quiet-button quiet-button--danger site-manager__remove" }
        ));
      }

      siteManagerList.appendChild(item);
    });

    focusRenderedManagerControl(focusRequest, entries);
  }

  function clearImportError() {
    importError.hidden = true;
    importError.textContent = "";
  }

  function showImportPageOpenError() {
    importError.textContent = msg("settingsImportPageOpenError");
    importError.hidden = false;
    importError.focus();
  }

  exportButton.addEventListener("click", async () => {
    if (exportButton.disabled) {
      return;
    }

    exportButton.disabled = true;
    exportButton.setAttribute("aria-busy", "true");
    try {
      const response = await sendSettingsMessage({ type: MESSAGE_TYPES.get });
      if (!response.ok) {
        throw new Error(response.error || "SETTINGS_EXPORT_SOURCE_UNAVAILABLE");
      }

      rememberResponseSettings(response);
      const { envelope, text } = serializeSettingsExport(response.settings, {
        defaultText: DEFAULTS.text,
      });
      const blob = new Blob([text], {
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
      showStatus(msg(
        error?.code === "EXPORT_FILE_TOO_LARGE"
          ? "settingsExportErrorTooLarge"
          : "settingsExportError"
      ));
    } finally {
      exportButton.disabled = false;
      exportButton.removeAttribute("aria-busy");
    }
  });

  importButton.addEventListener("click", async () => {
    clearImportError();
    try {
      await openSettingsImportPage({
        mode: config.importPageMode,
      });
    } catch (error) {
      showImportPageOpenError();
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

  function focusVisibleSessionAction() {
    (sessionSection.hidden ? pauseActionButton : sessionActionButton).focus();
  }

  async function toggleSessionPause(trigger) {
    if (sessionUiPhase === "loading") {
      return;
    }

    const restoreActionFocus = shadow.activeElement === trigger;

    if (sessionUiPhase === "error") {
      await loadSessionState();
      if (restoreActionFocus) {
        focusVisibleSessionAction();
      }
      return;
    }

    const nextPaused = !isSessionPaused;
    const revision = ++sessionRequestRevision;
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
        focusVisibleSessionAction();
      }
    } catch (error) {
      if (revision === sessionRequestRevision) {
        syncSessionUi("error", isSessionPaused);
        if (restoreActionFocus) {
          focusVisibleSessionAction();
        }
      }
    }
  }

  sessionActionButton.addEventListener("click", () => toggleSessionPause(sessionActionButton));
  pauseActionButton.addEventListener("click", () => toggleSessionPause(pauseActionButton));

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
    const value = parseLiveThreshold(globalThresholdControl.input.value);
    if (value === null) {
      return;
    }
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

    const value = parseLiveThreshold(siteThresholdControl.input.value);
    if (value === null) {
      return;
    }
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
    setEditingHost("");
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
      setEditingHost("");
      renderSiteManager({ type: "host", hostname, action: "edit-threshold" });
      return;
    }

    if (pendingConfirmation) {
      const { hostname } = pendingConfirmation;
      pendingConfirmation = null;
      renderSiteManager({ type: "host", hostname, action: "remove-site" });
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
    const restoreRetryFocus = shadow.activeElement === storageRetryButton;
    uiWriteRevision += 1;
    setStorageUiState("loading");

    try {
      const response = retryPhase === "read"
        ? await sendSettingsMessage({ type: MESSAGE_TYPES.get, retry: true })
        : await sendSettingsMessage({ type: MESSAGE_TYPES.retry, phase: "write" });

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

  init().catch((error) => {
    console.error("Failed to initialize popup", error);
  });
}
