(() => {
  const $ = (id) => document.getElementById(id);
  const videoInput = $('videoInput'), videoPreview = $('videoPreview'), videoMeta = $('videoMeta');
  const dropZone = $('dropZone'), captionList = $('captionList'), emptyState = $('emptyState');
  const captionCount = $('captionCount'), micBtn = $('micBtn'), polishBtn = $('polishBtn');
  const speechStatus = $('speechStatus'), micIndicator = $('micIndicator');
  const languageSelect = $('languageSelect'), toast = $('toast');
  let captions = [], videoUrl = null, recognition = null, listening = false, toastTimer = null;

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }
  function seconds(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }
  function stamp(value, comma = true) {
    const n = seconds(value), hours = Math.floor(n/3600), minutes = Math.floor((n%3600)/60);
    const secs = Math.floor(n%60), millis = Math.round((n-Math.floor(n))*1000), sep = comma ? ',' : '.';
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}${sep}${String(millis).padStart(3,'0')}`;
  }
  function addCaption(text = '', start = 0, end = 3) {
    captions.push({id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, text, start: seconds(start), end: Math.max(seconds(end), seconds(start)+.2)});
    renderCaptions();
  }
  function renderCaptions() {
    captionList.replaceChildren();
    emptyState.classList.toggle('hidden', captions.length > 0);
    captionCount.textContent = `${captions.length} caption ${captions.length === 1 ? 'line' : 'lines'}`;
    captions.forEach((caption, index) => {
      const row = document.createElement('div'); row.className='caption-row';
      const times = document.createElement('div'); times.className='time-inputs';
      const start = document.createElement('input'); start.type='number'; start.min='0'; start.step='.1'; start.setAttribute('aria-label',`Caption ${index+1} start time in seconds`); start.value=caption.start;
      const end = document.createElement('input'); end.type='number'; end.min='0'; end.step='.1'; end.setAttribute('aria-label',`Caption ${index+1} end time in seconds`); end.value=caption.end;
      start.addEventListener('change',()=>{caption.start=seconds(start.value); if(caption.end<=caption.start) caption.end=caption.start+.2; renderCaptions();});
      end.addEventListener('change',()=>{caption.end=Math.max(seconds(end.value),caption.start+.2);renderCaptions();});
      times.append(start,end);
      const textarea = document.createElement('textarea'); textarea.className='caption-text'; textarea.value=caption.text; textarea.placeholder='Type caption text…'; textarea.setAttribute('aria-label',`Caption ${index+1} text`);
      textarea.addEventListener('input',()=>{caption.text=textarea.value;});
      const del=document.createElement('button');del.className='delete-line';del.type='button';del.textContent='×';del.setAttribute('aria-label',`Delete caption ${index+1}`);
      del.addEventListener('click',()=>{captions=captions.filter(c=>c.id!==caption.id);renderCaptions();});
      row.append(times,textarea,del); captionList.append(row);
    });
  }
  function resetProject() {
    stopRecognition();
    captions=[]; renderCaptions();
    if(videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl=null; videoInput.value=''; videoPreview.removeAttribute('src'); videoPreview.load();
    videoPreview.classList.add('hidden'); videoMeta.classList.add('hidden'); videoMeta.textContent='';
    notify('Project reset.');
  }
  function useFile(file) {
    if(!file) return;
    if(!file.type.startsWith('video/')) return notify('Please choose a video file.');
    if(videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl=URL.createObjectURL(file); videoPreview.src=videoUrl; videoPreview.classList.remove('hidden');
    videoMeta.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`; videoMeta.classList.remove('hidden');
  }
  videoInput.addEventListener('change',()=>useFile(videoInput.files[0]));
  ['dragenter','dragover'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.add('dragover');}));
  ['dragleave','drop'].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.remove('dragover');}));
  dropZone.addEventListener('drop',e=>useFile(e.dataTransfer.files[0]));
  $('addLineBtn').addEventListener('click',()=>addCaption('',captions.length?captions[captions.length-1].end:0,(captions.length?captions[captions.length-1].end:0)+3));
  $('clearBtn').addEventListener('click',()=>{captions=[];renderCaptions();});
  $('resetBtn').addEventListener('click',resetProject);

  function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) return notify('Speech recognition is not supported in this browser. Try Chrome on HTTPS or add caption lines manually.');
    recognition = new SpeechRecognition();
    recognition.continuous=true; recognition.interimResults=true;
    recognition.lang=languageSelect.value==='hinglish'?'hi-IN':languageSelect.value;
    recognition.onstart=()=>{listening=true;micBtn.classList.add('listening');micBtn.textContent='■ Stop microphone captions';micIndicator.classList.add('active');speechStatus.textContent='Listening…';};
    recognition.onerror=e=>{notify(e.error==='not-allowed'?'Microphone permission was blocked. Allow it in browser settings.':`Speech recognition error: ${e.error}`);};
    recognition.onresult=e=>{
      let interim='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const result=e.results[i], text=result[0].transcript.trim();
        if(result.isFinal && text) addCaption(text,videoPreview.currentTime||0,(videoPreview.currentTime||0)+Math.max(1.8,text.split(/\s+/).length*.32));
        else interim+=text;
      }
      speechStatus.textContent=interim?('Hearing: '+interim):'Listening…';
    };
    recognition.onend=()=>{listening=false;micBtn.classList.remove('listening');micBtn.textContent='🎙 Start microphone captions';micIndicator.classList.remove('active');if(speechStatus.textContent==='Listening…')speechStatus.textContent='Ready to listen';};
    try { recognition.start(); } catch { notify('Could not start speech recognition. Wait a moment and try again.'); }
    if(languageSelect.value==='hinglish') notify('Hinglish uses Hindi speech recognition as a best-effort fallback; accuracy may vary.');
  }
  function stopRecognition(){if(recognition){try{recognition.stop();}catch{} recognition=null;}listening=false;micBtn.classList.remove('listening');micBtn.textContent='🎙 Start microphone captions';micIndicator.classList.remove('active');}
  micBtn.addEventListener('click',()=>listening?stopRecognition():startRecognition());

  polishBtn.addEventListener('click',async()=>{
    const endpoint=(window.CAPTIONCRAFT_API_URL||'').trim();
    const usable=captions.filter(c=>c.text.trim());
    if(!usable.length) return notify('Add or dictate some caption text first.');
    if(!endpoint) return notify('Configure your Cloudflare Worker URL in config.js first.');
    const original=usable.map(c=>c.text), originalLabel=polishBtn.textContent;
    polishBtn.disabled=true;polishBtn.textContent='Improving transcript…';
    try{
      const response=await fetch(endpoint.replace(/\/$/,'')+'/polish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:languageSelect.value,captions:original})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload.error||`Request failed (${response.status})`);
      if(!Array.isArray(payload.captions)||payload.captions.length!==usable.length||payload.captions.some(line=>typeof line!=='string')) throw new Error('The AI response did not match the caption format.');
      usable.forEach((caption,index)=>{caption.text=payload.captions[index].trim()||original[index];});
      renderCaptions();notify('Transcript improved. Review before exporting.');
    }catch(error){notify(error.message||'Could not reach AI service. Check Worker URL and setup.');}
    finally{polishBtn.disabled=false;polishBtn.textContent=originalLabel;}
  });

  function exportFile(type){
    const items=captions.filter(c=>c.text.trim());
    if(!items.length) return notify('Add some caption text first.');
    let content;
    if(type==='srt') content=items.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text.trim()}\n`).join('\n');
    else content='WEBVTT\n\n'+items.map(c=>`${stamp(c.start,false)} --> ${stamp(c.end,false)}\n${c.text.trim()}\n`).join('\n');
    const blob=new Blob([content],{type:'text/plain;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=`captioncraft-captions.${type}`;a.click();URL.revokeObjectURL(url);
  }
  $('exportSrt').addEventListener('click',()=>exportFile('srt'));
  $('exportVtt').addEventListener('click',()=>exportFile('vtt'));
  window.addEventListener('beforeunload',()=>{if(videoUrl)URL.revokeObjectURL(videoUrl);});
  renderCaptions();
})();
