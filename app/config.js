/* My Story App v0.9 - production AI endpoints */
window.MY_STORY_CONFIG = {
  storyPlannerApi: "https://my-story-api-n5z9.vercel.app/api/story-plan",
  snapshotGenerationApi: "https://my-story-api-n5z9.vercel.app/api/snapshot-generate",
  devBypassPayment: false,
  debugEvents: false
};

/* UX helpers are loaded separately so the existing app flow and AI logic stay stable. */
(() => {
  const styles = ["upload-controls.css", "ux-flow.css"];
  styles.forEach(href => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  });

  window.addEventListener("load", () => {
    const scripts = ["local-preview.js", "upload-controls.js", "ux-flow.js"];
    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) return;
      const script = document.createElement("script");
      script.src = src;
      document.body.appendChild(script);
    });
  }, { once: true });
})();
