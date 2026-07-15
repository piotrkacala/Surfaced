import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
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

function contentType(filePath) {
  switch (path.extname(filePath)) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js":
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    default: return "application/octet-stream";
  }
}

async function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const requestedPath = path.resolve(repoRoot, `.${decodeURIComponent(url.pathname)}`);
      if (!requestedPath.startsWith(`${repoRoot}${path.sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const stats = await fs.stat(requestedPath);
      const filePath = stats.isDirectory() ? path.join(requestedPath, "index.html") : requestedPath;
      const file = await fs.readFile(filePath);
      response.writeHead(200, { "Content-Type": contentType(filePath) });
      response.end(file);
    } catch (error) {
      response.writeHead(404).end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function installClosedShadowProbe(page) {
  await page.addInitScript(() => {
    const originalAttachShadow = Element.prototype.attachShadow;
    const roots = new WeakMap();
    Object.defineProperty(window, "__surfacedTestShadowRoots", { value: roots });
    Element.prototype.attachShadow = function attachShadow(init) {
      const root = originalAttachShadow.call(this, init);
      roots.set(this, root);
      return root;
    };
  });
}

async function waitForReady(page) {
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
}

async function popupFocus(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root").shadowRoot;
    const active = root.activeElement;
    if (!active) return null;
    return {
      id: active.id,
      className: active.className,
      controls: active.getAttribute("aria-controls"),
      direction: active.dataset.direction || "",
      action: active.dataset.managerAction || "",
      hostname: active.closest(".site-manager__item")?.dataset.hostname || "",
      tagName: active.tagName,
      role: active.getAttribute("role"),
      tabIndex: active.tabIndex,
    };
  });
}

async function tabUntil(page, predicate, { backwards = false, limit = 60 } = {}) {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
    const focus = await popupFocus(page);
    if (predicate(focus)) return focus;
    if (!focus) {
      throw new Error("Keyboard traversal left the popup document before reaching the expected control");
    }
  }
  throw new Error("Expected popup control was not reached by keyboard traversal");
}

async function reminderMetrics(page) {
  return page.evaluate(() => {
    const host = document.getElementById("surfaced-notification-host");
    if (!host) return null;
    const root = window.__surfacedTestShadowRoots.get(host);
    const notification = root.querySelector(".notification");
    const close = root.querySelector(".notification__close");
    const notificationRect = notification.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();

    return {
      viewportWidth: document.documentElement.clientWidth,
      hostClientWidth: host.clientWidth,
      hostScrollWidth: host.scrollWidth,
      notificationLeft: notificationRect.left,
      notificationRight: notificationRect.right,
      closeLeft: closeRect.left,
      closeRight: closeRect.right,
      closeAriaLabel: close.getAttribute("aria-label"),
    };
  });
}

async function testReminderResponsiveness(browser, origin) {
  for (const width of [320, 360, 386]) {
    const page = await browser.newPage({ viewport: { width, height: 640 } });
    await installClosedShadowProbe(page);
    await page.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=shallow`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);
    await page.waitForFunction(() => document.getElementById("surfaced-notification-host"));

    const metrics = await reminderMetrics(page);
    assert.ok(metrics, `reminder should be visible at ${width}px`);
    assert.ok(metrics.hostScrollWidth <= metrics.hostClientWidth, `host must not overflow at ${width}px`);
    assert.ok(metrics.notificationLeft >= 0, `reminder left edge must be visible at ${width}px`);
    assert.ok(metrics.notificationRight <= metrics.viewportWidth, `reminder right edge must be visible at ${width}px`);
    assert.ok(metrics.closeLeft >= 0 && metrics.closeRight <= metrics.viewportWidth, `close button must be visible at ${width}px`);
    assert.equal(metrics.closeAriaLabel, "Dismiss notification");
    const closeFocus = await page.evaluate(() => {
      const host = document.getElementById("surfaced-notification-host");
      const close = window.__surfacedTestShadowRoots.get(host).querySelector(".notification__close");
      close.focus();
      const style = getComputedStyle(close);
      return {
        active: close.getRootNode().activeElement === close,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    assert.equal(closeFocus.active, true, `close button must accept keyboard focus at ${width}px`);
    assert.notEqual(closeFocus.outlineStyle, "none", `close button must have visible focus at ${width}px`);
    assert.notEqual(closeFocus.outlineWidth, "0px", `close button focus must have non-zero width at ${width}px`);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.getElementById("surfaced-notification-host"));
    await page.close();
  }
}

async function testReminderCycleAndSessionPause(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await installClosedShadowProbe(page);
  await page.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=shallow`, {
    waitUntil: "networkidle",
  });
  await waitForReady(page);
  await page.waitForFunction(() => document.getElementById("surfaced-notification-host"));

  await page.evaluate(() => {
    const host = document.getElementById("surfaced-notification-host");
    window.__surfacedTestShadowRoots.get(host).querySelector(".notification__close").click();
  });
  await page.waitForFunction(() => !document.getElementById("surfaced-notification-host"));
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.15));
  await page.waitForFunction(() => document.getElementById("surfaced-notification-host"));

  const pauseResponse = await page.evaluate(() => browser.runtime.sendMessage({
    type: "SET_SESSION_PAUSED",
    paused: true,
  }));
  assert.deepEqual(pauseResponse, { ok: true, paused: true });
  await page.waitForFunction(() => !document.getElementById("surfaced-notification-host"));
  const lastBadgeMessage = await page.evaluate(() => (
    window.__SURFACED_CAPTURE__.runtimeMessages
      .filter((message) => message.type === "SCROLL_DEPTH")
      .at(-1)
  ));
  assert.deepEqual(lastBadgeMessage, { type: "SCROLL_DEPTH", value: 0 });
  await page.close();

  const pausedPage = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await installClosedShadowProbe(pausedPage);
  await pausedPage.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=mid&sessionPaused=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(pausedPage);
  assert.equal(await pausedPage.locator("#surfaced-notification-host").count(), 0);

  const resumeResponse = await pausedPage.evaluate(() => browser.runtime.sendMessage({
    type: "SET_SESSION_PAUSED",
    paused: false,
  }));
  assert.deepEqual(resumeResponse, { ok: true, paused: false });
  await pausedPage.waitForTimeout(180);
  assert.equal(await pausedPage.locator("#surfaced-notification-host").count(), 0, "resume must not show overdue reminder");
  await pausedPage.evaluate(() => window.scrollBy(0, window.innerHeight * 1.1));
  await pausedPage.waitForFunction(() => document.getElementById("surfaced-notification-host"));
  await pausedPage.close();

  const failurePage = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await installClosedShadowProbe(failurePage);
  await failurePage.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=shallow&sessionGetFailures=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(failurePage);
  await failurePage.waitForFunction(() => document.getElementById("surfaced-notification-host"));
  await failurePage.close();

  const settingsFailurePage = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await installClosedShadowProbe(settingsFailurePage);
  await settingsFailurePage.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=shallow&storageGetFailures=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(settingsFailurePage);
  assert.equal(
    await settingsFailurePage.locator("#surfaced-notification-host").count(),
    0,
    "content tracking must fail closed when the persisted settings snapshot is unavailable",
  );
  await settingsFailurePage.evaluate(() => browser.storage.local.set({ scrollNotifierThreshold: 1 }));
  await settingsFailurePage.waitForTimeout(180);
  await settingsFailurePage.evaluate(() => window.scrollBy(0, window.innerHeight * 1.1));
  await settingsFailurePage.waitForFunction(() => document.getElementById("surfaced-notification-host"));
  await settingsFailurePage.close();
}

async function testReducedMotion(browser, origin) {
  const reminderPage = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await reminderPage.emulateMedia({ reducedMotion: "reduce" });
  await installClosedShadowProbe(reminderPage);
  await reminderPage.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=shallow`, {
    waitUntil: "networkidle",
  });
  await waitForReady(reminderPage);
  await reminderPage.waitForFunction(() => document.getElementById("surfaced-notification-host"));
  const reminderMotion = await reminderPage.evaluate(() => {
    const host = document.getElementById("surfaced-notification-host");
    const root = window.__surfacedTestShadowRoots.get(host);
    const notification = root.querySelector(".notification");
    const bubble = root.querySelector(".bubble");
    return {
      animation: getComputedStyle(notification).animationName,
      beforeAnimation: getComputedStyle(notification, "::before").animationName,
      afterAnimation: getComputedStyle(notification, "::after").animationName,
      bubbleDisplay: getComputedStyle(bubble).display,
    };
  });
  assert.deepEqual(reminderMotion, {
    animation: "none",
    beforeAnimation: "none",
    afterAnimation: "none",
    bubbleDisplay: "none",
  });
  await reminderPage.close();

  for (const platform of ["desktop", "android"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/tools/capture/popup-harness.html?platform=${platform}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);
    const popupMotion = await page.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      const shell = root.querySelector(".shell");
      const preview = root.querySelector(".preview-card");
      const bubble = root.querySelector(".bubble");
      return {
        sessionState: root.querySelector(".session-section").dataset.state,
        shellAnimation: getComputedStyle(shell).animationName,
        shellBeforeAnimation: getComputedStyle(shell, "::before").animationName,
        previewBeforeAnimation: getComputedStyle(preview, "::before").animationName,
        bubbleDisplay: getComputedStyle(bubble).display,
      };
    });
    assert.deepEqual(popupMotion, {
      sessionState: "active",
      shellAnimation: "none",
      shellBeforeAnimation: "none",
      previewBeforeAnimation: "none",
      bubbleDisplay: "none",
    });
    await page.close();
  }
}

async function testPopupSessionUi(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${origin}/tools/capture/popup-harness.html?platform=desktop`, {
    waitUntil: "networkidle",
  });
  await waitForReady(page);

  await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".session-action").click());
  await page.waitForFunction(() => (
    document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "paused"
  ));
  const pausedUi = await page.evaluate(() => {
    const root = document.getElementById("root").shadowRoot;
    return {
      title: root.querySelector(".session-section .section__title").textContent,
      action: root.querySelector(".session-action").textContent,
      aria: root.querySelector(".session-action").getAttribute("aria-label"),
    };
  });
  assert.deepEqual(pausedUi, {
    title: "Notifications paused",
    action: "Resume now",
    aria: "Resume reminders now on all tabs",
  });

  await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".session-action").click());
  await page.waitForFunction(() => (
    document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "active"
  ));
  await page.close();

  const errorPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await errorPage.goto(`${origin}/tools/capture/popup-harness.html?platform=android&sessionGetFailures=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(errorPage);
  assert.equal(await errorPage.evaluate(() => (
    document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state
  )), "error");
  await errorPage.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".session-action").click());
  await errorPage.waitForFunction(() => (
    document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "active"
  ));
  await errorPage.close();
}

async function permissionUiSnapshot(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root").shadowRoot;
    const permission = root.querySelector(".permission-section");
    const action = root.querySelector(".permission-action");
    return {
      state: permission.dataset.state,
      message: permission.querySelector(".section__description").textContent,
      actionHidden: action.hidden,
      actionDisabled: action.disabled,
      fallbackHidden: root.querySelector(".permission-fallback").hidden,
      reloadHidden: root.querySelector(".permission-reload").hidden,
      contentHidden: root.querySelector(".content").hidden,
      storagePhase: root.querySelector(".storage-state").dataset.phase,
      siteUnavailable: !root.querySelector(".site-note").hidden,
      thresholdDisabled: root.querySelector("#globalThresholdValue").disabled,
    };
  });
}

async function openPermissionPopup(browser, origin, params) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${origin}/tools/capture/popup-harness.html?${new URLSearchParams(params)}`, {
    waitUntil: "networkidle",
  });
  await waitForReady(page);
  await page.waitForFunction(() => (
    document.getElementById("root").shadowRoot
      .querySelector(".permission-section").dataset.state !== "loading"
  ));
  return page;
}

async function permissionIsolationSnapshot(page) {
  return page.evaluate(() => ({
    settings: window.__SURFACED_CAPTURE__.settingsStore.getState(),
    sessionPaused: window.__SURFACED_CAPTURE__.sessionPaused,
  }));
}

async function testPermissionHealthUi(browser, origin) {
  for (const platform of ["desktop", "android"]) {
    const fullPage = await openPermissionPopup(browser, origin, { platform, permission: "full" });
    assert.deepEqual(await permissionUiSnapshot(fullPage), {
      state: "granted",
      message: "Surfaced can access supported pages. Your saved settings are available.",
      actionHidden: true,
      actionDisabled: false,
      fallbackHidden: true,
      reloadHidden: true,
      contentHidden: false,
      storagePhase: "ready",
      siteUnavailable: false,
      thresholdDisabled: false,
    }, `${platform}: full host grant is separate from healthy storage`);
    await fullPage.close();

    const missingPage = await openPermissionPopup(browser, origin, {
      platform,
      permission: "missing",
      permissionRequest: "grant",
    });
    assert.equal((await permissionUiSnapshot(missingPage)).state, "missing");
    assert.equal((await permissionUiSnapshot(missingPage)).contentHidden, false);
    await missingPage.evaluate(() => {
      const input = document.getElementById("root").shadowRoot.querySelector("#globalThresholdValue");
      input.value = "9";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await missingPage.waitForFunction(() => (
      window.__SURFACED_CAPTURE__.settingsStore.getState().scrollNotifierThreshold === 9
    ));
    const beforeRestore = await permissionIsolationSnapshot(missingPage);
    await missingPage.evaluate(() => document.getElementById("root").shadowRoot
      .querySelector(".permission-action").click());
    await missingPage.waitForFunction(() => (
      document.getElementById("root").shadowRoot
        .querySelector(".permission-section").dataset.state === "restored"
    ));
    const restored = await permissionUiSnapshot(missingPage);
    assert.equal(restored.reloadHidden, false, `${platform}: verified restore explains tab reload`);
    assert.equal(restored.actionHidden, true);
    assert.deepEqual(
      await permissionIsolationSnapshot(missingPage),
      beforeRestore,
      `${platform}: verified permission restore changes no settings or session state`
    );
    assert.equal(await missingPage.evaluate(() => (
      window.__SURFACED_CAPTURE__.permissionCalls.filter(({ method }) => method === "contains").length
    )), 2, `${platform}: restore is verified with a fresh contains call`);
    await missingPage.close();

    const keyboardRestorePage = await openPermissionPopup(browser, origin, {
      platform,
      permission: "missing",
      permissionRequest: "grant",
    });
    await keyboardRestorePage.keyboard.press("Tab");
    assert.equal((await popupFocus(keyboardRestorePage)).id, "enabled", `${platform}: global switch precedes permission restore`);
    await keyboardRestorePage.keyboard.press("Tab");
    assert.match((await popupFocus(keyboardRestorePage)).className, /permission-action/, `${platform}: missing permission adds restore to Tab order`);
    await keyboardRestorePage.keyboard.press("Tab");
    assert.match((await popupFocus(keyboardRestorePage)).className, /session-action/, `${platform}: session action follows permission restore`);
    await keyboardRestorePage.keyboard.press("Shift+Tab");
    assert.match((await popupFocus(keyboardRestorePage)).className, /permission-action/);
    await keyboardRestorePage.keyboard.press("Enter");
    await keyboardRestorePage.waitForFunction(() => (
      document.getElementById("root").shadowRoot
        .querySelector(".permission-section").dataset.state === "restored"
    ));
    const restoredFocus = await popupFocus(keyboardRestorePage);
    assert.match(restoredFocus.className, /permission-status/, `${platform}: verified keyboard restore moves focus to status`);
    assert.equal(restoredFocus.role, "status");
    assert.equal(restoredFocus.tabIndex, -1, `${platform}: status is only programmatically focusable`);
    assert.equal(await keyboardRestorePage.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      return getComputedStyle(root.querySelector(".permission-status")).outlineStyle;
    }), "solid", `${platform}: restored status has visible focus`);
    await keyboardRestorePage.keyboard.press("Tab");
    assert.match((await popupFocus(keyboardRestorePage)).className, /session-action/, `${platform}: restored status is not a permanent Tab stop`);
    await keyboardRestorePage.close();

    const partialPage = await openPermissionPopup(browser, origin, { platform, permission: "partial" });
    assert.equal((await permissionUiSnapshot(partialPage)).state, "partial");
    assert.match((await permissionUiSnapshot(partialPage)).message, /limited to only some sites/);
    await partialPage.close();

    const unavailablePage = await openPermissionPopup(browser, origin, { platform, permission: "exception" });
    const unavailableHealth = await permissionUiSnapshot(unavailablePage);
    assert.equal(unavailableHealth.state, "unavailable");
    assert.equal(unavailableHealth.actionHidden, false);
    assert.equal(unavailableHealth.fallbackHidden, false);
    assert.equal(unavailableHealth.contentHidden, false, `${platform}: permission verification failure does not become a storage failure`);
    await unavailablePage.close();

    for (const [request, expectedState, expectedMessage] of [
      ["deny", "denied", /was not granted/],
      ["exception", "exception", /could not complete/],
      ["partial", "partial", /granted only limited/],
      ["true-unverified", "unverified", /still cannot verify/],
    ]) {
      const requestPage = await openPermissionPopup(browser, origin, {
        platform,
        permission: "missing",
        permissionRequest: request,
      });
      const beforeRequest = await permissionIsolationSnapshot(requestPage);
      await requestPage.evaluate(() => document.getElementById("root").shadowRoot
        .querySelector(".permission-action").focus());
      await requestPage.keyboard.press("Space");
      await requestPage.waitForFunction((state) => (
        document.getElementById("root").shadowRoot
          .querySelector(".permission-section").dataset.state === state
      ), expectedState);
      const snapshot = await permissionUiSnapshot(requestPage);
      assert.match(snapshot.message, expectedMessage, `${platform}: request ${request}`);
      assert.equal(snapshot.fallbackHidden, false, `${platform}: request ${request} shows manual fallback`);
      assert.equal(snapshot.reloadHidden, true, `${platform}: request ${request} does not claim restore`);
      assert.match((await popupFocus(requestPage)).className, /permission-action/, `${platform}: request ${request} keeps focus on visible restore action`);
      assert.equal(await requestPage.evaluate(() => {
        const root = document.getElementById("root").shadowRoot;
        return getComputedStyle(root.querySelector(".permission-action")).outlineStyle;
      }), "solid", `${platform}: request ${request} keeps visible keyboard focus`);
      assert.deepEqual(
        await permissionIsolationSnapshot(requestPage),
        beforeRequest,
        `${platform}: request ${request} changes no settings or session state`
      );
      await requestPage.close();
    }

    for (const params of [
      { tabUrlMissing: "1" },
      { tab: "about:config" },
      { tab: "chrome://extensions" },
      { tab: "https://addons.mozilla.org/firefox/addon/surfaced/" },
      { tab: "https://accounts.firefox.com/settings" },
      { tab: "https://support.mozilla.org/kb/extensions" },
      { tab: "https://chromewebstore.google.com/detail/surfaced/id" },
    ]) {
      const unavailablePage = await openPermissionPopup(browser, origin, {
        platform,
        permission: "full",
        ...params,
      });
      const unavailable = await permissionUiSnapshot(unavailablePage);
      assert.equal(unavailable.state, "granted", `${platform}: current page does not alter global permission health`);
      assert.equal(unavailable.siteUnavailable, true, `${platform}: unavailable current page is neutral`);
      assert.equal(unavailable.contentHidden, false);
      await unavailablePage.close();
    }

    const storageFailurePage = await openPermissionPopup(browser, origin, {
      platform,
      permission: "missing",
      storageGetFailures: "1",
    });
    const storageFailure = await permissionUiSnapshot(storageFailurePage);
    assert.equal(storageFailure.storagePhase, "error", `${platform}: storage read failure keeps its own error state`);
    assert.equal(storageFailure.contentHidden, true, `${platform}: storage failure still blocks unsafe default editing`);
    await storageFailurePage.evaluate(() => document.getElementById("root").shadowRoot
      .querySelector(".storage-state__retry").click());
    await storageFailurePage.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".storage-state").hidden
    ));
    assert.equal((await permissionUiSnapshot(storageFailurePage)).state, "missing");
    assert.equal((await permissionUiSnapshot(storageFailurePage)).contentHidden, false);
    await storageFailurePage.close();
  }
}

async function testPopupKeyboardAndSiteManager(browser, origin) {
  for (const platform of ["desktop", "android"]) {
    const commonParams = {
      platform,
      disabledDomains: "disabled-only.example,both.example",
      siteOverrides: "override-only.example:12;both.example:5.5",
    };
    const tabOrderParams = new URLSearchParams({
      ...commonParams,
      tab: "https://quiet.example/article",
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${origin}/tools/capture/popup-harness.html?${tabOrderParams}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);

    await page.keyboard.press("Tab");
    assert.equal((await popupFocus(page)).id, "enabled", `${platform}: global switch is first`);
    const switchFocusStyle = await page.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      return getComputedStyle(root.querySelector("#enabled + .switch__track")).outlineStyle;
    });
    assert.equal(switchFocusStyle, "solid", `${platform}: switch has visible keyboard focus`);

    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => (
      document.getElementById("root").shadowRoot.querySelector("#enabled").checked
    )), false, `${platform}: Space toggles a switch`);
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => (
      document.getElementById("root").shadowRoot.querySelector("#enabled").checked
    )), true, `${platform}: Enter toggles a switch`);

    await page.keyboard.press("Tab");
    assert.match((await popupFocus(page)).className, /session-action/);
    const actionFocusStyle = await page.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      return getComputedStyle(root.querySelector(".session-action")).outlineStyle;
    });
    assert.equal(actionFocusStyle, "solid", `${platform}: actions have visible keyboard focus`);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "paused"
    ));
    await page.keyboard.press("Space");
    await page.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "active"
    ));
    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).id, "enabled", `${platform}: Shift+Tab reverses the order`);

    const tabOrder = ["enabled"];
    for (let index = 0; index < 11; index += 1) {
      await page.keyboard.press("Tab");
      const focus = await popupFocus(page);
      tabOrder.push(
        focus.id
        || focus.controls
        || focus.direction
        || (focus.className.includes("session-action") ? "session-action" : focus.tagName)
      );
    }
    assert.deepEqual(tabOrder, [
      "enabled",
      "session-action",
      "thresholdHelper",
      "decrement",
      "globalThresholdValue",
      "increment",
      "siteEnabled",
      "siteOverrideEnabled",
      "siteSettingsManager",
      "notificationText",
      "settingsExport",
      "settingsImport",
    ], `${platform}: Tab order includes every primary switch, session pause, and backup action`);

    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).id, "settingsExport", `${platform}: Shift+Tab reverses through backup actions`);
    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).id, "notificationText", `${platform}: Shift+Tab returns to reminder text`);
    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).controls, "siteSettingsManager", `${platform}: Shift+Tab reaches site manager from reminder text`);
    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).id, "siteOverrideEnabled", `${platform}: Shift+Tab reaches the site override switch`);
    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).id, "siteEnabled", `${platform}: Shift+Tab reaches the site enabled switch without relying on document focus wrapping`);
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    assert.equal((await popupFocus(page)).id, "siteOverrideEnabled");
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => (
      document.getElementById("root").shadowRoot.querySelector("#siteOverrideEnabled").checked
    )), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => (
      document.getElementById("root").shadowRoot.querySelector("#siteOverrideEnabled").checked
    )), false);
    await page.close();

    const managerParams = new URLSearchParams({
      ...commonParams,
      tab: "about:config",
    });
    const managerPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await managerPage.goto(`${origin}/tools/capture/popup-harness.html?${managerParams}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(managerPage);

    const managerButtonVisible = await managerPage.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      const button = root.querySelector("[aria-controls='siteSettingsManager']");
      return !button.hidden && getComputedStyle(button).display !== "none";
    });
    assert.equal(managerButtonVisible, true, `${platform}: manager is available without a tab hostname`);

    await tabUntil(managerPage, (focus) => focus?.controls === "siteSettingsManager");
    await managerPage.keyboard.press("Enter");
    assert.match((await popupFocus(managerPage)).className, /icon-button/, `${platform}: open focuses close`);
    await managerPage.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(managerPage)).controls, "siteSettingsManager");
    await managerPage.keyboard.press("Tab");

    const rows = await managerPage.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      return Array.from(root.querySelectorAll(".site-manager__item")).map((item) => ({
        hostname: item.dataset.hostname,
        state: item.querySelector(".site-manager__state").textContent,
        threshold: item.querySelector(".site-manager__threshold").textContent,
      }));
    });
    assert.deepEqual(rows, [
      { hostname: "both.example", state: "Disabled", threshold: "Site override: 5.5 screens" },
      { hostname: "disabled-only.example", state: "Disabled", threshold: "Global threshold: 7 screens" },
      { hostname: "override-only.example", state: "Enabled", threshold: "Site override: 12 screens" },
    ]);

    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "both.example" && focus.action === "toggle-enabled"
    ));
    await managerPage.keyboard.press("Space");
    assert.equal(await managerPage.evaluate(() => (
      document.getElementById("root").shadowRoot
        .querySelector("[data-hostname='both.example'] .site-manager__state").textContent
    )), "Enabled");

    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "disabled-only.example" && focus.action === "set-override"
    ));
    await managerPage.keyboard.press("Enter");
    assert.equal((await popupFocus(managerPage)).action, "override-input");
    await managerPage.keyboard.press("Control+A");
    await managerPage.keyboard.type("13");
    await managerPage.keyboard.press("Enter");
    assert.equal(await managerPage.evaluate(() => (
      document.getElementById("root").shadowRoot
        .querySelector("[data-hostname='disabled-only.example'] .site-manager__threshold").textContent
    )), "Site override: 13 screens");

    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "disabled-only.example" && focus.action === "remove-override"
    ));
    await managerPage.keyboard.press("Enter");
    assert.equal((await popupFocus(managerPage)).action, "confirm");
    await managerPage.keyboard.press("Enter");
    assert.equal(await managerPage.evaluate(() => (
      document.getElementById("root").shadowRoot
        .querySelector("[data-hostname='disabled-only.example'] .site-manager__threshold").textContent
    )), "Global threshold: 7 screens");

    // Start from the row focused by the preceding override removal, then follow
    // the manager's real next-neighbor focus. This keeps every traversal inside
    // the document and does not depend on Firefox wrapping Tab after the page.
    const removalOrder = ["disabled-only.example", "override-only.example", "both.example"];
    const expectedFocusAfterRemoval = ["override-only.example", "both.example", ""];
    for (const [index, hostname] of removalOrder.entries()) {
      await tabUntil(managerPage, (focus) => (
        focus?.hostname === hostname && focus.action === "remove-site"
      ));
      await managerPage.keyboard.press("Enter");
      assert.equal((await popupFocus(managerPage)).action, "confirm");
      await managerPage.keyboard.press("Enter");
      assert.equal(
        (await popupFocus(managerPage))?.hostname || "",
        expectedFocusAfterRemoval[index],
        `${platform}: removal focuses the next logical row`
      );
    }

    const emptyFocus = await popupFocus(managerPage);
    assert.match(emptyFocus.className, /site-manager__empty/);
    assert.equal(await managerPage.evaluate(() => (
      document.getElementById("root").shadowRoot.querySelector(".site-manager__empty").textContent
    )), "No site-specific settings saved yet.");
    assert.equal(await managerPage.evaluate(() => (
      getComputedStyle(document.getElementById("root").shadowRoot.querySelector(".site-manager__empty")).outlineStyle
    )), "solid", `${platform}: focused empty state remains visible`);

    await managerPage.keyboard.press("Escape");
    assert.equal((await popupFocus(managerPage)).controls, "siteSettingsManager", `${platform}: close restores focus`);
    await managerPage.keyboard.press("Enter");
    await managerPage.keyboard.press("Space");
    assert.equal((await popupFocus(managerPage)).controls, "siteSettingsManager", `${platform}: Space closes manager`);
    await managerPage.close();

    const writeFailureParams = new URLSearchParams({
      ...commonParams,
      tab: "about:config",
      storageSetFailures: "1",
    });
    const writeFailurePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await writeFailurePage.goto(`${origin}/tools/capture/popup-harness.html?${writeFailureParams}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(writeFailurePage);
    await tabUntil(writeFailurePage, (focus) => focus?.controls === "siteSettingsManager");
    await writeFailurePage.keyboard.press("Enter");
    await tabUntil(writeFailurePage, (focus) => (
      focus?.hostname === "both.example" && focus.action === "toggle-enabled"
    ));
    await writeFailurePage.keyboard.press("Space");
    await writeFailurePage.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".storage-state").dataset.phase === "error"
    ));
    assert.match((await popupFocus(writeFailurePage)).className, /storage-state__retry/, `${platform}: async write failure focuses visible retry`);
    await writeFailurePage.keyboard.press("Enter");
    await writeFailurePage.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".storage-state").hidden
    ));
    assert.equal((await popupFocus(writeFailurePage)).id, "enabled", `${platform}: successful retry moves focus out of the hidden error panel`);
    await writeFailurePage.close();
  }
}

function importEnvelope(settings = {}) {
  return {
    format: "surfaced-settings",
    formatVersion: 1,
    exportedAt: "2026-07-15T12:00:00.000Z",
    settings: {
      scrollNotifierThreshold: 20.5,
      scrollNotifierText: "Imported local reminder",
      scrollNotifierEnabled: false,
      scrollNotifierDisabledDomains: ["current.example", "new-disabled.example"],
      scrollNotifierSiteOverrides: {
        "current.example": 5.5,
        "new-override.example": 100,
      },
      ...settings,
    },
  };
}

async function popupSettingsSnapshot(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root").shadowRoot;
    return {
      threshold: root.querySelector("#globalThresholdValue").value,
      text: root.querySelector("#notificationText").value,
      enabled: root.querySelector("#enabled").checked,
      siteEnabled: root.querySelector("#siteEnabled").checked,
      siteOverrideEnabled: root.querySelector("#siteOverrideEnabled").checked,
      siteThreshold: root.querySelector("#siteThresholdValue").value,
      managerOpen: root.querySelector("#siteSettingsManager").hidden === false,
      managerRows: Array.from(root.querySelectorAll(".site-manager__item")).map((item) => ({
        hostname: item.dataset.hostname,
        state: item.querySelector(".site-manager__state").textContent,
        threshold: item.querySelector(".site-manager__threshold").textContent,
      })),
      sessionState: root.querySelector(".session-section").dataset.state,
      stored: window.__SURFACED_CAPTURE__.settingsStore.getState(),
    };
  });
}

async function setImportFile(page, contents, name = "surfaced-settings.json") {
  await page.locator("#settingsImportFile").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
}

async function waitForImportPreview(page) {
  await page.waitForFunction(() => (
    document.getElementById("root").shadowRoot.querySelector(".import-preview").hidden === false
  ));
}

async function testPopupSettingsImportExport(browser, origin) {
  for (const platform of ["desktop", "android"]) {
    const params = new URLSearchParams({
      platform,
      tab: "https://current.example/article",
      threshold: "7",
      text: "Current reminder",
      enabled: "1",
      disabledDomains: "old-disabled.example",
      siteOverrides: "old-override.example:9",
      sessionPaused: "1",
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 980 } });
    await page.goto(`${origin}/tools/capture/popup-harness.html?${params}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);

    await page.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      root.querySelector("[aria-controls='siteSettingsManager']").click();
    });
    const initial = await popupSettingsSnapshot(page);
    assert.equal(initial.managerOpen, true);
    assert.equal(initial.sessionState, "paused");

    const downloadPromise = page.waitForEvent("download");
    await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector("#settingsExport").click());
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^surfaced-settings-\d{4}-\d{2}-\d{2}\.json$/);
    const downloadStream = await download.createReadStream();
    const downloadChunks = [];
    for await (const chunk of downloadStream) downloadChunks.push(chunk);
    const downloaded = JSON.parse(Buffer.concat(downloadChunks).toString("utf8"));
    assert.equal(downloaded.format, "surfaced-settings");
    assert.equal(downloaded.formatVersion, 1);
    assert.deepEqual(Object.keys(downloaded.settings), [
      "scrollNotifierThreshold",
      "scrollNotifierText",
      "scrollNotifierEnabled",
      "scrollNotifierDisabledDomains",
      "scrollNotifierSiteOverrides",
    ]);
    assert.equal(Object.prototype.hasOwnProperty.call(downloaded, "scrollNotifierSessionPaused"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(downloaded.settings, "scrollNotifierSessionPaused"), false);

    await setImportFile(page, JSON.stringify(importEnvelope()));
    await waitForImportPreview(page);
    const preview = await page.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      return {
        hidden: root.querySelector(".import-preview").hidden,
        values: Array.from(root.querySelectorAll(".import-preview__summary dd")).map((item) => item.textContent),
        focus: root.activeElement?.id,
      };
    });
    assert.equal(preview.hidden, false, `${platform}: valid file opens preview`);
    assert.deepEqual(preview.values, ["20.5 screens", "Imported local reminder", "No", "2", "2"]);
    assert.equal(preview.focus, "settingsImportReplace");

    await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector("#settingsImportCancel").click());
    assert.deepEqual(await popupSettingsSnapshot(page), initial, `${platform}: preview cancellation changes no state`);
    assert.equal((await popupFocus(page)).id, "settingsImport", `${platform}: cancel returns focus to import action`);

    await setImportFile(page, JSON.stringify(importEnvelope()));
    await waitForImportPreview(page);
    await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector("#settingsImportReplace").click());
    await page.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector("#globalThresholdValue").value === "20.5"
    ));
    const imported = await popupSettingsSnapshot(page);
    assert.deepEqual(imported, {
      threshold: "20.5",
      text: "Imported local reminder",
      enabled: false,
      siteEnabled: false,
      siteOverrideEnabled: true,
      siteThreshold: "5.5",
      managerOpen: true,
      managerRows: [
        { hostname: "current.example", state: "Disabled", threshold: "Site override: 5.5 screens" },
        { hostname: "new-disabled.example", state: "Disabled", threshold: "Global threshold: 20.5 screens" },
        { hostname: "new-override.example", state: "Enabled", threshold: "Site override: 100 screens" },
      ],
      sessionState: "paused",
      stored: importEnvelope().settings,
    }, `${platform}: confirmed import refreshes current-site controls and open manager`);
    assert.equal((await popupFocus(page)).id, "settingsImport");
    await page.close();

    const errorPage = await browser.newPage({ viewport: { width: 1280, height: 980 } });
    await errorPage.goto(`${origin}/tools/capture/popup-harness.html?${params}&storageSetFailures=1`, {
      waitUntil: "networkidle",
    });
    await waitForReady(errorPage);
    await errorPage.evaluate(() => document.getElementById("root").shadowRoot
      .querySelector("[aria-controls='siteSettingsManager']").click());
    const beforeFailure = await popupSettingsSnapshot(errorPage);
    await setImportFile(errorPage, JSON.stringify(importEnvelope()));
    await waitForImportPreview(errorPage);
    await errorPage.evaluate(() => document.getElementById("root").shadowRoot.querySelector("#settingsImportReplace").click());
    await errorPage.waitForFunction(() => !document.getElementById("root").shadowRoot.querySelector(".import-error").hidden);
    assert.deepEqual(await popupSettingsSnapshot(errorPage), beforeFailure, `${platform}: write failure changes no controls or manager state`);
    assert.equal((await popupFocus(errorPage)).id, "settingsImportReplace", `${platform}: write error preserves confirmation focus`);
    assert.equal(await errorPage.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".import-preview").hidden), false);
    await errorPage.close();

    const oversizedPage = await browser.newPage({ viewport: { width: 1280, height: 980 } });
    await oversizedPage.goto(`${origin}/tools/capture/popup-harness.html?${params}`, { waitUntil: "networkidle" });
    await waitForReady(oversizedPage);
    await oversizedPage.evaluate(() => document.getElementById("root").shadowRoot.querySelector("#settingsImport").focus());
    const oversizedBefore = await popupSettingsSnapshot(oversizedPage);
    await setImportFile(oversizedPage, "x".repeat(256 * 1024 + 1), "too-large.json");
    assert.deepEqual(await popupSettingsSnapshot(oversizedPage), oversizedBefore, `${platform}: oversized file changes no settings`);
    assert.equal(await oversizedPage.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".import-preview").hidden), true);
    assert.equal((await popupFocus(oversizedPage)).id, "settingsImport", `${platform}: file size error preserves focus`);
    await oversizedPage.close();
  }
}

const playwright = await loadPlaywright();
const server = await startServer();
const browserName = process.env.SURFACED_BROWSER === "firefox" ? "firefox" : "chromium";
const browser = await playwright[browserName].launch({
  headless: true,
  ...(browserName === "chromium" ? { executablePath: "/usr/bin/chromium" } : {}),
});

try {
  const smokeScope = process.env.SURFACED_SMOKE_SCOPE || "full";
  if (smokeScope === "permission-health") {
    await testPermissionHealthUi(browser, server.origin);
  } else if (smokeScope === "import-export") {
    await testPopupSettingsImportExport(browser, server.origin);
  } else {
    await testReminderResponsiveness(browser, server.origin);
    await testReminderCycleAndSessionPause(browser, server.origin);
    await testReducedMotion(browser, server.origin);
    await testPopupSessionUi(browser, server.origin);
    await testPermissionHealthUi(browser, server.origin);
    await testPopupKeyboardAndSiteManager(browser, server.origin);
    await testPopupSettingsImportExport(browser, server.origin);
  }
  console.log(`${browserName === "firefox" ? "Firefox" : "Chromium"} harness smoke: pass`);
} finally {
  await browser.close();
  await server.close();
}
