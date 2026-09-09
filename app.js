
const state = {
  step: 1,
  format: "Snapshot",
  mode: "Easy",
  source: "event",
  generation: 0,
  sceneOverrides: {},
  lastPlan: null
};

const panels = [...document.querySelectorAll("[data-panel]")];
const navItems = [...document.querySelectorAll("[data-step]")];
const progressBar = document.getElementById("progressBar");
const peopleList = document.getElementById("peopleList");
const plannerStatus = document.getElementById("plannerStatus");
const apiUrl = window.MY_STORY_CONFIG?.storyPlannerApi || "/api/story-plan";

function gotoStep(step){
  state.step = step;
  panels.forEach(p => p.classList.toggle("active", Number(p.dataset.panel) === step));
  navItems.forEach(n => n.classList.toggle("active", Number(n.dataset.step) === step));
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
    card.querySelector(".choose-mark").textContent="Selected ✓";
    state.format=card.dataset.format;
    document.getElementById("storyModeBlock").classList.toggle("hidden", state.format!=="My Story");
    syncSideCopy();
  });
});
document.querySelectorAll(".mode-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".mode-card").forEach(c=>c.classList.remove("selected"));
    card.classList.add("selected");
    state.mode=card.dataset.mode;
    syncSideCopy();
  });
});
document.querySelectorAll(".source-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    document.querySelectorAll(".source-card").forEach(c=>{
      c.classList.remove("selected");
      c.querySelector(".choose-mark").textContent="Choose";
    });
    card.classList.add("selected");
    card.querySelector(".choose-mark").textContent="Selected ✓";
    state.source=card.dataset.source;
    document.getElementById("eventPath").classList.toggle("hidden", state.source!=="event");
    document.getElementById("reconstructPath").classList.toggle("hidden", state.source!=="reconstruct");
  });
});

function syncSideCopy(){
  if(state.format==="My Story"){
    document.getElementById("sideTitle").textContent="Build the story from the strongest source.";
    document.getElementById("sideText").textContent=`${state.mode} mode: AI reads the memory and reference images, then proposes the synopsis and 4 scenes.`;
  }else{
    document.getElementById("sideTitle").textContent="Create one illustrated moment.";
    document.getElementById("sideText").textContent="AI reads the source photo and your memory, then creates one precise image brief.";
  }
}

function addPerson(){
  if(peopleList.children.length>=5) return;
  const card=document.createElement("div");
  card.className="person-card";
  card.innerHTML=`
    <button class="remove-person" type="button">×</button>
    <label>Name<input type="text" class="person-name" placeholder="e.g. Alex"></label>
    <label>Role (optional)<input type="text" class="person-role" placeholder="e.g. son, partner"></label>
    <div class="photo-row">
      <div class="photo-slot">
        <label>Reference photo<br><small>1 image</small><input type="file" class="person-photo" accept="image/*" hidden></label>
      </div>
    </div>`;
  peopleList.appendChild(card);
  card.querySelector(".remove-person").addEventListener("click", ()=>{
    if(peopleList.children.length>1){card.remove();syncRemove();}
  });
  card.querySelector(".person-photo").addEventListener("change", e=>{
    const file=e.target.files[0];
    if(!file) return;
    const slot=e.target.closest(".photo-slot");
    slot.dataset.hasFile="1";
    slot.innerHTML=`<img src="${URL.createObjectURL(file)}" alt="Person reference">`;
    slot._file=file;
  });
  syncRemove();
}
function syncRemove(){
  peopleList.querySelectorAll(".remove-person").forEach(btn=>btn.style.visibility=peopleList.children.length===1?"hidden":"visible");
}
document.getElementById("addPersonBtn").addEventListener("click", addPerson);
addPerson();

function renderFiles(input, targetId, max){
  const files=[...input.files].slice(0,max);
  const target=document.getElementById(targetId);
  target.innerHTML="";
  files.forEach(file=>{
    const img=document.createElement("img");
    img.src=URL.createObjectURL(file);
    target.appendChild(img);
  });
}
document.getElementById("eventPhotos").addEventListener("change",e=>renderFiles(e.target,"eventPreview",3));
document.getElementById("placePhoto").addEventListener("change",e=>renderFiles(e.target,"placePreview",1));

document.getElementById("photosContinueBtn").addEventListener("click", ()=>{
  if(state.source==="event"){
    const count=document.getElementById("eventPhotos").files.length;
    if(count<1){alert("Please add at least one event photo.");return;}
  }else{
    const cards=[...peopleList.querySelectorAll(".person-card")];
    for(const card of cards){
      const name=card.querySelector(".person-name").value.trim();
      if(!name){alert("Please add a name for each person.");return;}
    }
  }
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

async function fileToDataUrl(file, maxSide=1024, quality=.72){
  if(!file) return null;
  const bitmap=await createImageBitmap(file);
  let {width,height}=bitmap;
  const scale=Math.min(1,maxSide/Math.max(width,height));
  width=Math.round(width*scale);
  height=Math.round(height*scale);
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(bitmap,0,0,width,height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg",quality);
}

async function collectImages(){
  const images=[];
  if(state.source==="event"){
    const files=[...document.getElementById("eventPhotos").files].slice(0,3);
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
  plannerStatus.innerHTML=message;
  plannerStatus.classList.remove("hidden");
}
function hidePlannerStatus(){
  plannerStatus.classList.add("hidden");
}

async function callPlanner(){
  const data=collect();
  if(!data.memory){
    alert("Tell us a little about the moment first.");
    return;
  }

  const btn=document.getElementById("planBtn");
  btn.disabled=true;
  btn.textContent="Building AI plan…";

  try{
    const images=await collectImages();
    const response=await fetch(apiUrl,{
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
    });

    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      throw new Error(payload.error || `Planner request failed (${response.status})`);
    }

    state.lastPlan=payload.plan;
    renderAIPlan(payload.plan);
    gotoStep(5);
    showPlannerStatus("AI planner completed successfully.","success");
  }catch(err){
    console.error(err);
    alert(`AI Story Planner error: ${err.message}`);
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

  if(!isStory){
    document.getElementById("planHeading").textContent="Your AI Snapshot direction.";
    document.getElementById("planExplainer").textContent="The live planner analyzed your inputs and produced this image brief.";
    document.getElementById("snapSource").textContent=plan.source_strategy;
    document.getElementById("snapAction").textContent=plan.action;
    document.getElementById("snapFraming").textContent=plan.framing;
    document.getElementById("snapAnchor").textContent=plan.visual_anchor;
  }else{
    document.getElementById("planHeading").textContent="AI synopsis + 4-scene storyboard.";
    document.getElementById("planExplainer").textContent=state.mode==="Easy"
      ?"Easy mode: accept the AI plan or regenerate another complete version."
      :"Guided mode: use the AI plan as a starting point, then change individual scenes or add scene photos.";
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
        <label class="scene-action">Add scene photo<input class="scene-photo-input" data-index="${i}" type="file" accept="image/*"></label>
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
      state.sceneOverrides[btn.dataset.index]=text;
      renderScenes(state.lastPlan.scenes);
    }));
    wrap.querySelectorAll(".scene-photo-input").forEach(input=>input.addEventListener("change",()=>{
      const file=input.files[0]; if(!file)return;
      wrap.querySelector(`[data-photo="${input.dataset.index}"]`).innerHTML=
        `<img src="${URL.createObjectURL(file)}" alt="Scene reference">`;
    }));
  }
}

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

document.getElementById("planBtn").addEventListener("click",callPlanner);

document.getElementById("regenerateBtn").addEventListener("click",async ()=>{
  state.generation++;
  state.sceneOverrides={};
  gotoStep(4);
  await callPlanner();
});

document.getElementById("finalBtn").addEventListener("click",()=>{
  gotoStep(6);
  document.getElementById("generatingState").classList.remove("hidden");
  document.getElementById("resultState").classList.add("hidden");
  const bar=document.getElementById("fakeProgress");bar.style.width="0%";
  let p=0;
  const timer=setInterval(()=>{
    p+=12+Math.random()*12;
    if(p>=100){
      p=100;clearInterval(timer);
      setTimeout(()=>{
        document.getElementById("generatingState").classList.add("hidden");
        document.getElementById("resultState").classList.remove("hidden");
        document.getElementById("resultFormatLabel").textContent=state.format.toUpperCase();
        document.getElementById("resultPlanTitle").textContent=state.lastPlan?.title || "Approved plan";
        document.getElementById("resultSummary").textContent=
          state.format==="Snapshot"
          ?"The live AI Story Planner is now working. v0.8 will send this approved brief and source image(s) to live image generation."
          :"The live AI Story Planner is now working. v0.8/v0.9 will turn this approved storyboard into consistent illustrated scenes.";
      },250);
    }
    bar.style.width=`${p}%`;
  },160);
});

document.getElementById("startOverBtn").addEventListener("click",()=>{
  state.generation=0;state.sceneOverrides={};state.lastPlan=null;hidePlannerStatus();gotoStep(1);
});
