# AMO Listing Copy

**Status:** Draft for manual update in AMO  
**Last updated:** 2026-07-15

This file contains ready-to-paste listing copy for Firefox Add-ons (AMO).

Notes:

- AMO supports separate translated `summary` and `description` fields.
- The AMO `description` field supports Markdown, so the long descriptions below are formatted accordingly.
- The copy below is intentionally concise and should fit comfortably even if AMO UI constraints change.

## English

### Summary

Endless-scroll reminders for Firefox. Track scroll depth and stay in control on desktop and Android.

### Description

**Come up for air.**

You opened a long page for a quick check. A few minutes later, you are 20 screens deep.

Surfaced is a private browser extension that helps you notice endless scrolling before it turns into doomscrolling. It tracks signed, cumulative scroll depth and shows a gentle reminder when you have gone farther than you meant to.

**Where it helps**

- Social feeds and infinite-scroll timelines
- News sites with endless recommendations
- Forums, long threads, and comment sections
- Single-page apps with no natural stopping point

**What Surfaced does**

- Lets you choose the first reminder threshold in screens
- Shows follow-up reminders at `2×` and `3×` your threshold
- Lets you customize the first reminder text
- Lets you dismiss the current reminder without silencing the next deeper level
- Includes a complete manager for per-site enablement and threshold overrides
- Pauses reminders and badge updates on every tab until the browser restarts
- Imports and exports all persistent settings with a local JSON file
- Separates page-access diagnostics from the health of saved local settings
- Shows your current depth in the toolbar badge after you pass the threshold
- Works in Firefox on desktop and Android

**Why it feels different**

Surfaced is built around reminders, not blocks. It does not lock pages, force timers, or shame you for browsing. It adds a calm scroll-depth cue so you can notice the moment and decide what to do next.

Because downward movement adds depth and upward movement subtracts it, Surfaced's net cumulative scroll depth is more useful on infinite feeds and many single-page apps than a simple page-position check.

**Private by design**

- No analytics
- No account
- No remote services
- No data sent anywhere

Persistent settings stay in your browser in `browser.storage.local`; the temporary pause stays in `browser.storage.session`. Surfaced does not use sync storage, and local import/export files are never uploaded.

Available in English and Polish.

## Polish

### Summary

Przypomnienia przy nieskończonym przewijaniu w Firefoksie. Kontroluj głębokość przewijania na desktopie i Androidzie.

### Description

**Złap oddech.**

Wchodzisz na długą stronę tylko na chwilę. Kilka minut później jesteś 20 ekranów niżej.

Surfaced to prywatne rozszerzenie przeglądarki, które pomaga zauważyć moment, w którym nieskończone przewijanie zmienia się w bezwładne przeglądanie. Śledzi skumulowaną głębokość przewijania i pokazuje delikatne przypomnienie, gdy zjedziesz dalej, niż planowałeś.

**Gdzie pomaga**

- Strony społecznościowe i kanały z nieskończonym przewijaniem
- Serwisy informacyjne z niekończącymi się rekomendacjami
- Fora, długie wątki i sekcje komentarzy
- Aplikacje jednostronicowe bez naturalnego punktu zatrzymania

**Co robi Surfaced**

- Pozwala ustawić próg pierwszego przypomnienia w ekranach
- Pokazuje kolejne przypomnienia przy `2×` i `3×` ustawionego progu
- Pozwala zmienić treść pierwszego przypomnienia
- Pozwala zamknąć bieżące przypomnienie bez wyciszania kolejnego, głębszego poziomu
- Udostępnia pełny manager włączania stron i osobnych progów dla wybranych witryn
- Wstrzymuje przypomnienia i odznaki we wszystkich kartach do restartu przeglądarki
- Importuje i eksportuje wszystkie trwałe ustawienia w lokalnym pliku JSON
- Oddziela diagnostykę dostępu do stron od stanu zapisanych ustawień lokalnych
- Pokazuje aktualną głębokość na ikonie dodatku po przekroczeniu progu
- Działa w Firefoksie na desktopie i Androidzie

**Dlaczego działa inaczej**

Surfaced opiera się na przypomnieniach, a nie blokadach. Nie blokuje stron, nie narzuca minutników i nie zawstydza Cię za przeglądanie. Dodaje spokojny sygnał głębokości, żebyś mógł zauważyć ten moment i sam zdecydować, co dalej.

Ponieważ ruch w dół zwiększa głębokość, a ruch w górę ją zmniejsza, Surfaced śledzi skumulowaną głębokość netto i lepiej sprawdza się na nieskończonych kanałach oraz w wielu aplikacjach jednostronicowych niż prosty pomiar pozycji strony.

**Prywatność z założenia**

- Bez analityki
- Bez konta
- Bez zdalnych usług
- Bez wysyłania danych gdziekolwiek

Trwałe ustawienia zostają lokalnie w `browser.storage.local`, a tymczasowe wstrzymanie w `browser.storage.session`. Surfaced nie używa synchronizacji, a lokalne pliki importu i eksportu nie są nigdzie wysyłane.

Dostępne po angielsku i po polsku.
