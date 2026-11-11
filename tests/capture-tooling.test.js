"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(repoRoot, relativePath)).href);
}

test("capture messages are derived directly from the canonical English locale", async () => {
  const canonical = JSON.parse(fs.readFileSync(
    path.join(repoRoot, "shared/_locales/en/messages.json"),
    "utf8"
  ));
  const { EN_MESSAGES } = await importModule("tools/capture/shared/en-messages.mjs");

  assert.deepEqual(
    EN_MESSAGES,
    Object.fromEntries(Object.entries(canonical).map(([key, entry]) => [key, entry.message]))
  );
});

test("all shipped locales have canonical key and placeholder parity", () => {
  const locales = ["en", "pl", "fr"].map((locale) => JSON.parse(fs.readFileSync(
    path.join(repoRoot, `shared/_locales/${locale}/messages.json`),
    "utf8"
  )));
  const [canonical, ...translations] = locales;
  const canonicalKeys = Object.keys(canonical).sort();

  translations.forEach((locale) => {
    assert.deepEqual(Object.keys(locale).sort(), canonicalKeys);
    canonicalKeys.forEach((key) => {
      assert.deepEqual(
        Object.fromEntries(Object.entries(locale[key].placeholders || {}).map(([name, value]) => [name, value.content])),
        Object.fromEntries(Object.entries(canonical[key].placeholders || {}).map(([name, value]) => [name, value.content])),
        `${key}: placeholder parity`
      );
    });
  });

  locales.forEach((locale) => {
    canonicalKeys.forEach((key) => {
      assert.equal(typeof locale[key].message, "string", `${key}: message must be a string`);
      assert.notEqual(locale[key].message.trim(), "", `${key}: message must not be empty`);
    });
  });
});

test("the manifest description fits the Chrome Web Store summary limit in every locale", () => {
  // Chrome Web Store shows the manifest description as the listing summary
  // and accepts at most 132 characters.
  for (const locale of ["en", "pl", "fr"]) {
    const { extensionDescription } = JSON.parse(fs.readFileSync(
      path.join(repoRoot, `shared/_locales/${locale}/messages.json`),
      "utf8"
    ));
    const length = [...extensionDescription.message].length;
    assert.ok(length <= 132, `${locale}: description is ${length} characters`);
  }
});

test("every literal runtime and manifest localization reference exists in every locale", () => {
  const localeData = ["en", "pl", "fr"].map((locale) => JSON.parse(fs.readFileSync(
    path.join(repoRoot, `shared/_locales/${locale}/messages.json`),
    "utf8"
  )));
  const sourceFiles = [
    "shared/content.js",
    "shared/popup/popup-core.mjs",
    "shared/settings-import/settings-import.js",
    "android/manifest.json",
    "desktop/manifest.json",
    "chrome/manifest.json",
  ];
  const references = new Set();

  sourceFiles.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    for (const match of source.matchAll(/(?:getMessage|msg)\(\s*["']([A-Za-z0-9]+)["'](?!\s*\+)/g)) {
      references.add(match[1]);
    }
    for (const match of source.matchAll(/__MSG_([A-Za-z0-9]+)__/g)) {
      references.add(match[1]);
    }
  });

  for (const reference of references) {
    localeData.forEach((locale) => assert.ok(locale[reference], `missing locale key: ${reference}`));
  }
});

test("capture tooling resolves French and Polish browser locales with English fallback", async () => {
  const { EN_MESSAGES, getMessages } = await importModule("tools/capture/shared/en-messages.mjs");
  assert.equal(getMessages("fr-FR").settingsExportAction, "Exporter les paramètres");
  assert.equal(getMessages("pl-PL").settingsExportAction, "Eksportuj ustawienia");
  assert.equal(getMessages("de-DE"), EN_MESSAGES);
});

test("capture asNumber uses fallback for absent and empty values while preserving zero", async () => {
  const { asNumber } = await importModule("tools/capture/shared/capture-state.mjs");

  for (const value of [null, undefined, "", "   "]) {
    assert.equal(asNumber(value, 7), 7, String(value));
  }

  assert.equal(asNumber("invalid", 7), 7);
  assert.equal(asNumber(0, 7), 0);
  assert.equal(asNumber("0", 7), 0);
  assert.equal(asNumber("5.5", 7), 5.5);
});
