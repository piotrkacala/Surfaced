import { getCaptureState, setCaptureReady, wait, waitForAnimationFrames } from "../../tools/capture/shared/capture-state.mjs";
import { installBrowserStub } from "../../tools/capture/shared/browser-stub.mjs";

const ARTICLE_SECTIONS = [
  {
    label: "Field Notes",
    title: "Depth is easy to lose in interfaces built to keep moving.",
    paragraphs: [
      "A modern feed rarely offers a natural stopping point. A user arrives with a small intention, follows one item to the next, and quickly loses any reliable sense of distance.",
      "What feels like a quick scan can become a long descent because the interface removes the visual cues that would usually tell us where we are in the page.",
    ],
  },
  {
    label: "Signals",
    title: "The problem is not motion alone. It is invisible continuity.",
    paragraphs: [
      "Infinite scroll succeeds because it feels frictionless. Every next item appears before the current one has fully settled, which makes the browsing session feel less like a sequence and more like a current.",
      "Without a deliberate cue, people often notice depth only after they are already much farther down than they expected to be.",
    ],
  },
  {
    label: "Observation",
    title: "Small cues often work better than hard interruptions.",
    paragraphs: [
      "The most effective reminder is often the one that appears quietly, at the right moment, and leaves the user in control.",
      "That kind of intervention restores awareness without turning the experience into a conflict between the person and the tool meant to help them.",
    ],
  },
  {
    label: "Practice",
    title: "A screen-height threshold is simple enough to feel natural.",
    paragraphs: [
      "People do not need another dashboard just to regain orientation. A depth marker that matches the visible height of the page is easy to reason about and easy to tune.",
      "A single value can stay light enough for casual browsing while still adapting to different kinds of sites and sessions.",
    ],
  },
  {
    label: "Conclusion",
    title: "Awareness is often enough to change the next decision.",
    paragraphs: [
      "Once a person notices that they are deeper in the feed than planned, they can keep reading, close the tab, or pause and come back later. The key change is that the decision becomes conscious again.",
      "That is where a calm reminder matters most: not by forcing the outcome, but by making it visible in time.",
    ],
  },
];

const FEED_ITEMS = [
  "Designing for attention without resorting to friction",
  "A field guide to interface cues that gently interrupt habits",
  "When page depth becomes invisible in continuous feeds",
  "Why calm software can still shift user behavior",
  "The difference between awareness tools and blockers",
  "Privacy-friendly approaches to everyday browser habits",
  "Signals, thresholds, and the shape of online drift",
  "How small cues can restore orientation in long threads",
  "What product teams miss about subtle interventions",
  "Rethinking feed ergonomics for focused reading",
  "Interfaces that stretch time without looking dramatic",
  "Lightweight tools for noticing when intention fades",
];

const state = installBrowserStub() || getCaptureState();

function createElement(tag, className, textContent) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (textContent) {
    element.textContent = textContent;
  }
  return element;
}

function renderCopyOverlay(root) {
  const hasCopy = state.stageTitle || state.stageSubtitle;
  const panel = createElement("aside", "capture-copy");
  if (!hasCopy) {
    panel.hidden = true;
  }

  const eyebrow = createElement("div", "capture-copy__eyebrow", state.stageEyebrow);
  const title = createElement("h1", "capture-copy__title", state.stageTitle);
  const subtitle = createElement("p", "capture-copy__subtitle", state.stageSubtitle);

  panel.append(eyebrow, title, subtitle);
  root.appendChild(panel);
}

function renderArticle(root) {
  const shell = createElement("main", "article-shell");
  const hero = createElement("section", "article-hero");
  hero.append(
    createElement("p", "article-kicker", "Reading Pattern"),
    createElement("h1", "article-title", "Quiet signals work best when a feed forgets to stop."),
    createElement("p", "article-dek", "A long-form fixture built for repeatable Surfaced captures without external brands, unstable layouts, or copyrighted feed content."),
    createElement("div", "article-meta", "8 min read · Visual systems · Product ergonomics"),
  );

  const body = createElement("div", "article-body");
  for (let index = 0; index < 20; index += 1) {
    const content = ARTICLE_SECTIONS[index % ARTICLE_SECTIONS.length];
    const section = createElement("section", "article-section");
    section.append(
      createElement("p", "article-section__label", content.label),
      createElement("h2", "article-section__title", content.title),
    );

    content.paragraphs.forEach((paragraph) => {
      section.appendChild(createElement("p", "article-section__copy", paragraph));
    });

    body.appendChild(section);
  }

  shell.append(hero, body);
  root.appendChild(shell);
}

function renderFeed(root) {
  const shell = createElement("main", "feed-shell");
  shell.append(
    createElement("p", "feed-shell__label", "Daily Flow"),
    createElement("h1", "feed-shell__title", "A neutral feed fixture for deep-scroll captures."),
    createElement("p", "feed-shell__subtitle", "Every card is intentionally generic so the browsing context feels real without introducing outside branding into the final images."),
  );

  const grid = createElement("section", "feed-grid");
  for (let index = 0; index < 28; index += 1) {
    const title = FEED_ITEMS[index % FEED_ITEMS.length];
    const card = createElement("article", "feed-card");
    card.append(
      createElement("div", "feed-card__meta", `Signal ${String(index + 1).padStart(2, "0")} · Curated reading`),
      createElement("h2", "feed-card__title", title),
      createElement(
        "p",
        "feed-card__copy",
        "This fixture keeps the layout stable and readable so reminder captures remain repeatable across redesigns, browser updates, and future marketing refreshes."
      ),
    );
    grid.appendChild(card);
  }

  shell.appendChild(grid);
  root.appendChild(shell);
}

function getScrollTargetScreens() {
  if (state.scrollScreens !== null) {
    return state.scrollScreens;
  }

  switch (state.zone) {
    case "mid":
      return state.threshold * 2.05;
    case "deep":
      return state.threshold * 3.05;
    default:
      return state.threshold * 1.04;
  }
}

async function loadContentScript() {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "../../shared/content.js";
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function scrollByScreens(targetScreens) {
  const targetPixels = targetScreens * window.innerHeight;
  const stepSize = window.innerHeight * 0.72;
  let current = 0;

  while (current < targetPixels) {
    current = Math.min(targetPixels, current + stepSize);
    window.scrollTo(0, current);
    await wait(80);
  }
}

async function waitForNotification() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (document.getElementById("surfaced-notification-host")) {
      return;
    }
    await wait(80);
  }
}

async function runSurfacedDemo() {
  await loadContentScript();
  await waitForAnimationFrames(4);
  await wait(80);

  const targetScreens = state.motion === "depth"
    ? state.threshold * (0.9 + (2.2 * state.progress))
    : getScrollTargetScreens();

  await scrollByScreens(targetScreens);
  await waitForNotification();
}

async function init() {
  const root = document.getElementById("fixture-root");
  renderCopyOverlay(root);

  if (state.fixture === "feed") {
    renderFeed(root);
  } else {
    renderArticle(root);
  }

  if (state.zone || state.motion === "depth") {
    await runSurfacedDemo();
  }

  await waitForAnimationFrames(4);
  setCaptureReady();
}

init().catch((error) => {
  console.error("Failed to initialize fixture runtime", error);
});
