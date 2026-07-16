(() => {
  async function init() {
    const { mountPopup } = await import(browser.runtime.getURL("popup/popup-core.mjs"));
    mountPopup({
      isTouch: true,
      importPageMode: "same-tab",
    });
  }

  init().catch((error) => {
    console.error("Failed to initialize Android popup", error);
  });
})();
