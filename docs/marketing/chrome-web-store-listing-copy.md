# Chrome Web Store Listing Copy

**Status:** Draft for manual publishing in Chrome Web Store
**Last updated:** 2026-07-15

This file contains ready-to-paste copy for the Chrome Web Store Developer Dashboard.

References:

- Prepare package and manifest: https://developer.chrome.com/docs/webstore/prepare
- Store listing fields and image requirements: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Program policies: https://developer.chrome.com/docs/webstore/program-policies/policies

## Package

Upload:

```text
dist/surfaced-chrome-1.2.0.zip
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

Come up for air.

You opened a long page for a quick check. A few minutes later, you are 20 screens deep.

Surfaced is a private browser extension that helps you notice endless scrolling before it turns into doomscrolling. It tracks signed, cumulative scroll depth and shows a gentle reminder when you have gone farther than you meant to.

Where it helps

- Social feeds and infinite-scroll timelines
- News sites with endless recommendations
- Forums, long threads, and comment sections
- Single-page apps with no natural stopping point

What Surfaced does

- Lets you choose the first reminder threshold in screens
- Shows follow-up reminders at 2× and 3× your threshold
- Lets you customize the first reminder text
- Lets you dismiss the current reminder without silencing the next deeper level
- Includes a complete manager for per-site enablement and threshold overrides
- Pauses reminders and badge updates on every tab until Chrome restarts
- Imports and exports all persistent settings with a local JSON file
- Separates page-access diagnostics from the health of saved local settings
- Shows your current depth in the toolbar badge after you pass the threshold
- Works on Chrome desktop

Why it feels different

Surfaced is built around reminders, not blocks. It does not lock pages, force timers, or shame you for browsing. It adds a calm scroll-depth cue so you can notice the moment and decide what to do next.

Because downward movement adds depth and upward movement subtracts it, Surfaced's net cumulative scroll depth is more useful on infinite feeds and many single-page apps than a simple page-position check.

Private by design

- No analytics
- No account
- No remote services
- No data sent anywhere

Persistent settings stay in browser.storage.local; the temporary pause stays in browser.storage.session. Surfaced does not use sync storage, and local import/export files are never uploaded.

Available in English and Polish.

### Detailed Description: Polish

Złap oddech.

Wchodzisz na długą stronę tylko na chwilę. Kilka minut później jesteś 20 ekranów niżej.

Surfaced to prywatne rozszerzenie przeglądarki, które pomaga zauważyć moment, w którym nieskończone przewijanie zmienia się w bezwładne przeglądanie. Śledzi skumulowaną głębokość przewijania i pokazuje delikatne przypomnienie, gdy zjedziesz dalej, niż planowałeś.

Gdzie pomaga

- Strony społecznościowe i kanały z nieskończonym przewijaniem
- Serwisy informacyjne z niekończącymi się rekomendacjami
- Fora, długie wątki i sekcje komentarzy
- Aplikacje jednostronicowe bez naturalnego punktu zatrzymania

Co robi Surfaced

- Pozwala ustawić próg pierwszego przypomnienia w ekranach
- Pokazuje kolejne przypomnienia przy 2× i 3× ustawionego progu
- Pozwala zmienić treść pierwszego przypomnienia
- Pozwala zamknąć bieżące przypomnienie bez wyciszania kolejnego, głębszego poziomu
- Udostępnia pełny manager włączania stron i osobnych progów dla wybranych witryn
- Wstrzymuje przypomnienia i odznaki we wszystkich kartach do restartu Chrome
- Importuje i eksportuje wszystkie trwałe ustawienia w lokalnym pliku JSON
- Oddziela diagnostykę dostępu do stron od stanu zapisanych ustawień lokalnych
- Pokazuje aktualną głębokość na ikonie dodatku po przekroczeniu progu
- Działa w Chrome na desktopie

Dlaczego działa inaczej

Surfaced opiera się na przypomnieniach, a nie blokadach. Nie blokuje stron, nie narzuca minutników i nie zawstydza Cię za przeglądanie. Dodaje spokojny sygnał głębokości, żebyś mógł zauważyć ten moment i sam zdecydować, co dalej.

Ponieważ ruch w dół zwiększa głębokość, a ruch w górę ją zmniejsza, Surfaced śledzi skumulowaną głębokość netto i lepiej sprawdza się na nieskończonych kanałach oraz w wielu aplikacjach jednostronicowych niż prosty pomiar pozycji strony.

Prywatność z założenia

- Bez analityki
- Bez konta
- Bez zdalnych usług
- Bez wysyłania danych gdziekolwiek

Trwałe ustawienia zostają lokalnie w browser.storage.local, a tymczasowe wstrzymanie w browser.storage.session. Surfaced nie używa synchronizacji, a lokalne pliki importu i eksportu nie są nigdzie wysyłane.

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

Surfaced uses persistent extension storage to save the reminder threshold, custom reminder text, global enabled state, per-site disable settings, and per-site threshold overrides locally. It also uses session storage for the optional pause-until-restart state. Surfaced does not use sync storage.

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
Surfaced stores persistent settings and the temporary session pause locally in browser extension storage. Local JSON import/export files are not uploaded. Surfaced does not transmit user data off-device or use analytics, advertising, accounts, remote APIs, sync storage, or backend services.
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
10. Open Manage site settings and verify that saved disabled sites and overrides can both be edited or removed.
11. Export settings, import the local JSON file, review the preview, and confirm replacement.
12. Pause reminders until restart, verify reminders and badges clear, then resume.
13. Restart Chrome and verify that persistent settings remain saved while the session pause is cleared.
```

No account, login, remote service, or test credentials are required.
