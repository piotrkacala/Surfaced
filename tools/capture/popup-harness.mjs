import { mountPopup } from "../../shared/popup/popup-core.mjs";
import { getCaptureState, setCaptureReady, wait, waitForAnimationFrames } from "./shared/capture-state.mjs";
import { installBrowserStub } from "./shared/browser-stub.mjs";

const state = installBrowserStub() || getCaptureState();

function setCopy() {
  const copyPanel = document.getElementById("copyPanel");
  const eyebrow = document.getElementById("copyEyebrow");
  const title = document.getElementById("copyTitle");
  const subtitle = document.getElementById("copySubtitle");

  eyebrow.textContent = state.stageEyebrow;
  title.textContent = state.stageTitle;
  subtitle.textContent = state.stageSubtitle;

  if (!state.stageTitle && !state.stageSubtitle) {
    copyPanel.hidden = true;
  }
}

function configureShell() {
  const shell = document.getElementById("popupShell");
  const screen = document.getElementById("popupScreen");
  if (state.platform === "android") {
    shell.classList.add("popup-shell--android");
    screen.classList.add("popup-shell__screen--android");
  }
}

function getShadowRoot() {
  return document.getElementById("root").shadowRoot;
}

function query(shadowRoot, selector) {
  return shadowRoot.querySelector(selector);
}

function setInputValue(input, value) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function expandHelpIfNeeded(shadowRoot) {
  if (!state.helpExpanded) {
    return;
  }

  const button = query(shadowRoot, ".icon-button[aria-controls='thresholdHelper']");
  if (button?.getAttribute("aria-expanded") === "false") {
    button.click();
    await waitForAnimationFrames(2);
  }
}

async function openSiteManagerIfNeeded(shadowRoot) {
  if (!state.overridesOpen) {
    return;
  }

  const button = query(shadowRoot, ".ghost-button[aria-controls='siteSettingsManager']");
  if (button?.getAttribute("aria-expanded") === "false") {
    button.click();
    await waitForAnimationFrames(2);
  }
}

async function applyPreviewEditMotion(shadowRoot) {
  const input = query(shadowRoot, "#notificationText");
  if (!input) {
    return;
  }

  const targetText = "Take a breath. Deep enough for now.";
  const visibleCharacters = Math.round(targetText.length * state.progress);
  setInputValue(input, targetText.slice(0, visibleCharacters));
  await waitForAnimationFrames(2);
  input.blur();
  input.scrollLeft = 0;
}

async function applyThresholdChangeMotion(shadowRoot) {
  const input = query(shadowRoot, "#globalThresholdValue");
  if (!input) {
    return;
  }

  const value = (7 + (9.5 - 7) * state.progress).toFixed(1).replace(/\.0$/, "");
  setInputValue(input, value);
  await waitForAnimationFrames(2);
  input.blur();
}

async function applySiteOverrideMotion(shadowRoot) {
  const toggle = query(shadowRoot, "#siteOverrideEnabled");
  const input = query(shadowRoot, "#siteThresholdValue");

  if (!toggle || !input) {
    return;
  }

  if (!toggle.checked && state.progress > 0.15) {
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await waitForAnimationFrames(2);
  }

  if (toggle.checked) {
    const thresholdSteps = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5];
    const localProgress = Math.min(1, Math.max(0, (state.progress - 0.15) / 0.85));
    const stepIndex = Math.min(
      thresholdSteps.length - 1,
      Math.floor(localProgress * thresholdSteps.length)
    );
    const value = String(thresholdSteps[stepIndex]).replace(/\.0$/, "");
    setInputValue(input, value);
    await waitForAnimationFrames(2);
    input.blur();
    input.scrollLeft = 0;
  }
}

async function applyMotion(shadowRoot) {
  switch (state.motion) {
    case "preview-edit":
      await applyPreviewEditMotion(shadowRoot);
      break;
    case "threshold-change":
      await applyThresholdChangeMotion(shadowRoot);
      break;
    case "site-override":
      await applySiteOverrideMotion(shadowRoot);
      break;
    default:
      break;
  }
}

async function init() {
  setCopy();
  configureShell();

  mountPopup(state.platform === "android"
    ? {
      isTouch: true,
    }
    : {
      isTouch: false,
    });

  await waitForAnimationFrames(3);
  await wait(50);

  const shadowRoot = getShadowRoot();
  await expandHelpIfNeeded(shadowRoot);
  await openSiteManagerIfNeeded(shadowRoot);
  await applyMotion(shadowRoot);

  document.activeElement?.blur();
  await waitForAnimationFrames(4);
  setCaptureReady();
}

init().catch((error) => {
  console.error("Failed to initialize popup harness", error);
});
