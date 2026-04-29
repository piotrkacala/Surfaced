const DEFAULT_TEXT = "You've drifted pretty far. Come up for air.";

export const STATIC_SCENES = {
  "desktop-reminder-context": {
    output: "amo-s1-desktop-reminder-context.png",
    purpose: "Hero AMO shot showing the in-page reminder in a realistic long-scroll context.",
    amoCaptionEn: "A gentle reminder appears when you scroll deeper than planned.",
    amoCaptionPl: "Delikatne przypomnienie pojawia się, gdy scrollujesz głębiej niż planowałeś.",
    page: "/fixtures/marketing/long-article.html",
    params: {
      fixture: "article",
      title: "A gentle cue for endless scroll",
      subtitle: "Know when the feed has gone deeper than planned.",
      threshold: "7",
      zone: "shallow",
      text: DEFAULT_TEXT,
    },
  },
  "desktop-threshold-control": {
    output: "amo-s2-desktop-threshold-control.png",
    purpose: "Desktop popup shot focused on the threshold stepper and helper copy.",
    amoCaptionEn: "Set your reminder depth in screens.",
    amoCaptionPl: "Ustaw próg przypomnienia w ekranach.",
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
    amoCaptionEn: "Customize the first reminder and preview it before it appears.",
    amoCaptionPl: "Dostosuj pierwsze przypomnienie i zobacz podgląd przed jego wyświetleniem.",
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
    amoCaptionEn: "Disable Surfaced on one site or give that site a different threshold.",
    amoCaptionPl: "Wyłącz Surfaced na jednej stronie albo ustaw dla niej inny próg.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "desktop",
      title: "Tune Surfaced for each site",
      subtitle: "Disable it here, or use a deeper threshold where you need one.",
      threshold: "7",
      tab: "https://forum.example/threads/signal-design",
      siteOverrides: "forum.example:11.5;news.example:9",
      overridesOpen: "1",
    },
  },
  "android-popup": {
    output: "amo-s5-android-popup.png",
    purpose: "Android popup shot proving the product works on Firefox for Android too.",
    amoCaptionEn: "The same calm controls are available on Firefox for Android.",
    amoCaptionPl: "Te same spokojne ustawienia są dostępne w Firefoksie na Androidzie.",
    page: "/tools/capture/popup-harness.html",
    params: {
      platform: "android",
      title: "The same calm control on Android",
      subtitle: "Surfaced works on Firefox desktop and Firefox for Android.",
      threshold: "7",
      tab: "https://reading.example/articles/quiet-patterns",
      text: DEFAULT_TEXT,
    },
  },
  "reminder-escalation": {
    output: "amo-s6-reminder-escalation.png",
    purpose: "Optional comparison shot showing a deeper reminder state.",
    amoCaptionEn: "Surfaced escalates gently as you go deeper.",
    amoCaptionPl: "Surfaced delikatnie wzmacnia sygnał, gdy schodzisz głębiej.",
    page: "/fixtures/marketing/feed.html",
    params: {
      fixture: "feed",
      title: "Deeper scroll, stronger cue",
      subtitle: "Surfaced escalates gently as depth increases.",
      threshold: "7",
      zone: "deep",
      text: DEFAULT_TEXT,
    },
  },
  "site-settings-list": {
    output: "amo-s7-site-settings-list.png",
    purpose: "Optional shot showing the saved per-site settings list.",
    amoCaptionEn: "Review and remove saved site-specific settings anytime.",
    amoCaptionPl: "W każdej chwili przejrzyj i usuń zapisane ustawienia dla stron.",
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
          threshold: "7",
          motion: "depth",
          progress: progress.toFixed(4),
          text: DEFAULT_TEXT,
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
