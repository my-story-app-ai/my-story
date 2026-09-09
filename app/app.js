
const state = {
  step: 1,
  theme: "Family Adventure",
  generation: 0,
  people: [],
  memoryPhotos: []
};

const panels = [...document.querySelectorAll(".panel")];
const navItems = [...document.querySelectorAll(".steps li")];
const progressBar = document.getElementById("progressBar");
const peopleList = document.getElementById("peopleList");

function gotoStep(step){
  state.step = step;
  panels.forEach(p => p.classList.toggle("active", Number(p.dataset.panel) === step));
  navItems.forEach(n => n.classList.toggle("active", Number(n.dataset.step) === step));
  progressBar.style.width = `${step * 20}%`;
  window.scrollTo({top:0, behavior:"smooth"});
}

document.addEventListener("click", (e)=>{
  const next = e.target.closest("[data-next]");
  const back = e.target.closest("[data-back]");
  if(next){
    if(Number(next.dataset.next) === 2 && !validatePeople()) return;
    gotoStep(Number(next.dataset.next));
  }
  if(back) gotoStep(Number(back.dataset.back));
});

function addPerson(){
  if(peopleList.children.length >= 5) return;
  const idx = peopleList.children.length + 1;
  const card = document.createElement("div");
  card.className = "person-card";
  card.innerHTML = `
    <button class="remove-person" type="button" title="Remove">×</button>
    <label>Name
      <input type="text" class="person-name" placeholder="e.g. Alex" />
    </label>
    <label>Role (optional)
      <input type="text" class="person-role" placeholder="e.g. son, partner, grandma" />
    </label>
    <div class="photo-row">
      <div class="photo-slot">
        <label>Primary photo<br><small>Required</small>
          <input type="file" class="person-photo" accept="image/*" hidden />
        </label>
      </div>
      <div class="photo-slot">
        <label>Second photo<br><small>Optional</small>
          <input type="file" class="person-photo optional" accept="image/*" hidden />
        </label>
      </div>
    </div>
  `;
  peopleList.appendChild(card);
  attachPersonCard(card);
  updateRemoveButtons();
}

function attachPersonCard(card){
  card.querySelector(".remove-person").addEventListener("click", ()=>{
    if(peopleList.children.length <= 1) return;
    card.remove();
    updateRemoveButtons();
  });
  card.querySelectorAll(".person-photo").forEach(input=>{
    input.addEventListener("change", ()=>{
      const file = input.files[0];
      if(!file) return;
      const slot = input.closest(".photo-slot");
      slot.innerHTML = `<img alt="Reference preview">`;
      slot.querySelector("img").src = URL.createObjectURL(file);
    });
  });
}

function updateRemoveButtons(){
  const disabled = peopleList.children.length <= 1;
  peopleList.querySelectorAll(".remove-person").forEach(btn=>{
    btn.style.visibility = disabled ? "hidden" : "visible";
  });
}

function validatePeople(){
  const cards = [...peopleList.querySelectorAll(".person-card")];
  if(cards.length < 1 || cards.length > 5) return false;
  for(const card of cards){
    const name = card.querySelector(".person-name").value.trim();
    const requiredInput = card.querySelector(".person-photo:not(.optional)");
    if(!name){
      alert("Please add a name for each person.");
      return false;
    }
    if(!requiredInput.files || requiredInput.files.length === 0){
      alert(`Please add one primary photo for ${name}.`);
      return false;
    }
  }
  return true;
}

document.getElementById("addPersonBtn").addEventListener("click", addPerson);
addPerson();

document.querySelectorAll(".theme-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".theme-card").forEach(c=>c.classList.remove("selected"));
    card.classList.add("selected");
    state.theme = card.dataset.theme;
  });
});

document.getElementById("memoryPhotos").addEventListener("change", (e)=>{
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

const titleVariants = [
  ["The Summer We Saved the Moon","A warm family adventure grows into a magical coastal mystery — where one ordinary evening becomes a story they will always remember."],
  ["When the Stars Followed Us Home","A familiar memory is transformed into a playful adventure where tiny details from the real moment become clues, wonders and surprises."],
  ["The Night the Sea Started Whispering","A real family moment becomes a cinematic adventure filled with wonder, humor and a little impossible magic."]
];

function collectInputs(){
  const people = [...peopleList.querySelectorAll(".person-card")].map(card=>({
    name: card.querySelector(".person-name").value.trim(),
    role: card.querySelector(".person-role").value.trim()
  }));
  return {
    people,
    theme: state.theme,
    occasion: document.getElementById("occasion").value.trim(),
    place: document.getElementById("place").value.trim(),
    memory: document.getElementById("memory").value.trim(),
    tone: document.getElementById("tone").value,
    length: document.getElementById("length").value
  };
}

function makeOutline(){
  const data = collectInputs();
  const pick = titleVariants[state.generation % titleVariants.length];
  const names = data.people.map(p=>p.name).filter(Boolean);
  const leadNames = names.length ? names.join(", ") : "the people in your story";
  const place = data.place || "a place they love";
  const memory = data.memory || "a favorite shared memory";
  const tone = data.tone.toLowerCase();

  document.getElementById("previewTheme").textContent = data.theme;
  document.getElementById("storyTitle").textContent = pick[0];
  document.getElementById("storySynopsis").textContent =
    `${pick[1]} Inspired by ${memory.toLowerCase()}, the story follows ${leadNames} through ${place}, with a ${tone} tone and details drawn from the moment you described.`;

  const scenes = [
    ["Scene 1","The familiar beginning",`We open with ${leadNames} in ${place}, grounding the story in the real memory.`],
    ["Scene 2","Something changes",`A small unexpected detail turns the ordinary moment into the beginning of an adventure.`],
    ["Scene 3","The heart of the story",`The characters face a playful challenge shaped by the ${tone} tone you selected.`],
    ["Scene 4","A memory worth keeping",`The adventure resolves in a warm final image that echoes the original moment.`]
  ];

  const wrap = document.getElementById("sceneList");
  wrap.innerHTML = "";
  scenes.forEach((s,i)=>{
    const el = document.createElement("div");
    el.className = "scene";
    el.innerHTML = `<span>${s[0]}</span><strong>${s[1]}</strong><p>${s[2]}</p>`;
    wrap.appendChild(el);
  });

  document.getElementById("finalTitle").textContent = pick[0];
}

document.getElementById("generateOutlineBtn").addEventListener("click", ()=>{
  if(!document.getElementById("memory").value.trim()){
    alert("Please tell us a little about the moment first.");
    return;
  }
  makeOutline();
  gotoStep(4);
});

document.getElementById("regenerateBtn").addEventListener("click", ()=>{
  state.generation += 1;
  makeOutline();
});

document.getElementById("generateFinalBtn").addEventListener("click", ()=>{
  gotoStep(5);
  document.getElementById("generatingState").classList.remove("hidden");
  document.getElementById("finalState").classList.add("hidden");
  const bar = document.getElementById("fakeProgressBar");
  bar.style.width = "0%";
  let p = 0;
  const timer = setInterval(()=>{
    p += 8 + Math.random()*10;
    if(p >= 100){
      p = 100;
      clearInterval(timer);
      setTimeout(()=>{
        document.getElementById("generatingState").classList.add("hidden");
        document.getElementById("finalState").classList.remove("hidden");
      },350);
    }
    bar.style.width = `${p}%`;
  },220);
});
