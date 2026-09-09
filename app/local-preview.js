(() => {
  function $(id){ return document.getElementById(id); }

  function selectedFormat(){
    return document.querySelector('.format-card.selected')?.dataset.format || 'Snapshot';
  }

  function cleanInline(value=''){
    return String(value)
      .replace(/\s+/g,' ')
      .replace(/\s+([,.;!?])/g,'$1')
      .replace(/([!?.,])\1{1,}/g,'$1')
      .trim();
  }

  function sentenceCase(value=''){
    const text=cleanInline(value);
    if(!text) return '';
    const first=[...text][0];
    const rest=text.slice(first.length);
    let out=first.toLocaleUpperCase()+rest;
    if(!/[.!?…]$/.test(out)) out+='.';
    return out;
  }

  function labelCase(value=''){
    const text=cleanInline(value);
    if(!text) return '';
    const first=[...text][0];
    const rest=text.slice(first.length);
    return first.toLocaleUpperCase()+rest;
  }

  function lowerFirst(value=''){
    const text=cleanInline(value);
    if(!text) return '';
    const first=[...text][0];
    const rest=text.slice(first.length);
    return first.toLocaleLowerCase()+rest;
  }

  function clip(value='', max=170){
    const text=sentenceCase(value);
    if(text.length<=max) return text;
    const clipped=text.slice(0,max-1).trim().replace(/[,:;\-]+$/,'');
    return `${clipped}…`;
  }

  function storySynopsis({occasion,place,tone}){
    const bits=[];
    if(occasion) bits.push(lowerFirst(occasion));
    if(place) bits.push(`in ${cleanInline(place)}`);
    const subject=bits.length ? bits.join(' ') : 'a personal memory';
    const mood=cleanInline(tone || 'Warm').toLocaleLowerCase();
    return `A ${mood} illustrated story shaped around ${subject}, using the moments you chose to remember.`;
  }

  function snapshotSynopsis({occasion,place,tone}){
    const bits=[];
    if(occasion) bits.push(lowerFirst(occasion));
    if(place) bits.push(`in ${cleanInline(place)}`);
    const subject=bits.length ? bits.join(' ') : 'one personal moment';
    const mood=cleanInline(tone || 'Warm').toLocaleLowerCase();
    return `A ${mood} illustrated keepsake built around ${subject}.`;
  }

  function snapshotTitle(occasion,place){
    if(occasion && place) return `${labelCase(occasion)} · ${labelCase(place)}`;
    if(occasion) return labelCase(occasion);
    if(place) return `A Memory from ${labelCase(place)}`;
    return 'A Moment to Remember';
  }

  function storyTitle(occasion,place){
    if(occasion) return labelCase(occasion);
    if(place) return `A Story from ${labelCase(place)}`;
    return 'A Memory Worth Keeping';
  }

  function renderLocalPreview(){
    const format=selectedFormat();
    const occasion=cleanInline($('occasion')?.value || '');
    const place=cleanInline($('place')?.value || $('placeDescription')?.value || '');
    const tone=$('tone')?.value || 'Warm';
    const theme=$('theme')?.value || 'Family Adventure';

    if(format==='My Story'){
      const beginning=cleanInline($('storyBeginning')?.value || '');
      const highlight=cleanInline($('storyHighlight')?.value || '');
      const change=cleanInline($('storyChange')?.value || '');
      const ending=cleanInline($('storyEnding')?.value || '');
      const detail=cleanInline($('storyDetail')?.value || '');
      const hasStoryInput=[beginning,highlight,change,ending,detail].some(Boolean);

      if(!hasStoryInput){
        showError('Tell us a little about the memory first.');
        return false;
      }

      $('previewHeading').textContent='Your story is taking shape';
      $('previewExplainer').textContent='A simple first look at the story structure — the detailed creative work starts after purchase.';
      $('previewFormat').textContent='My Story';
      $('previewTitle').textContent=storyTitle(occasion,place);
      $('previewSynopsis').textContent=storySynopsis({occasion,place,tone});
      $('snapshotPreview').classList.add('hidden');
      $('storyPreview').classList.remove('hidden');

      const scenes=[
        ['The Beginning', beginning || 'The story opens with the first part of the memory you described.'],
        ['The Moment', highlight || detail || 'The strongest remembered moment becomes the heart of the story.'],
        ['The Change', change || 'A shift in place, time, activity or mood moves the story forward.'],
        ['The Ending', ending || 'The story closes around the feeling you want to keep.']
      ];

      const wrap=$('storyPreview');
      wrap.innerHTML='';
      scenes.forEach(([title,text],index)=>{
        const card=document.createElement('article');
        card.className='preview-scene-card';
        card.innerHTML=`<span>${String(index+1).padStart(2,'0')}</span><h4>${escapeHtml(title)}</h4><p>${escapeHtml(clip(text))}</p>`;
        wrap.appendChild(card);
      });
    }else{
      const memory=cleanInline($('memory')?.value || '');
      if(!memory){
        showError('Tell us a little about the moment first.');
        return false;
      }

      $('previewHeading').textContent='Your Snapshot is taking shape';
      $('previewExplainer').textContent='A simple first look at the illustration direction — the detailed creative work starts after purchase.';
      $('previewFormat').textContent='Snapshot';
      $('previewTitle').textContent=snapshotTitle(occasion,place);
      $('previewSynopsis').textContent=snapshotSynopsis({occasion,place,tone});
      $('storyPreview').classList.add('hidden');
      $('snapshotPreview').classList.remove('hidden');
      $('previewConcept').textContent=clip(memory);
      $('previewMood').textContent=labelCase(tone);
      $('previewStyle').textContent=labelCase(theme);
    }

    hideError();
    gotoPreviewStep();
    return true;
  }

  function escapeHtml(value=''){
    return String(value).replace(/[&<>"']/g,m=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[m]));
  }

  function gotoPreviewStep(){
    document.querySelectorAll('[data-panel]').forEach(panel=>{
      panel.classList.toggle('active',Number(panel.dataset.panel)===5);
    });
    document.querySelectorAll('[data-step]').forEach(item=>{
      item.classList.toggle('active',Number(item.dataset.step)===5);
    });
    const meta=$('currentStepMeta');
    const title=$('currentStepTitle');
    const bar=$('progressBar');
    if(meta) meta.textContent='Step 5 of 7';
    if(title) title.textContent='Free preview';
    if(bar) bar.style.width=`${5/7*100}%`;
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function showError(message){
    const status=$('plannerStatus');
    if(!status) return;
    status.className='planner-status error';
    status.textContent=message;
    status.classList.remove('hidden');
  }

  function hideError(){
    const status=$('plannerStatus');
    if(status) status.classList.add('hidden');
  }

  // Capture the preview click before app.js can call the paid OpenAI planner.
  document.addEventListener('click',event=>{
    const btn=event.target.closest('#planBtn');
    if(!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    renderLocalPreview();
  },true);
})();
