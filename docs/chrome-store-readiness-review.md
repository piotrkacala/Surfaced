# Chrome Store Readiness Review

**Date:** 2026-05-28
**Status:** Ready for privacy-URL completion

## Findings

### Blocking Before Submission

1. **Privacy policy URL must point to a pushed public page.**

   `PRIVACY.md` has been added locally. After pushing this branch, use:

   ```text
   https://github.com/piotrkacala/Surfaced/blob/main/PRIVACY.md
   ```

   If publishing from a branch before merge, use the matching branch URL temporarily or wait until `main` contains the file.

## Code Review

No blocking code issues found.

### Manifest

Chrome package manifest:

- Uses Manifest V3.
- Uses `background.service_worker`.
- Declares only one regular permission: `storage`.
- Declares `<all_urls>` as a host permission for automatic content script execution.
- Does not include Firefox-specific `browser_specific_settings`.

The previously declared `tabs` permission was removed during this review. The popup still uses `browser.tabs.query()` and `browser.tabs.sendMessage()`, but the sensitive `tabs.Tab.url` field is available through matching host permissions. Chrome's Tabs API documentation states that host permissions allow extensions to read matching tabs' sensitive properties such as `url`.

Reference: https://developer.chrome.com/docs/extensions/reference/api/tabs

### Permissions

#### `storage`

Required and appropriate. Surfaced stores user settings locally:

- global threshold
- custom first-reminder text
- global enabled state
- disabled domains
- site-specific threshold overrides

#### `<all_urls>`

Required for the product's core purpose. Surfaced must run a content script on normal browsed pages so it can measure local scroll depth and show local reminders without waiting for the user to click the toolbar action.

`activeTab` is not a sufficient replacement for the core workflow because it grants temporary access only after user invocation. Surfaced's reminder behavior needs to run while browsing normally.

Reference: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab

### Remote Code

No remote hosted code found in the Chrome package.

Review checks:

- No `https://` strings in the built Chrome zip.
- `http://` matches are SVG namespace strings only.
- No `new Function` matches.
- `eval` matches were only substrings inside local function names such as `evaluateActiveState`.
- `importScripts()` is used only to load local `extension-api.js` from the extension package.
- No remote `<script src="http...">` matches.

Relevant policy references:

- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- https://developer.chrome.com/docs/webstore/program-policies/policies

### Service Worker

No blocking issue found.

`shared/background.js` is stateless and event-driven. It listens for `SCROLL_DEPTH` messages from content scripts and updates badge text/background color. This fits Chrome MV3 service worker lifecycle constraints because it does not rely on persistent in-memory state.

### Package Contents

Chrome zip contents are narrow and expected:

- `manifest.json`
- `background.js`
- `content.js`
- `extension-api.js`
- `_locales/`
- `icons/`
- `popup/` with desktop popup files and shared popup core

No docs, fixtures, tools, screenshots, build artifacts, or source-control metadata are included in the Chrome package.

## Store Listing Readiness

Prepared:

- Chrome listing copy: `docs/marketing/chrome-web-store-listing-copy.md`
- Privacy policy: `PRIVACY.md`
- Permission justifications for `storage` and `<all_urls>`
- Remote code declaration copy
- Data usage declaration copy
- Reviewer test instructions
- Existing `1280x800` screenshots
- Small promo tile: `screenshots/chrome-small-promo-tile.png`

Remaining:

- Push `PRIVACY.md` before using the GitHub privacy policy URL.
- Optional: create `1400x560` marquee promo tile.

## Validation Commands Run

```sh
bash -n build.sh
jq empty chrome/manifest.json
jq empty desktop/manifest.json
jq empty android/manifest.json
node --check shared/extension-api.js
node --check shared/popup/popup-core.mjs
./build.sh all
unzip -p dist/surfaced-chrome-1.1.4.zip manifest.json
unzip -l dist/surfaced-chrome-1.1.4.zip
zipgrep -n "https://" dist/surfaced-chrome-1.1.4.zip
zipgrep -n "http://" dist/surfaced-chrome-1.1.4.zip
zipgrep -n "eval" dist/surfaced-chrome-1.1.4.zip
zipgrep -n "new Function" dist/surfaced-chrome-1.1.4.zip
zipgrep -n "importScripts" dist/surfaced-chrome-1.1.4.zip
zipgrep -n "<script src=\"http" dist/surfaced-chrome-1.1.4.zip
```
