import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const explicitPath = process.env.PLAYWRIGHT_MODULE_PATH;
    const nvmGlobalPath = path.resolve(
      path.dirname(process.execPath),
      "../lib/node_modules/playwright/index.mjs"
    );
    return import(pathToFileURL(explicitPath || nvmGlobalPath).href);
  }
}

async function createUnpackedChromeBuild() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "surfaced-chrome-extension-"));
  await fs.cp(path.join(repoRoot, "shared"), directory, { recursive: true });
  await fs.mkdir(path.join(directory, "popup"), { recursive: true });
  await fs.cp(path.join(repoRoot, "desktop", "popup"), path.join(directory, "popup"), { recursive: true });
  await fs.cp(path.join(repoRoot, "chrome"), directory, { recursive: true, force: true });
  await fs.rm(path.join(directory, "popup", "dispatcher.js"), { force: true });
  return directory;
}

async function startLongPageServer() {
  const html = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Surfaced extension smoke</title>
        <style>
          html,body { margin: 0; background: #071625; color: #dff5ff; font: 16px/1.6 system-ui; }
          main { min-height: 14000px; padding: 40px; background: linear-gradient(#071625,#10324a); }
          section { min-height: 720px; max-width: 720px; margin: auto; }
          #element-scroll { width: min(760px, 90vw); height: 500px; overflow: auto; margin: 40px auto; border: 2px solid #00d4ff; }
          #element-scroll-content { height: 7000px; background: linear-gradient(#10324a,#071625); }
          #anchor-target { margin-top: 5000px; min-height: 700px; }
        </style>
      </head>
      <body><main>
        <a id="anchor-jump" href="#anchor-target">Jump to anchor target</a>
        <div id="element-scroll" tabindex="0"><div id="element-scroll-content">Scrollable element</div></div>
        ${Array.from({ length: 18 }, (_, index) => (
          `<section><h2>Section ${index + 1}</h2><p>Long local page for Surfaced browser smoke.</p></section>`
        )).join("")}
        <section id="anchor-target"><h2>Anchor target</h2></section>
      </main></body>
    </html>`;

  const server = http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function launchContext(chromium, profileDirectory, extensionDirectory) {
  return chromium.launchPersistentContext(profileDirectory, {
    headless: true,
    executablePath: "/usr/bin/chromium",
    viewport: { width: 900, height: 700 },
    args: [
      `--disable-extensions-except=${extensionDirectory}`,
      `--load-extension=${extensionDirectory}`,
    ],
  });
}

async function getServiceWorker(context) {
  return context.serviceWorkers()[0]
    || context.waitForEvent("serviceworker", { timeout: 15000 });
}

async function setPersistentSettings(worker, settings) {
  await worker.evaluate((snapshot) => new Promise((resolve, reject) => {
    chrome.storage.local.set(snapshot, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  }), settings);
}

async function getPersistentSettings(worker) {
  return worker.evaluate(() => new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  }));
}

async function waitForPersistentSettings(worker, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const settings = await getPersistentSettings(worker);
    if (predicate(settings)) {
      return settings;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for persistent settings: ${label}`);
}

async function closePopupAfter(popup, delayMs) {
  if (delayMs > 0) {
    await popup.waitForTimeout(delayMs);
  }
  await popup.close();
}

async function openLongPage(context, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  return page;
}

async function scrollPastThreshold(page) {
  for (const screens of [0.35, 0.7, 1.05, 1.3]) {
    await page.evaluate((value) => window.scrollTo(0, window.innerHeight * value), screens);
    await page.waitForTimeout(130);
  }
}

async function waitForReminder(page) {
  await page.waitForFunction(() => document.getElementById("surfaced-notification-host"), null, {
    timeout: 8000,
  });
}

async function openPopup(context, extensionOrigin) {
  let lastError;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const popup = await context.newPage();
    try {
      await popup.goto(`${extensionOrigin}/popup/popup.html`, { waitUntil: "domcontentloaded" });
      await popup.waitForFunction(() => {
        const root = document.getElementById("root")?.shadowRoot;
        return root?.querySelector(".session-section")?.dataset.state === "active"
          && root?.querySelector(".permission-section")?.dataset.state !== "loading";
      }, null, { timeout: 8000 });
      return popup;
    } catch (error) {
      lastError = error;
      await popup.close().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  throw lastError;
}

async function exercisePopupClosePersistence(context, worker, extensionOrigin) {
  const closeDelays = [0, 50, 100];

  for (const [index, delayMs] of closeDelays.entries()) {
    const threshold = 1.25 + (index * 0.25);
    const popup = await openPopup(context, extensionOrigin);
    await popup.evaluate((value) => {
      const input = document.getElementById("root").shadowRoot.querySelector("#globalThresholdValue");
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, threshold);
    await closePopupAfter(popup, delayMs);
    await waitForPersistentSettings(
      worker,
      (settings) => settings.scrollNotifierThreshold === threshold,
      `global mutation after ${delayMs} ms`
    );
  }

  let expectedDisabled = false;
  for (const delayMs of closeDelays) {
    const popup = await openPopup(context, extensionOrigin);
    await popup.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      root.querySelector("[aria-controls='siteSettingsManager']").click();
      const toggle = root.querySelector("[data-hostname='manager.example'] [data-manager-action='toggle-enabled']");
      if (!toggle) throw new Error("manager.example toggle is unavailable");
      toggle.click();
    });
    expectedDisabled = !expectedDisabled;
    await closePopupAfter(popup, delayMs);
    await waitForPersistentSettings(
      worker,
      (settings) => settings.scrollNotifierDisabledDomains.includes("manager.example") === expectedDisabled,
      `site-manager mutation after ${delayMs} ms`
    );
  }

  for (const [index, delayMs] of closeDelays.entries()) {
    const threshold = [1.6, 1.3, 1][index];
    const importedSettings = {
      scrollNotifierThreshold: threshold,
      scrollNotifierText: `Zażółć gęślą jaźń 🌊 — ${delayMs} ms`,
      scrollNotifierEnabled: true,
      scrollNotifierDisabledDomains: [],
      scrollNotifierSiteOverrides: { "manager.example": 1 },
    };
    const envelope = {
      format: "surfaced-settings",
      formatVersion: 1,
      exportedAt: "2026-07-15T12:00:00.000Z",
      settings: importedSettings,
    };
    const popup = await openPopup(context, extensionOrigin);
    const importPagePromise = context.waitForEvent("page");
    await popup.evaluate(() => document.getElementById("root").shadowRoot
      .querySelector("#settingsImport").click());
    const importPage = await importPagePromise;
    await importPage.waitForLoadState("domcontentloaded");
    await importPage.locator("#settingsImportFile").setInputFiles({
      name: "surfaced-settings.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(envelope)),
    });
    await importPage.waitForFunction(() => document.getElementById("importPreview").hidden === false);
    await importPage.locator("#replaceSettings").click({ noWaitAfter: true });
    await closePopupAfter(importPage, delayMs);
    await popup.close();
    const stored = await waitForPersistentSettings(
      worker,
      (settings) => settings.scrollNotifierText === importedSettings.scrollNotifierText,
      `full import after ${delayMs} ms`
    );
    assert.deepEqual(stored, importedSettings, `full import must persist all five fields after ${delayMs} ms`);
  }
}

async function clickSessionAction(popup, expectedState) {
  await popup.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".session-action").click());
  await popup.waitForFunction((state) => (
    document.getElementById("root")?.shadowRoot
      ?.querySelector(".session-section")?.dataset.state === state
  ), expectedState, { timeout: 8000 });
}

async function badgeTextForUrl(worker, url) {
  return worker.evaluate((targetUrl) => new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      const queryError = chrome.runtime.lastError;
      if (queryError) {
        reject(new Error(queryError.message));
        return;
      }

      const tab = tabs.find((entry) => entry.url === targetUrl);
      if (!tab) {
        reject(new Error(`Tab not found: ${targetUrl}`));
        return;
      }

      chrome.action.getBadgeText({ tabId: tab.id }, (text) => {
        const badgeError = chrome.runtime.lastError;
        if (badgeError) reject(new Error(badgeError.message));
        else resolve(text);
      });
    });
  }), url);
}

const playwright = await loadPlaywright();
const extensionDirectory = await createUnpackedChromeBuild();
const profileDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "surfaced-chromium-profile-"));
const server = await startLongPageServer();
let context = null;

try {
  context = await launchContext(playwright.chromium, profileDirectory, extensionDirectory);
  let worker = await getServiceWorker(context);
  const workerUrl = new URL(worker.url());
  const extensionOrigin = `${workerUrl.protocol}//${workerUrl.host}`;
  await setPersistentSettings(worker, {
    scrollNotifierThreshold: 1,
    scrollNotifierText: "Initial extension smoke reminder",
    scrollNotifierEnabled: true,
    scrollNotifierDisabledDomains: [],
    scrollNotifierSiteOverrides: { "manager.example": 1 },
  });
  await exercisePopupClosePersistence(context, worker, extensionOrigin);

  const first = await openLongPage(context, `${server.origin}/first`);
  const second = await openLongPage(context, `${server.origin}/second`);
  await scrollPastThreshold(first);
  await scrollPastThreshold(second);
  await Promise.all([waitForReminder(first), waitForReminder(second)]);
  assert.notEqual(await badgeTextForUrl(worker, first.url()), "");
  assert.notEqual(await badgeTextForUrl(worker, second.url()), "");

  await first.evaluate(() => window.scrollTo(0, 0));
  await first.waitForFunction(() => !document.getElementById("surfaced-notification-host"));
  assert.equal(await badgeTextForUrl(worker, first.url()), "", "Home/back-to-top clears the badge");
  await scrollPastThreshold(first);
  await waitForReminder(first);

  for (const screens of [2, 3, 4, 3, 2, 1, 0]) {
    await second.evaluate((value) => window.scrollTo(0, window.innerHeight * value), screens);
    await second.waitForTimeout(130);
  }
  await second.waitForFunction(() => !document.getElementById("surfaced-notification-host"));
  assert.equal(await badgeTextForUrl(worker, second.url()), "", "animated back-to-top clears the badge");

  const endPage = await openLongPage(context, `${server.origin}/end-jump`);
  await endPage.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
  await waitForReminder(endPage);
  assert.notEqual(await badgeTextForUrl(worker, endPage.url()), "", "End contributes a bounded visible depth");

  const anchorPage = await openLongPage(context, `${server.origin}/anchor-jump`);
  await anchorPage.click("#anchor-jump");
  await waitForReminder(anchorPage);
  assert.notEqual(await badgeTextForUrl(worker, anchorPage.url()), "", "anchor navigation contributes depth");

  const elementPage = await openLongPage(context, `${server.origin}/element-scroll`);
  await elementPage.evaluate(() => window.scrollTo(0, window.innerHeight * 0.4));
  await elementPage.waitForTimeout(150);
  await elementPage.evaluate(() => {
    document.getElementById("element-scroll").scrollTop = 2000;
  });
  await elementPage.waitForTimeout(180);
  assert.equal(await elementPage.locator("#surfaced-notification-host").count(), 0, "switching targets does not charge the element's existing offset");
  await elementPage.evaluate(() => {
    document.getElementById("element-scroll").scrollTop = 2800;
  });
  await waitForReminder(elementPage);
  const elementBadge = await badgeTextForUrl(worker, elementPage.url());
  await elementPage.evaluate(() => {
    const target = document.getElementById("element-scroll");
    target.scrollTop = 5000;
  });
  await elementPage.waitForTimeout(150);
  await elementPage.evaluate(() => {
    const target = document.getElementById("element-scroll");
    target.scrollTop = 3000;
  });
  await elementPage.waitForTimeout(180);
  assert.equal(await elementPage.locator("#surfaced-notification-host").count(), 1, "virtual-list rebase away from the top keeps earned depth");
  assert.notEqual(await badgeTextForUrl(worker, elementPage.url()), "", "virtual-list rebase does not clear the badge");
  assert.notEqual(elementBadge, "");

  const spaPage = await openLongPage(context, `${server.origin}/spa-one`);
  await scrollPastThreshold(spaPage);
  await waitForReminder(spaPage);
  await spaPage.evaluate(() => history.pushState({}, "", "/spa-two"));
  await spaPage.waitForFunction(() => !document.getElementById("surfaced-notification-host"), null, { timeout: 3000 });
  assert.equal(await badgeTextForUrl(worker, spaPage.url()), "", "SPA pathname reset clears the badge");
  await spaPage.evaluate(() => window.scrollBy(0, window.innerHeight * 0.2));
  await spaPage.waitForTimeout(150);
  assert.equal(await spaPage.locator("#surfaced-notification-host").count(), 0, "first post-SPA event establishes a new baseline");
  await spaPage.evaluate(() => window.scrollBy(0, window.innerHeight * 1.1));
  await waitForReminder(spaPage);

  let popup = await openPopup(context, extensionOrigin);
  assert.equal(await popup.evaluate(() => (
    document.getElementById("root").shadowRoot.querySelector(".permission-section").dataset.state
  )), "granted", "required host access is confirmed through the Chromium adapter");
  const mirrorPopup = await openPopup(context, extensionOrigin);
  await clickSessionAction(popup, "paused");
  await mirrorPopup.waitForFunction(() => (
    document.getElementById("root")?.shadowRoot
      ?.querySelector(".session-section")?.dataset.state === "paused"
  ));
  await Promise.all([
    first.waitForFunction(() => !document.getElementById("surfaced-notification-host")),
    second.waitForFunction(() => !document.getElementById("surfaced-notification-host")),
  ]);
  assert.equal(await badgeTextForUrl(worker, first.url()), "");
  assert.equal(await badgeTextForUrl(worker, second.url()), "");

  const duringPause = await openLongPage(context, `${server.origin}/during-pause`);
  await scrollPastThreshold(duringPause);
  assert.equal(await duringPause.locator("#surfaced-notification-host").count(), 0);
  assert.equal(await badgeTextForUrl(worker, duringPause.url()), "");

  await clickSessionAction(popup, "active");
  await mirrorPopup.waitForFunction(() => (
    document.getElementById("root")?.shadowRoot
      ?.querySelector(".session-section")?.dataset.state === "active"
  ));
  await duringPause.waitForTimeout(250);
  assert.equal(await duringPause.locator("#surfaced-notification-host").count(), 0, "resume must not replay paused depth");
  await duringPause.evaluate(() => window.scrollBy(0, window.innerHeight * 1.15));
  await waitForReminder(duringPause);

  // A real browser-process restart clears session storage while preserving the
  // persistent local threshold in the same profile.
  await clickSessionAction(popup, "paused");
  await context.close();
  context = await launchContext(playwright.chromium, profileDirectory, extensionDirectory);
  popup = await openPopup(context, extensionOrigin);
  worker = await getServiceWorker(context);
  assert.equal(await popup.evaluate(() => (
    document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state
  )), "active");
  const storedThreshold = await worker.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.get("scrollNotifierThreshold", (result) => resolve(result.scrollNotifierThreshold));
  }));
  assert.equal(storedThreshold, 1);

  console.log("Chromium unpacked-extension smoke: pass");
} finally {
  await context?.close().catch(() => undefined);
  await server.close();
  await fs.rm(extensionDirectory, { recursive: true, force: true });
  await fs.rm(profileDirectory, { recursive: true, force: true });
}
