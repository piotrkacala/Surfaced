import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { capturePageOptions, MOTION_SCENES, STATIC_SCENES } from "../tools/capture/scene-definitions.mjs";

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

async function managerFocus(page) {
  const focus = await popupFocus(page);
  return focus ? { hostname: focus.hostname, action: focus.action } : null;
}

async function managerRowText(page, hostname, selector) {
  return page.evaluate(({ hostname, selector }) => (
    document.getElementById("root").shadowRoot
      .querySelector(`[data-hostname='${hostname}'] ${selector}`)?.textContent ?? null
  ), { hostname, selector });
}

async function managerActionCount(page, hostname, action) {
  return page.evaluate(({ hostname, action }) => (
    document.getElementById("root").shadowRoot
      .querySelectorAll(`[data-hostname='${hostname}'] [data-manager-action='${action}']`).length
  ), { hostname, action });
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
    const icon = root.querySelector(".notification__icon");
    const message = root.querySelector(".notification__text");
    const notificationRect = notification.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const hostStyle = getComputedStyle(host);

    return {
      viewportWidth: document.documentElement.clientWidth,
      hostClientWidth: host.clientWidth,
      hostScrollWidth: host.scrollWidth,
      notificationLeft: notificationRect.left,
      notificationRight: notificationRect.right,
      closeLeft: closeRect.left,
      closeRight: closeRect.right,
      closeWidth: closeRect.width,
      closeHeight: closeRect.height,
      closeAriaLabel: close.getAttribute("aria-label"),
      hostDisplay: hostStyle.display,
      hostVisibility: hostStyle.visibility,
      hostOpacity: hostStyle.opacity,
      hostPosition: hostStyle.position,
      iconWidth: iconRect.width,
      iconAriaHidden: icon.getAttribute("aria-hidden"),
      svgAriaHidden: icon.querySelector("svg").getAttribute("aria-hidden"),
      messageRole: message.getAttribute("role"),
      messageLive: message.getAttribute("aria-live"),
      notificationRole: notification.getAttribute("role"),
      subtitleCount: root.querySelectorAll(".notification__sub").length,
      interactiveCount: root.querySelectorAll("button, a, [role='button']").length,
    };
  });
}

async function testReminderResponsiveness(browser, origin) {
  for (const { width, hasTouch } of [
    { width: 320, hasTouch: false },
    { width: 360, hasTouch: false },
    { width: 386, hasTouch: false },
    { width: 900, hasTouch: true },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 640 }, hasTouch });
    await installClosedShadowProbe(page);
    await page.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=shallow`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);
    await page.waitForFunction(() => document.getElementById("surfaced-notification-host"));
    assert.equal(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), hasTouch);
    // Hostile page CSS aimed at the reminder host. The fixture root is spared:
    // collapsing it scrolls the page to the top, which correctly hides the
    // reminder and made this check race the scroll handler.
    await page.addStyleTag({ content: `
      body > div:not(#fixture-root) {
        display: none;
        visibility: hidden;
        width: 1px;
        opacity: 0.01;
        transform: scale(0);
        filter: blur(10px);
      }
    ` });

    const metrics = await reminderMetrics(page);
    assert.ok(metrics, `reminder should be visible at ${width}px`);
    assert.ok(metrics.hostScrollWidth <= metrics.hostClientWidth, `host must not overflow at ${width}px`);
    assert.ok(metrics.notificationLeft >= 0, `reminder left edge must be visible at ${width}px`);
    assert.ok(metrics.notificationRight <= metrics.viewportWidth, `reminder right edge must be visible at ${width}px`);
    assert.ok(metrics.closeLeft >= 0 && metrics.closeRight <= metrics.viewportWidth, `close button must be visible at ${width}px`);
    assert.equal(metrics.closeAriaLabel, "Dismiss this reminder");
    assert.ok(metrics.closeWidth >= 44 && metrics.closeHeight >= 44, `close target must be at least 44px at ${width}px`);
    assert.equal(metrics.hostDisplay, "block");
    assert.equal(metrics.hostVisibility, "visible");
    assert.equal(metrics.hostOpacity, "1");
    assert.equal(metrics.hostPosition, "fixed");
    assert.equal(metrics.iconWidth, 32);
    assert.equal(metrics.iconAriaHidden, "true");
    assert.equal(metrics.svgAriaHidden, "true");
    assert.equal(metrics.messageRole, "status");
    assert.equal(metrics.messageLive, "polite");
    assert.equal(metrics.notificationRole, null);
    assert.equal(metrics.subtitleCount, 0);
    assert.equal(metrics.interactiveCount, 1);
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
    await page.keyboard.press(width === 360 ? "Space" : "Enter");
    await page.waitForFunction(() => !document.getElementById("surfaced-notification-host"));
    await page.close();
  }
}

// These localized reminders need three lines at 320px; textContent alone would
// still pass if the card clipped them. Firefox reports 1px of glyph overflow on
// text that fits at 390px, so the check allows exactly that much.
async function testLocalizedReminderFitsNarrowViewport(browser, origin) {
  const zoneMessageKeys = { mid: "notificationMid", deep: "notificationDeep" };
  for (const { locale, zone, width } of [
    { locale: "pl", zone: "deep", width: 320 },
    { locale: "fr", zone: "mid", width: 320 },
    { locale: "fr", zone: "deep", width: 320 },
    { locale: "fr", zone: "deep", width: 390 },
  ]) {
    const messages = JSON.parse(await fs.readFile(
      path.join(repoRoot, "shared", "_locales", locale, "messages.json"),
      "utf8"
    ));
    const page = await browser.newPage({ viewport: { width, height: 640 } });
    await installClosedShadowProbe(page);
    await page.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=${zone}&locale=${locale}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);
    await page.waitForFunction(() => document.getElementById("surfaced-notification-host"));
    const message = await page.evaluate(() => {
      const host = document.getElementById("surfaced-notification-host");
      const title = window.__surfacedTestShadowRoots.get(host).querySelector(".notification__title");
      return {
        text: title.textContent,
        scrollHeight: title.scrollHeight,
        clientHeight: title.clientHeight,
      };
    });
    assert.equal(message.text, messages[zoneMessageKeys[zone]].message);
    assert.ok(
      message.scrollHeight - message.clientHeight <= 1,
      `${locale} ${zone} reminder must be fully visible at ${width}px (${message.scrollHeight}px content in ${message.clientHeight}px)`
    );
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
  assert.deepEqual(pauseResponse, { ok: true, paused: true, resumeCount: 0 });
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
  assert.deepEqual(resumeResponse, { ok: true, paused: false, resumeCount: 1 });
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

async function testRestoredPageSessionRefreshFailure(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await installClosedShadowProbe(page);
  await page.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=shallow`, {
    waitUntil: "networkidle",
  });
  await waitForReady(page);
  await page.waitForFunction(() => document.getElementById("surfaced-notification-host"));
  await page.evaluate(() => browser.runtime.sendMessage({ type: "SET_SESSION_PAUSED", paused: true }));
  await page.waitForFunction(() => !document.getElementById("surfaced-notification-host"));

  // A back/forward cache restore refreshes the session state; that read fails.
  await page.evaluate(() => {
    window.__SURFACED_CAPTURE__.sessionFailureState.get = 1;
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await page.waitForFunction(() => window.__SURFACED_CAPTURE__.sessionFailureState.get === 0);
  await page.waitForTimeout(180);
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator("#surfaced-notification-host").count(),
    0,
    "a failed session refresh after restore must keep the known pause"
  );
  assert.deepEqual(await page.evaluate(() => (
    window.__SURFACED_CAPTURE__.runtimeMessages
      .filter((message) => message.type === "SCROLL_DEPTH")
      .at(-1)
  )), { type: "SCROLL_DEPTH", value: 0 }, "the restored page republishes a cleared badge");
  await page.close();
}

async function testCanonicalRuntimeHostname(browser, origin) {
  const trailingDotOrigin = origin.replace("127.0.0.1", "127.0.0.1.");

  for (const query of [
    "threshold=1&zone=shallow&disabledDomains=127.0.0.1",
    "threshold=1&zone=shallow&siteOverrides=127.0.0.1%3A100",
  ]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
    await page.goto(`${trailingDotOrigin}/fixtures/marketing/long-article.html?${query}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);
    await page.waitForTimeout(180);
    assert.equal(
      await page.locator("#surfaced-notification-host").count(),
      0,
      "a trailing-dot page hostname must use canonical disabled-site and override settings"
    );
    await page.close();
  }
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
    const chevrons = [...root.querySelectorAll(".notification__chevron")];
    return {
      animation: getComputedStyle(notification).animationName,
      chevronAnimations: chevrons.map((chevron) => getComputedStyle(chevron).animationName),
      bubbleCount: root.querySelectorAll(".bubble").length,
    };
  });
  assert.deepEqual(reminderMotion, {
    animation: "none",
    chevronAnimations: ["none", "none", "none"],
    bubbleCount: 0,
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
      const preview = root.querySelector(".preview-block .notification");
      return {
        sessionState: root.querySelector(".session-section").dataset.state,
        shellAnimation: getComputedStyle(shell).animationName,
        shellBeforeAnimation: getComputedStyle(shell, "::before").animationName,
        previewChevronAnimations: [...preview.querySelectorAll(".notification__chevron")]
          .map((chevron) => getComputedStyle(chevron).animationName),
        bubbleCount: root.querySelectorAll(".bubble").length,
      };
    });
    assert.deepEqual(popupMotion, {
      sessionState: "active",
      shellAnimation: "none",
      shellBeforeAnimation: "none",
      previewChevronAnimations: ["none", "none", "none"],
      bubbleCount: 0,
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

  assert.deepEqual(await sessionViews(page), {
    state: "active",
    bannerHidden: true,
    pauseHidden: false,
    pauseLabel: "Pause until browser restarts",
  }, "active reminders show only the quiet pause action");

  await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".pause-action").click());
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
    title: "Reminders paused",
    action: "Resume now",
    aria: "Resume reminders now on all tabs",
  });
  assert.deepEqual(await sessionViews(page), {
    state: "paused",
    bannerHidden: false,
    pauseHidden: true,
    pauseLabel: "Pause until browser restarts",
  }, "a paused session replaces the quiet action with the banner");

  await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".session-action").click());
  await page.waitForFunction(() => (
    document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "active"
  ));
  assert.equal((await sessionViews(page)).bannerHidden, true);
  await page.close();

  const errorPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await errorPage.goto(`${origin}/tools/capture/popup-harness.html?platform=android&sessionGetFailures=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(errorPage);
  assert.deepEqual(await sessionViews(errorPage), {
    state: "error",
    bannerHidden: false,
    pauseHidden: true,
    pauseLabel: "Pause until browser restarts",
  }, "an unavailable session state is shown in the banner with retry");
  await errorPage.evaluate(() => document.getElementById("root").shadowRoot.querySelector(".session-action").click());
  await errorPage.waitForFunction(() => (
    document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "active"
  ));
  assert.equal((await sessionViews(errorPage)).pauseHidden, false);
  await errorPage.close();
}

async function sessionViews(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root").shadowRoot;
    const pause = root.querySelector(".pause-action");
    return {
      state: root.querySelector(".session-section").dataset.state,
      bannerHidden: root.querySelector(".session-section").hidden,
      pauseHidden: pause.hidden,
      pauseLabel: pause.textContent,
    };
  });
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

async function permissionSectionHidden(page) {
  return page.evaluate(() => (
    document.getElementById("root").shadowRoot.querySelector(".permission-section").hidden
  ));
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
    assert.equal(await permissionSectionHidden(fullPage), true, `${platform}: healthy page access needs no card`);
    await fullPage.close();

    const missingPage = await openPermissionPopup(browser, origin, {
      platform,
      permission: "missing",
      permissionRequest: "grant",
    });
    assert.equal((await permissionUiSnapshot(missingPage)).state, "missing");
    assert.equal((await permissionUiSnapshot(missingPage)).contentHidden, false);
    assert.equal(await permissionSectionHidden(missingPage), false, `${platform}: missing page access shows the card`);
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
    assert.equal((await popupFocus(keyboardRestorePage)).controls, "thresholdHelper", `${platform}: threshold settings follow permission restore`);
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
    assert.equal((await popupFocus(keyboardRestorePage)).controls, "thresholdHelper", `${platform}: restored status is not a permanent Tab stop`);
    assert.equal(await permissionSectionHidden(keyboardRestorePage), false, `${platform}: restored access keeps its reload hint visible`);
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
    assert.equal((await popupFocus(page)).controls, "thresholdHelper", `${platform}: threshold settings follow the global switch`);
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
        || (focus.className.includes("pause-action") ? "pause-action" : focus.tagName)
      );
    }
    assert.deepEqual(tabOrder, [
      "enabled",
      "thresholdHelper",
      "decrement",
      "globalThresholdValue",
      "increment",
      "siteEnabled",
      "siteOverrideEnabled",
      "siteSettingsManager",
      "pause-action",
      "notificationText",
      "settingsExport",
      "settingsImport",
    ], `${platform}: Tab order includes every primary switch, session pause, and backup action`);

    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).id, "settingsExport", `${platform}: Shift+Tab reverses through backup actions`);
    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).id, "notificationText", `${platform}: Shift+Tab returns to reminder text`);
    await page.keyboard.press("Shift+Tab");
    assert.match((await popupFocus(page)).className, /pause-action/, `${platform}: Shift+Tab reaches the quiet pause action`);
    const actionFocusStyle = await page.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      return getComputedStyle(root.querySelector(".pause-action")).outlineStyle;
    });
    assert.equal(actionFocusStyle, "solid", `${platform}: actions have visible keyboard focus`);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "paused"
    ));
    assert.match((await popupFocus(page)).className, /session-action/, `${platform}: pausing moves focus to Resume in the banner`);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".session-section").dataset.state === "active"
    ));
    assert.match((await popupFocus(page)).className, /pause-action/, `${platform}: resuming returns focus to the quiet pause action`);
    await page.keyboard.press("Shift+Tab");
    assert.equal((await popupFocus(page)).controls, "siteSettingsManager", `${platform}: Shift+Tab reaches site manager from the pause action`);
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
      { hostname: "both.example", state: "Disabled", threshold: "Custom threshold · 5.5 screens" },
      { hostname: "disabled-only.example", state: "Disabled", threshold: "Global threshold · 7 screens" },
      { hostname: "override-only.example", state: "Enabled", threshold: "Custom threshold · 12 screens" },
    ]);
    assert.deepEqual(await managerPage.evaluate(() => {
      const input = document.getElementById("root").shadowRoot
        .querySelector("[data-hostname='both.example'] [data-manager-action='toggle-enabled']");
      return { role: input.getAttribute("role"), label: input.getAttribute("aria-label"), checked: input.checked };
    }), { role: "switch", label: "Enabled on both.example", checked: false }, `${platform}: each saved site has an enabled switch`);

    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "both.example" && focus.action === "toggle-enabled"
    ));
    await managerPage.keyboard.press("Space");
    assert.equal(await managerRowText(managerPage, "both.example", ".site-manager__state"), "Enabled");
    assert.deepEqual(
      await managerFocus(managerPage),
      { hostname: "both.example", action: "toggle-enabled" },
      `${platform}: a row that remains keeps focus on its switch`
    );

    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "disabled-only.example" && focus.action === "edit-threshold"
    ));
    await managerPage.keyboard.press("Enter");
    assert.equal((await popupFocus(managerPage)).action, "override-input");
    assert.equal(
      await managerActionCount(managerPage, "disabled-only.example", "use-global"),
      0,
      `${platform}: Use global threshold appears only for a saved custom threshold`
    );
    await managerPage.keyboard.press("Control+A");
    await managerPage.keyboard.type("5.25");
    await managerPage.keyboard.press("Enter");
    assert.equal(
      await managerRowText(managerPage, "disabled-only.example", ".site-manager__threshold"),
      "Custom threshold · 5.25 screens"
    );
    assert.deepEqual(
      await managerFocus(managerPage),
      { hostname: "disabled-only.example", action: "edit-threshold" },
      `${platform}: saving returns focus to Edit`
    );

    await managerPage.keyboard.press("Enter");
    await managerPage.keyboard.press("Escape");
    assert.deepEqual(
      await managerFocus(managerPage),
      { hostname: "disabled-only.example", action: "edit-threshold" },
      `${platform}: Escape in the editor returns focus to Edit`
    );

    await managerPage.keyboard.press("Enter");
    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "disabled-only.example" && focus.action === "use-global"
    ));
    await managerPage.keyboard.press("Enter");
    assert.deepEqual({
      state: await managerRowText(managerPage, "disabled-only.example", ".site-manager__state"),
      threshold: await managerRowText(managerPage, "disabled-only.example", ".site-manager__threshold"),
    }, {
      state: "Disabled",
      threshold: "Global threshold · 7 screens",
    }, `${platform}: Use global threshold changes only the threshold`);
    assert.deepEqual(
      await managerFocus(managerPage),
      { hostname: "disabled-only.example", action: "edit-threshold" },
      `${platform}: a row that remains after Use global threshold focuses Edit`
    );

    // Enabling a site with nothing else saved removes its row.
    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "disabled-only.example" && focus.action === "toggle-enabled"
    ), { backwards: true });
    await managerPage.keyboard.press("Space");
    assert.equal(await managerActionCount(managerPage, "disabled-only.example", "toggle-enabled"), 0);
    assert.equal(
      (await popupFocus(managerPage))?.hostname,
      "override-only.example",
      `${platform}: a row that disappears focuses the next row`
    );

    await tabUntil(managerPage, (focus) => (
      focus?.hostname === "override-only.example" && focus.action === "remove-site"
    ));
    await managerPage.keyboard.press("Enter");
    assert.equal((await popupFocus(managerPage)).action, "confirm");
    assert.equal(
      await managerRowText(managerPage, "override-only.example", ".site-manager__confirmation-text"),
      "Remove saved settings for override-only.example? The site will follow your global settings again. This does not turn reminders off.",
      `${platform}: removal explains the site returns to global settings`
    );
    await managerPage.keyboard.press("Escape");
    assert.deepEqual(
      await managerFocus(managerPage),
      { hostname: "override-only.example", action: "remove-site" },
      `${platform}: Escape in the confirmation returns focus to Remove site settings`
    );

    // Follow the manager's real next-neighbor focus. This keeps every traversal
    // inside the document and does not depend on Firefox wrapping Tab after the page.
    const removalOrder = ["override-only.example", "both.example"];
    const expectedFocusAfterRemoval = ["both.example", ""];
    for (const [index, hostname] of removalOrder.entries()) {
      const isTarget = (focus) => focus?.hostname === hostname && focus.action === "remove-site";
      if (!isTarget(await managerFocus(managerPage))) {
        await tabUntil(managerPage, isTarget);
      }
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
    const newerImportedSettings = {
      scrollNotifierThreshold: 23.125,
      scrollNotifierText: "Newer imported reminder",
      scrollNotifierEnabled: false,
      scrollNotifierDisabledDomains: ["imported.example"],
      scrollNotifierSiteOverrides: { "imported.example": 0.004 },
    };
    assert.equal(await writeFailurePage.evaluate(async (settings) => {
      const response = await browser.runtime.sendMessage({
        type: "SURFACED_SETTINGS_REPLACE",
        settings,
      });
      return response.ok;
    }, newerImportedSettings), true, `${platform}: external import succeeds before popup retry`);
    await writeFailurePage.keyboard.press("Enter");
    await writeFailurePage.waitForFunction(() => (
      document.getElementById("root").shadowRoot.querySelector(".storage-state").hidden
    ));
    assert.equal((await popupFocus(writeFailurePage)).id, "enabled", `${platform}: successful retry moves focus out of the hidden error panel`);
    assert.deepEqual(
      await writeFailurePage.evaluate(() => window.__SURFACED_CAPTURE__.settingsStore.getState()),
      newerImportedSettings,
      `${platform}: retry preserves the newer imported snapshot`
    );
    await writeFailurePage.close();
  }
}

// The manager list is rebuilt after every change, so editor state must survive
// a rebuild and must not outlive the row it belongs to.
async function testSiteManagerEditorAcrossRebuilds(browser, origin) {
  for (const platform of ["desktop", "android"]) {
    const params = new URLSearchParams({
      platform,
      tab: "about:config",
      disabledDomains: "both.example,disabled-only.example",
      siteOverrides: "both.example:5.5",
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${origin}/tools/capture/popup-harness.html?${params}`, { waitUntil: "networkidle" });
    await waitForReady(page);
    const root = page.locator("#root");
    await root.locator("[aria-controls='siteSettingsManager']").click();

    await root.locator("[data-hostname='both.example'] [data-manager-action='edit-threshold']").click();
    const draftInput = root.locator("[data-hostname='both.example'] [data-manager-action='override-input']");
    await draftInput.fill("9.25");
    await root.locator("[data-hostname='both.example'] [data-manager-action='toggle-enabled']").focus();
    await page.keyboard.press("Space");
    assert.equal(await managerRowText(page, "both.example", ".site-manager__state"), "Enabled");
    assert.equal(await draftInput.inputValue(), "9.25", `${platform}: switching a site keeps its unsaved threshold`);

    await root.locator("[data-hostname='disabled-only.example'] [data-manager-action='edit-threshold']").click();
    await root.locator("[data-hostname='disabled-only.example'] [data-manager-action='toggle-enabled']").focus();
    await page.keyboard.press("Space");
    assert.equal(await managerActionCount(page, "disabled-only.example", "toggle-enabled"), 0);
    assert.equal((await popupFocus(page))?.hostname, "both.example", `${platform}: the edited row disappearing focuses the next row`);
    await page.keyboard.press("Escape");
    assert.equal(
      (await popupFocus(page))?.controls,
      "siteSettingsManager",
      `${platform}: Escape after the edited row disappears closes the manager`
    );
    assert.equal(await page.evaluate(() => (
      document.getElementById("root").shadowRoot.querySelector("#siteSettingsManager").hidden
    )), true);
    await page.close();
  }
}

async function testThresholdEditing(browser, origin) {
  for (const platform of ["desktop", "android"]) {
    const params = new URLSearchParams({
      platform,
      tab: "https://current.example/article",
      threshold: "7",
      siteOverrides: "tiny.example:0.004;precise.example:7.999",
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${origin}/tools/capture/popup-harness.html?${params}`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);

    const globalInput = page.locator("#root").locator("#globalThresholdValue");
    await globalInput.focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("5.5", { delay: 20 });
    await page.waitForFunction(() => (
      window.__SURFACED_CAPTURE__.settingsStore.getState().scrollNotifierThreshold === 5.5
    ));
    assert.equal(await globalInput.inputValue(), "5.5", `${platform}: typing preserves the threshold draft`);

    await page.keyboard.press("Control+A");
    await page.keyboard.type("5.25", { delay: 20 });
    await page.waitForFunction(() => (
      window.__SURFACED_CAPTURE__.settingsStore.getState().scrollNotifierThreshold === 5.25
    ));
    assert.equal(await globalInput.evaluate((input) => input.checkValidity()), true, `${platform}: custom positive values are valid`);
    assert.equal(await globalInput.getAttribute("step"), "any");

    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    assert.equal(await globalInput.inputValue(), "");
    assert.equal(await page.evaluate(() => (
      window.__SURFACED_CAPTURE__.settingsStore.getState().scrollNotifierThreshold
    )), 5.25, `${platform}: an incomplete draft is not persisted`);
    await globalInput.blur();
    assert.equal(await globalInput.inputValue(), "5.25", `${platform}: blur restores the last accepted value`);

    const root = page.locator("#root");
    await root.locator("#siteOverrideEnabled").check();
    const siteInput = root.locator("#siteThresholdValue");
    await siteInput.focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("0.004", { delay: 20 });
    await page.waitForFunction(() => (
      window.__SURFACED_CAPTURE__.settingsStore.getState()
        .scrollNotifierSiteOverrides["current.example"] === 0.004
    ));
    assert.equal(await siteInput.inputValue(), "0.004");
    assert.equal(await siteInput.getAttribute("step"), "any");

    await root.locator("[aria-controls='siteSettingsManager']").click();
    const summaries = await root.locator(".site-manager__threshold").allTextContents();
    assert.ok(summaries.includes("Custom threshold · 0.004 screens"));
    assert.ok(summaries.includes("Custom threshold · 7.999 screens"));

    for (const input of [globalInput, siteInput]) {
      const control = input.locator("../..");
      for (const [initial, incremented] of [
        [5.254, 5.754],
        [7.999, 8.499],
        [1e-7, 0.5000001],
        [1e21, 1e21],
        [Number.MAX_VALUE, Number.MAX_VALUE],
      ]) {
        await input.fill(String(initial));
        await control.locator('[data-direction="increment"]').click();
        assert.equal(await input.inputValue(), String(incremented), `${platform}: decimal increment from ${initial}`);
        await page.evaluate(() => window.__SURFACED_CAPTURE__.settingsStore.whenIdle());
        const storedValue = await input.evaluate(async (element) => {
          const state = await browser.storage.local.get(null);
          return element.id === "globalThresholdValue"
            ? state.scrollNotifierThreshold
            : state.scrollNotifierSiteOverrides["current.example"];
        });
        assert.equal(storedValue, incremented, `${platform}: stepper persists the exact result`);
        await control.locator('[data-direction="decrement"]').click();
        assert.equal(await input.inputValue(), String(initial), `${platform}: decimal decrement back to ${initial}`);
      }
    }
    await page.close();
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
    document.getElementById("importPreview").hidden === false
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
    assert.equal(await page.evaluate(() => document.getElementById("root").shadowRoot
      .querySelector("input[type='file']")), null, `${platform}: popup contains no file picker`);

    assert.equal(await page.evaluate(async () => {
      const response = await browser.runtime.sendMessage({
        type: "SURFACED_SETTINGS_UPDATE",
        patch: { scrollNotifierThreshold: 9.125 },
      });
      return response.ok;
    }), true, `${platform}: external settings update succeeds before export`);

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
    assert.equal(downloaded.settings.scrollNotifierThreshold, 9.125, `${platform}: export reads the fresh authoritative state`);
    assert.deepEqual(Object.keys(downloaded.settings), [
      "scrollNotifierThreshold",
      "scrollNotifierText",
      "scrollNotifierEnabled",
      "scrollNotifierDisabledDomains",
      "scrollNotifierSiteOverrides",
    ]);
    assert.equal(Object.prototype.hasOwnProperty.call(downloaded, "scrollNotifierSessionPaused"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(downloaded.settings, "scrollNotifierSessionPaused"), false);

    if (platform === "desktop") {
      await page.evaluate(() => document.getElementById("root").shadowRoot.querySelector("#settingsImport").click());
      assert.deepEqual(await page.evaluate(() => window.__SURFACED_CAPTURE__.tabCalls), [{
        method: "create",
        details: {
          url: `${origin}/settings-import/index.html`,
          active: true,
        },
      }], "desktop popup opens the persistent import page in a new active tab");
    }
    await page.close();
  }

  const oversizedExportPage = await browser.newPage({ viewport: { width: 900, height: 780 } });
  await oversizedExportPage.goto(`${origin}/tools/capture/popup-harness.html?platform=desktop`, {
    waitUntil: "networkidle",
  });
  await waitForReady(oversizedExportPage);
  assert.equal(await oversizedExportPage.evaluate(async (oversizedText) => {
    const current = window.__SURFACED_CAPTURE__.settingsStore.getState();
    const response = await browser.runtime.sendMessage({
      type: "SURFACED_SETTINGS_REPLACE",
      settings: { ...current, scrollNotifierText: oversizedText },
    });
    return response.ok;
  }, "🌊".repeat(70_000)), true);
  let oversizedDownloadCount = 0;
  oversizedExportPage.on("download", () => { oversizedDownloadCount += 1; });
  await oversizedExportPage.evaluate(() => document.getElementById("root").shadowRoot
    .querySelector("#settingsExport").click());
  await oversizedExportPage.waitForFunction(() => document.getElementById("root").shadowRoot
    .querySelector(".status").textContent.includes("too large"));
  assert.equal(oversizedDownloadCount, 0, "over-limit settings must not create a download");
  await oversizedExportPage.close();

  const popupErrorPage = await browser.newPage({ viewport: { width: 900, height: 780 } });
  await popupErrorPage.goto(`${origin}/tools/capture/popup-harness.html?platform=desktop&tabCreateFailures=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(popupErrorPage);
  await popupErrorPage.evaluate(() => document.getElementById("root").shadowRoot.querySelector("#settingsImport").click());
  await popupErrorPage.waitForFunction(() => !document.getElementById("root").shadowRoot.querySelector(".import-error").hidden);
  assert.match(await popupErrorPage.evaluate(() => document.getElementById("root").shadowRoot
    .querySelector(".import-error").textContent), /couldn't open the settings import page/i);
  await popupErrorPage.close();

  const importParams = new URLSearchParams({
    platform: "desktop",
    threshold: "7",
    text: "Current reminder",
    enabled: "1",
    disabledDomains: "old-disabled.example",
    siteOverrides: "old-override.example:9",
    sessionPaused: "1",
  });
  const importPage = await browser.newPage({ viewport: { width: 900, height: 780 } });
  await importPage.goto(`${origin}/tools/capture/settings-import-harness.html?${importParams}`, {
    waitUntil: "networkidle",
  });
  await waitForReady(importPage);
  const initialStore = await importPage.evaluate(() => window.__SURFACED_CAPTURE__.storageArea.get(null));

  await setImportFile(importPage, JSON.stringify(importEnvelope()));
  await waitForImportPreview(importPage);
  assert.deepEqual(await importPage.locator(".preview__summary dd").allTextContents(), [
    "20.5 screens",
    "Imported local reminder",
    "No",
    "2",
    "2",
  ]);
  assert.equal(await importPage.evaluate(() => document.activeElement?.id), "previewTitle");
  await importPage.locator("#cancelImport").click();
  assert.deepEqual(await importPage.evaluate(() => window.__SURFACED_CAPTURE__.storageArea.get(null)), initialStore);
  assert.equal(await importPage.evaluate(() => window.__SURFACED_CAPTURE__.sessionPaused), true);

  await setImportFile(importPage, JSON.stringify(importEnvelope()));
  await waitForImportPreview(importPage);
  await importPage.evaluate(() => {
    const original = browser.runtime.sendMessage;
    browser.runtime.sendMessage = (message) => new Promise((resolve) => {
      window.__releaseImportWrite = () => original(message).then(resolve);
    });
  });
  await importPage.locator("#replaceSettings").click();
  assert.equal(await importPage.locator("#replaceSettings").isDisabled(), true);
  assert.equal(await importPage.locator("#replaceSettings").getAttribute("aria-busy"), "true");
  await importPage.evaluate(() => window.__releaseImportWrite());
  await importPage.waitForFunction(() => !document.getElementById("importSuccess").hidden);
  assert.deepEqual(await importPage.evaluate(() => window.__SURFACED_CAPTURE__.storageArea.get(null)), importEnvelope().settings);
  assert.equal(await importPage.evaluate(() => window.__SURFACED_CAPTURE__.sessionPaused), true, "session pause survives import");
  assert.equal(await importPage.evaluate(() => document.activeElement?.id), "successTitle");
  await importPage.locator("#closeTab").click();
  assert.deepEqual(await importPage.evaluate(() => window.__SURFACED_CAPTURE__.tabCalls), [
    { method: "getCurrent" },
    { method: "remove", tabId: 1 },
  ], "close action uses tabs.getCurrent and tabs.remove");
  await importPage.locator("#importAnother").click();
  assert.equal(await importPage.evaluate(() => document.activeElement?.id), "chooseFileLabel");

  await setImportFile(importPage, "{ invalid JSON");
  await importPage.waitForFunction(() => !document.getElementById("importError").hidden);
  assert.match(await importPage.locator("#importError").textContent(), /isn't valid JSON/i);
  assert.equal(await importPage.evaluate(() => document.activeElement?.id), "importError");
  await importPage.close();

  const writeErrorPage = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await writeErrorPage.goto(`${origin}/tools/capture/settings-import-harness.html?${importParams}&storageSetFailures=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(writeErrorPage);
  await setImportFile(writeErrorPage, JSON.stringify(importEnvelope()));
  await waitForImportPreview(writeErrorPage);
  await writeErrorPage.locator("#replaceSettings").click();
  await writeErrorPage.waitForFunction(() => !document.getElementById("importError").hidden);
  assert.equal(await writeErrorPage.locator("#importPreview").isVisible(), true, "write error preserves preview");
  assert.equal(await writeErrorPage.evaluate(() => document.activeElement?.id), "replaceSettings");
  assert.deepEqual(await writeErrorPage.evaluate(() => window.__SURFACED_CAPTURE__.storageArea.get(null)), initialStore);
  await writeErrorPage.close();
}

// The import page follows the system theme, holds still, keeps its brand mark
// decorative, and stays inside a narrow viewport with a long unbroken value.
async function testSettingsImportAppearance(browser, origin) {
  const backgrounds = {};
  for (const colorScheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 }, colorScheme });
    await page.goto(`${origin}/tools/capture/settings-import-harness.html?locale=fr-FR`, {
      waitUntil: "networkidle",
    });
    await waitForReady(page);
    backgrounds[colorScheme] = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, `${colorScheme}: no running animations`);
    assert.deepEqual(await page.evaluate(() => {
      const mark = document.querySelector(".brand__mark");
      return {
        ariaHidden: mark.getAttribute("aria-hidden"),
        text: mark.textContent.trim(),
        icon: Boolean(mark.querySelector("svg")),
      };
    }), { ariaHidden: "true", text: "", icon: true });

    await setImportFile(page, JSON.stringify(importEnvelope({ scrollNotifierText: "W".repeat(120) })));
    await waitForImportPreview(page);
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    assert.ok(widths.scroll <= widths.client, `${colorScheme}: preview overflows at 320px (${widths.scroll}px in ${widths.client}px)`);
    await page.close();
  }
  assert.notEqual(backgrounds.light, backgrounds.dark, "page background follows the system theme");
}

async function openStoreScene(browser, origin, scene) {
  const page = await browser.newPage(capturePageOptions(scene));
  await installClosedShadowProbe(page);
  await page.goto(`${origin}${scene.page}?${new URLSearchParams(scene.params)}`, { waitUntil: "networkidle" });
  await waitForReady(page);
  return page;
}

async function renderedReminder(browser, origin, scene) {
  const page = await openStoreScene(browser, origin, scene);
  const reminder = await page.evaluate(() => {
    const host = document.getElementById("surfaced-notification-host");
    const card = host && window.__surfacedTestShadowRoots.get(host).querySelector(".notification");
    return card && {
      depth: Number(card.dataset.depth),
      litChevrons: card.querySelectorAll(".notification__chevron--lit").length,
      opacity: getComputedStyle(card).opacity,
    };
  });
  await page.close();
  return reminder;
}

async function renderedPopupScene(browser, origin, scene) {
  const page = await openStoreScene(browser, origin, scene);
  const state = await page.evaluate(() => {
    const root = document.getElementById("root").shadowRoot;
    return {
      focused: root.activeElement?.className ?? null,
      managerExpanded: root.querySelector("[aria-controls='siteSettingsManager']").getAttribute("aria-expanded"),
      customThresholdVisible: !root.querySelector(".site-override-panel").hidden,
      stageBackground: getComputedStyle(document.body).backgroundColor,
      popupBackground: getComputedStyle(root.querySelector(".shell")).backgroundColor,
    };
  });
  await page.close();
  return state;
}

// Store scenes must show what they claim, so this reads what each one rendered
// under the capture tool's own page options, not the scene's parameters.
async function testStoreScenes(browser, origin) {
  const settled = (depth) => ({ depth, litChevrons: depth, opacity: "1" });
  assert.deepEqual(
    await renderedReminder(browser, origin, STATIC_SCENES["desktop-reminder-context"]),
    settled(1),
    "s1 shows the first reminder in its settled state"
  );
  assert.deepEqual(
    await renderedReminder(browser, origin, STATIC_SCENES["reminder-escalation"]),
    settled(3),
    "the escalation scene reaches the deepest zone"
  );

  const heroPage = await openStoreScene(browser, origin, STATIC_SCENES["desktop-reminder-context"]);
  assert.deepEqual(await heroPage.evaluate(() => {
    const filterOf = (element) => getComputedStyle(element).filter;
    return {
      pageBlurred: filterOf(document.querySelector(".article-shell")) !== "none",
      copy: filterOf(document.querySelector(".capture-copy")),
      reminder: filterOf(document.getElementById("surfaced-notification-host")),
    };
  }), { pageBlurred: true, copy: "none", reminder: "none" }, "s1 softens only the placeholder page");
  await heroPage.close();

  const depthAnimation = MOTION_SCENES["anim-reminder-depth"];
  const depths = [];
  for (let frame = 0; frame < depthAnimation.frames; frame += 1) {
    const reminder = await renderedReminder(browser, origin, depthAnimation.build(frame / (depthAnimation.frames - 1)));
    depths.push(reminder?.depth ?? 0);
  }
  assert.equal(depths[0], 0, "the depth animation starts before the first reminder");
  assert.deepEqual(depths, [...depths].sort(), `the depth animation only goes deeper: ${depths}`);
  for (const zone of [1, 2, 3]) {
    assert.ok(depths.filter((depth) => depth === zone).length >= 3, `the depth animation holds zone ${zone}: ${depths}`);
  }

  const savedSites = await renderedPopupScene(browser, origin, STATIC_SCENES["site-settings-list"]);
  assert.equal(savedSites.managerExpanded, "true");
  assert.equal(savedSites.focused, null, "the open manager leaves no focus ring in the scene");

  const siteSettings = await renderedPopupScene(browser, origin, STATIC_SCENES["desktop-site-settings"]);
  assert.equal(siteSettings.managerExpanded, "false", "s4 keeps the saved-site manager closed");
  assert.equal(siteSettings.customThresholdVisible, true, "s4 shows the custom threshold");

  const lightPopup = await renderedPopupScene(browser, origin, STATIC_SCENES["desktop-threshold-control"]);
  const darkPopup = await renderedPopupScene(browser, origin, STATIC_SCENES["android-popup"]);
  assert.notEqual(darkPopup.popupBackground, lightPopup.popupBackground, "s5 shows the dark popup");
  assert.equal(darkPopup.stageBackground, lightPopup.stageBackground, "s5 keeps the light composition");
}

async function testFrenchLocalization(browser, origin) {
  const reminderMessages = {
    shallow: "Vous voilà déjà bien loin. Remontez prendre l’air.",
    mid: "Vous continuez ? Vous êtes maintenant bien loin dans le fil.",
    deep: "Vous êtes ici depuis un moment. Il est temps de remonter.",
  };
  for (const [zone, expectedMessage] of Object.entries(reminderMessages)) {
    const reminderPage = await browser.newPage({ viewport: { width: 360, height: 640 } });
    await installClosedShadowProbe(reminderPage);
    await reminderPage.goto(`${origin}/fixtures/marketing/long-article.html?threshold=1&zone=${zone}&locale=fr-FR`, {
      waitUntil: "networkidle",
    });
    await waitForReady(reminderPage);
    await reminderPage.waitForFunction(() => document.getElementById("surfaced-notification-host"));
    const reminderCopy = await reminderPage.evaluate(() => {
      const host = document.getElementById("surfaced-notification-host");
      const root = window.__surfacedTestShadowRoots.get(host);
      return {
        message: root.querySelector(".notification__title").textContent,
        dismiss: root.querySelector(".notification__close").getAttribute("aria-label"),
      };
    });
    assert.deepEqual(reminderCopy, {
      message: expectedMessage,
      dismiss: "Fermer ce rappel",
    });
    await reminderPage.close();
  }

  for (const platform of ["desktop", "android"]) {
    const popupPage = await browser.newPage({ viewport: { width: platform === "android" ? 360 : 1280, height: 900 } });
    await popupPage.goto(`${origin}/tools/capture/popup-harness.html?platform=${platform}&locale=fr-FR&tab=https%3A%2F%2Fexample.com%2F`, {
      waitUntil: "networkidle",
    });
    await waitForReady(popupPage);
    const popupCopy = await popupPage.evaluate(() => {
      const root = document.getElementById("root").shadowRoot;
      const shell = root.querySelector(".shell");
      return {
        lang: document.documentElement.lang,
        thresholdTitle: root.querySelector("#globalThresholdValue").getAttribute("aria-label"),
        site: root.querySelector("#siteEnabled").closest("section").querySelector(".section__title").textContent,
        pause: root.querySelector(".pause-action").textContent,
        exportAction: root.querySelector("#settingsExport").textContent,
        previewSubtitle: root.querySelector(".preview-block .notification__sub"),
        previewInteractive: root.querySelectorAll(".preview-block button, .preview-block [role='status']").length,
        scrollWidth: shell.scrollWidth,
        clientWidth: shell.clientWidth,
      };
    });
    assert.deepEqual(popupCopy, {
      lang: "fr-FR",
      thresholdTitle: "Valeur du seuil du premier rappel",
      site: "Ce site : example.com",
      pause: "Mettre en pause jusqu’au redémarrage du navigateur",
      exportAction: "Exporter les paramètres",
      previewSubtitle: null,
      previewInteractive: 0,
      scrollWidth: popupCopy.clientWidth,
      clientWidth: popupCopy.clientWidth,
    });
    await popupPage.close();
  }

  const importPage = await browser.newPage({ viewport: { width: 900, height: 780 } });
  await importPage.goto(`${origin}/tools/capture/settings-import-harness.html?locale=fr-FR`, {
    waitUntil: "networkidle",
  });
  await waitForReady(importPage);
  for (const [threshold, expected] of [
    [1, "1 écran"],
    [2, "2 écrans"],
    [0.004, "0,004 écran"],
    [5.254, "5,254 écrans"],
  ]) {
    await setImportFile(importPage, JSON.stringify(importEnvelope({ scrollNotifierThreshold: threshold })));
    await waitForImportPreview(importPage);
    assert.equal(await importPage.locator("#previewThreshold").textContent(), expected);
    assert.equal(await importPage.locator("#replaceSettings").textContent(), "Remplacer les paramètres");
    await importPage.locator("#cancelImport").click();
  }
  await setImportFile(importPage, "{ invalid JSON");
  await importPage.waitForFunction(() => !document.getElementById("importError").hidden);
  assert.match(await importPage.locator("#importError").textContent(), /JSON valide/);
  await importPage.close();
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
    await testSettingsImportAppearance(browser, server.origin);
  } else if (smokeScope === "store-scenes") {
    await testStoreScenes(browser, server.origin);
  } else {
    await testReminderResponsiveness(browser, server.origin);
    await testLocalizedReminderFitsNarrowViewport(browser, server.origin);
    await testReminderCycleAndSessionPause(browser, server.origin);
    await testRestoredPageSessionRefreshFailure(browser, server.origin);
    await testCanonicalRuntimeHostname(browser, server.origin);
    await testReducedMotion(browser, server.origin);
    await testPopupSessionUi(browser, server.origin);
    await testPermissionHealthUi(browser, server.origin);
    await testPopupKeyboardAndSiteManager(browser, server.origin);
    await testSiteManagerEditorAcrossRebuilds(browser, server.origin);
    await testThresholdEditing(browser, server.origin);
    await testPopupSettingsImportExport(browser, server.origin);
    await testSettingsImportAppearance(browser, server.origin);
    await testStoreScenes(browser, server.origin);
    await testFrenchLocalization(browser, server.origin);
  }
  console.log(`${browserName === "firefox" ? "Firefox" : "Chromium"} harness smoke: pass`);
} finally {
  await browser.close();
  await server.close();
}
