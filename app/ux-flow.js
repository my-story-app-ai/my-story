(() => {
  const step1Continue = document.querySelector('[data-panel="1"] [data-next="2"]');
  const step2Continue = document.querySelector('[data-panel="2"] [data-next="3"]');
  const formatCards = [...document.querySelectorAll('.format-card')];
  const modeCards = [...document.querySelectorAll('.mode-card')];
  const sourceCards = [...document.querySelectorAll('.source-card')];
  const storyModeBlock = document.getElementById('storyModeBlock');
  const eventPath = document.getElementById('eventPath');
  const eventInput = document.getElementById('eventPhotos');

  if (!step1Continue || !step2Continue || !formatCards.length || !sourceCards.length) return;

  step1Continue.classList.add('hidden');
  step2Continue.classList.add('hidden');

  function isStory() {
    return document.querySelector('.format-card.selected')?.dataset.format === 'My Story';
  }

  function maxEventPhotos() {
    return isStory() ? 5 : 3;
  }

  function updatePhotoCopy() {
    const max = maxEventPhotos();
    const panelHeadCopy = eventPath?.querySelector('.panel-head p');
    const uploadSmall = eventPath?.querySelector('.big-upload small');
    if (panelHeadCopy) {
      panelHeadCopy.textContent = isStory()
        ? 'Upload 1–5 photos from the actual memory. Different moments help us build a richer four-scene story.'
        : 'Upload 1–3 photos from the actual moment.';
    }
    if (uploadSmall) uploadSmall.textContent = `JPG, PNG or WEBP · up to ${max} photos`;
  }

  function trimEventPhotosIfNeeded() {
    if (!eventInput || eventInput.files.length <= maxEventPhotos()) return;
    const dt = new DataTransfer();
    [...eventInput.files].slice(0, maxEventPhotos()).forEach(file => dt.items.add(file));
    eventInput.files = dt.files;
    eventInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function advance(button) {
    window.setTimeout(() => button.click(), 120);
  }

  formatCards.forEach(card => {
    card.addEventListener('click', () => {
      updatePhotoCopy();
      trimEventPhotosIfNeeded();

      if (card.dataset.format === 'Snapshot') {
        advance(step1Continue);
        return;
      }

      // My Story needs one meaningful choice (Easy / Guided), but not an extra confirmation click.
      storyModeBlock?.classList.remove('hidden');
    });
  });

  modeCards.forEach(card => {
    card.addEventListener('click', () => advance(step1Continue));
  });

  sourceCards.forEach(card => {
    card.addEventListener('click', () => advance(step2Continue));
  });

  async function fileToDataUrl(file, maxSide = 1280, quality = 0.78) {
    const bitmap = await createImageBitmap(file);
    try {
      let { width, height } = bitmap;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    } finally {
      bitmap.close();
    }
  }

  // Existing v0.8 app.js was originally built around a 3-photo limit.
  // Keep that stable, but enrich Story planner requests with event photos 4 and 5.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const plannerUrl = window.MY_STORY_CONFIG?.storyPlannerApi || '';
    const isPlannerRequest = url === plannerUrl || url.endsWith('/api/story-plan');

    if (!isPlannerRequest || !init?.body || !eventInput) {
      return nativeFetch(input, init);
    }

    try {
      const payload = JSON.parse(init.body);
      const selectedFiles = [...eventInput.files];
      if (payload.format !== 'My Story' || payload.source !== 'event' || selectedFiles.length <= 3) {
        return nativeFetch(input, init);
      }

      const images = Array.isArray(payload.images) ? [...payload.images] : [];
      for (let i = 3; i < Math.min(selectedFiles.length, 5); i++) {
        images.push({
          kind: 'event',
          label: `Event photo ${i + 1}`,
          dataUrl: await fileToDataUrl(selectedFiles[i])
        });
      }

      payload.images = images.slice(0, 5);
      return nativeFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch (error) {
      console.warn('Could not enrich Story planner photo payload.', error);
      return nativeFetch(input, init);
    }
  };

  updatePhotoCopy();
})();
