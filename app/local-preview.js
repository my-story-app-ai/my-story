(() => {
  const TYPE_KEYWORDS = {
    emotion: ['happy','joy','joyful','warm','love','loved','emotional','proud','excited','nervous','calm','peaceful','funny','laughed','laughter','smile','smiling','hugged','together'],
    action: ['went','played','jumped','ran','danced','swam','walked','watched','celebrated','visited','stayed','arrived','started','made','met','sat','opened','found'],
    person: ['mom','dad','mother','father','son','daughter','brother','sister','grandma','grandpa','wife','husband','partner','friend','family','kid','kids','child','children'],
    place: ['hotel','beach','park','pool','cinema','restaurant','home','house','garden','balcony','room','city','village','sea','mountain','lake'],
    detail: ['remember','detail','smell','sound','laugh','song','toy','dress','light','weather','little thing','joke','voice','look','outfit'],
    beginning: ['arrived','started','began','first','morning','when we got there'],
    change: ['then','suddenly','unexpected','unexpectedly','but','changed','started raining','surprise'],
    ending: ['finally','ended','sunset','went home','evening','last','at the end']
  };

  const TONE_KEYWORDS = {
    Joyful: ['happy','joy','joyful','laughed','laughter','smile','smiling','funny'],
    Emotional: ['emotional','cried','tears','proud','moved','love','loved','hugged'],
    Nostalgic: ['remember','miss','old','years','childhood','again','used to'],
    Adventurous: ['adventure','explore','trip','journey','jumped','ran','swam','park'],
    Magical: ['magic','magical','moon','dream','fairy','sparkle','wonder'],
    Calm: ['calm','quiet','peaceful','slow','balcony','sunset'],
    Playful: ['play','played','silly','joke','funny','kids','toy']
  };

  function $(id){ return document.getElementById(id); }

  function selectedFormat(){
    return document.querySelector('.format-card.selected')?.dataset.format || 'Snapshot';
  }

  function normalizeText(value=''){
    return String(value)
      .toLocaleLowerCase()
      .replace(/[^a-z0-9čćžšđ\s']/gi,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function cleanText(input=''){
    const text=String(input)
      .replace(/\s+/g,' ')
      .replace(/\s+([,.;!?])/g,'$1')
      .replace(/([!?.,])\1{1,}/g,'$1')
      .trim();
    if(!text) return '';
    const first=[...text][0];
    const punctuated=/[.!?…]$/.test(text) ? text : `${text}.`;
    return first.toLocaleUpperCase()+punctuated.slice(first.length);
  }

  function readRawDetails(){
    return {
      memory: $('memory')?.value || '',
      storyBeginning: $('storyBeginning')?.value || '',
      storyHighlight: $('storyHighlight')?.value || '',
      storyChange: $('storyChange')?.value || '',
      storyEnding: $('storyEnding')?.value || '',
      storyDetail: $('storyDetail')?.value || '',
      occasion: $('occasion')?.value || '',
      place: $('place')?.value || $('placeDescription')?.value || '',
      theme: $('theme')?.value || 'Illustrated keepsake',
      tone: $('tone')?.value || ''
    };
  }

  function derivePreviewDetails(raw){
    return {
      memory: cleanText(raw.memory),
      storyBeginning: cleanText(raw.storyBeginning),
      storyHighlight: cleanText(raw.storyHighlight),
      storyChange: cleanText(raw.storyChange),
      storyEnding: cleanText(raw.storyEnding),
      storyDetail: cleanText(raw.storyDetail),
      occasion: cleanText(raw.occasion),
      place: cleanText(raw.place),
      theme: raw.theme || 'Illustrated keepsake',
      tone: raw.tone || ''
    };
  }

  function labelCase(value=''){
    const text=String(value || '').replace(/[.!?…]$/,'').replace(/\s+/g,' ').trim();
    if(!text) return '';
    return text.split(' ').map(word=>{
      const first=[...word][0];
      return first ? first.toLocaleUpperCase()+word.slice(first.length) : word;
    }).join(' ');
  }

  function lowerFirst(value=''){
    const text=cleanText(value);
    if(!text) return '';
    const first=[...text][0];
    return first.toLocaleLowerCase()+text.slice(first.length);
  }

  function stripEnd(value=''){
    return cleanText(value).replace(/[.!?…]$/,'');
  }

  function clip(value='', max=165){
    const text=cleanText(value);
    if(text.length<=max) return text;
    return `${text.slice(0,max-1).trim().replace(/[,:;\-]+$/,'')}…`;
  }

  function classifyInput(text=''){
    const normalized=normalizeText(text);
    const scores={};
    Object.entries(TYPE_KEYWORDS).forEach(([type,keywords])=>{
      scores[type]=keywords.reduce((score,keyword)=>score+(normalized.includes(keyword) ? 1 : 0),0);
    });
    return Object.entries(scores)
      .filter(([,score])=>score>0)
      .sort((a,b)=>b[1]-a[1])
      .map(([type])=>type);
  }

  function detectTone(details){
    if(details.tone) return details.tone === 'Funny' ? 'Playful' : details.tone;
    const combined=[
      details.memory,
      details.storyBeginning,
      details.storyHighlight,
      details.storyChange,
      details.storyEnding,
      details.storyDetail
    ].join(' ');
    const normalized=normalizeText(combined);
    const match=Object.entries(TONE_KEYWORDS)
      .map(([tone,keywords])=>[tone,keywords.filter(keyword=>normalized.includes(keyword)).length])
      .filter(([,score])=>score>0)
      .sort((a,b)=>b[1]-a[1])[0];
    return match?.[0] || 'Warm';
  }

  function pickStoryAnchor(details){
    const candidates=[
      details.storyDetail,
      details.storyHighlight,
      details.memory,
      details.storyEnding,
      details.storyChange,
      details.occasion,
      details.place
    ].filter(Boolean);

    const ranked=candidates.map(text=>{
      const types=classifyInput(text);
      const score=
        (types.includes('emotion') ? 8 : 0)+
        (types.includes('detail') ? 7 : 0)+
        (types.includes('action') ? 5 : 0)+
        (types.includes('person') ? 4 : 0)+
        (types.includes('place') ? 2 : 0);
      return {text,score};
    }).sort((a,b)=>b.score-a.score || a.text.length-b.text.length);

    return ranked[0]?.text || candidates[0] || '';
  }

  function avoidRepetition(parts){
    const seen=new Set();
    return parts.map(part=>{
      const text=cleanText(part);
      if(!text) return '';
      const key=normalizeText(text).split(' ').filter(word=>word.length>3).slice(0,7).join(' ');
      if(key && seen.has(key)) return '';
      if(key) seen.add(key);
      return text;
    });
  }

  function shortAnchor(anchor){
    const text=stripEnd(anchor);
    if(!text) return '';
    const words=text.split(' ');
    if(words.length<=6) return text;
    return words.slice(0,6).join(' ');
  }

  function buildAdaptiveTitle(details, format){
    const anchor=shortAnchor(pickStoryAnchor(details));
    const occasion=stripEnd(details.occasion);
    const place=stripEnd(details.place);

    if(anchor && classifyInput(anchor).some(type=>['emotion','detail'].includes(type))){
      return format==='My Story' ? `The ${labelCase(anchor)} Story` : `The ${labelCase(anchor)} We Remember`;
    }
    if(format==='My Story'){
      if(place && occasion) return `Our ${labelCase(place)} Story`;
      if(occasion) return `${labelCase(occasion)} We Still Remember`;
      if(place) return `Our ${labelCase(place)} Story`;
      return 'The Day We Still Remember';
    }
    if(place && occasion) return `Our Day in ${labelCase(place)}`;
    if(occasion) return `A ${labelCase(occasion)} Moment`;
    if(place) return `A Moment in ${labelCase(place)}`;
    return 'A Moment Worth Keeping';
  }

  function joinNatural(parts){
    const cleanParts=avoidRepetition(parts).filter(Boolean).map(stripEnd);
    if(cleanParts.length===0) return '';
    if(cleanParts.length===1) return cleanText(cleanParts[0]);
    if(cleanParts.length===2) return cleanText(`${cleanParts[0]} and ${cleanParts[1]}`);
    return cleanText(`${cleanParts.slice(0,-1).join(', ')}, and ${cleanParts[cleanParts.length-1]}`);
  }

  function buildNaturalSynopsis(details, format){
    const tone=detectTone(details).toLocaleLowerCase();

    if(format==='Snapshot'){
      const anchor=details.memory || pickStoryAnchor(details) || details.occasion || details.place;
      const place=details.place ? ` in ${stripEnd(details.place)}` : '';
      return cleanText(`A ${tone} illustrated keepsake centered on ${lowerFirst(anchor || 'one personal moment')}${place}`);
    }

    const anchor=shortAnchor(pickStoryAnchor(details));
    const highlightText=details.storyHighlight || details.storyDetail || details.memory;
    const extraAnchor=anchor && !normalizeText(highlightText).includes(normalizeText(anchor)) ? anchor : '';
    const arc=joinNatural([
      (details.storyBeginning || details.occasion || details.place) && `${lowerFirst(details.storyBeginning || details.occasion || details.place)} turns into a ${tone} memory`,
      highlightText && `centered around ${lowerFirst(highlightText)}`,
      details.storyChange && lowerFirst(details.storyChange),
      details.storyEnding && `ending with ${lowerFirst(details.storyEnding)}`,
      extraAnchor && `held together by ${lowerFirst(extraAnchor)}`
    ]);
    return arc || 'A personal memory becomes a short illustrated story with a clear beginning, moment, change and ending.';
  }

  function smartBeat(text, fallback, used){
    const cleaned=clip(text || '', 150);
    const key=normalizeText(cleaned).split(' ').filter(word=>word.length>3).slice(0,6).join(' ');
    if(cleaned && (!key || !used.has(key))){
      if(key) used.add(key);
      return cleaned;
    }
    return fallback;
  }

  function buildSnapshotPreview(details){
    const anchor=pickStoryAnchor(details);
    return {
      title: buildAdaptiveTitle(details, 'Snapshot'),
      synopsis: buildNaturalSynopsis(details, 'Snapshot'),
      moment: clip(details.memory || anchor || details.occasion || details.place, 150),
      mood: detectTone(details),
      focus: shortAnchor(anchor) || 'The moment you described',
      style: details.theme || 'Illustrated keepsake'
    };
  }

  function buildStoryPreview(details){
    const used=new Set();
    return {
      title: buildAdaptiveTitle(details, 'My Story'),
      synopsis: buildNaturalSynopsis(details, 'My Story'),
      detail: details.storyDetail,
      scenes: [
        ['01','The Beginning','Setup',smartBeat(details.storyBeginning,'It starts with the setting and people that shaped the memory.',used)],
        ['02','The Moment','Highlight',smartBeat(details.storyHighlight || details.storyDetail,'The strongest remembered moment becomes the heart of the story.',used)],
        ['03','The Change','Turning point',smartBeat(details.storyChange,'The story moves toward its final moment.',used)],
        ['04','The Ending','Resolution',smartBeat(details.storyEnding,'The memory settles into the moment you wanted to keep.',used)]
      ]
    };
  }

  function renderSnapshotPreview(details){
    const preview=buildSnapshotPreview(details);
    $('previewHeading').textContent='Your memory, reimagined';
    $('previewExplainer').textContent='A first look at how your moment could become an illustrated keepsake.';
    $('previewFormat').textContent='Free preview';
    $('previewTitle').textContent=preview.title;
    $('previewSynopsis').textContent=preview.synopsis;
    $('storyPreview').classList.add('hidden');
    $('snapshotPreview').classList.remove('hidden');
    $('snapshotPreview').innerHTML=`
      <div class="preview-wide"><span>The moment</span><strong>${escapeHtml(preview.moment)}</strong></div>
      <div><span>Mood</span><strong>${escapeHtml(preview.mood)}</strong></div>
      <div><span>Focus</span><strong>${escapeHtml(preview.focus)}</strong></div>
      <div><span>Style</span><strong>${escapeHtml(preview.style)}</strong></div>
      <div class="snapshot-free-frame"><b>Your Snapshot</b><p>Your final illustration will be created after purchase.</p></div>
      <div class="preview-wide"><span>What you'll receive</span><ul><li>1 personalized illustrated image</li><li>visual direction based on your memory</li><li>digital file ready to save, share or print</li></ul></div>
    `;
  }

  function renderStoryPreview(details){
    const preview=buildStoryPreview(details);
    $('previewHeading').textContent="Here's how your memory becomes a story";
    $('previewExplainer').textContent='A first look at the emotional arc of your illustrated story.';
    $('previewFormat').textContent='Story structure preview';
    $('previewTitle').textContent=preview.title;
    $('previewSynopsis').textContent=preview.synopsis;
    $('snapshotPreview').classList.add('hidden');
    $('storyPreview').classList.remove('hidden');
    $('storyPreview').innerHTML=`
      <article class="preview-story-intro"><span>Your story</span><p>${escapeHtml(preview.synopsis)}</p></article>
      ${preview.scenes.map(([number,title,label,text])=>`
        <article class="preview-scene-card">
          <span>${number}</span>
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(text)}</p>
          <small>${escapeHtml(label)}</small>
        </article>
      `).join('')}
      ${preview.detail ? `<article class="preview-story-detail"><span>A detail worth keeping</span><strong>${escapeHtml(clip(preview.detail,120))}</strong></article>` : ''}
      <article class="preview-story-detail"><span>What you'll receive</span><ul><li>illustrated cover</li><li>4 personalized story scenes</li><li>consistent characters and visual world</li><li>digital story ready to save, share or print</li></ul></article>
    `;
  }

  function renderLocalPreview(){
    const format=selectedFormat();
    const details=derivePreviewDetails(readRawDetails());

    if(format==='My Story'){
      const hasStoryInput=[
        details.storyBeginning,
        details.storyHighlight,
        details.storyChange,
        details.storyEnding,
        details.storyDetail
      ].some(Boolean);
      if(!hasStoryInput){
        showError('Tell us a little about the memory first.');
        return false;
      }
      renderStoryPreview(details);
    }else{
      if(!details.memory){
        showError('Tell us a little about the moment first.');
        return false;
      }
      renderSnapshotPreview(details);
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

  document.addEventListener('click',event=>{
    const btn=event.target.closest('#planBtn');
    if(!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    renderLocalPreview();
  },true);
})();
