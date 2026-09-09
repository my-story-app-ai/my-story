/* My Story App v0.8 - production AI endpoints */
window.MY_STORY_CONFIG = {
  storyPlannerApi: "https://my-story-api-n5z9.vercel.app/api/story-plan",
  snapshotGenerationApi: "https://my-story-api-n5z9.vercel.app/api/snapshot-generate"
};

/* Upload controls are loaded separately so the existing app flow remains untouched. */
(() => {
  if (!document.querySelector('link[href="upload-controls.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "upload-controls.css";
    document.head.appendChild(link);
  }

  window.addEventListener("load", () => {
    if (document.querySelector('script[src="upload-controls.js"]')) return;
    const script = document.createElement("script");
    script.src = "upload-controls.js";
    document.body.appendChild(script);
  }, { once: true });
})();
