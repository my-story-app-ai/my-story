(() => {
  const eventInput = document.getElementById("eventPhotos");
  const eventPreview = document.getElementById("eventPreview");
  const eventPath = document.getElementById("eventPath");
  const placeInput = document.getElementById("placePhoto");
  const placePreview = document.getElementById("placePreview");
  const peopleList = document.getElementById("peopleList");

  if (!eventInput || !eventPreview || !eventPath || !placeInput || !placePreview || !peopleList) return;

  const MAX_EVENT_PHOTOS = 3;

  function setFiles(input, files) {
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    input.files = dt.files;
  }

  function triggerChange(input) {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fileKey(file) {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  function ensureEventToolbar() {
    let toolbar = document.getElementById("eventUploadToolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "eventUploadToolbar";
      toolbar.className = "upload-toolbar hidden";
      toolbar.innerHTML = `
        <button type="button" class="upload-control-btn" id="eventAddReplaceBtn">Add / replace photos</button>
        <button type="button" class="upload-control-btn danger" id="eventClearBtn">Clear all</button>
      `;
      eventPreview.insertAdjacentElement("afterend", toolbar);

      const addInput = document.createElement("input");
      addInput.type = "file";
      addInput.accept = "image/*";
      addInput.multiple = true;
      addInput.hidden = true;
      addInput.id = "eventPhotoAddInput";
      eventPath.appendChild(addInput);

      toolbar.querySelector("#eventAddReplaceBtn").addEventListener("click", () => {
        const current = [...eventInput.files];
        if (current.length >= MAX_EVENT_PHOTOS) {
          eventInput.click();
        } else {
          addInput.value = "";
          addInput.click();
        }
      });

      toolbar.querySelector("#eventClearBtn").addEventListener("click", () => {
        eventInput.value = "";
        triggerChange(eventInput);
      });

      addInput.addEventListener("change", () => {
        const existing = [...eventInput.files];
        const incoming = [...addInput.files];
        const seen = new Set(existing.map(fileKey));
        const merged = [...existing];
        for (const file of incoming) {
          if (!seen.has(fileKey(file)) && merged.length < MAX_EVENT_PHOTOS) {
            merged.push(file);
            seen.add(fileKey(file));
          }
        }
        setFiles(eventInput, merged);
        triggerChange(eventInput);
      });
    }
    return toolbar;
  }

  function renderEventControls() {
    const files = [...eventInput.files].slice(0, MAX_EVENT_PHOTOS);
    const toolbar = ensureEventToolbar();
    toolbar.classList.toggle("hidden", files.length === 0);

    if (!files.length) return;

    eventPreview.innerHTML = "";
    files.forEach((file, index) => {
      const card = document.createElement("div");
      card.className = "upload-preview-card";

      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = `Selected event photo ${index + 1}`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "upload-remove-btn";
      remove.setAttribute("aria-label", `Remove photo ${index + 1}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        const kept = [...eventInput.files].filter((_, i) => i !== index);
        setFiles(eventInput, kept);
        triggerChange(eventInput);
      });

      card.append(img, remove);
      eventPreview.appendChild(card);
    });
  }

  eventInput.addEventListener("change", () => {
    queueMicrotask(renderEventControls);
  });

  function renderPlaceControls() {
    const file = placeInput.files[0];
    if (!file) {
      placePreview.innerHTML = "";
      return;
    }

    placePreview.innerHTML = "";
    const card = document.createElement("div");
    card.className = "upload-preview-card place-preview-card";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = "Selected place photo";

    const actions = document.createElement("div");
    actions.className = "upload-inline-actions";

    const replace = document.createElement("button");
    replace.type = "button";
    replace.className = "upload-control-btn";
    replace.textContent = "Replace";
    replace.addEventListener("click", () => placeInput.click());

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "upload-control-btn danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      placeInput.value = "";
      triggerChange(placeInput);
    });

    actions.append(replace, remove);
    card.append(img, actions);
    placePreview.appendChild(card);
  }

  placeInput.addEventListener("change", () => {
    queueMicrotask(renderPlaceControls);
  });

  function decoratePersonCard(card) {
    if (!card || card.dataset.uploadControlsReady === "1") return;
    card.dataset.uploadControlsReady = "1";

    const originalInput = card.querySelector(".person-photo");
    if (!originalInput) return;

    originalInput.addEventListener("change", () => {
      queueMicrotask(() => addPersonPhotoControls(card));
    });
  }

  function addPersonPhotoControls(card) {
    const slot = card.querySelector(".photo-slot");
    if (!slot || !slot._file) return;

    if (slot.querySelector(".person-photo-controls")) return;

    const controls = document.createElement("div");
    controls.className = "person-photo-controls";

    const replace = document.createElement("button");
    replace.type = "button";
    replace.className = "upload-control-btn";
    replace.textContent = "Replace";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "upload-control-btn danger";
    remove.textContent = "Remove";

    replace.addEventListener("click", () => {
      const replacementInput = document.createElement("input");
      replacementInput.type = "file";
      replacementInput.accept = "image/jpeg,image/png,image/webp";
      replacementInput.hidden = true;
      document.body.appendChild(replacementInput);
      replacementInput.addEventListener("change", () => {
        const file = replacementInput.files[0];
        if (!file) {
          replacementInput.remove();
          return;
        }
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
          replacementInput.remove();
          return;
        }
        slot._file = file;
        slot.dataset.hasFile = "1";
        slot.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Person reference">`;
        replacementInput.remove();
        addPersonPhotoControls(card);
      }, { once: true });
      replacementInput.click();
    });

    remove.addEventListener("click", () => {
      slot._file = null;
      delete slot.dataset.hasFile;
      slot.innerHTML = `<label>Reference photo<br><small>1 image</small><input type="file" class="person-photo" accept="image/jpeg,image/png,image/webp" hidden></label>`;
      const newInput = slot.querySelector(".person-photo");
      newInput.addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
          e.target.value = "";
          return;
        }
        slot._file = file;
        slot.dataset.hasFile = "1";
        slot.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Person reference">`;
        addPersonPhotoControls(card);
      });
    });

    controls.append(replace, remove);
    slot.appendChild(controls);
  }

  [...peopleList.querySelectorAll(".person-card")].forEach(decoratePersonCard);

  const observer = new MutationObserver(() => {
    [...peopleList.querySelectorAll(".person-card")].forEach(decoratePersonCard);
  });
  observer.observe(peopleList, { childList: true, subtree: true });

  document.addEventListener("change", e => {
    if (e.target.matches(".person-photo")) {
      const card = e.target.closest(".person-card");
      queueMicrotask(() => addPersonPhotoControls(card));
    }
  });

  renderEventControls();
  renderPlaceControls();
})();