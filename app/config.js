/* My Story App v0.9 - production AI endpoints */
window.MY_STORY_CONFIG = {
  storyPlannerApi: "https://my-story-api-n5z9.vercel.app/api/story-plan",
  snapshotGenerationApi: "https://my-story-api-n5z9.vercel.app/api/snapshot-generate",
  storyRenderApi: "https://my-story-api-n5z9.vercel.app/api/story-render",
  useLocalPreview: true,
  devBypassPayment: false,
  debugEvents: false,
  // Browser key: restrict allowed origins in Geoapify before enabling.
  geoapifyApiKey: "5481590688004e2ba6b4b560f3063134",
  outputPresets: {
    Snapshot: [
      {
        id: "snapshot-digital",
        outputType: "digital",
        label: "Digital",
        shortLabel: "Digital",
        description: "Optimized for screens, sharing and digital keepsakes.",
        resultLabel: "Digital image",
        downloadLabel: "Download digital image",
        ratio: "1:1",
        targetPixels: null
      },
      {
        id: "snapshot-print-10x15",
        outputType: "print",
        label: "Print-ready 10 x 15 cm",
        shortLabel: "10 x 15 cm",
        description: "Professional print-ready file for a classic photo size.",
        resultLabel: "Print-ready · 10 x 15 cm",
        downloadLabel: "Download print file",
        ratio: "2:3",
        targetPixels: { width: 1181, height: 1772, dpi: 300 }
      },
      {
        id: "snapshot-print-15x20",
        outputType: "print",
        label: "Print-ready 15 x 20 cm",
        shortLabel: "15 x 20 cm",
        description: "Professional print-ready file for a larger portrait keepsake.",
        resultLabel: "Print-ready · 15 x 20 cm",
        downloadLabel: "Download print file",
        ratio: "3:4",
        targetPixels: { width: 1772, height: 2362, dpi: 300 }
      }
    ],
    "My Story": [
      {
        id: "story-digital",
        outputType: "digital",
        label: "Digital Story",
        shortLabel: "Digital Story",
        description: "Optimized for screen reading, saving and sharing.",
        resultLabel: "Digital story",
        downloadLabel: "Download digital story",
        ratio: "story",
        targetPixels: null
      },
      {
        id: "story-print-30x40",
        outputType: "print",
        label: "Print-ready 30 x 40 cm",
        shortLabel: "30 x 40 cm",
        description: "Prepared as an elegant story-board print.",
        resultLabel: "Print-ready · 30 x 40 cm",
        downloadLabel: "Download print file",
        ratio: "3:4",
        targetPixels: { width: 3543, height: 4724, dpi: 300 }
      },
      {
        id: "story-print-50x70",
        outputType: "print",
        label: "Print-ready 50 x 70 cm",
        shortLabel: "50 x 70 cm",
        description: "Prepared for a larger wall-worthy story print.",
        resultLabel: "Print-ready · 50 x 70 cm",
        downloadLabel: "Download print file",
        ratio: "5:7",
        targetPixels: { width: 5906, height: 8268, dpi: 300 }
      }
    ]
  }
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
