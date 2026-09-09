
const state = {
  step: 1,
  format: "Snapshot",
  theme: "Family Adventure",
  generation: 0,
  memoryPhotos: []
};

const panels = [...document.querySelectorAll("[data-panel]")];
const navItems = [...document.querySelectorAll("[data-step]")];
const progressBar = document.getElementById("progressBar");
const peopleList = document.getElementById("peopleList");

function gotoStep(step){
  state.step = step;
  panels.forEach(p => p.classList.toggle("active", Number(p.dataset.panel) === step));
  navItems.forEach(n => n.classList.toggle("active", Number(n.dataset.step) === step));
  progressBar.style.width = `${step / 6 * 100}%`;
  window.scrollTo({top:0, behavior:"smooth"});
}

document.addEventListener("click", e=>{
  const n = e.target.closest("[data-next]");
  const b = e.target.closest("[data-back]");
  if(n) gotoStep(Number(n.dataset.next));
  if(b) gotoStep(Number(b.dataset.back));
});

document.querySelectorAll(".format-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".format-card").forEach(c=>{
      c.classList.remove("selected");
      c.querySelector(".choose-mark").textContent = "Choose";
    });
    card.classList.add("selected");
    card.querySelector(".choose-mark").textContent = "Selected ✓";
    state.format = card.dataset.format;
    applyFormatUI();
  });
});

function applyFormatUI(){
  const story = state.format === "My Story";
  document.getElementById("lengthLabel").classList.toggle("hidden", !story);
  document.getElementById("sideTitle").textContent = story ? "Build your illustrated story." : "Create your illustrated moment.";
  document.getElementById("sideText").textContent = story
    ? "Add the people and memory, then generate a story direction and final PDF."
    : "Add the people and memory, then generate one finished illustrated scene.";
}
applyFormatUI();

function addPerson(){
  if(peopleList.children.length >= 5) return;
  const card = document.createElement("div");
  card.className = "person-card";
  card.innerHTML = `
    <button class="remove-person" type="button">×</button>
    <label>Name<input type="text" class="person-name" placeholder="e.g. Alex"></label>
    <label>Role (optional)<input type="text" class="person-role" placeholder="e.g. son, partner, grandma"></label>
    <div class="photo-row">
      <div class="photo-slot">
        <label>Primary photo<br><small>Required</small><input type="file" class="person-photo primary" accept="image/*" hidden></label>
      </div>
      <div class="photo-slot">
        <label>Second photo<br><small>Optional</small><input type="file" class="person-photo" accept="image/*" hidden></label>
      </div>
    </div>`;
  peopleList.appendChild(card);
  attachPersonEvents(card);
  syncRemove();
}
function attachPersonEvents(card){
  card.querySelector(".remove-person").addEventListener("click", ()=>{
    if(peopleList.children.length > 1){ card.remove(); syncRemove(); }
  });
  card.querySelectorAll(".person-photo").forEach(input=>{
    input.addEventListener("change", ()=>{
      const file = input.files[0];
      if(!file) return;
      const slot = input.closest(".photo-slot");
      const url = URL.createObjectURL(file);
      slot.innerHTML = `<img src="${url}" alt="Reference preview">`;
    });
  });
}
function syncRemove(){
  peopleList.querySelectorAll(".remove-person").forEach(btn=>{
    btn.style.visibility = peopleList.children.length === 1 ? "hidden" : "visible";
  });
}
document.getElementById("addPersonBtn").addEventListener("click", addPerson);
addPerson();

document.getElementById("peopleContinueBtn").addEventListener("click", ()=>{
  const cards = [...peopleList.querySelectorAll(".person-card")];
  for(const card of cards){
    const name = card.querySelector(".person-name").value.trim();
    if(!name){ alert("Please add a name for each person."); return; }
  }
  gotoStep(3);
});

document.querySelectorAll(".theme-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".theme-card").forEach(c=>c.classList.remove("selected"));
    card.classList.add("selected");
    state.theme = card.dataset.theme;
  });
});

document.getElementById("memoryPhotos").addEventListener("change", e=>{
  const files = [...e.target.files].slice(0,5);
  state.memoryPhotos = files;
  const wrap = document.getElementById("memoryPreview");
  wrap.innerHTML = "";
  files.forEach(file=>{
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = "Memory reference";
    wrap.appendChild(img);
  });
});

const variants = [
  ["The Summer We Saved the Moon","A real memory becomes a warm illustrated adventure where one familiar evening slowly turns magical."],
  ["When the Stars Followed Us Home","Small details from the original memory become the clues and surprises that drive the illustrated scene."],
  ["The Night the Sea Started Whispering","A cinematic interpretation of the moment, with real people and place details transformed into a gentle visual story."]
];

function collect(){
  const people = [...peopleList.querySelectorAll(".person-card")].map(c=>c.querySelector(".person-name").value.trim()).filter(Boolean);
  return {
    people,
    occasion: document.getElementById("occasion").value.trim(),
    place: document.getElementById("place").value.trim(),
    memory: document.getElementById("memory").value.trim(),
    tone: document.getElementById("tone").value
  };
}

function renderPreview(){
  const data = collect();
  const v = variants[state.generation % variants.length];
  const names = data.people.length ? data.people.join(", ") : "your characters";
  const place = data.place || "a place that matters to you";
  const memory = data.memory || "the memory you described";
  const tone = data.tone.toLowerCase();

  document.getElementById("previewFormat").textContent = state.format;
  document.getElementById("previewTitle").textContent = v[0];
  document.getElementById("previewSynopsis").textContent =
    `${v[1]} Inspired by ${memory.toLowerCase()}, featuring ${names} in ${place}, with a ${tone} tone.`;

  const storyMode = state.format === "My Story";
  document.getElementById("snapshotPreview").classList.toggle("hidden", storyMode);
  document.getElementById("storyPreview").classList.toggle("hidden", !storyMode);

  if(!storyMode){
    document.getElementById("snapshotComposition").textContent =
      `${names} framed in ${place}, using the memory as the central visual moment.`;
    document.getElementById("snapshotTreatment").textContent =
      `${data.tone} illustrated storybook treatment with cinematic composition and recognizable recurring character styling.`;
  } else {
    const scenes = [
      ["Scene 1","The familiar beginning",`We open with ${names} in ${place}, grounded in the real memory.`],
      ["Scene 2","Something changes","A small unexpected detail turns the ordinary moment into the beginning of an adventure."],
      ["Scene 3","The heart of the story",`The characters face a playful challenge shaped by the ${tone} tone.`],
      ["Scene 4","A memory worth keeping","The final scene resolves warmly and echoes the original moment."]
    ];
    const wrap = document.getElementById("storyPreview");
    wrap.innerHTML = "";
    scenes.forEach(s=>{
      const div = document.createElement("div");
      div.className = "scene";
      div.innerHTML = `<span>${s[0]}</span><strong>${s[1]}</strong><p>${s[2]}</p>`;
      wrap.appendChild(div);
    });
  }

  document.getElementById("snapshotResultTitle").textContent = v[0];
  document.getElementById("storyResultTitle").textContent = v[0];
}

document.getElementById("previewBtn").addEventListener("click", ()=>{
  if(!document.getElementById("memory").value.trim()){
    alert("Tell us a little about the moment first.");
    return;
  }
  renderPreview();
  gotoStep(5);
});

document.getElementById("regenerateBtn").addEventListener("click", ()=>{
  state.generation++;
  renderPreview();
});

document.getElementById("generateBtn").addEventListener("click", ()=>{
  gotoStep(6);
  const storyMode = state.format === "My Story";
  document.getElementById("generatingTitle").textContent = storyMode ? "Creating your My Story…" : "Creating your Snapshot…";
  document.getElementById("generatingCopy").textContent = storyMode
    ? "Building the narrative, recurring characters and illustrated scenes."
    : "Combining your people, moment and visual direction.";

  document.getElementById("generatingState").classList.remove("hidden");
  document.getElementById("resultState").classList.add("hidden");
  const bar = document.getElementById("fakeProgress");
  bar.style.width = "0%";
  let p = 0;
  const timer = setInterval(()=>{
    p += 9 + Math.random()*11;
    if(p >= 100){
      p = 100;
      clearInterval(timer);
      setTimeout(()=>{
        document.getElementById("generatingState").classList.add("hidden");
        document.getElementById("resultState").classList.remove("hidden");
        document.getElementById("snapshotResult").classList.toggle("hidden", storyMode);
        document.getElementById("storyResult").classList.toggle("hidden", !storyMode);
        document.getElementById("resultTitle").textContent = storyMode ? "Your My Story is ready." : "Your Snapshot is ready.";
      },350);
    }
    bar.style.width = `${p}%`;
  },180);
});

document.getElementById("startOverBtn").addEventListener("click", ()=>{
  state.generation = 0;
  gotoStep(1);
});
