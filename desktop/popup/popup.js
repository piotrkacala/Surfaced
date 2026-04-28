(() => {
  async function init() {
    const { mountPopup } = await import(browser.runtime.getURL("popup/popup-core.mjs"));
    mountPopup({
      gaugeHeight: "128px",
      sliderHeight: "4px",
      sliderBorderRadius: "2px",
      sliderThumbSize: "16px",
      isTouch: false,
    });
  }

  init().catch((error) => {
    console.error("Failed to initialize desktop popup", error);
  });
})();
