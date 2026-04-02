(() => {
  // ── Storage keys ──────────────────────────────────────────────────────────
  const KEYS = {
    threshold: "scrollNotifierThreshold",
    enabled: "scrollNotifierEnabled",
    disabledDomains: "scrollNotifierDisabledDomains",
    text: "scrollNotifierText",
    siteOverrides: "scrollNotifierSiteOverrides",
  };

  // ── i18n helper ───────────────────────────────────────────────────────────
  const msg = (key, ...subs) => browser.i18n.getMessage(key, subs);

  const pr = new Intl.PluralRules(browser.i18n.getUILanguage());
  function getUnitScreensMsg(val) {
    const form = pr.select(val);
    const suffix = form.charAt(0).toUpperCase() + form.slice(1);
    const m = msg("unitScreens" + suffix);
    return m ? m : msg("unitScreensOther");
  }

  const DEFAULTS = {
    threshold: 7,
    enabled: true,
    disabledDomains: [],
    text: msg("defaultNotificationText"),
  };

  // ── Shadow DOM mount ──────────────────────────────────────────────────────
  const root = document.getElementById("root");
  const shadow = root.attachShadow({ mode: "open" });

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');

    /* ── Tokens ─────────────────────────────────────────────────────────── */
    :host {
      --deep:        #020d1a;
      --mid:         #041628;
      --water:       #0d4a7a;
      --water-light: #1a6fa8;
      --foam:        #5bc4f5;
      --foam-dim:    #2a8abf;
      --accent:      #00d4ff;
      --warn:        #f0a500;
      --text:        #c8eaf7;
      --text-dim:    #5a8fae;
      --border:      rgba(0, 212, 255, 0.18);
      --border-dim:  rgba(0, 212, 255, 0.08);
      --font-ui:     'Rubik', system-ui, sans-serif;
      --font-mono:   'Space Mono', monospace;

      display: block;
      width: 100%;
      height: 100%;
      font-family: var(--font-ui);
      font-size: 13px;
      color: var(--text);
      -webkit-font-smoothing: antialiased;
    }

    /* ── Layout shell ───────────────────────────────────────────────────── */
    .shell {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      
      /* Ocean dark background matching content.js */
      background: linear-gradient(
        135deg,
        rgba(4, 22, 42, 0.97) 0%,
        rgba(2, 14, 30, 0.97) 100%
      );
      border: 1px solid rgba(0, 212, 255, 0.25);
      box-shadow:
        0 0 0 1px rgba(0, 212, 255, 0.08),
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 40px rgba(0, 212, 255, 0.08),
        inset 0 1px 0 rgba(0, 212, 255, 0.1);
      border-radius: 8px;
      font-family: 'Rubik', system-ui, sans-serif;
      animation: surface-up 0.4s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
    }

    @keyframes surface-up {
      from {
        opacity: 0;
        transform: translateY(20px);
        box-shadow: 0 0 0 1px rgba(0,212,255,0.08), 0 0 0 rgba(0,0,0,0);
      }
      to {
        opacity: 1;
        transform: translateY(0);
        box-shadow:
          0 0 0 1px rgba(0, 212, 255, 0.08),
          0 8px 32px rgba(0, 0, 0, 0.6),
          0 0 40px rgba(0, 212, 255, 0.08),
          inset 0 1px 0 rgba(0, 212, 255, 0.1);
      }
    }

    /* Surface shimmer effect like content.js */
    .shell::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 80px 30px at 20% 50%, rgba(0,212,255,0.05) 0%, transparent 70%),
        radial-gradient(ellipse 60px 40px at 75% 30%, rgba(0,180,220,0.04) 0%, transparent 70%);
      pointer-events: none;
      animation: caustic-shift 6s ease-in-out infinite alternate;
    }

    .shell::after {
      content: '';
      position: absolute;
      top: 0;
      left: 10%;
      right: 10%;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(0, 212, 255, 0.6),
        rgba(91, 196, 245, 0.8),
        rgba(0, 212, 255, 0.6),
        transparent
      );
      animation: surface-shimmer 3s ease-in-out infinite;
    }

    @keyframes surface-shimmer {
      0%, 100% { opacity: 0.5; transform: scaleX(0.9); }
      50%       { opacity: 1.0; transform: scaleX(1.0); }
    }

    /* ── Ocean background ───────────────────────────────────────────────── */
    .caustics {
      position: absolute;
      inset: -50%;
      width: 200%;
      height: 200%;
      pointer-events: none;
      background-image:
        radial-gradient(ellipse 80px 30px at 20% 50%, rgba(0,212,255,0.05) 0%, transparent 70%),
        radial-gradient(ellipse 60px 40px at 75% 30%, rgba(0,180,220,0.04) 0%, transparent 70%);
      animation: caustic-shift 6s ease-in-out infinite alternate;
      opacity: 0.8;
    }

    .caustics--2 {
      animation-duration: 11s;
      animation-delay: -4s;
      animation-direction: alternate-reverse;
      opacity: 0.5;
      background-image:
        radial-gradient(ellipse 90px 30px at 35% 20%, rgba(0,212,255,0.04) 0%, transparent 70%),
        radial-gradient(ellipse 50px 70px at 60% 50%, rgba(0,180,255,0.05) 0%, transparent 70%);
    }

    @keyframes caustic-shift {
      0%   { opacity: 0.6; transform: scale(1) translateX(0); }
      100% { opacity: 1;   transform: scale(1.05) translateX(4px); }
    }

    .bubbles { position: absolute; inset: 0; pointer-events: none; }

    .bubble {
      position: absolute;
      bottom: -20px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.35), rgba(0,212,255,0.06));
      border: 1px solid rgba(0,212,255,0.2);
      animation: bubble-rise linear infinite;
    }

    @keyframes bubble-rise {
      0%   { transform: translateY(0) translateX(0); opacity: 0; }
      10%  { opacity: 0.8; }
      90%  { opacity: 0.4; }
      100% { transform: translateY(-460px) translateX(var(--drift, 0px)); opacity: 0; }
    }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .header {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(4,30,58,0.95) 0%, rgba(2,18,36,0.8) 100%);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(4px);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo__icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .logo__icon svg {
      width: 16px;
      height: 16px;
    }

    .logo__name {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #e8f6ff;
      line-height: 1;
      margin: 0;
    }

    .logo__tagline {
      font-family: var(--font-mono);
      font-size: 9px;
      color: rgba(200, 234, 247, 0.7);
      margin-top: 1px;
      letter-spacing: 0.3px;
    }

    .depth-badge {
      display: flex;
      align-items: baseline;
      gap: 2px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 4px;
      padding: 4px 8px;
      cursor: text;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .depth-badge:hover {
      border-color: rgba(0, 212, 255, 0.3);
      box-shadow: 0 0 8px rgba(0, 212, 255, 0.15);
    }

    .depth-badge__input {
      background: transparent;
      border: none;
      color: #00d4ff;
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
      text-shadow: 0 0 12px rgba(0,212,255,0.6);
      transition: text-shadow 0.3s;
      width: 40px;
      text-align: center;
      outline: none;
      -moz-appearance: textfield;
    }

    .depth-badge__input::-webkit-outer-spin-button,
    .depth-badge__input::-webkit-inner-spin-button { 
      -webkit-appearance: none; 
      margin: 0;
    }

    .depth-badge__input:focus {
      text-shadow: 0 0 16px rgba(0,212,255,0.8);
    }

    .depth-badge__unit {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--text-dim);
      text-transform: uppercase;
    }

    /* ── Body ───────────────────────────────────────────────────────────── */
    .body {
      position: relative;
      z-index: 1;
      flex: 1;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    /* ── Gauge ──────────────────────────────────────────────────────────── */
    .gauge-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 10px;
    }

    .gauge-label__text {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-dim);
    }

    .gauge-label__hint {
      font-family: var(--font-mono);
      font-size: 9px;
      color: rgba(200, 234, 247, 0.7);
      letter-spacing: 0.3px;
    }

    .gauge-wrap {
      display: flex;
      align-items: stretch;
      gap: 10px;
      height: 128px;
    }

    .ruler {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2px 0;
      width: 26px;
    }

    .ruler-spacer {
      width: 26px;
      flex: 0 0 26px;
    }

    .ruler__mark {
      font-family: var(--font-mono);
      font-size: 8px;
      color: var(--text-dim);
      text-align: right;
      line-height: 1;
      opacity: 0.7;
    }

    .gauge-track-wrap { flex: 1; display: flex; }

    .gauge-track {
      flex: 1;
      position: relative;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 6px;
      overflow: hidden;
    }

    /* Caustic shimmer inside the gauge */
    .gauge-track::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 80px 30px at 20% 50%, rgba(0,212,255,0.05) 0%, transparent 70%),
        radial-gradient(ellipse 60px 40px at 75% 30%, rgba(0,180,220,0.04) 0%, transparent 70%);
      pointer-events: none;
      animation: caustic-shift 6s ease-in-out infinite alternate;
    }

    .gauge-water {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 20%;
      background: linear-gradient(180deg, rgba(13,74,122,0.6) 0%, rgba(4,40,80,0.9) 100%);
      transition: height 0.35s cubic-bezier(0.34, 1.1, 0.64, 1);
      z-index: 1;
    }

    .gauge-water__surface {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--foam), var(--foam-dim), transparent);
      animation: surface-shimmer 3s ease-in-out infinite;
      opacity: 0.8;
    }

    @keyframes surface-shimmer {
      0%, 100% { opacity: 0.5; transform: scaleX(0.97); }
      50%       { opacity: 1.0; transform: scaleX(1.0);  }
    }

    .gauge-marker {
      position: absolute;
      left: 0; right: 0;
      top: 80%;
      display: flex;
      align-items: center;
      pointer-events: none;
      transition: top 0.35s cubic-bezier(0.34, 1.1, 0.64, 1);
      z-index: 2;
    }

    .gauge-marker__line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--warn), transparent);
      box-shadow: 0 0 6px var(--warn);
    }

    .gauge-marker__dot {
      position: absolute;
      right: 6px;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--warn);
      box-shadow: 0 0 8px var(--warn);
      animation: pulse-dot 2s ease-in-out infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 4px var(--warn); }
      50%       { box-shadow: 0 0 12px var(--warn), 0 0 20px rgba(240,165,0,0.4); }
    }

    /* Used by per-site override input row */
    .gauge-input {
      width: 52px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 5px;
      color: #00d4ff;
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      padding: 5px 4px;
      text-align: center;
      outline: none;
      -moz-appearance: textfield;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .gauge-input::-webkit-outer-spin-button,
    .gauge-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .gauge-input:focus {
      border-color: #00d4ff;
      box-shadow: 0 0 0 2px rgba(0,212,255,0.15);
    }

    .gauge-input__unit {
      font-family: var(--font-mono);
      font-size: 8px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Text input below gauge */
    .text-input-wrap {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .text-input-wrap label {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
    }

    .text-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0, 212, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 6px;
      color: #c8eaf7;
      font-family: var(--font-ui);
      font-size: 12px;
      padding: 8px 10px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }

    .text-input:focus {
      border-color: #00d4ff;
      background: rgba(0, 212, 255, 0.1);
      box-shadow: 0 0 0 2px rgba(0,212,255,0.15);
    }

    /* Horizontal slider under gauge */
    .depth-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: rgba(0,212,255,0.1);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
      margin-top: 8px;
    }

    .depth-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--accent);
      border: 2px solid var(--deep);
      box-shadow: 0 0 8px rgba(0,212,255,0.5);
      cursor: grab;
      transition: box-shadow 0.15s, transform 0.15s;
    }

    .depth-slider::-webkit-slider-thumb:active {
      cursor: grabbing;
      transform: scale(1.2);
      box-shadow: 0 0 16px rgba(0,212,255,0.7);
    }

    .depth-slider::-moz-range-thumb {
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--accent);
      border: 2px solid var(--deep);
      box-shadow: 0 0 8px rgba(0,212,255,0.5);
      cursor: grab;
    }

    /* ── Divider ─────────────────────────────────────────────────────────── */
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--border), transparent);
    }

    /* ── Settings rows ───────────────────────────────────────────────────── */
    .settings-rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .setting {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .setting__label {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      white-space: nowrap;
    }

    /* Toggle pills */
    .toggle-group { display: flex; gap: 5px; }
    .toggle-pill  { cursor: pointer; }
    .toggle-pill input[type="radio"] { display: none; }

    .toggle-pill span {
      display: block;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 212, 255, 0.2);
      background: rgba(0, 212, 255, 0.08);
      color: rgba(90, 143, 174, 0.8);
      font-size: 11px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .toggle-pill input[type="radio"]:checked + span {
      background: rgba(0, 212, 255, 0.2);
      border-color: #00d4ff;
      color: #c8eaf7;
    }

    .toggle-pill:hover span {
      border-color: rgba(0, 212, 255, 0.25);
      color: #c8eaf7;
    }

    /* Switch */
    .switch { cursor: pointer; display: inline-flex; align-items: center; }
    .switch input { display: none; }

    .switch__track {
      width: 36px; height: 20px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 10px;
      position: relative;
      transition: background 0.2s, border-color 0.2s;
    }

    .switch input:checked + .switch__track {
      background: rgba(0, 212, 255, 0.2);
      border-color: #00d4ff;
      box-shadow: 0 0 8px rgba(0, 212, 255, 0.2);
    }

    .switch__thumb {
      position: absolute;
      top: 2px; left: 2px;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: rgba(90, 143, 174, 0.8);
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), background 0.2s;
    }

    .switch input:checked + .switch__track .switch__thumb {
      transform: translateX(16px);
      background: #00d4ff;
      box-shadow: 0 0 6px #00d4ff;
    }

    /* ── Header controls ───────────────────────────────────────────────── */
    .header__controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* ── Site bar ───────────────────────────────────────────────────────── */
    .site-bar {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: linear-gradient(180deg, rgba(2,18,36,0.8) 0%, rgba(4,22,42,0.5) 100%);
      border-bottom: 1px solid var(--border-dim);
      backdrop-filter: blur(4px);
      transition: opacity 0.3s, filter 0.3s;
    }

    .site-bar__label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.5px;
      color: var(--text-dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Footer: status-only ────────────────────────────────────────────── */
    .footer {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 9px 16px;
      border-top: 1px solid rgba(0, 212, 255, 0.15);
      background: linear-gradient(0deg, rgba(2,10,20,0.95) 0%, rgba(4,22,42,0.8) 100%);
      backdrop-filter: blur(4px);
      min-height: 36px;
    }

    .status {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--foam);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .status.visible { opacity: 1; }

    /* ── Per-site Config  ─────────────────────────────────────────── */
    .site-config {
      margin-top: 4px;
      padding: 12px;
      background: rgba(0, 212, 255, 0.03);
      border: 1px solid rgba(0, 212, 255, 0.1);
      border-radius: 8px;
    }

    .site-config__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .site-config__title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-dim);
    }

    .override-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(0, 212, 255, 0.08);
      margin-top: 8px;
      transition: all 0.3s ease;
    }

    .override-controls.hidden {
      display: none;
    }

    .override-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .override-input-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .manage-link {
      display: block;
      margin-top: 12px;
      font-size: 10px;
      color: var(--accent);
      text-decoration: none;
      text-align: center;
      opacity: 0.7;
      transition: opacity 0.2s;
      cursor: pointer;
    }

    .manage-link:hover {
      opacity: 1;
      text-decoration: underline;
    }

    .overrides-list {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 212, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 150px;
      overflow-y: auto;
    }

    .overrides-list.hidden {
      display: none;
    }

    .override-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      background: rgba(0, 212, 255, 0.05);
      border-radius: 4px;
      font-size: 11px;
    }

    .override-item__host {
      color: #c8eaf7;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      margin-right: 8px;
    }

    .override-item__value {
      font-family: var(--font-mono);
      color: var(--accent);
      margin-right: 8px;
    }

    .override-item__remove {
      background: none;
      border: none;
      color: var(--warn);
      cursor: pointer;
      font-size: 12px;
      padding: 0 4px;
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .override-item__remove:hover {
      opacity: 1;
    }

    .no-overrides {
      font-size: 10px;
      color: var(--text-dim);
      text-align: center;
      padding: 10px;
      font-style: italic;
    }

  `;

  shadow.appendChild(style);

  // ── Build DOM ─────────────────────────────────────────────────────────────
  function el(tag, cls, attrs = {}) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  function svgEl(tag, attrs = {}) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // Shell
  const shell = el("div", "shell");

  // Ocean layers
  const caustics1 = el("div", "caustics");
  const caustics2 = el("div", "caustics caustics--2");
  const bubblesEl = el("div", "bubbles");
  shell.append(caustics1, caustics2, bubblesEl);

  // ── Header ────────────────────────────────────────────────────────────────
  const header = el("header", "header");

  const logo = el("div", "logo");
  const logoIcon = el("div", "logo__icon");
  const svg = svgEl("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none" });
  [
    { points: "3,3 8,7 13,3", opacity: "1" },
    { points: "3,7 8,11 13,7", opacity: "0.55" },
    { points: "3,11 8,15 13,11", opacity: "0.2" }
  ].forEach(p => {
    svg.appendChild(svgEl("polyline", {
      points: p.points, stroke: "#00d4ff", "stroke-width": "1.8",
      "stroke-linecap": "round", "stroke-linejoin": "round", opacity: p.opacity
    }));
  });
  logoIcon.appendChild(svg);
  const logoTitles = el("div");
  const logoName = el("h1", "logo__name");
  logoName.textContent = msg("extensionName");
  const logoTagline = el("p", "logo__tagline");
  logoTagline.textContent = msg("logoTagline");
  logoTitles.append(logoName, logoTagline);
  logo.append(logoIcon, logoTitles);

  const badge = el("div", "depth-badge");
  const badgeValueInput = el("input", "depth-badge__input", {
    type: "number", id: "thresholdValue",
    min: "7", max: "14", step: "0.5", value: "7",
    "aria-label": msg("ariaThresholdValue"),
  });
  const badgeUnit = el("span", "depth-badge__unit");
  badgeUnit.textContent = getUnitScreensMsg(DEFAULTS.threshold);
  badge.append(badgeValueInput, badgeUnit);

  // Header fully assembled after toggle creation below

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = el("main", "body");

  // Gauge
  const gaugeSection = el("div", "gauge-section");

  const gaugeLabel = el("div", "gauge-label");
  const gaugeLabelText = el("span", "gauge-label__text");
  gaugeLabelText.textContent = msg("depthThreshold");
  const gaugeLabelHint = el("span", "gauge-label__hint");
  gaugeLabelHint.textContent = msg("depthThresholdHint");
  gaugeLabel.append(gaugeLabelText, gaugeLabelHint);

  const gaugeWrap = el("div", "gauge-wrap");

  const ruler = el("div", "ruler");
  ["7", "9", "11", "13", "14"].forEach(n => {
    const m = el("span", "ruler__mark");
    m.textContent = n;
    ruler.appendChild(m);
  });

  const gaugeTrackWrap = el("div", "gauge-track-wrap");
  const gaugeTrack = el("div", "gauge-track");
  const gaugeWater = el("div", "gauge-water");
  const gaugeWaterSurface = el("div", "gauge-water__surface");
  gaugeWater.appendChild(gaugeWaterSurface);
  const gaugeMarker = el("div", "gauge-marker");
  const gaugeMarkerLine = el("span", "gauge-marker__line");
  const gaugeMarkerDot = el("span", "gauge-marker__dot");
  gaugeMarker.append(gaugeMarkerLine, gaugeMarkerDot);
  gaugeTrack.append(gaugeWater, gaugeMarker);
  gaugeTrackWrap.appendChild(gaugeTrack);

  const rulerSpacer = el("div", "ruler-spacer");

  gaugeWrap.append(ruler, gaugeTrackWrap, rulerSpacer);

  const slider = el("input", "depth-slider", {
    type: "range", id: "threshold",
    min: "7", max: "14", step: "0.5", value: "7",
    "aria-label": msg("ariaThresholdSlider"),
  });

  const textInputWrap = el("div", "text-input-wrap");
  const textInputLabel = el("label");
  textInputLabel.textContent = msg("notificationTextLabel");
  textInputLabel.htmlFor = "notificationText";
  const textInput = el("input", "text-input", {
    type: "text",
    id: "notificationText",
    placeholder: DEFAULTS.text
  });
  textInputWrap.append(textInputLabel, textInput);

  gaugeSection.append(gaugeLabel, gaugeWrap, slider, textInputWrap);

  // ── Per-site configuration ──────────────────────────────────────────
  const siteConfig = el("section", "site-config");

  const siteConfigHeader = el("div", "site-config__header");
  const siteConfigTitle = el("h2", "site-config__title");
  siteConfigTitle.textContent = msg("siteSettings");

  const overrideSwitchWrap = el("label", "switch");
  const overrideCheckbox = el("input", null, { type: "checkbox", id: "siteOverrideEnabled" });
  const overrideSwitchTrack = el("span", "switch__track");
  const overrideSwitchThumb = el("span", "switch__thumb");
  overrideSwitchTrack.appendChild(overrideSwitchThumb);
  overrideSwitchWrap.append(overrideCheckbox, overrideSwitchTrack);

  siteConfigHeader.append(siteConfigTitle, overrideSwitchWrap);

  const overrideControls = el("div", "override-controls hidden");
  const overrideRow = el("div", "override-row");
  const overrideLabel = el("span", "setting__label");
  overrideLabel.textContent = msg("siteOverride");

  const overrideInputWrap = el("div", "override-input-wrap");
  const overrideInput = el("input", "gauge-input", {
    type: "number", id: "siteThresholdValue",
    min: "7", max: "14", step: "0.5", value: "7"
  });
  const overrideUnit = el("span", "gauge-input__unit");
  overrideUnit.textContent = getUnitScreensMsg(7);
  overrideInputWrap.append(overrideInput, overrideUnit);

  overrideRow.append(overrideLabel, overrideInputWrap);
  overrideControls.append(overrideRow);

  const manageLink = el("a", "manage-link");
  manageLink.textContent = msg("manageSites");

  const overridesList = el("div", "overrides-list hidden");

  siteConfig.append(siteConfigHeader, overrideControls, manageLink, overridesList);

  // ── Global toggle (header right side) ─────────────────────────────────────
  const headerControls = el("div", "header__controls");
  const switchWrap = el("label", "switch");
  const enabledCheckbox = el("input", null, {
    type: "checkbox", id: "enabled",
    "aria-label": msg("ariaToggleGlobal"),
  });
  enabledCheckbox.checked = true;
  const switchTrack = el("span", "switch__track");
  const switchThumb = el("span", "switch__thumb");
  switchTrack.appendChild(switchThumb);
  switchWrap.append(enabledCheckbox, switchTrack);
  headerControls.append(badge, switchWrap);
  header.append(logo, headerControls);

  // ── Site toggle bar (below header) ────────────────────────────────────────
  const siteBar = el("div", "site-bar");
  const siteLabel = el("span", "site-bar__label");
  siteLabel.textContent = msg("enabledOnSite");
  const siteSwitchWrap = el("label", "switch");
  const siteCheckbox = el("input", null, { type: "checkbox", id: "siteEnabled" });
  siteCheckbox.checked = true;
  const siteSwitchTrack = el("span", "switch__track");
  const siteSwitchThumb = el("span", "switch__thumb");
  siteSwitchTrack.appendChild(siteSwitchThumb);
  siteSwitchWrap.append(siteCheckbox, siteSwitchTrack);
  siteBar.append(siteLabel, siteSwitchWrap);

  body.append(gaugeSection, siteConfig);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = el("footer", "footer");
  const statusEl = el("span", "status");
  statusEl.setAttribute("aria-live", "polite");
  footer.append(statusEl);

  shell.append(header, siteBar, body, footer);
  shadow.appendChild(shell);

  // ── Refs to interactive elements ──────────────────────────────────────────
  const badgeInput = shadow.getElementById("thresholdValue");

  // ── Gauge update ──────────────────────────────────────────────────────────
  function updateGauge(value) {
    const min = 7, max = 14;
    const bounded = Math.max(min, Math.min(max, value));
    const pct = (bounded - min) / (max - min);

    gaugeMarker.style.top = `${5 + pct * 85}%`;
    gaugeWater.style.height = `${5 + pct * 88}%`;
    badgeInput.value = value;

    const unitText = getUnitScreensMsg(value);
    badgeUnit.textContent = unitText;

    // Glow intensity scales with depth
    const g = Math.round(pct * 20 + 4);
    const glowAlpha = (0.4 + pct * 0.5).toFixed(2);
    badgeInput.style.textShadow = `0 0 ${g}px rgba(0,212,255,${glowAlpha})`;

    // Slider fill
    const fillPct = pct * 100;
    slider.style.background = `linear-gradient(to right, var(--accent) ${fillPct}%, rgba(0,212,255,0.1) ${fillPct}%)`;
  }

  // ── Bubble spawner ────────────────────────────────────────────────────────
  function spawnBubbles() {
    for (let i = 0; i < 12; i++) {
      const b = el("div", "bubble");
      const size = 3 + Math.random() * 8;
      const left = 10 + Math.random() * 80;
      const delay = Math.random() * 10;
      const dur = 6 + Math.random() * 8;
      const drift = (Math.random() - 0.5) * 30;
      b.style.cssText = `
        width:${size}px; height:${size}px;
        left:${left}%;
        animation-duration:${dur}s;
        animation-delay:-${delay}s;
        --drift:${drift}px;
      `;
      bubblesEl.appendChild(b);
    }
  }

  // ── Globals for active tab ────────────────────────────────────────────────
  let activeHostname = "";

  // ── Load settings ─────────────────────────────────────────────────────────
  async function init() {
    // 1. Get current tab hostname
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        activeHostname = new URL(tabs[0].url).hostname;
      }
    } catch (e) { /* default to empty string */ }

    // 2. Load settings
    const result = await browser.storage.local.get(Object.values(KEYS));
    const threshold = result[KEYS.threshold] ?? DEFAULTS.threshold;
    const enabled = result[KEYS.enabled] ?? DEFAULTS.enabled;
    const disabledDomains = result[KEYS.disabledDomains] ?? DEFAULTS.disabledDomains;
    const text = result[KEYS.text] ?? DEFAULTS.text;
    const siteOverrides = result[KEYS.siteOverrides] ?? {};

    slider.value = threshold;
    badgeInput.value = threshold;
    textInput.value = text;
    enabledCheckbox.checked = enabled;

    if (activeHostname) {
      siteLabel.textContent = msg("enabledOnHost", activeHostname);
      siteCheckbox.checked = !disabledDomains.includes(activeHostname);

      const siteThreshold = siteOverrides[activeHostname];
      if (siteThreshold !== undefined) {
        overrideCheckbox.checked = true;
        overrideInput.value = siteThreshold;
        overrideUnit.textContent = getUnitScreensMsg(siteThreshold);
        overrideControls.classList.remove("hidden");
      }
    } else {
      siteLabel.textContent = msg("enabledOnSite");
      siteCheckbox.disabled = true;
      overrideCheckbox.disabled = true;
    }

    // Sync global dim state
    syncGlobalState();

    updateGauge(threshold);
    renderOverridesList(siteOverrides);
  }

  // ── Shared: notify content script of current state ────────────────────────
  async function notifyContentScript() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        const result = await browser.storage.local.get([
          KEYS.threshold, KEYS.enabled, KEYS.disabledDomains, KEYS.text, KEYS.siteOverrides,
        ]);
        browser.tabs.sendMessage(tabs[0].id, {
          type: "SET_THRESHOLD",
          value: result[KEYS.threshold] ?? DEFAULTS.threshold,
          enabled: result[KEYS.enabled] ?? DEFAULTS.enabled,
          disabledDomains: result[KEYS.disabledDomains] ?? DEFAULTS.disabledDomains,
          text: result[KEYS.text] ?? DEFAULTS.text,
          siteOverrides: result[KEYS.siteOverrides] ?? {},
        }).catch(() => { });
      }
    } catch (e) { /* popup may close before this completes */ }
  }

  // ── Visual + auto-save: global toggle ─────────────────────────────────────
  function syncGlobalState() {
    const off = !enabledCheckbox.checked;
    body.style.opacity = off ? "0.35" : "1";
    body.style.pointerEvents = off ? "none" : "auto";
    body.style.filter = off ? "grayscale(0.4)" : "none";
    body.style.transition = "opacity 0.3s, filter 0.3s";
    siteBar.style.opacity = off ? "0.35" : "1";
    siteBar.style.pointerEvents = off ? "none" : "auto";
    siteBar.style.filter = off ? "grayscale(0.4)" : "none";
    siteBar.style.transition = "opacity 0.3s, filter 0.3s";
  }

  enabledCheckbox.addEventListener("change", async () => {
    syncGlobalState();
    await browser.storage.local.set({ [KEYS.enabled]: enabledCheckbox.checked });
    notifyContentScript();
    showStatus(enabledCheckbox.checked ? msg("statusEnabled") : msg("statusDisabled"));
  });

  // ── Auto-save: per-site toggle ────────────────────────────────────────────
  siteCheckbox.addEventListener("change", async () => {
    if (!activeHostname) return;
    const result = await browser.storage.local.get(KEYS.disabledDomains);
    let domains = result[KEYS.disabledDomains] ?? DEFAULTS.disabledDomains;
    if (siteCheckbox.checked) {
      domains = domains.filter(d => d !== activeHostname);
    } else if (!domains.includes(activeHostname)) {
      domains.push(activeHostname);
    }
    await browser.storage.local.set({ [KEYS.disabledDomains]: domains });
    notifyContentScript();
    showStatus(siteCheckbox.checked ? msg("statusEnabledOnHost", activeHostname) : msg("statusDisabledOnHost", activeHostname));
  });

  // ── Per-site override logic  ─────────────────────────────────────────
  async function saveSiteOverride() {
    if (!activeHostname) return;
    const result = await browser.storage.local.get(KEYS.siteOverrides);
    const overrides = result[KEYS.siteOverrides] ?? {};

    if (overrideCheckbox.checked) {
      const val = Number(overrideInput.value) || DEFAULTS.threshold;
      overrides[activeHostname] = val;
    } else {
      delete overrides[activeHostname];
    }

    await browser.storage.local.set({ [KEYS.siteOverrides]: overrides });
    notifyContentScript();
    renderOverridesList(overrides);
  }

  overrideCheckbox.addEventListener("change", async () => {
    if (overrideCheckbox.checked) {
      overrideControls.classList.remove("hidden");
      showStatus(msg("statusOverrideEnabled", activeHostname));
    } else {
      overrideControls.classList.add("hidden");
      showStatus(msg("statusOverrideDisabled", activeHostname));
    }
    await saveSiteOverride();
  });

  overrideInput.addEventListener("input", () => {
    const val = Number(overrideInput.value);
    overrideUnit.textContent = getUnitScreensMsg(val);
    debouncedSaveSiteOverride();
  });

  const debouncedSaveSiteOverride = debounce(saveSiteOverride, 600);

  // Management list
  manageLink.addEventListener("click", (e) => {
    e.preventDefault();
    overridesList.classList.toggle("hidden");
  });

  async function renderOverridesList(overrides) {
    overridesList.textContent = "";
    const hosts = Object.keys(overrides);

    if (hosts.length === 0) {
      const empty = el("div", "no-overrides");
      empty.textContent = msg("noOverrides");
      overridesList.appendChild(empty);
      return;
    }

    hosts.forEach(host => {
      const item = el("div", "override-item");

      const hostSpan = el("span", "override-item__host");
      hostSpan.textContent = host;

      const valSpan = el("span", "override-item__value");
      valSpan.textContent = `${overrides[host]} ${getUnitScreensMsg(overrides[host])}`;

      const removeBtn = el("button", "override-item__remove");
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", async () => {
        const result = await browser.storage.local.get(KEYS.siteOverrides);
        const current = result[KEYS.siteOverrides] ?? {};
        delete current[host];
        await browser.storage.local.set({ [KEYS.siteOverrides]: current });

        if (host === activeHostname) {
          overrideCheckbox.checked = false;
          overrideControls.classList.add("hidden");
        }

        notifyContentScript();
        renderOverridesList(current);
        showStatus(msg("statusOverrideRemoved", host));
      });

      item.append(hostSpan, valSpan, removeBtn);
      overridesList.appendChild(item);
    });
  }

  init();

  // ── Debounce helper ─────────────────────────────────────────────────────
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ── Auto-save: threshold ──────────────────────────────────────────────────
  async function saveThreshold() {
    const val = Number(badgeInput.value) || DEFAULTS.threshold;
    // Normalise the displayed value too
    badgeInput.value = val;
    slider.value = val;
    updateGauge(val);
    try {
      await browser.storage.local.set({ [KEYS.threshold]: val });
      notifyContentScript();
      showStatus(msg("statusAutoSaved"));
    } catch (e) {
      showStatus(msg("statusError"));
    }
  }

  const debouncedSaveThreshold = debounce(saveThreshold, 600);

  // Sync: slider → gauge + badge, then debounced save
  slider.addEventListener("input", () => {
    const val = Number(slider.value);
    badgeInput.value = val;
    updateGauge(val);
    debouncedSaveThreshold();
  });

  // Sync: badge input → gauge + slider, then debounced save
  badgeInput.addEventListener("input", () => {
    const val = Number(badgeInput.value);
    slider.value = val;
    updateGauge(val);
    debouncedSaveThreshold();
  });

  // Save immediately on blur (user tabbed/clicked away)
  badgeInput.addEventListener("blur", () => saveThreshold());

  // ── Auto-save: notification text ────────────────────────────────────────────
  async function saveText() {
    const text = textInput.value.trim() || DEFAULTS.text;
    try {
      await browser.storage.local.set({ [KEYS.text]: text });
      notifyContentScript();
      showStatus(msg("statusAutoSaved"));
    } catch (e) {
      showStatus(msg("statusError"));
    }
  }

  const debouncedSaveText = debounce(saveText, 800);

  textInput.addEventListener("input", () => debouncedSaveText());
  textInput.addEventListener("blur", () => saveText());

  // ── Status ────────────────────────────────────────────────────────────────
  let statusTimer = null;

  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.add("visible");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusEl.classList.remove("visible"), 2200);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  spawnBubbles();
  updateGauge(DEFAULTS.threshold);

})();