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
