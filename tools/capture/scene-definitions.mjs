const DEFAULT_TEXT = "You've drifted pretty far. Come up for air.";
// The fixtures are under ten screens long, so scenes that go past the first zone
// need a threshold low enough for its later zones to be reachable.
const DEPTH_SCENE_THRESHOLD = "1.5";

export function capturePageOptions({ viewport = { width: 1280, height: 800 }, colorScheme } = {}) {
  return {
    viewport,
    // The reminder skips its entrance animation, so every frame shows a settled state.
    reducedMotion: "reduce",
    ...(colorScheme ? { colorScheme } : {}),
  };
}

export const STATIC_SCENES = {
  "desktop-reminder-context": {
    output: "amo-s1-desktop-reminder-context.png",
    purpose: "Hero AMO shot showing the in-page reminder in a realistic long-scroll context.",
    amoCaptionEn: "A gentle reminder helps you notice how far you’ve scrolled.",
    amoCaptionPl: "Dyskretne przypomnienie pomaga zauważyć, jak daleko przewijasz.",
    page: "/fixtures/marketing/long-article.html",
    params: {
      fixture: "article",
      title: "A gentle cue for endless scroll",
      subtitle: "Know when the feed has gone deeper than planned.",
      threshold: "7",
      zone: "shallow",
      text: DEFAULT_TEXT,
      softPage: "1",
    },
  },
  "desktop-threshold-control": {
    output: "amo-s2-desktop-threshold-control.png",
    purpose: "Desktop popup shot focused on the threshold stepper and helper copy.",
    amoCaptionEn: "Choose how many screens to scroll before the first reminder.",
    amoCaptionPl: "Wybierz, po ilu ekranach pojawi się pierwsze przypomnienie.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "desktop",
      title: "Set your reminder depth in screens",
      subtitle: "Choose the point where scrolling stops feeling intentional.",
      threshold: "8.5",
      help: "1",
      tab: "https://reading.example/articles/quiet-patterns",
    },
  },
  "desktop-custom-preview": {
    output: "amo-s3-desktop-custom-preview.png",
    purpose: "Desktop popup shot showing custom shallow reminder text and live preview.",
    amoCaptionEn: "Write your own first reminder and preview how it will look.",
    amoCaptionPl: "Napisz własną treść pierwszego przypomnienia i sprawdź, jak będzie wyglądać.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "desktop",
      title: "Customize the first reminder",
      subtitle: "See the message before it ever appears on a page.",
      threshold: "7",
      text: "Take a breath. Deep enough for now.",
      tab: "https://reading.example/articles/quiet-patterns",
    },
  },
  "desktop-site-settings": {
    output: "amo-s4-desktop-site-settings.png",
    purpose: "Desktop popup shot showing per-site settings with a visible override.",
    amoCaptionEn: "Turn Surfaced off on a site or choose a different reminder depth for it.",
    amoCaptionPl: "Wyłącz Surfaced na wybranej stronie lub ustaw dla niej osobny próg.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "desktop",
      title: "Tune Surfaced for each site",
      subtitle: "Disable it here, or use a deeper threshold where you need one.",
      threshold: "7",
      tab: "https://forum.example/threads/signal-design",
      siteOverrides: "forum.example:11.5;news.example:9",
    },
  },
  "android-popup": {
    output: "amo-s5-android-popup.png",
    purpose: "Android popup shot proving the product works on Firefox for Android too.",
    amoCaptionEn: "Adjust your reminders in Firefox for Android, too.",
    amoCaptionPl: "Dopasuj przypomnienia do siebie także w Firefoksie na Androidzie.",
    page: "/tools/capture/popup-harness.html",
    colorScheme: "dark",
    params: {
      platform: "android",
      title: "The same calm control on Android",
      subtitle: "Surfaced works on Firefox desktop, Firefox for Android, and Chrome desktop.",
      threshold: "7",
      tab: "https://reading.example/articles/quiet-patterns",
      text: DEFAULT_TEXT,
    },
  },
  "reminder-escalation": {
    output: "amo-s6-reminder-escalation.png",
    purpose: "Optional comparison shot showing a deeper reminder state.",
    amoCaptionEn: "Reminders become more noticeable as you scroll deeper.",
    amoCaptionPl: "Im dalej przewijasz, tym wyraźniejsze stają się przypomnienia.",
    page: "/fixtures/marketing/feed.html",
    params: {
      fixture: "feed",
      title: "Deeper scroll, stronger cue",
      subtitle: "Surfaced escalates gently as depth increases.",
      threshold: DEPTH_SCENE_THRESHOLD,
      zone: "deep",
      text: DEFAULT_TEXT,
      softPage: "1",
    },
  },
  "site-settings-list": {
    output: "amo-s7-site-settings-list.png",
    purpose: "Optional shot showing the saved per-site settings list.",
    amoCaptionEn: "Review, edit, or remove your saved site settings anytime.",
    amoCaptionPl: "Przeglądaj, zmieniaj i usuwaj zapisane ustawienia stron w dowolnej chwili.",
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
  "chrome-small-promo-tile": {
    output: "chrome-small-promo-tile.png",
    purpose: "Chrome Web Store small promo tile, built around the rendered hero shot.",
    page: "/tools/capture/chrome-small-promo-tile.html",
    requires: "amo-s1-desktop-reminder-context.png",
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
          title: "Customize the first reminder",
          subtitle: "See the message before it ever appears on a page.",
          threshold: "7",
          motion: "preview-edit",
          progress: progress.toFixed(4),
          tab: "https://reading.example/articles/quiet-patterns",
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
        page: "/fixtures/marketing/long-article.html",
        params: {
          fixture: "article",
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
          title: "Tune Surfaced for each site",
          subtitle: "Set a deeper threshold where it actually helps.",
          threshold: "7",
          motion: "site-override",
          progress: progress.toFixed(4),
          tab: "https://forum.example/threads/signal-design",
        },
      };
    },
  },
};

export const PRIMARY_STATIC_SCENE_IDS = [
  "desktop-reminder-context",
  "desktop-threshold-control",
  "desktop-custom-preview",
  "desktop-site-settings",
  "android-popup",
];
