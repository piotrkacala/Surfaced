"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const settings = require("../shared/settings.js");
const settingsImportPage = require("../shared/settings-import/settings-import.js");

const importedSettings = {
  [settings.KEYS.threshold]: 20.5,
  [settings.KEYS.text]: "Imported local reminder",
  [settings.KEYS.enabled]: false,
  [settings.KEYS.disabledDomains]: ["quiet.example"],
  [settings.KEYS.siteOverrides]: { "deep.example": 12 },
};

function envelope(overrides = {}) {
  return {
    format: settings.SETTINGS_EXPORT_FORMAT,
    formatVersion: settings.SETTINGS_EXPORT_FORMAT_VERSION,
    exportedAt: "2026-07-16T12:00:00.000Z",
    settings: importedSettings,
    ...overrides,
  };
}

test("persistent import page parses a valid file through the shared validator", async () => {
  const source = JSON.stringify(envelope());
  const parsed = await settingsImportPage.readSettingsFile({
    size: Buffer.byteLength(source),
    async text() { return source; },
  });

  assert.deepEqual(parsed.settings, importedSettings);
});

test("persistent import page rejects an oversized file before reading it", async () => {
  let reads = 0;
  await assert.rejects(
    settingsImportPage.readSettingsFile({
      size: settings.SETTINGS_IMPORT_MAX_BYTES + 1,
      async text() {
        reads += 1;
        return JSON.stringify(envelope());
      },
    }),
    (error) => error?.code === "IMPORT_FILE_TOO_LARGE"
  );
  assert.equal(reads, 0);
});

test("persistent import page translates file read and validation failures to localized message keys", async () => {
  await assert.rejects(
    settingsImportPage.readSettingsFile({
      size: 20,
      async text() { throw new Error("read failed"); },
    }),
    (error) => error?.code === "IMPORT_FILE_READ_FAILED"
  );

  assert.equal(settingsImportPage.importErrorMessageKey({ code: "IMPORT_JSON_INVALID" }), "settingsImportErrorJson");
  assert.equal(settingsImportPage.importErrorMessageKey({ code: "IMPORT_HOSTNAME_DUPLICATE" }), "settingsImportErrorDuplicateHost");
  assert.equal(settingsImportPage.importErrorMessageKey({ code: "IMPORT_THRESHOLD_INVALID" }), "settingsImportErrorValues");
  assert.equal(settingsImportPage.importErrorMessageKey({ code: "STORAGE_WRITE_FAILED" }), "settingsImportErrorWrite");
  assert.equal(settingsImportPage.importErrorMessageKey({ code: "IMPORT_ENVELOPE_INVALID" }), "settingsImportErrorStructure");
});

test("popup import action uses explicit new-tab and same-tab platform modes", async () => {
  const popupModule = await import(pathToFileURL(path.resolve(__dirname, "../shared/popup/popup-core.mjs")).href);
  const created = [];
  const assigned = [];
  const browserApi = {
    runtime: { getURL: (value) => `moz-extension://surfaced/${value}` },
    tabs: { async create(details) { created.push(details); return { id: 3 }; } },
  };

  await popupModule.openSettingsImportPage({ mode: "new-tab", browserApi });
  await popupModule.openSettingsImportPage({
    mode: "same-tab",
    browserApi,
    locationApi: { assign(url) { assigned.push(url); } },
  });

  assert.deepEqual(created, [{
    url: "moz-extension://surfaced/settings-import/index.html",
    active: true,
  }]);
  assert.deepEqual(assigned, ["moz-extension://surfaced/settings-import/index.html"]);
});

test("popup no longer contains an active file picker or import processing state", () => {
  const popupSource = fs.readFileSync(path.resolve(__dirname, "../shared/popup/popup-core.mjs"), "utf8");
  assert.doesNotMatch(popupSource, /type:\s*["']file["']/);
  assert.doesNotMatch(popupSource, /pendingImportedSettings|parseSettingsImport|SETTINGS_IMPORT_MAX_BYTES/);
  assert.match(popupSource, /settingsImportPageOpenError/);
});
