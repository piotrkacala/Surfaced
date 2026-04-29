# README Audit

**Status:** Historical audit used for the 2026-04-28 README rewrite  
**Last updated:** 2026-04-28  
**Scope:** Legacy `README.md` versus the product behavior and UI that were current at the time of the audit

This document records the gaps that existed before the README rewrite completed on 2026-04-28. It is kept as process history for follow-up work on AMO copy and screenshots, not as a description of the current `README.md`.

## Summary

Before the rewrite, `README.md` still communicated the core idea of Surfaced correctly, but it was out of date in several visible places. The largest problems were:

- the popup screenshot no longer matches the real UI
- the setup instructions describe controls that no longer exist
- the threshold range is documented as a hard `7–14` limit even though the product now accepts any finite positive number
- the badge behavior is described too broadly

The file also underuses two of the product's strongest differentiators: fully local privacy and gentle, non-blocking intervention.

## Hard mismatches

### 1. Popup screenshot is outdated

`README.md` previously presented the popup via a legacy screenshot that showed an older interface with a water gauge and older section wording. That public screenshot has now been removed, but the mismatch is still relevant as rewrite context.

References:

- [README.md](/home/k/Projekty/Surfaced/README.md:21)
- [README.md](/home/k/Projekty/Surfaced/README.md:25)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1034)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1167)

What changed in the real UI:

- threshold is now controlled through a numeric stepper with `+` and `−`
- the threshold help is expandable
- the custom reminder text has a live preview card
- site settings are structured around the current host and a management list

### 2. The setup instructions describe controls that no longer exist

The README tells users to "Use the depth gauge or type a number directly into the badge in the top-right of the popup." The current popup does not expose that interaction model.

References:

- [README.md](/home/k/Projekty/Surfaced/README.md:34)
- [README.md](/home/k/Projekty/Surfaced/README.md:35)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:970)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1050)

Current behavior:

- users set the threshold in a dedicated number input with stepper buttons
- the popup header contains a global enable switch, not an editable threshold badge

### 3. Threshold range is documented incorrectly as `7–14`

The README states that depth threshold has a range of `7–14 screens`. That is no longer true as product behavior.

References:

- [README.md](/home/k/Projekty/Surfaced/README.md:63)
- [docs/adr-003-threshold-value-policy.md](/home/k/Projekty/Surfaced/docs/adr-003-threshold-value-policy.md:20)
- [docs/adr-003-threshold-value-policy.md](/home/k/Projekty/Surfaced/docs/adr-003-threshold-value-policy.md:25)
- [shared/_locales/en/messages.json](/home/k/Projekty/Surfaced/shared/_locales/en/messages.json:46)
- [shared/content.js](/home/k/Projekty/Surfaced/shared/content.js:38)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:64)

Current behavior:

- any finite positive number is valid
- fractional values are valid
- values above `14` are valid
- invalid values fall back to `7`

The recommended UI range may still be mentioned, but it must be presented as a recommendation, not a product limit.

### 4. Site settings are described using outdated structure and wording

The README says site override is enabled in the "Site settings" section. The current UI is built around a "This site" section with:

- enable on this site
- use a different value on this site
- a site-specific threshold control
- a "Manage site settings" list

References:

- [README.md](/home/k/Projekty/Surfaced/README.md:65)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1105)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1146)
- [shared/_locales/en/messages.json](/home/k/Projekty/Surfaced/shared/_locales/en/messages.json:172)
- [shared/_locales/en/messages.json](/home/k/Projekty/Surfaced/shared/_locales/en/messages.json:206)

This is not the most severe problem, but it makes the settings description feel one generation behind the product.

### 5. Badge behavior is overstated

The README says the toolbar badge shows "exactly how many screens deep into the page you are" while scrolling. The current code only shows an integer badge once the user is past threshold; otherwise it stays empty.

References:

- [README.md](/home/k/Projekty/Surfaced/README.md:52)
- [README.md](/home/k/Projekty/Surfaced/README.md:53)
- [shared/content.js](/home/k/Projekty/Surfaced/shared/content.js:73)
- [shared/content.js](/home/k/Projekty/Surfaced/shared/content.js:581)
- [shared/background.js](/home/k/Projekty/Surfaced/shared/background.js:5)

Current behavior:

- no badge before threshold
- integer-only badge after threshold
- badge clears when the user returns below threshold

## Product changes that README does not surface well

These are not always factual errors, but they are meaningful omissions for the next rewrite.

### 6. The live preview of the first reminder is now part of the product experience

The popup includes a preview card that mirrors the first reminder text in context.

References:

- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1086)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1204)

This is worth showing visually and mentioning in docs because it makes customization feel safer and more intentional.

### 7. Saved site-specific settings can now be managed from a list

The popup can expand a list of stored site-specific settings and remove them individually.

References:

- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1151)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1409)

This is a meaningful quality-of-life capability and should be part of the updated settings overview or screenshots.

### 8. The current docs hide privacy too deep

Privacy is currently mentioned only in the FAQ, even though "local-only, no analytics, no remote APIs" is one of the product's strongest differentiators.

References:

- [README.md](/home/k/Projekty/Surfaced/README.md:77)
- [AGENTS.md](/home/k/Projekty/Surfaced/AGENTS.md:11)

For the rewrite, privacy should move closer to the top-level product pitch.

### 9. The current docs hide the technical differentiator too deep

README only mentions cumulative scroll distance and SPA handling in the FAQ, even though this is one of the clearest reasons the product is better than a naive `scrollY` threshold.

References:

- [README.md](/home/k/Projekty/Surfaced/README.md:80)
- [shared/content.js](/home/k/Projekty/Surfaced/shared/content.js:33)
- [shared/content.js](/home/k/Projekty/Surfaced/shared/content.js:83)
- [shared/content.js](/home/k/Projekty/Surfaced/shared/content.js:526)

For the rewrite, this should move into the main feature framing, not stay buried in troubleshooting copy.

## Screenshot audit

### Current state

- The legacy public screenshots have been removed from the repo so they do not misrepresent the current product.
- New screenshots should be produced from the current popup and current notification styling before visual sections return to `README.md` or AMO copy.

References:

- [shared/content.js](/home/k/Projekty/Surfaced/shared/content.js:206)
- [shared/popup/popup-core.mjs](/home/k/Projekty/Surfaced/shared/popup/popup-core.mjs:1034)

## Rewrite implications

The next `README.md` should:

- keep the current tagline and core idea
- update the settings walkthrough to match the current popup
- describe `7` as the default and `7–14` as a recommended band, not a hard range
- correct the badge description
- bring privacy and "gentle reminder" messaging much higher in the file
- use new visuals that show the current popup and at least one in-context reminder
