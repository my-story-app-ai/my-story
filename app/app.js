const MAX_EVENT_PHOTOS = 3;
const MAX_PEOPLE = 5;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const PLANNER_TIMEOUT_MS = 70000;
const GENERATION_TIMEOUT_MS = 120000;

const state = {
  step: 1,
  format: "Snapshot",
  mode: "Easy",
  source: "event",
  generation: 0,
  sceneOverrides: {},
  scenePhotos: {},
  lastPlan: null,
  lastDetails: null,
  lastImages: [],
  lastSnapshot: null
};

const panels = [...document.querySelectorAll("[data-panel]")];
const navItems = [...document.querySelectorAll("[data-step]")];
const progressBar = document.getElementById("progressBar");
const peopleList = document.getElementById("peopleList");
const plannerStatus = document.getElementById("plannerStatus");
const generationStatus = document.getElementById("generationStatus");
const currentStepMeta = document.getElementById("currentStepMeta");
const currentStepTitle = document.getElementById("currentStepTitle");
const apiUrl = window.MY_STORY_CONFIG?.storyPlannerApi || "/api/story-plan";
const snapshotApiUrl = window.MY_STORY_CONFIG?.snapshotGenerationApi || "/api/snapshot-generate";

function gotoStep(step){
  state.step = step;
  panels.forEach(p => p.classList.toggle("active", Number(p.dataset.panel) === step));
  navItems.forEach(n => n.classList.toggle("active", Number(n.dataset.step) === step));
  const activeNav = navItems.find(n => Number(n.dataset.step) === step);
  currentStepMeta.textContent = `Step ${step} of 6`;
  currentStepTitle.textContent = activeNav?.dataset.title || "Create";
  progressBar.style.width = `${step / 6 * 100}%`;
  window.scrollTo({top:0, behavior:"smooth"});
}

document.addEventListener("click", e=>{
  const next = e.target.closest("[data-next]");
  const back = e.target.closest("[data-back]");
  if(next) gotoStep(Number(next.dataset.next));
  if(back) gotoStep(Number(back.dataset.back));
});

document.querySelectorAll(".format-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".format-card").forEach(c=>{
      c.classList.remove("selected");
      c.querySelector(".choose-mark").textContent="Choose";
    });
    card.classList.add("selected");
    card.querySelector(".choose-mark").textContent="Selected";
    state.format=card.dataset.format;
    document.getElementById("storyModeBlock").classList.toggle("hidden", state.format!=="My Story");
  });
});

document.querySelectorAll(".mode-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".mode-card").forEach(c=>c.classList.remove("selected"));
    card.classList.add("selected");
    state.mode=card.dataset.mode;
  });
});

document.querySelectorAll(".source-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".source-card").forEach(c=>{
      c.classList.remove("selected");
      c.querySelector(".choose-mark").textContent="Choose";
    });
    card.classList.add("selected");
    card.querySelector(".choose-mark").textContent="Selected";
    state.source=card.dataset.source;
    document.getElementById("eventPath").classList.toggle("hidden", state.source!=="event");
    document.getElementById("reconstructPath").classList.toggle("hidden", state.source!=="reconstruct");
  });
});

function addPerson(){
  if(peopleList.children.length>=MAX_PEOPLE) return;
  const card=document.createElement("div");
  card.className="person-card";
  card.innerHTML=`
    <button class="remove-person" type="button" aria-label="Remove person">x</button>
    <label>Name<input type="text" class="person-name" placeholder="e.g. Alex"></label>
    <label>Role (optional)<input type="text" class="person-role" placeholder="e.g. son, partner"></label>
    <div class="photo-row">
      <div class="photo-slot">
        <label>Reference photo<br><small>1 image</small><input type="file" class="person-photo" accept="image/jpeg,image/png,image/webp" hidden></label>
      </div>
    </div>`;
  peopleList.appendChild(card);
  card.querySelector(".remove-person").addEventListener("click", ()=>{
    if(peopleList.children.length>1){card.remove();syncRemove();}
  });
  card.querySelector(".person-photo").addEventListener("change", e=>{
    const file=e.target.files[0];
    if(!file) return;
    const validation=validateImageFile(file);
    if(validation){
      e.target.value="";
      showPlannerStatus(validation,"error");
      return;
    }
    const slot=e.target.closest(".photo-slot");
    slot.dataset.hasFile="1";
    slot.innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Person reference">`;
    slot._file=file;
    hidePlannerStatus();
  });
  syncRemove();
}

function syncRemove(){
  peopleList.querySelectorAll(".remove-person").forEach(btn=>btn.style.visibility=peopleList.children.length===1?"hidden":"visible");
}

document.getElementById("addPersonBtn").addEventListener("click", addPerson);
addPerson();

function validateImageFile(file){
  const allowed=["image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type)) return "Please use JPG, PNG or WEBP images.";
  if(file.size>MAX_UPLOAD_BYTES) return "One of the images is too large. Please use images under 8 MB each.";
  return "";
}

function renderFiles(input, targetId, max){
  const selected=[...input.files];
  const problem=selected.map(validateImageFile).find(Boolean);
  if(problem){
    input.value="";
    document.getElementById(targetId).innerHTML="";
    showPlannerStatus(problem,"error");
    return;
  }
  const files=selected.slice(0,max);
  const target=document.getElementById(targetId);
  target.innerHTML="";
  files.forEach(file=>{
    const img=document.createElement("img");
    img.src=URL.createObjectURL(file);
    target.appendChild(img);
  });
  if(selected.length>max){
    showPlannerStatus(`Using the first ${max} images. Extra images are ignored for this version.`,"");
  }else{
    hidePlannerStatus();
  }
}

document.getElementById("eventPhotos").addEventListener("change",e=>renderFiles(e.target,"eventPreview",MAX_EVENT_PHOTOS));
document.getElementById("placePhoto").addEventListener("change",e=>renderFiles(e.target,"placePreview",1));

document.getElementById("photosContinueBtn").addEventListener("click", ()=>{
  if(state.source==="event"){
    const count=document.getElementById("eventPhotos").files.length;
    if(count<1){showPlannerStatus("Please add at least one event photo.","error");return;}
  }else{
    const cards=[...peopleList.querySelectorAll(".person-card")];
    for(const card of cards){
      const name=card.querySelector(".person-name").value.trim();
      const hasPhoto=card.querySelector(".photo-slot")?._file;
      if(!name){showPlannerStatus("Please add a name for each person.","error");return;}
      if(!hasPhoto){showPlannerStatus("Please add one reference photo for each person.","error");return;}
    }
  }
  hidePlannerStatus();
  gotoStep(4);
});

function collect(){
  return {
    people:[...peopleList.querySelectorAll(".person-card")].map(c=>({
      name:c.querySelector(".person-name")?.value.trim() || "",
      role:c.querySelector(".person-role")?.value.trim() || ""
    })).filter(p=>p.name),
    occasion:document.getElementById("occasion").value.trim(),
    place:document.getElementById("place").value.trim() || document.getElementById("placeDescription").value.trim(),
    memory:document.getElementById("memory").value.trim(),
    theme:document.getElementById("theme").value,
    tone:document.getElementById("tone").value
  };
}

async function fileToDataUrl(file, maxSide=1280, quality=.78){
  if(!file) return null;
  const validation=validateImageFile(file);
  if(validation) throw new Error(validation);
  let bitmap;
  try{
    bitmap=await createImageBitmap(file);
    let {width,height}=bitmap;
    const scale=Math.min(1,maxSide/Math.max(width,height));
    width=Math.round(width*scale);
    height=Math.round(height*scale);
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext("2d");
    ctx.drawImage(bitmap,0,0,width,height);
    return canvas.toDataURL("image/jpeg",quality);
  }catch(error){
    throw new Error(`Could not read ${file.name}. Please try a different image.`);
  }finally{
    if(bitmap) bitmap.close();
  }
}

async function collectImages(){
  const images=[];
  if(state.source==="event"){
    const files=[...document.getElementById("eventPhotos").files].slice(0,MAX_EVENT_PHOTOS);
    for(let i=0;i<files.length;i++){
      images.push({
        kind:"event",
        label:`Event photo ${i+1}`,
        dataUrl:await fileToDataUrl(files[i])
      });
    }
  }else{
    const cards=[...peopleList.querySelectorAll(".person-card")];
    for(const card of cards){
      const name=card.querySelector(".person-name").value.trim();
      const slot=card.querySelector(".photo-slot");
      if(slot?._file){
        images.push({
          kind:"person",
          label:`Person reference: ${name}`,
          dataUrl:await fileToDataUrl(slot._file)
        });
      }
    }
    const placeFile=document.getElementById("placePhoto").files[0];
    if(placeFile){
      images.push({
        kind:"place",
        label:"Place reference",
        dataUrl:await fileToDataUrl(placeFile)
      });
    }
  }
  return images;
}

function showPlannerStatus(message,type=""){
  plannerStatus.className=`planner-status ${type}`.trim();
  plannerStatus.textContent=message;
  plannerStatus.classList.remove("hidden");
}

function hidePlannerStatus(){
  plannerStatus.classList.add("hidden");
}

function showGenerationStatus(message,type=""){
  generationStatus.className=`planner-status ${type}`.trim();
  generationStatus.textContent=message;
  generationStatus.classList.remove("hidden");
}

function hideGenerationStatus(){
  generationStatus.classList.add("hidden");
}

async function fetchJsonWithTimeout(url, options, timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      throw new Error(payload.error || payload.detail || `Request failed (${response.status})`);
    }
    return payload;
  }catch(error){
    if(error.name==="AbortError") throw new Error("The request took too long. Please try again.");
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

function hasText(value){
  return typeof value==="string" && value.trim().length>0;
}

function validatePlan(plan, format){
  if(!plan || typeof plan!=="object") throw new Error("Planner returned an empty plan.");
  if(!hasText(plan.title) || !hasText(plan.synopsis)) throw new Error("Planner returned an incomplete title or synopsis.");

  if(format==="Snapshot"){
    ["source_strategy","action","framing","emotion","visual_anchor"].forEach(key=>{
      if(!hasText(plan[key])) throw new Error(`Planner returned an incomplete Snapshot field: ${key}.`);
    });
    return;
  }

  if(!Array.isArray(plan.scenes) || plan.scenes.length!==4){
    throw new Error("Planner must return exactly 4 scenes for My Story.");
  }
  plan.scenes.forEach((scene,index)=>{
    ["title","location","time","action","framing","emotion","visual_anchor"].forEach(key=>{
      if(!hasText(scene?.[key])) throw new Error(`Scene ${index+1} is missing ${key}.`);
    });
  });
}

async function callPlanner(){
  const data=collect();
  if(!data.memory){
    showPlannerStatus("Tell us a little about the moment first.","error");
    return;
  }

  const btn=document.getElementById("planBtn");
  btn.disabled=true;
  btn.textContent="Building AI plan...";

  try{
    const images=await collectImages();
    if(images.length===0) throw new Error("Please add the required source photo before planning.");
    showPlannerStatus("Planning your Snapshot...","");

    const payload=await fetchJsonWithTimeout(apiUrl,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        format:state.format,
        mode:state.mode,
        source:state.source,
        regeneration:state.generation,
        details:data,
        images
      })
    },PLANNER_TIMEOUT_MS);

    validatePlan(payload.plan,state.format);
    state.lastPlan=payload.plan;
    state.lastDetails=data;
    state.lastImages=images;
    state.lastSnapshot=null;
    renderAIPlan(payload.plan);
    gotoStep(5);
    showPlannerStatus("AI planner completed successfully.","success");
  }catch(err){
    console.error(err);
    showPlannerStatus(`AI Story Planner error: ${err.message}`,"error");
  }finally{
    btn.disabled=false;
    btn.textContent="Build AI creative plan";
  }
}

function renderAIPlan(plan){
  const isStory=state.format==="My Story";
  document.getElementById("previewFormat").textContent=state.format;
  document.getElementById("previewTitle").textContent=plan.title;
  document.getElementById("previewSynopsis").textContent=plan.synopsis;
  document.getElementById("snapshotPlan").classList.toggle("hidden",isStory);
  document.getElementById("storyPlan").classList.toggle("hidden",!isStory);
  document.getElementById("finalBtn").textContent=isStory ? "Approve storyboard" : "Generate Snapshot";

  if(!isStory){
    document.getElementById("planHeading").textContent="Your AI Snapshot direction.";
    document.getElementById("planExplainer").textContent="Approve or regenerate.";
    document.getElementById("snapSource").textContent=plan.source_strategy;
    document.getElementById("snapAction").textContent=plan.action;
    document.getElementById("snapFraming").textContent=plan.framing;
    document.getElementById("snapAnchor").textContent=plan.visual_anchor;
  }else{
    document.getElementById("planHeading").textContent="AI synopsis + 4-scene storyboard.";
    document.getElementById("planExplainer").textContent=state.mode==="Easy"
      ?"Accept or regenerate."
      :"Adjust scenes, then approve.";
    document.getElementById("modeBadge").textContent=`${state.mode} mode`;
    renderScenes(plan.scenes || []);
  }
}

function renderScenes(scenes){
  const wrap=document.getElementById("sceneList");
  wrap.innerHTML="";
  scenes.forEach((s,i)=>{
    const description=state.sceneOverrides[i] || s.action;
    const div=document.createElement("article");
    div.className="scene-card";
    div.innerHTML=`
      <div class="scene-number">Scene ${i+1}</div>
      <h4>${escapeHtml(s.title)}</h4>
      <p class="scene-description">${escapeHtml(description)}</p>
      <div class="scene-meta">
        <div><span>Location</span><b>${escapeHtml(s.location)}</b></div>
        <div><span>Time</span><b>${escapeHtml(s.time)}</b></div>
        <div><span>Framing</span><b>${escapeHtml(s.framing)}</b></div>
        <div><span>Visual anchor</span><b>${escapeHtml(s.visual_anchor)}</b></div>
      </div>
      ${s.emotion ? `<div class="scene-meta"><div><span>Emotion</span><b>${escapeHtml(s.emotion)}</b></div></div>` : ""}
      ${state.mode==="Guided" ? `
      <div class="guided-tools">
        <button class="scene-action change-scene" data-index="${i}" type="button">Change scene</button>
        <label class="scene-action">Add scene photo<input class="scene-photo-input" data-index="${i}" type="file" accept="image/jpeg,image/png,image/webp"></label>
      </div>
      <div class="scene-edit-wrap hidden" data-edit="${i}">
        <textarea class="scene-edit">${escapeHtml(description)}</textarea>
        <button class="scene-action save-scene" data-index="${i}" type="button">Use this scene</button>
      </div>
      <div class="scene-photo-preview" data-photo="${i}"></div>`:""}
    `;
    wrap.appendChild(div);
  });

  if(state.mode==="Guided"){
    wrap.querySelectorAll(".change-scene").forEach(btn=>btn.addEventListener("click",()=>{
      wrap.querySelector(`[data-edit="${btn.dataset.index}"]`).classList.toggle("hidden");
    }));
    wrap.querySelectorAll(".save-scene").forEach(btn=>btn.addEventListener("click",()=>{
      const text=wrap.querySelector(`[data-edit="${btn.dataset.index}"] textarea`).value.trim();
      if(text) state.sceneOverrides[btn.dataset.index]=text;
      renderScenes(state.lastPlan.scenes);
    }));
    wrap.querySelectorAll(".scene-photo-input").forEach(input=>input.addEventListener("change",async ()=>{
      const file=input.files[0]; if(!file)return;
      const validation=validateImageFile(file);
      if(validation){showPlannerStatus(validation,"error");return;}
      state.scenePhotos[input.dataset.index]=await fileToDataUrl(file);
      wrap.querySelector(`[data-photo="${input.dataset.index}"]`).innerHTML=
        `<img src="${URL.createObjectURL(file)}" alt="Scene reference">`;
    }));
  }
}

function approvedPackage(){
  return {
    format:state.format,
    mode:state.mode,
    source:state.source,
    details:state.lastDetails,
    plan:state.lastPlan,
    images:state.lastImages,
    sceneOverrides:state.sceneOverrides,
    scenePhotos:state.scenePhotos
  };
}

async function generateSnapshot(){
  if(!state.lastPlan || !state.lastDetails){
    showPlannerStatus("Build and approve a creative plan first.","error");
    gotoStep(5);
    return;
  }
  gotoStep(6);
  hideGenerationStatus();
  document.getElementById("generatingState").classList.remove("hidden");
  document.getElementById("resultState").classList.add("hidden");
  document.getElementById("generatedImage").removeAttribute("src");
  document.getElementById("downloadImageLink").classList.add("hidden");
  document.getElementById("fakeProgress").style.width="18%";

  try{
    if(state.format!=="Snapshot"){
      renderStoryApproved();
      return;
    }
    showGenerationStatus("Generating Snapshot...","");
    const payload=await fetchJsonWithTimeout(snapshotApiUrl,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(approvedPackage())
    },GENERATION_TIMEOUT_MS);

    if(!hasText(payload.image?.dataUrl)) throw new Error("Image generation finished without an image.");
    state.lastSnapshot=payload.image;
    renderSnapshotResult(payload);
  }catch(error){
    console.error(error);
    document.getElementById("generatingState").classList.add("hidden");
    document.getElementById("resultState").classList.remove("hidden");
    document.getElementById("resultPlanTitle").textContent=state.lastPlan?.title || "Snapshot generation";
    document.getElementById("resultSummary").textContent="The approved creative plan is safe. Generation can be retried without changing your inputs.";
    showGenerationStatus(`Snapshot generation error: ${error.message}`,"error");
  }
}

function renderSnapshotResult(payload){
  document.getElementById("fakeProgress").style.width="100%";
  document.getElementById("generatingState").classList.add("hidden");
  document.getElementById("resultState").classList.remove("hidden");
  document.getElementById("resultFormatLabel").textContent="SNAPSHOT";
  document.getElementById("resultPlanTitle").textContent=state.lastPlan.title;
  document.getElementById("resultSummary").textContent="Your generated Snapshot is ready.";
  const img=document.getElementById("generatedImage");
  img.src=payload.image.dataUrl;
  img.alt=state.lastPlan.title;
  const link=document.getElementById("downloadImageLink");
  link.href=payload.image.dataUrl;
  link.download=`${slugify(state.lastPlan.title)}.png`;
  link.classList.remove("hidden");
  showGenerationStatus(`Generated with ${payload.model || "the Snapshot image model"}.`,"success");
}

function renderStoryApproved(){
  document.getElementById("generatingState").classList.add("hidden");
  document.getElementById("resultState").classList.remove("hidden");
  document.getElementById("resultFormatLabel").textContent="MY STORY";
  document.getElementById("resultPlanTitle").textContent=state.lastPlan.title;
  document.getElementById("resultSummary").textContent="Storyboard approved for the next generation phase.";
  showGenerationStatus("Storyboard approved.","success");
}

function resetFlow(){
  document.querySelectorAll("input, textarea").forEach(input=>{
    if(input.type==="file" || input.tagName==="TEXTAREA" || input.type==="text") input.value="";
  });
  document.getElementById("theme").value="Family Adventure";
  document.getElementById("tone").value="Magical";
  document.getElementById("eventPreview").innerHTML="";
  document.getElementById("placePreview").innerHTML="";
  peopleList.innerHTML="";
  addPerson();
  state.step=1;
  state.format="Snapshot";
  state.mode="Easy";
  state.source="event";
  state.generation=0;
  state.sceneOverrides={};
  state.scenePhotos={};
  state.lastPlan=null;
  state.lastDetails=null;
  state.lastImages=[];
  state.lastSnapshot=null;
  document.querySelectorAll(".format-card").forEach(card=>{
    const selected=card.dataset.format==="Snapshot";
    card.classList.toggle("selected",selected);
    card.querySelector(".choose-mark").textContent=selected ? "Selected" : "Choose";
  });
  document.querySelectorAll(".mode-card").forEach(card=>card.classList.toggle("selected",card.dataset.mode==="Easy"));
  document.querySelectorAll(".source-card").forEach(card=>{
    const selected=card.dataset.source==="event";
    card.classList.toggle("selected",selected);
    card.querySelector(".choose-mark").textContent=selected ? "Selected" : "Choose";
  });
  hidePlannerStatus();
  hideGenerationStatus();
  document.getElementById("eventPath").classList.remove("hidden");
  document.getElementById("reconstructPath").classList.add("hidden");
  document.getElementById("storyModeBlock").classList.add("hidden");
  gotoStep(1);
}

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function slugify(value){
  return String(value || "my-story-snapshot").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "my-story-snapshot";
}

document.getElementById("planBtn").addEventListener("click",callPlanner);

document.getElementById("regenerateBtn").addEventListener("click",async ()=>{
  state.generation++;
  state.sceneOverrides={};
  state.scenePhotos={};
  gotoStep(4);
  await callPlanner();
});

document.getElementById("finalBtn").addEventListener("click",generateSnapshot);
document.getElementById("startOverBtn").addEventListener("click",resetFlow);
