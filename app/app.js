const MAX_EVENT_PHOTOS = 3;
const MAX_STORY_EVENT_PHOTOS = 5;
const MAX_PEOPLE = 5;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const PLANNER_TIMEOUT_MS = 70000;
const GENERATION_TIMEOUT_MS = 120000;
const TOTAL_STEPS = 7;

const state = {
  step: 1,
  format: "Snapshot",
  mode: "Easy",
  source: "event",
  generation: 0,
  sceneOverrides: {},
  scenePhotos: {},
  lastPlan: null,
  publicPreview: null,
  lastDetails: null,
  lastImages: [],
  lastSnapshot: null,
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

document.getElementById("eventPhotos").addEventListener("change",e=>renderFiles(e.target,"eventPreview",maxEventPhotos()));
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
    showPlannerStatus("Creating your free preview...","");

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
    state.payment={status:"not_started",checkoutId:null};
    renderPublicPreview(state.publicPreview);
    configureUnlock();
    gotoStep(5);
    showPlannerStatus("Free preview is ready.","success");
  }catch(err){
    console.error(err);
    showPlannerStatus(`AI Story Planner error: ${err.message}`,"error");
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

function configureUnlock(){
  const isStory=state.format==="My Story";
  document.getElementById("unlockHeading").textContent=isStory
    ?"Your story is ready to be illustrated."
    :"Your memory is ready to become an illustration.";
  document.getElementById("unlockIntro").textContent=isStory
    ?"We have the memory, photo source and story preview. The next step is paid generation."
    :"We have the memory, photo source and creative preview. The next step is paid generation.";
  document.getElementById("unlockBenefits").innerHTML=isStory
    ?"<li>4 illustrated scenes</li><li>Consistent visual storytelling</li><li>Downloadable story PDF</li>"
    :"<li>1 final illustrated image</li><li>High-resolution download</li><li>Personalized from your photos and memory</li>";
  document.getElementById("unlockPrice").textContent=isStory
    ?"$19.99 · one-time payment"
    :"$9.99 · one-time payment";
  document.getElementById("unlockBtn").textContent=isStory
    ?"Create my Story — $19.99"
    :"Create my Snapshot — $9.99";
  hideUnlockStatus();
}

function approvedPackage(){
  return {
    format:state.format,
    mode:state.mode,
    source:state.source,
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
  if(!state.lastPlan || !state.lastDetails){
    showPlannerStatus("Build the free preview first.","error");
    gotoStep(5);
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
  document.getElementById("resultSummary").textContent="Story generation is gated and ready for the next production phase.";
  showGenerationStatus("Story generation will be connected after payment and image/PDF generation are wired.","success");
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
  state.publicPreview=null;
  state.lastDetails=null;
  state.lastImages=[];
  state.lastSnapshot=null;
  state.payment={status:"not_started",checkoutId:null};
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
  configureUnlock();
  gotoStep(6);
});

document.getElementById("unlockBtn").addEventListener("click",()=>{
  if(devBypassPayment){
    generateSnapshot();
    return;
  }
  state.payment.status="not_started";
  state.payment.checkoutId=null;
  showUnlockStatus("Checkout integration coming next. No payment has been taken.","");
});

document.getElementById("startOverBtn").addEventListener("click",resetFlow);
