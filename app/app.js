const MAX_EVENT_PHOTOS = 3;
const MAX_STORY_EVENT_PHOTOS = 5;
const MAX_PEOPLE = 5;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const PLANNER_TIMEOUT_MS = 70000;
const GENERATION_TIMEOUT_MS = 120000;
const TOTAL_STEPS = 7;
const DEFAULT_OUTPUT_PRESETS = {
  Snapshot: [
    {id:"snapshot-digital",outputType:"digital",label:"Digital",shortLabel:"Digital",description:"Optimized for screens, sharing and digital keepsakes.",resultLabel:"Digital image",downloadLabel:"Download digital image",ratio:"1:1",targetPixels:null},
    {id:"snapshot-print-10x15",outputType:"print",label:"Print-ready 10 x 15 cm",shortLabel:"10 x 15 cm",description:"Professional print-ready file for a classic photo size.",resultLabel:"Print-ready · 10 x 15 cm",downloadLabel:"Download print file",ratio:"2:3",targetPixels:{width:1181,height:1772,dpi:300}},
    {id:"snapshot-print-15x20",outputType:"print",label:"Print-ready 15 x 20 cm",shortLabel:"15 x 20 cm",description:"Professional print-ready file for a larger portrait keepsake.",resultLabel:"Print-ready · 15 x 20 cm",downloadLabel:"Download print file",ratio:"3:4",targetPixels:{width:1772,height:2362,dpi:300}}
  ],
  "My Story": [
    {id:"story-digital",outputType:"digital",label:"Digital Story",shortLabel:"Digital Story",description:"Optimized for screen reading, saving and sharing.",resultLabel:"Digital story",downloadLabel:"Download digital story",ratio:"story",targetPixels:null},
    {id:"story-print-30x40",outputType:"print",label:"Print-ready 30 x 40 cm",shortLabel:"30 x 40 cm",description:"Prepared as an elegant story-board print.",resultLabel:"Print-ready · 30 x 40 cm",downloadLabel:"Download print file",ratio:"3:4",targetPixels:{width:3543,height:4724,dpi:300}},
    {id:"story-print-50x70",outputType:"print",label:"Print-ready 50 x 70 cm",shortLabel:"50 x 70 cm",description:"Prepared for a larger wall-worthy story print.",resultLabel:"Print-ready · 50 x 70 cm",downloadLabel:"Download print file",ratio:"5:7",targetPixels:{width:5906,height:8268,dpi:300}}
  ]
};
const OUTPUT_PRESETS = window.MY_STORY_CONFIG?.outputPresets || DEFAULT_OUTPUT_PRESETS;

const state = {
  step: 1,
  format: "Snapshot",
  mode: "Easy",
  source: "event",
  outputPresetId: "snapshot-digital",
  generation: 0,
  sceneOverrides: {},
  scenePhotos: {},
  lastPlan: null,
  publicPreview: null,
  lastDetails: null,
  lastImages: [],
  lastSnapshot: null,
  inputRevision: 0,
  planRevision: null,
  payment: {
    status: "not_started",
    checkoutId: null
  }
};

const panels = [...document.querySelectorAll("[data-panel]")];
const navItems = [...document.querySelectorAll("[data-step]")];
const progressBar = document.getElementById("progressBar");
const peopleList = document.getElementById("peopleList");
const plannerStatus = document.getElementById("plannerStatus");
const retryPlannerBtn = document.getElementById("retryPlannerBtn");
const generationStatus = document.getElementById("generationStatus");
const unlockStatus = document.getElementById("unlockStatus");
const currentStepMeta = document.getElementById("currentStepMeta");
const currentStepTitle = document.getElementById("currentStepTitle");
const apiUrl = window.MY_STORY_CONFIG?.storyPlannerApi || "/api/story-plan";
const snapshotApiUrl = window.MY_STORY_CONFIG?.snapshotGenerationApi || "/api/snapshot-generate";
const devBypassPayment = window.MY_STORY_CONFIG?.devBypassPayment === true;

function gotoStep(step){
  state.step = step;
  panels.forEach(p => p.classList.toggle("active", Number(p.dataset.panel) === step));
  navItems.forEach(n => n.classList.toggle("active", Number(n.dataset.step) === step));
  const activeNav = navItems.find(n => Number(n.dataset.step) === step);
  currentStepMeta.textContent = `Step ${step} of ${TOTAL_STEPS}`;
  currentStepTitle.textContent = activeNav?.dataset.title || "Create";
  progressBar.style.width = `${step / TOTAL_STEPS * 100}%`;
  window.scrollTo({top:0, behavior:"smooth"});
  logFunnelEvent("step_view", { step });
}

function logFunnelEvent(name, detail={}){
  const eventDetail={
    name,
    step: state.step,
    format: state.format,
    mode: state.mode,
    source: state.source,
    outputPresetId: state.outputPresetId,
    ...detail
  };
  window.dispatchEvent(new CustomEvent("my-story:funnel", { detail: eventDetail }));
  if(window.MY_STORY_CONFIG?.debugEvents) console.debug("[My Story]", eventDetail);
}

function presetsForFormat(format=state.format){
  return OUTPUT_PRESETS[format] || [];
}

function defaultOutputPresetId(format=state.format){
  return presetsForFormat(format)[0]?.id || "";
}

function getOutputPreset(id=state.outputPresetId, format=state.format){
  return presetsForFormat(format).find(preset=>preset.id===id) || presetsForFormat(format)[0] || null;
}

function ensureOutputPreset(){
  const preset=getOutputPreset();
  if(!preset) return null;
  state.outputPresetId=preset.id;
  return preset;
}

function outputTypeLabel(preset){
  if(!preset) return "Digital";
  return preset.outputType==="print" ? "Print-ready" : "Digital";
}

function resetDeliveryForOutputChange(){
  state.lastSnapshot=null;
  resetPayment();
  hideUnlockStatus();
}

function selectOutputPreset(presetId){
  const preset=getOutputPreset(presetId);
  if(!preset) return;
  if(state.outputPresetId!==preset.id){
    state.outputPresetId=preset.id;
    resetDeliveryForOutputChange();
  }
  renderOutputOptions();
  logFunnelEvent("output_preset_selected", { outputPresetId:preset.id, outputType:preset.outputType });
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
    state.outputPresetId=defaultOutputPresetId(state.format);
    document.getElementById("storyModeBlock").classList.toggle("hidden", state.format!=="My Story");
    markInputsChanged();
    logFunnelEvent("format_selected", { format: state.format });
  });
});

document.querySelectorAll(".mode-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".mode-card").forEach(c=>c.classList.remove("selected"));
    card.classList.add("selected");
    state.mode=card.dataset.mode;
    markInputsChanged();
    logFunnelEvent("mode_selected", { mode: state.mode });
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
    markInputsChanged();
    logFunnelEvent("source_selected", { source: state.source });
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
    if(peopleList.children.length>1){card.remove();syncRemove();markInputsChanged();}
  });
  card.querySelector(".person-name").addEventListener("input",markInputsChanged);
  card.querySelector(".person-role").addEventListener("input",markInputsChanged);
  card.querySelector(".person-photo").addEventListener("change", e=>{
    const file=e.target.files[0];
    if(!file) return;
    const validation=validateImageFile(file);
    if(validation){
      e.target.value="";
      showPlannerStatus(validation,"error");
      showPlannerRetry();
      return;
    }
    const slot=e.target.closest(".photo-slot");
    slot.dataset.hasFile="1";
    slot.innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Person reference">`;
    slot._file=file;
    hidePlannerStatus();
    markInputsChanged();
  });
  syncRemove();
}

function syncRemove(){
  peopleList.querySelectorAll(".remove-person").forEach(btn=>btn.style.visibility=peopleList.children.length===1?"hidden":"visible");
}

document.getElementById("addPersonBtn").addEventListener("click", addPerson);
addPerson();

function maxEventPhotos(){
  return state.format==="My Story" ? MAX_STORY_EVENT_PHOTOS : MAX_EVENT_PHOTOS;
}

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
    showPlannerRetry();
    markInputsChanged();
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
  markInputsChanged();
  logFunnelEvent("photos_selected", { target: targetId, selected: selected.length, used: files.length });
}

document.getElementById("eventPhotos").addEventListener("change",e=>renderFiles(e.target,"eventPreview",maxEventPhotos()));
document.getElementById("placePhoto").addEventListener("change",e=>renderFiles(e.target,"placePreview",1));
document.querySelectorAll("#occasion,#place,#memory,#storyBeginning,#storyHighlight,#storyChange,#storyEnding,#storyDetail,#placeDescription").forEach(input=>{
  input.addEventListener("input",markInputsChanged);
});
document.querySelectorAll("#theme,#tone").forEach(input=>{
  input.addEventListener("change",markInputsChanged);
});
document.addEventListener("my-story:input-changed",markInputsChanged);

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
  const plannerMemory=window.MyStoryFormState?.getPlannerMemory?.() ?? document.getElementById("memory").value;
  const place=document.getElementById("place").value.trim();
  const reconstructPlace=state.source==="reconstruct" ? document.getElementById("placeDescription").value.trim() : "";
  return {
    people:[...peopleList.querySelectorAll(".person-card")].map(c=>({
      name:c.querySelector(".person-name")?.value.trim() || "",
      role:c.querySelector(".person-role")?.value.trim() || ""
    })).filter(p=>p.name),
    occasion:document.getElementById("occasion").value.trim(),
    place:place || reconstructPlace,
    memory:String(plannerMemory).trim(),
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
    const files=[...document.getElementById("eventPhotos").files].slice(0,maxEventPhotos());
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
  hidePlannerRetry();
}

function showPlannerRetry(){
  retryPlannerBtn.classList.remove("hidden");
}

function hidePlannerRetry(){
  retryPlannerBtn.classList.add("hidden");
}

function resetPayment(){
  state.payment={status:"not_started",checkoutId:null};
}

function markInputsChanged(){
  state.inputRevision += 1;
  if(state.lastPlan || state.publicPreview || state.lastSnapshot || state.payment.status!=="not_started"){
    state.lastPlan=null;
    state.publicPreview=null;
    state.lastDetails=null;
    state.lastImages=[];
    state.lastSnapshot=null;
    state.planRevision=null;
    resetPayment();
    hideUnlockStatus();
    showPlannerStatus("Your changes are saved. Create a fresh free preview before continuing.","");
  }
}

function showGenerationStatus(message,type=""){
  generationStatus.className=`planner-status ${type}`.trim();
  generationStatus.textContent=message;
  generationStatus.classList.remove("hidden");
}

function hideGenerationStatus(){
  generationStatus.classList.add("hidden");
}

function showUnlockStatus(message,type=""){
  unlockStatus.className=`planner-status ${type}`.trim();
  unlockStatus.textContent=message;
  unlockStatus.classList.remove("hidden");
}

function hideUnlockStatus(){
  unlockStatus.classList.add("hidden");
}

async function fetchJsonWithTimeout(url, options, timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(payload.error || payload.detail || `Request failed (${response.status})`);
      error.status=response.status;
      error.payload=payload;
      throw error;
    }
    return payload;
  }catch(error){
    if(error.name==="AbortError") throw new Error("The request took too long. Please try again.");
    if(error instanceof TypeError) throw new Error("We could not reach the AI service. Please check your connection and try again.");
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

function friendlyPlannerError(error){
  const status=error?.status;
  const message=String(error?.message || "");
  if(status===400) return message || "Some details are missing. Please review the form and try again.";
  if(status===401 || status===403) return "The AI service is not accepting this request right now. Please try again later.";
  if(status===429) return "The AI service is busy or out of quota. Please try again later.";
  if(status>=500) return "The AI Story Planner is temporarily unavailable. Your inputs are safe; please try again.";
  if(message.toLowerCase().includes("too long")) return "The AI Story Planner took too long. Your inputs are safe; please try again.";
  return message || "AI Story Planner failed. Your inputs are safe; please try again.";
}

function validatePreflight(data){
  const issues=[];
  if(!data.memory) issues.push(state.format==="My Story" ? "Add at least one Story memory answer." : "Tell us a little about the moment.");
  if(state.source==="event"){
    const count=document.getElementById("eventPhotos").files.length;
    if(count<1) issues.push("Add at least one event photo.");
    if(count>maxEventPhotos()) issues.push(`Only the first ${maxEventPhotos()} photos will be used.`);
  }else{
    const cards=[...peopleList.querySelectorAll(".person-card")];
    const completePeople=cards.filter(card=>card.querySelector(".person-name").value.trim() && card.querySelector(".photo-slot")?._file);
    if(completePeople.length<1) issues.push("Add at least one person with a name and reference photo.");
    if(cards.some(card=>card.querySelector(".person-name").value.trim() && !(card.querySelector(".photo-slot")?._file))){
      issues.push("Every named person needs one reference photo.");
    }
  }
  return issues;
}

function hasApprovedPreview(){
  return Boolean(state.lastPlan && state.publicPreview && state.lastDetails && state.lastImages.length && state.planRevision===state.inputRevision);
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

function firstSentence(value="", fallback="A meaningful moment becomes part of the illustrated memory."){
  const text=String(value || "").replace(/\s+/g," ").trim();
  if(!text) return fallback;
  const end=[...text].findIndex(char=>[".","!","?"].includes(char));
  const sentence=end>=0 ? text.slice(0,end+1) : text;
  return sentence.length>150 ? `${sentence.slice(0,147).trim()}...` : sentence;
}

function sceneSummary(scene,index){
  const fallbacks=[
    "The memory opens with the people and place that matter most.",
    "The heart of the moment becomes the center of the story.",
    "A shift in place, time or activity moves the story forward.",
    "The story closes with the feeling they will remember later."
  ];
  return firstSentence(scene?.action, fallbacks[index] || fallbacks[1]);
}

function buildPublicPreview(plan, details){
  if(state.format==="Snapshot"){
    return {
      title: plan.title,
      synopsis: firstSentence(plan.synopsis, "A personal memory becomes one illustrated keepsake."),
      concept: firstSentence(plan.action, "One favorite moment becomes a personalized illustration."),
      mood: firstSentence(plan.emotion, details?.tone || "Warm"),
      styleDirection: [details?.tone, details?.theme].filter(Boolean).join(" ") || "Warm illustrated keepsake"
    };
  }

  return {
    title: plan.title,
    synopsis: firstSentence(plan.synopsis, "A personal memory becomes a short illustrated story."),
    scenes: plan.scenes.map((scene,index)=>({
      title: scene.title,
      summary: sceneSummary(scene,index)
    }))
  };
}

function approveLocalPreview({plan, publicPreview, details, images=[]}){
  if(!plan || !publicPreview || !details) return false;
  state.lastPlan=plan;
  state.publicPreview=publicPreview;
  state.lastDetails=details;
  state.lastImages=images;
  state.lastSnapshot=null;
  state.planRevision=state.inputRevision;
  resetPayment();
  configureUnlock();
  logFunnelEvent("local_preview_approved", { imageCount: images.length });
  return true;
}

async function callPlanner(){
  const data=collect();
  const issues=validatePreflight(data);
  if(issues.some(issue=>!issue.startsWith("Only the first"))){
    showPlannerStatus(issues[0],"error");
    return;
  }

  const btn=document.getElementById("planBtn");
  btn.disabled=true;
  btn.textContent="Building AI plan...";

  try{
    const images=await collectImages();
    if(images.length===0) throw new Error("Please add the required source photo before planning.");
    showPlannerStatus(issues.find(issue=>issue.startsWith("Only the first")) || "Creating your free preview...","");
    hidePlannerRetry();

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
    state.publicPreview=buildPublicPreview(payload.plan,data);
    state.lastDetails=data;
    state.lastImages=images;
    state.lastSnapshot=null;
    state.planRevision=state.inputRevision;
    resetPayment();
    renderPublicPreview(state.publicPreview);
    configureUnlock();
    gotoStep(5);
    showPlannerStatus("Free preview is ready.","success");
    logFunnelEvent("preview_created", { imageCount: images.length });
  }catch(err){
    console.error(err);
    showPlannerStatus(friendlyPlannerError(err),"error");
    showPlannerRetry();
    logFunnelEvent("planner_failed", { status: err?.status || null, message: err?.message || "Planner failed" });
  }finally{
    btn.disabled=false;
    btn.textContent="Create free preview";
  }
}

function renderPublicPreview(preview){
  const isStory=state.format==="My Story";
  document.getElementById("previewHeading").textContent=isStory
    ?"Your story is taking shape"
    :"Your Snapshot is taking shape";
  document.getElementById("previewExplainer").textContent=isStory
    ?"A simple preview of the illustrated story we can create from this memory."
    :"A simple preview of the final illustration direction.";
  document.getElementById("previewFormat").textContent=state.format;
  document.getElementById("previewTitle").textContent=preview.title;
  document.getElementById("previewSynopsis").textContent=preview.synopsis;

  document.getElementById("snapshotPreview").classList.toggle("hidden",isStory);
  document.getElementById("storyPreview").classList.toggle("hidden",!isStory);

  if(isStory){
    const list=document.getElementById("storyPreview");
    list.innerHTML="";
    preview.scenes.forEach((scene,index)=>{
      const card=document.createElement("article");
      card.className="preview-scene-card";
      card.innerHTML=`
        <span>${String(index+1).padStart(2,"0")}</span>
        <h4>${escapeHtml(scene.title)}</h4>
        <p>${escapeHtml(scene.summary)}</p>
      `;
      list.appendChild(card);
    });
    return;
  }

  document.getElementById("previewConcept").textContent=preview.concept;
  document.getElementById("previewMood").textContent=preview.mood;
  document.getElementById("previewStyle").textContent=preview.styleDirection;
}

function renderOutputOptions(){
  const container=document.getElementById("outputOptions");
  if(!container) return;
  const presets=presetsForFormat();
  const selected=ensureOutputPreset();
  container.innerHTML="";
  presets.forEach(preset=>{
    const card=document.createElement("button");
    card.className=`output-option ${selected?.id===preset.id ? "selected" : ""}`.trim();
    card.type="button";
    card.dataset.presetId=preset.id;
    card.setAttribute("aria-pressed", selected?.id===preset.id ? "true" : "false");
    card.innerHTML=`
      <span class="output-radio" aria-hidden="true"></span>
      <span class="output-copy">
        <strong>${escapeHtml(preset.label)}</strong>
        <small>${escapeHtml(preset.description)}</small>
      </span>
    `;
    card.addEventListener("click",()=>selectOutputPreset(preset.id));
    container.appendChild(card);
  });

  const note=document.getElementById("outputNote");
  if(note && selected){
    note.textContent=selected.outputType==="print"
      ?"Prepared for professional printing with a print-safe composition."
      :"Optimized for screens, sharing and digital download.";
  }
}

function configureUnlock(){
  const isStory=state.format==="My Story";
  const preset=ensureOutputPreset();
  renderOutputOptions();
  document.getElementById("unlockHeading").textContent=isStory
    ?"Your story is ready to be illustrated."
    :"Your memory is ready to become an illustration.";
  document.getElementById("unlockIntro").textContent=isStory
    ?"Choose the final file you want, then continue to paid generation."
    :"Choose the final file you want, then continue to paid generation.";
  document.getElementById("unlockBenefits").innerHTML=isStory
    ?"<li>4 illustrated scenes</li><li>Consistent visual storytelling</li><li>Digital or print-ready delivery</li>"
    :"<li>1 final illustrated image</li><li>Digital or print-ready delivery</li><li>Personalized from your photos and memory</li>";
  document.getElementById("unlockPrice").textContent=isStory
    ?"$19.99 · one-time payment"
    :"$9.99 · one-time payment";
  document.getElementById("unlockBtn").textContent=isStory
    ?"Create my Story — $19.99"
    :"Create my Snapshot — $9.99";
  logFunnelEvent("unlock_configured", { outputPresetId:preset?.id || null, outputType:preset?.outputType || null });
  hideUnlockStatus();
}

function approvedPackage(){
  const outputPreset=ensureOutputPreset();
  return {
    format:state.format,
    mode:state.mode,
    source:state.source,
    outputPresetId:outputPreset?.id || "",
    outputType:outputPreset?.outputType || "digital",
    outputPreset,
    details:state.lastDetails,
    plan:state.lastPlan,
    publicPreview:state.publicPreview,
    images:state.lastImages,
    sceneOverrides:state.sceneOverrides,
    scenePhotos:state.scenePhotos,
    payment:state.payment
  };
}

async function generateSnapshot(){
  if(!hasApprovedPreview()){
    showPlannerStatus("Build the free preview first.","error");
    gotoStep(4);
    return;
  }
  if(state.payment.status!=="paid" && !devBypassPayment){
    configureUnlock();
    gotoStep(6);
    showUnlockStatus("Checkout integration is coming next. Generation stays locked until payment is connected.","error");
    return;
  }
  gotoStep(7);
  hideGenerationStatus();
  document.getElementById("generatingState").classList.remove("hidden");
  document.getElementById("resultState").classList.add("hidden");
  document.getElementById("generatedImage").removeAttribute("src");
  document.getElementById("downloadImageLink").classList.add("hidden");
  document.getElementById("fakeProgress").style.width="18%";

  try{
    if(state.format!=="Snapshot"){
      renderStoryApproved();
      logFunnelEvent("story_generation_placeholder_viewed");
      return;
    }
    const preset=ensureOutputPreset();
    showGenerationStatus(preset?.outputType==="print" ? "Generating print-safe Snapshot master..." : "Generating digital Snapshot...","");
    logFunnelEvent("snapshot_generation_started", { outputPresetId:preset?.id || null, outputType:preset?.outputType || null });
    const payload=await fetchJsonWithTimeout(snapshotApiUrl,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(approvedPackage())
    },GENERATION_TIMEOUT_MS);

    if(!hasText(payload.image?.dataUrl)) throw new Error("Image generation finished without an image.");
    state.lastSnapshot=payload.image;
    renderSnapshotResult(payload);
    logFunnelEvent("snapshot_generation_succeeded");
  }catch(error){
    console.error(error);
    document.getElementById("generatingState").classList.add("hidden");
    document.getElementById("resultState").classList.remove("hidden");
    document.getElementById("resultPlanTitle").textContent=state.lastPlan?.title || "Snapshot generation";
    document.getElementById("resultOutputMeta").textContent=getOutputPreset()?.resultLabel || "";
    document.getElementById("resultSummary").textContent="The approved creative plan is safe. Generation can be retried without changing your inputs.";
    showGenerationStatus(`Snapshot generation error: ${error.message}`,"error");
    logFunnelEvent("snapshot_generation_failed", { status: error?.status || null, message: error?.message || "Generation failed" });
  }
}

function renderSnapshotResult(payload){
  const preset=payload.outputPreset || getOutputPreset();
  document.getElementById("fakeProgress").style.width="100%";
  document.getElementById("generatingState").classList.add("hidden");
  document.getElementById("resultState").classList.remove("hidden");
  document.getElementById("resultFormatLabel").textContent=`SNAPSHOT · ${outputTypeLabel(preset).toUpperCase()}`;
  document.getElementById("resultPlanTitle").textContent=state.lastPlan.title;
  document.getElementById("resultOutputMeta").textContent=preset?.resultLabel || "Digital image";
  document.getElementById("resultSummary").textContent=preset?.outputType==="print"
    ?"Your Snapshot master is ready for the selected print-ready export path."
    :"Your generated Snapshot is ready.";
  const img=document.getElementById("generatedImage");
  img.src=payload.image.dataUrl;
  img.alt=state.lastPlan.title;
  const link=document.getElementById("downloadImageLink");
  link.href=payload.image.dataUrl;
  link.download=`${slugify(state.lastPlan.title)}-${preset?.id || "snapshot-digital"}.png`;
  link.textContent=preset?.downloadLabel || "Download image";
  link.classList.remove("hidden");
  showGenerationStatus(`Generated with ${payload.model || "the Snapshot image model"}. ${preset?.resultLabel || "Digital image"}.`,"success");
}

function renderStoryApproved(){
  const preset=getOutputPreset();
  document.getElementById("generatingState").classList.add("hidden");
  document.getElementById("resultState").classList.remove("hidden");
  document.getElementById("resultFormatLabel").textContent=`MY STORY · ${outputTypeLabel(preset).toUpperCase()}`;
  document.getElementById("resultPlanTitle").textContent=state.lastPlan.title;
  document.getElementById("resultOutputMeta").textContent=preset?.resultLabel || "Digital story";
  document.getElementById("resultSummary").textContent="Story generation is gated and ready for the scene generation and layout renderer phase.";
  showGenerationStatus("Story output will be created from four scene masters plus a final layout renderer after payment and generation are wired.","success");
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
  state.outputPresetId="snapshot-digital";
  state.generation=0;
  state.sceneOverrides={};
  state.scenePhotos={};
  state.lastPlan=null;
  state.publicPreview=null;
  state.lastDetails=null;
  state.lastImages=[];
  state.lastSnapshot=null;
  state.inputRevision=0;
  state.planRevision=null;
  resetPayment();
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
  hideUnlockStatus();
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

document.getElementById("continueToUnlockBtn").addEventListener("click",()=>{
  if(!hasApprovedPreview()){
    gotoStep(4);
    showPlannerStatus("Create a fresh free preview before continuing.","error");
    return;
  }
  logFunnelEvent("unlock_viewed");
  configureUnlock();
  gotoStep(6);
});

document.getElementById("unlockBtn").addEventListener("click",()=>{
  if(!hasApprovedPreview()){
    gotoStep(4);
    showPlannerStatus("Create a fresh free preview before unlocking.","error");
    return;
  }
  if(devBypassPayment){
    state.payment.status="paid";
    logFunnelEvent("dev_payment_bypass_used");
    generateSnapshot();
    return;
  }
  state.payment.status="not_started";
  state.payment.checkoutId=null;
  showUnlockStatus("Checkout integration coming next. No payment has been taken.","");
  logFunnelEvent("unlock_clicked", { paymentStatus: state.payment.status });
});

retryPlannerBtn.addEventListener("click",callPlanner);
document.getElementById("startOverBtn").addEventListener("click",resetFlow);

window.MyStoryApp = {
  approveLocalPreview
};
