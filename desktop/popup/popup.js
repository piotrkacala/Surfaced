(() => {
  async function init() {
    const { mountPopup } = await import(browser.runtime.getURL("popup/popup-core.mjs"));
    mountPopup({
      isTouch: false,
      importPageMode: "new-tab",
    });
  }

  init().catch((error) => {
    console.error("Failed to initialize desktop popup", error);
  });
})();
