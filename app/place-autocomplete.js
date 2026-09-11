(() => {
  const key=window.MY_STORY_CONFIG?.geoapifyApiKey?.trim();
  const input=document.getElementById('place');
  if(!key || !input) return;
  const popup=document.getElementById('placeSuggestions');
  const selection=document.getElementById('placeSelection');
  const status=document.getElementById('placeSearchStatus');
  let timer, controller, revision=0, selected=null, results=[], active=-1;
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-controls','placeResultList');
  input.setAttribute('aria-expanded','false');
  input.autocomplete='off';

  function close(){
    clearTimeout(timer);
    controller?.abort();
    revision++;
    popup.hidden=true;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    input.removeAttribute('aria-busy');
    active=-1;
    status.textContent='';
  }
  function clearSelection(){
    selected=null;
    selection.replaceChildren();
    selection.hidden=true;
  }
  function choose(index){
    const result=results[index];
    if(!result) return;
    // Keep the user's exact words; selected geography is separate derived data.
    selected={...result,query:input.value,provider:'geoapify'};
    close();
    selection.replaceChildren();
    const name=document.createElement('span');
    name.textContent=result.formatted;
    const clear=document.createElement('button');
    clear.type='button';
    clear.textContent='\u00d7';
    clear.title='Clear selected location';
    clear.setAttribute('aria-label','Clear selected location');
    clear.onclick=()=>{clearSelection();document.dispatchEvent(new Event('my-story:input-changed'));input.focus();};
    selection.append(name,clear);
    selection.hidden=false;
    document.dispatchEvent(new Event('my-story:input-changed'));
  }
  function render(){
    popup.replaceChildren();
    if(!results.length){status.textContent='No matches. You can keep your own place description.';return;}
    const list=document.createElement('ul');
    list.id='placeResultList';list.setAttribute('role','listbox');list.setAttribute('aria-label','Places');
    results.forEach((result,index)=>{
      const option=document.createElement('li');
      option.id=`place-result-${index}`;
      option.setAttribute('role','option');option.setAttribute('aria-selected','false');
      option.textContent=result.formatted;
      option.addEventListener('pointerdown',event=>event.preventDefault());
      option.addEventListener('click',()=>choose(index));
      list.append(option);
    });
    const attribution=document.createElement('a');
    attribution.href='https://www.geoapify.com/';attribution.textContent='Powered by Geoapify';
    attribution.target='_blank';attribution.rel='noopener noreferrer';
    popup.append(list,attribution);popup.hidden=false;
    input.setAttribute('aria-expanded','true');
    status.textContent=`${results.length} places found.`;
  }
  function schedule(){
    close();
    const query=input.value;
    if(query.trim().length<3 || query.length>200 || selected || document.activeElement!==input) return;
    const current=revision;
    timer=setTimeout(async()=>{
      controller=new AbortController();
      const requestController=controller;
      const timeout=setTimeout(()=>requestController.abort(),7000);
      input.setAttribute('aria-busy','true');
      status.textContent='Finding places...';
      try{
        const params=new URLSearchParams({text:query.trim(),format:'json',limit:'5',lang:'en',apiKey:key});
        const response=await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`,{signal:requestController.signal,credentials:'omit'});
        if(!response.ok) throw new Error('Place search unavailable');
        const payload=await response.json();
        if(!Array.isArray(payload.results)) throw new Error('Invalid place results');
        if(current!==revision || input.value!==query || document.activeElement!==input) return;
        results=payload.results.filter(item=>typeof item.formatted==='string' && item.formatted.length<500 && Number.isFinite(item.lat) && Math.abs(item.lat)<=90 && Number.isFinite(item.lon) && Math.abs(item.lon)<=180)
          .slice(0,5).map(item=>({formatted:item.formatted,lat:item.lat,lon:item.lon,placeId:typeof item.place_id==='string'?item.place_id:null}));
        render();
      }catch{
        if(current===revision) status.textContent='Place search is unavailable. You can still enter any place.';
      }finally{
        clearTimeout(timeout);
        if(current===revision) input.removeAttribute('aria-busy');
      }
    },450);
  }
  input.addEventListener('input',()=>{clearSelection();schedule();});
  input.addEventListener('focus',schedule);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){close();return;}
    if(popup.hidden) return;
    if(event.key==='Enter' && active>=0){event.preventDefault();choose(active);return;}
    if(!['ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    active=active<0 ? (event.key==='ArrowDown'?0:results.length-1) : (active+(event.key==='ArrowDown'?1:-1)+results.length)%results.length;
    [...popup.querySelectorAll('[role="option"]')].forEach((option,index)=>{
      option.setAttribute('aria-selected',String(index===active));
      if(index===active){input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
    });
  });
  input.closest('.place-field').addEventListener('focusout',event=>{
    if(!event.currentTarget.contains(event.relatedTarget)) close();
  });
  document.addEventListener('pointerdown',event=>{if(!input.closest('.place-field').contains(event.target)) close();});
  window.MyStoryPlace={
    getSelection:()=>selected && selected.query===input.value ? {...selected} : null,
    reset:()=>{close();clearSelection();}
  };
})();
