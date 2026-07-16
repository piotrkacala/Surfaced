(function initializeSurfacedSettingsImport(root, factory) {
  const api = factory(root.SurfacedSettings);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SurfacedSettingsImport = api;

  if (typeof document !== "undefined") {
    const mount = () => api.mountSettingsImportPage();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (settingsApi) => {
  "use strict";

  const VALUE_ERROR_CODES = new Set([
    "IMPORT_THRESHOLD_INVALID",
    "IMPORT_TEXT_INVALID",
    "IMPORT_ENABLED_INVALID",
    "IMPORT_DISABLED_DOMAINS_INVALID",
    "IMPORT_OVERRIDES_INVALID",
    "IMPORT_OVERRIDE_INVALID",
  ]);

  function createError(code, cause) {
    const error = new Error(code, cause ? { cause } : undefined);
    error.code = code;
    return error;
  }

  function importErrorMessageKey(error) {
    const code = error?.code || error?.message || "IMPORT_UNKNOWN";

    if (code === "IMPORT_FILE_TOO_LARGE") return "settingsImportErrorTooLarge";
    if (code === "IMPORT_JSON_INVALID") return "settingsImportErrorJson";
    if (code === "IMPORT_VERSION_UNSUPPORTED") return "settingsImportErrorVersion";
    if (code === "IMPORT_HOSTNAME_INVALID") return "settingsImportErrorHostname";
    if (code === "IMPORT_HOSTNAME_DUPLICATE") return "settingsImportErrorDuplicateHost";
    if (VALUE_ERROR_CODES.has(code)) return "settingsImportErrorValues";
    if (["STORAGE_WRITE_FAILED", "SETTINGS_REPLACE_PENDING"].includes(code)) {
      return "settingsImportErrorWrite";
    }
    if (code === "IMPORT_FILE_READ_FAILED") return "settingsImportErrorRead";
    return "settingsImportErrorStructure";
  }

  async function readSettingsFile(file) {
    if (file.size > settingsApi.SETTINGS_IMPORT_MAX_BYTES) {
      throw createError("IMPORT_FILE_TOO_LARGE");
    }

    let text;
    try {
      text = await file.text();
    } catch (error) {
      throw createError("IMPORT_FILE_READ_FAILED", error);
    }

    return settingsApi.parseSettingsImport(text, { byteLength: file.size });
  }

  function mountSettingsImportPage({
    browserApi = globalThis.browser,
    documentApi = globalThis.document,
  } = {}) {
    const root = documentApi?.getElementById("settingsImportRoot");
    if (!root || root.dataset.mounted === "true") {
      return null;
    }

    root.dataset.mounted = "true";
    const msg = (key, ...substitutions) => browserApi.i18n.getMessage(key, substitutions);
    const uiLanguage = browserApi.i18n.getUILanguage();
    if (uiLanguage) documentApi.documentElement.lang = uiLanguage;
    documentApi.title = `${msg("settingsImportPageTitle")} · ${msg("extensionName")}`;

    root.innerHTML = `
      <main class="import-page">
        <div class="bubbles" aria-hidden="true"></div>
        <article class="import-card">
          <header class="brand">
            <span class="brand__mark" aria-hidden="true">◡</span>
            <span id="extensionName" class="brand__name"></span>
          </header>
          <input id="settingsImportFile" class="visually-hidden" type="file" accept=".json,application/json" tabindex="-1" />

          <section id="importStart" class="state-panel">
            <p id="importEyebrow" class="eyebrow"></p>
            <h1 id="importTitle" tabindex="-1"></h1>
            <p id="importDescription" class="lead"></p>
            <div class="notice-list">
              <p id="replaceNotice" class="notice"></p>
              <p id="pauseNotice" class="notice notice--quiet"></p>
            </div>
            <div class="file-control">
              <label id="chooseFileLabel" class="button button--primary" for="settingsImportFile" role="button" tabindex="0"></label>
              <p id="acceptedFormat" class="file-control__hint"></p>
            </div>
          </section>

          <p id="importError" class="message message--error" role="alert" aria-live="assertive" tabindex="-1" hidden></p>

          <section id="importPreview" class="state-panel preview" aria-labelledby="previewTitle" hidden>
            <p id="previewEyebrow" class="eyebrow"></p>
            <h2 id="previewTitle" tabindex="-1"></h2>
            <dl class="preview__summary">
              <div><dt id="previewThresholdLabel"></dt><dd id="previewThreshold"></dd></div>
              <div><dt id="previewTextLabel"></dt><dd id="previewText"></dd></div>
              <div><dt id="previewEnabledLabel"></dt><dd id="previewEnabled"></dd></div>
              <div><dt id="previewDisabledLabel"></dt><dd id="previewDisabled"></dd></div>
              <div><dt id="previewOverridesLabel"></dt><dd id="previewOverrides"></dd></div>
            </dl>
            <div class="actions">
              <button id="replaceSettings" class="button button--primary" type="button"></button>
              <button id="cancelImport" class="button" type="button"></button>
              <label id="chooseOtherFileLabel" class="button" for="settingsImportFile" role="button" tabindex="0"></label>
            </div>
          </section>

          <section id="importSuccess" class="state-panel success" hidden>
            <div class="success__message" role="status" aria-live="polite">
              <p id="successEyebrow" class="eyebrow"></p>
              <h2 id="successTitle" tabindex="-1"></h2>
              <p id="successDescription" class="lead"></p>
            </div>
            <div class="actions">
              <button id="closeTab" class="button button--primary" type="button"></button>
              <button id="importAnother" class="button" type="button"></button>
            </div>
          </section>
        </article>
      </main>`;

    const byId = (id) => documentApi.getElementById(id);
    const copy = {
      extensionName: "extensionName",
      importEyebrow: "settingsBackupTitle",
      importTitle: "settingsImportPageTitle",
      importDescription: "settingsImportPageDescription",
      replaceNotice: "settingsImportReplaceNotice",
      pauseNotice: "settingsImportPauseNotice",
      chooseFileLabel: "settingsImportChooseFileAction",
      acceptedFormat: "settingsImportAcceptedFormat",
      previewEyebrow: "settingsImportPreviewEyebrow",
      previewTitle: "settingsImportPreviewTitle",
      previewThresholdLabel: "settingsImportPreviewThreshold",
      previewTextLabel: "settingsImportPreviewText",
      previewEnabledLabel: "settingsImportPreviewEnabled",
      previewDisabledLabel: "settingsImportPreviewDisabledDomains",
      previewOverridesLabel: "settingsImportPreviewOverrides",
      replaceSettings: "settingsImportReplaceAction",
      cancelImport: "settingsImportCancelAction",
      chooseOtherFileLabel: "settingsImportChooseOtherAction",
      successEyebrow: "settingsImportSuccessEyebrow",
      successTitle: "settingsImportSuccess",
      successDescription: "settingsImportSuccessDescription",
      closeTab: "settingsImportCloseTabAction",
      importAnother: "settingsImportAnotherAction",
    };
    Object.entries(copy).forEach(([id, key]) => {
      byId(id).textContent = msg(key);
    });

    const fileInput = byId("settingsImportFile");
    const start = byId("importStart");
    const preview = byId("importPreview");
    const success = byId("importSuccess");
    const errorMessage = byId("importError");
    const replaceButton = byId("replaceSettings");
    const cancelButton = byId("cancelImport");
    const closeTabButton = byId("closeTab");
    const importAnotherButton = byId("importAnother");
    const chooseFileLabel = byId("chooseFileLabel");
    const chooseOtherFileLabel = byId("chooseOtherFileLabel");
    const previewTitle = byId("previewTitle");
    const successTitle = byId("successTitle");

    fileInput.setAttribute("aria-label", msg("ariaImportSettingsFile"));
    replaceButton.setAttribute("aria-label", msg("ariaReplaceSettings"));
    cancelButton.setAttribute("aria-label", msg("ariaCancelSettingsImport"));
    closeTabButton.setAttribute("aria-label", msg("ariaCloseSettingsImportTab"));
    importAnotherButton.setAttribute("aria-label", msg("ariaImportAnotherSettingsFile"));

    const pluralRules = new Intl.PluralRules(uiLanguage);
    const numberFormatter = new Intl.NumberFormat(uiLanguage, { maximumFractionDigits: 2 });
    let pendingSettings = null;
    let readRevision = 0;
    let writePending = false;

    function unitFor(value) {
      const form = pluralRules.select(value);
      const suffix = form.charAt(0).toUpperCase() + form.slice(1);
      return msg(`unitScreens${suffix}`) || msg("unitScreensOther");
    }

    function clearError() {
      errorMessage.hidden = true;
      errorMessage.textContent = "";
    }

    function showError(error, { focus = true } = {}) {
      errorMessage.textContent = msg(importErrorMessageKey(error));
      errorMessage.hidden = false;
      if (focus) errorMessage.focus();
    }

    function showStart({ focus = true } = {}) {
      readRevision += 1;
      pendingSettings = null;
      fileInput.value = "";
      preview.hidden = true;
      success.hidden = true;
      start.hidden = false;
      clearError();
      if (focus) chooseFileLabel.focus();
    }

    function activateFileLabelWithKeyboard(event) {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      fileInput.value = "";
      fileInput.click();
    }

    chooseFileLabel.addEventListener("keydown", activateFileLabelWithKeyboard);
    chooseOtherFileLabel.addEventListener("keydown", activateFileLabelWithKeyboard);

    function renderPreview(settings) {
      byId("previewThreshold").textContent = `${numberFormatter.format(settings[settingsApi.KEYS.threshold])} ${unitFor(settings[settingsApi.KEYS.threshold])}`;
      byId("previewText").textContent = settings[settingsApi.KEYS.text];
      byId("previewEnabled").textContent = msg(
        settings[settingsApi.KEYS.enabled] ? "settingsImportStateEnabled" : "settingsImportStateDisabled"
      );
      byId("previewDisabled").textContent = String(settings[settingsApi.KEYS.disabledDomains].length);
      byId("previewOverrides").textContent = String(Object.keys(settings[settingsApi.KEYS.siteOverrides]).length);
      start.hidden = true;
      success.hidden = true;
      preview.hidden = false;
      clearError();
      previewTitle.focus();
    }

    fileInput.addEventListener("click", () => {
      fileInput.value = "";
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const revision = ++readRevision;
      pendingSettings = null;
      preview.hidden = true;
      start.hidden = false;
      clearError();

      try {
        const parsed = await readSettingsFile(file);
        if (revision !== readRevision) return;
        pendingSettings = parsed.settings;
        renderPreview(parsed.settings);
      } catch (error) {
        if (revision === readRevision) showError(error);
      } finally {
        if (revision === readRevision) fileInput.value = "";
      }
    });

    cancelButton.addEventListener("click", () => showStart());

    replaceButton.addEventListener("click", async () => {
      if (!pendingSettings || writePending) return;

      writePending = true;
      replaceButton.disabled = true;
      replaceButton.setAttribute("aria-busy", "true");
      preview.setAttribute("aria-busy", "true");
      clearError();
      let restoreConfirmFocus = false;

      try {
        const response = await browserApi.runtime.sendMessage({
          type: settingsApi.MESSAGE_TYPES.replace,
          settings: pendingSettings,
        });
        if (!response?.ok) throw createError(response?.error || "STORAGE_WRITE_FAILED");

        pendingSettings = null;
        preview.hidden = true;
        start.hidden = true;
        success.hidden = false;
        successTitle.focus();
      } catch (error) {
        showError(error, { focus: false });
        restoreConfirmFocus = true;
      } finally {
        writePending = false;
        replaceButton.disabled = false;
        replaceButton.removeAttribute("aria-busy");
        preview.removeAttribute("aria-busy");
        if (restoreConfirmFocus) replaceButton.focus();
      }
    });

    importAnotherButton.addEventListener("click", () => showStart());

    closeTabButton.addEventListener("click", async () => {
      clearError();
      try {
        const tab = await browserApi.tabs.getCurrent();
        if (!Number.isInteger(tab?.id)) throw createError("IMPORT_TAB_UNAVAILABLE");
        await browserApi.tabs.remove(tab.id);
      } catch (error) {
        errorMessage.textContent = msg("settingsImportCloseTabError");
        errorMessage.hidden = false;
        closeTabButton.focus();
      }
    });

    return {
      showStart,
      getPendingSettings: () => pendingSettings,
    };
  }

  return {
    importErrorMessageKey,
    mountSettingsImportPage,
    readSettingsFile,
  };
});
