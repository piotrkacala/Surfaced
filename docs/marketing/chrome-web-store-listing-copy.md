# Chrome Web Store Listing Copy

**Status:** Draft for manual publishing in Chrome Web Store
**Last updated:** 2026-05-28

This file contains ready-to-paste copy for the Chrome Web Store Developer Dashboard.

References:

- Prepare package and manifest: https://developer.chrome.com/docs/webstore/prepare
- Store listing fields and image requirements: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Program policies: https://developer.chrome.com/docs/webstore/program-policies/policies

## Package

Upload:

```text
dist/surfaced-chrome-1.1.4.zip
```

The zip must contain `manifest.json` at the archive root.

## Product Details

### Name

Surfaced

### Category

Productivity

### Default Language

English

### Detailed Description: English

**Come up for air.**

Surfaced is a browser extension for people who want a gentle reminder before endless scrolling turns into mindless drifting.

It tracks cumulative scroll depth on long pages and feed-like interfaces, then shows a subtle reminder when you've gone deeper than you meant to.

**What Surfaced does**

- Reminds you after a scroll-depth threshold you choose, measured in screens
- Shows follow-up reminders at `2x` and `3x` your chosen threshold
- Lets you customize the first reminder text and preview it in the popup
- Supports per-site disable and per-site threshold overrides
- Shows your current depth in the toolbar badge once you are past your threshold

**Why it feels different**

Surfaced is reminder-first, not blocker-first. It does not lock the page, force timers, or interrupt your browsing flow. It adds a missing depth cue and helps you notice when you have drifted farther than intended.

Because it tracks cumulative scroll distance, Surfaced is more useful on long feeds and many single-page apps than a simple page-position check.

**Private by design**

- No analytics
- No account
- No remote services
- No synced backend
- Settings stored only in local browser extension storage

Everything stays in your browser.

Available in English and Polish.

### Detailed Description: Polish

**Złap oddech.**

Surfaced to rozszerzenie przeglądarki dla osób, które chcą dostać delikatne przypomnienie, zanim endless scroll zamieni się w bezwładne przewijanie.

Rozszerzenie śledzi skumulowaną głębokość scrollowania na długich stronach i w interfejsach przypominających feed, a potem pokazuje subtelne przypomnienie, gdy zejdziesz głębiej, niż planowałeś.

**Co robi Surfaced**

- Przypomina po przekroczeniu wybranego progu głębokości scrollowania, mierzonego w ekranach
- Pokazuje kolejne przypomnienia przy `2x` i `3x` wybranego progu
- Pozwala zmienić tekst pierwszego przypomnienia i podejrzeć go w popupie
- Obsługuje wyłączenie na wybranych stronach i progi ustawiane per site
- Pokazuje aktualną głębokość na badge'u, gdy jesteś już po przekroczeniu progu

**Dlaczego działa inaczej**

Surfaced jest reminder-first, a nie blocker-first. Nie blokuje strony, nie narzuca timerów i nie rozbija flow przeglądania. Dodaje brakującą informację o głębokości i pomaga zauważyć moment, w którym odpłynąłeś dalej, niż chciałeś.

Ponieważ śledzi skumulowany dystans scrollowania, działa lepiej na długich feedach i wielu single-page appach niż prosty pomiar pozycji strony.

**Prywatność by design**

- Brak analityki
- Brak konta
- Brak zdalnych usług
- Brak backendu do synchronizacji
- Ustawienia zapisywane wyłącznie lokalnie w pamięci rozszerzenia

Wszystko zostaje w Twojej przeglądarce.

Dostępne po angielsku i po polsku.

## Graphic Assets

Current screenshots already match the required `1280x800` screenshot size:

- `screenshots/amo-s1-desktop-reminder-context.png`
- `screenshots/amo-s2-desktop-threshold-control.png`
- `screenshots/amo-s3-desktop-custom-preview.png`
- `screenshots/amo-s4-desktop-site-settings.png`
- `screenshots/amo-s5-android-popup.png`

Chrome Web Store assets:

- Store icon: `128x128` px; use `shared/icons/icon-128.png`
- Small promo tile: `screenshots/chrome-small-promo-tile.png`
- Marquee promo tile: `1400x560` px PNG or JPEG, optional

## URLs

### Homepage URL

```text
https://github.com/piotrkacala/Surfaced
```

### Support URL

```text
https://github.com/piotrkacala/Surfaced/issues
```

### Privacy Policy URL

Use this after `PRIVACY.md` is pushed to GitHub:

```text
https://github.com/piotrkacala/Surfaced/blob/main/PRIVACY.md
```

## Privacy Tab

### Single Purpose Description

Surfaced provides local scroll-depth reminders that help users notice when they have gone deep into endless scrolling.

### Permission Justifications

#### `storage`

Surfaced uses extension storage to save user settings locally, including the reminder threshold, custom reminder text, global enabled state, per-site disable settings, and per-site threshold overrides.

#### Host permission: `<all_urls>`

Surfaced needs to run its content script on pages where the user browses so it can measure local scroll depth and show reminders after the configured threshold. The extension does not transmit page URLs, page content, or scroll data to any remote service.

### Remote Code Use

Select:

```text
No, I am not using remote code.
```

Suggested explanation if a text field is shown:

```text
Surfaced does not load or execute remote code. All JavaScript, HTML, CSS, images, and locale files are bundled inside the extension package.
```

### Data Usage

Suggested selection:

```text
No user data is collected.
```

Suggested explanation if a text field is shown:

```text
Surfaced stores settings locally in browser extension storage and does not transmit user data off-device. It does not use analytics, advertising, accounts, remote APIs, or backend services.
```

### Limited Use Certification

Certify that Surfaced's data use complies with the Chrome Web Store Developer Program Policies. The extension does not sell, transfer, or use user data for unrelated purposes.

## Distribution Tab

Suggested initial settings:

- Visibility: Public, once assets and privacy URL are ready
- Distribution regions: All regions
- Pricing: Free
- In-app products: None

## Reviewer Test Instructions

```text
1. Load the extension in Chrome.
2. Open a long webpage or feed-like page.
3. Open the Surfaced toolbar popup.
4. Set a low reminder threshold, for example 1 screen.
5. Scroll down past the threshold and verify that a local in-page reminder appears.
6. Continue scrolling to verify follow-up reminders at 2x and 3x the threshold.
7. Reopen the popup and verify that settings can be saved.
8. Disable Surfaced for the current site and confirm reminders stop on that site.
9. Re-enable the site and set a site-specific threshold override.
10. Restart Chrome and verify that settings remain saved.
```

No account, login, remote service, or test credentials are required.
