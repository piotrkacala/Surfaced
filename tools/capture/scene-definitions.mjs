const DEFAULT_TEXT = "You've drifted pretty far. Come up for air.";
// The fixtures are under ten screens long, so scenes that go past the first zone
// need a threshold low enough for its later zones to be reachable.
const DEPTH_SCENE_THRESHOLD = "1.5";

// Every scene is 1280x800 in the saved image. A scene that should show the page
// and the reminder twice as large uses CLOSE_UP: half the viewport at double density.
const CLOSE_UP = { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 };
// The desktop popup scenes enlarge the popup and give it a window-like height,
// so it fits the frame as a whole and scrolls inside like the real popup.
const POPUP_WINDOW = { popupZoom: "1.4", popupHeight: "531" };

export function capturePageOptions({ viewport = { width: 1280, height: 800 }, deviceScaleFactor, colorScheme } = {}) {
  return {
    viewport,
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    // The reminder skips its entrance animation, so every frame shows a settled state.
    reducedMotion: "reduce",
    ...(colorScheme ? { colorScheme } : {}),
  };
}

export const STATIC_SCENES = {
  "desktop-reminder-context": {
    output: "amo-s1-desktop-reminder-context.png",
    purpose: "Hero shot: the in-page reminder, large, on a softened feed.",
    amoCaptionEn: "A gentle reminder helps you notice how far you’ve scrolled.",
    amoCaptionPl: "Dyskretne przypomnienie pomaga zauważyć, jak daleko przewijasz.",
    amoCaptionFr: "Un rappel discret vous aide à remarquer jusqu’où vous avez fait défiler la page.",
    page: "/fixtures/marketing/feed.html",
    ...CLOSE_UP,
    params: {
      fixture: "feed",
      title: "A gentle cue for endless scroll",
      subtitle: "Know when the feed has gone deeper than planned.",
      threshold: "7",
      zone: "shallow",
      text: DEFAULT_TEXT,
      softPage: "1",
    },
  },
  "reminder-depths": {
    output: "amo-s2-reminder-depths.png",
    purpose: "The three reminder levels side by side, each with the depth that triggers it.",
    amoCaptionEn: "Follow-up reminders appear at twice and three times your chosen depth.",
    amoCaptionPl: "Kolejne przypomnienia pojawiają się przy dwu- i trzykrotności wybranego progu.",
    amoCaptionFr: "Les rappels suivants apparaissent à deux puis trois fois la profondeur choisie.",
    page: "/tools/capture/reminder-depths.html",
    params: {
      title: "Deeper scroll, clearer cue",
      subtitle: "Two more reminders follow if you keep going.",
      threshold: "7",
    },
  },
  "desktop-site-settings": {
    output: "amo-s3-desktop-site-settings.png",
    purpose: "Desktop popup shot showing the reminder depth and a site-specific override.",
    amoCaptionEn: "Choose your reminder depth, then adjust it or turn Surfaced off on any site.",
    amoCaptionPl: "Wybierz próg przypomnienia, a potem zmień go lub wyłącz Surfaced na dowolnej stronie.",
    amoCaptionFr: "Choisissez votre seuil, puis ajustez-le ou désactivez Surfaced sur n’importe quel site.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "desktop",
      title: "Your depth, tuned for each site",
      subtitle: "Set it once, then adjust it or switch Surfaced off where you need to.",
      threshold: "7",
      tab: "https://forum.example/threads/signal-design",
      siteOverrides: "forum.example:11.5;news.example:9",
      ...POPUP_WINDOW,
    },
  },
  "desktop-custom-preview": {
    output: "amo-s4-desktop-custom-preview.png",
    purpose: "Desktop popup shot showing custom shallow reminder text and live preview.",
    amoCaptionEn: "Write your own first reminder and preview how it will look.",
    amoCaptionPl: "Napisz własną treść pierwszego przypomnienia i sprawdź, jak będzie wyglądać.",
    amoCaptionFr: "Personnalisez le texte du premier rappel et prévisualisez son apparence.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "desktop",
      title: "Say it in your own words",
      subtitle: "Write the first reminder and see it before it appears on a page.",
      threshold: "7",
      text: "Take a breath. Deep enough for now.",
      tab: "https://reading.example/articles/quiet-patterns",
      ...POPUP_WINDOW,
      popupScroll: "end",
    },
  },
  "android-popup": {
    output: "amo-s5-android-popup.png",
    purpose: "Android popup shot proving the product works on Firefox for Android too.",
    amoCaptionEn: "Adjust your reminders in Firefox for Android, too.",
    amoCaptionPl: "Dopasuj przypomnienia do siebie także w Firefoksie na Androidzie.",
    amoCaptionFr: "Réglez aussi vos rappels dans Firefox pour Android.",
    page: "/tools/capture/popup-harness.html",
    colorScheme: "dark",
    params: {
      platform: "android",
      title: "The same calm control on Android",
      subtitle: "Surfaced works on Firefox desktop, Firefox for Android, and Chrome desktop.",
      threshold: "7",
      tab: "https://reading.example/articles/quiet-patterns",
      text: DEFAULT_TEXT,
      popupHeight: "704",
    },
  },
  "site-settings-list": {
    output: "amo-s6-site-settings-list.png",
    purpose: "Optional shot showing the saved per-site settings list.",
    amoCaptionEn: "Review, edit, or remove your saved site settings anytime.",
    amoCaptionPl: "Przeglądaj, zmieniaj i usuwaj zapisane ustawienia stron w dowolnej chwili.",
    amoCaptionFr: "Consultez, modifiez ou supprimez à tout moment vos paramètres enregistrés par site.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "desktop",
      title: "Review saved site rules anytime",
      subtitle: "Saved thresholds stay visible and easy to manage.",
      threshold: "7",
      tab: "https://forum.example/threads/signal-design",
      siteOverrides: "forum.example:11.5;news.example:9;research.example:14",
      overridesOpen: "1",
    },
  },
  "github-social-preview": {
    output: "github-social-preview.png",
    purpose: "Repository social preview: the hero composition in GitHub's 2:1 format.",
    page: "/fixtures/marketing/feed.html",
    viewport: { width: 640, height: 320 },
    deviceScaleFactor: 2,
    params: {
      fixture: "feed",
      title: "A gentle cue for endless scroll",
      subtitle: "Know when the feed has gone deeper than planned.",
      threshold: "7",
      zone: "shallow",
      text: DEFAULT_TEXT,
      softPage: "1",
    },
  },
  "promo-tile-backdrop": {
    output: "promo-tile-backdrop.png",
    purpose: "Working image for the promo tile: a softened long page with no caption. The tile covers its reminder with its own.",
    page: "/fixtures/marketing/long-article.html",
    params: {
      fixture: "article",
      threshold: "7",
      zone: "shallow",
      text: DEFAULT_TEXT,
      softPage: "1",
    },
  },
  "chrome-small-promo-tile": {
    output: "chrome-small-promo-tile.png",
    purpose: "Chrome Web Store small promo tile, built around the rendered backdrop.",
    page: "/tools/capture/chrome-small-promo-tile.html",
    requires: "promo-tile-backdrop.png",
    viewport: { width: 440, height: 280 },
    params: {},
  },
};

export const MOTION_SCENES = {
  "anim-preview-edit": {
    outputDir: "anim-preview-edit",
    purpose: "Frame sequence for editing the shallow reminder and watching the preview update.",
    frames: 24,
    build(progress) {
      return {
        page: "/tools/capture/popup-harness.html",
        params: {
          platform: "desktop",
          title: "Say it in your own words",
          subtitle: "Write the first reminder and see it before it appears on a page.",
          threshold: "7",
          motion: "preview-edit",
          progress: progress.toFixed(4),
          tab: "https://reading.example/articles/quiet-patterns",
          ...POPUP_WINDOW,
          popupScroll: "end",
        },
      };
    },
  },
  "anim-reminder-depth": {
    outputDir: "anim-reminder-depth",
    purpose: "Frame sequence showing the reminder appearing as depth increases.",
    frames: 20,
    build(progress) {
      return {
        page: "/fixtures/marketing/feed.html",
        ...CLOSE_UP,
        params: {
          fixture: "feed",
          title: "A gentle cue for endless scroll",
          subtitle: "Know when the feed has gone deeper than planned.",
          threshold: DEPTH_SCENE_THRESHOLD,
          motion: "depth",
          progress: progress.toFixed(4),
          text: DEFAULT_TEXT,
          softPage: "1",
        },
      };
    },
  },
  "anim-site-override": {
    outputDir: "anim-site-override",
    purpose: "Frame sequence showing a site-specific threshold override being enabled and adjusted.",
    frames: 22,
    build(progress) {
      return {
        page: "/tools/capture/popup-harness.html",
        params: {
          platform: "desktop",
          title: "Your depth, tuned for each site",
          subtitle: "Set it once, then adjust it or switch Surfaced off where you need to.",
          threshold: "7",
          motion: "site-override",
          progress: progress.toFixed(4),
          tab: "https://forum.example/threads/signal-design",
          ...POPUP_WINDOW,
        },
      };
    },
  },
};

export const PRIMARY_STATIC_SCENE_IDS = [
  "desktop-reminder-context",
  "reminder-depths",
  "desktop-site-settings",
  "desktop-custom-preview",
  "android-popup",
];
