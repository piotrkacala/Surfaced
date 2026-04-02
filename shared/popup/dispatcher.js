(async () => {
  const { os } = await browser.runtime.getPlatformInfo();
  location.replace(os === "android" ? "android/popup.html" : "desktop/popup.html");
})();
