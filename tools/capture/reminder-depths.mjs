import "../../shared/reminder-view.js";
import { getCaptureState, setCaptureReady, waitForAnimationFrames } from "./shared/capture-state.mjs";
import { getMessages } from "./shared/en-messages.mjs";

// Renders the real reminder card once per depth zone, with the product's own
// messages, so the three levels can be compared in one frame.
const ZONES = [
  { multiplier: 1, messageKey: "defaultNotificationText" },
  { multiplier: 2, messageKey: "notificationMid" },
  { multiplier: 3, messageKey: "notificationDeep" },
];

const state = getCaptureState();
const messages = getMessages(state.language);
const { createReminderCard, createReminderStyles } = globalThis.SurfacedReminderView;

function setCopy() {
  document.getElementById("copyEyebrow").textContent = state.stageEyebrow;
  document.getElementById("copyTitle").textContent = state.stageTitle;
  document.getElementById("copySubtitle").textContent = state.stageSubtitle;
  document.getElementById("copyPanel").hidden = !state.stageTitle && !state.stageSubtitle;
}

// The unit follows the locale's plural rules, as it does in the popup.
function formatScreens(value) {
  const form = new Intl.PluralRules(state.language).select(value);
  const unit = messages[`unitScreens${form.charAt(0).toUpperCase()}${form.slice(1)}`] || messages.unitScreensOther;
  const number = new Intl.NumberFormat(state.language, { maximumFractionDigits: 3 }).format(value);
  return `${number} ${unit}`;
}

function renderDepths() {
  const style = document.createElement("style");
  // Like the desktop popup preview, the cards keep their regular layout
  // whatever the width of the page around them.
  style.textContent = createReminderStyles({ adaptToViewport: false });
  document.head.appendChild(style);

  const list = document.getElementById("depths");
  ZONES.forEach((zone, index) => {
    const step = document.createElement("li");
    step.className = "depths__step";
    step.dataset.depth = String(index + 1);

    const label = document.createElement("span");
    label.className = "depths__label";
    label.textContent = formatScreens(state.threshold * zone.multiplier);

    const { card } = createReminderCard({
      depth: index + 1,
      text: messages[zone.messageKey],
      preview: true,
    });

    step.append(label, card);
    list.appendChild(step);
  });
}

setCopy();
renderDepths();
await waitForAnimationFrames(4);
setCaptureReady();
