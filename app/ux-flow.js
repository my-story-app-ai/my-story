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

      // My Story still needs the Easy / Guided choice, but no extra Continue click.
      storyModeBlock?.classList.remove('hidden');
    });
  });

  modeCards.forEach(card => {
    card.addEventListener('click', () => advance(step1Continue));
  });

  sourceCards.forEach(card => {
    card.addEventListener('click', () => advance(step2Continue));
  });

  updatePhotoCopy();
})();
