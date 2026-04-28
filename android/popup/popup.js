(() => {
  async function init() {
    const { mountPopup } = await import(browser.runtime.getURL("popup/popup-core.mjs"));
    mountPopup({
      gaugeHeight: "clamp(128px, 28vw, 192px)",
      sliderHeight: "6px",
      sliderBorderRadius: "3px",
      sliderThumbSize: "24px",
      isTouch: true,
    });
  }

  init().catch((error) => {
    console.error("Failed to initialize Android popup", error);
  });
})();
