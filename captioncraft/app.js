(() => {
  const $ = id => document.getElementById(id);
  const videoInput=$('videoInput'), videoPreview=$('videoPreview'), videoMeta=$('videoMeta'), dropZone=$('dropZone');
  const captionList=$('captionList'), emptyState=$('emptyState'), captionCount=$('captionCount');
  const generateBtn=$('generateBtn'), renderBtn=$('renderBtn'), polishBtn=$('polishBtn');
  let captions=[], videoUrl=null, renderUrl=null, ffmpeg=null, toastTimer=null, busy=false;
  const styles={
    creator:{color:'&H00FFFFFF',outline:'&H00111111',border:'3',box:'0'},
    yellow:{color:'&H0000E8FF',outline:'&H00111111',border:'3',box:'0'},
    clean:{color:'&H00FFFFFF',outline:'&H00000000',border:'1',box:'0'},
    boxed:{color:'&H00FFFFFF',outline:'&HCC111111',border:'1',box:'1'},
    karaoke:{color:'&H0000F5FF',outline:'&H00111111',border:'3',box:'0'}
  };
  function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),4200);}
  function seconds(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0;}
  function stamp(v,comma=true){const n=seconds(v),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=Math.floor(n%60),ms=Math.round((n-Math.floor(n))*1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${comma?',':'.'}${String(ms).padStart(3,'0')}`;}
  function addCaption(text='',start=0,end=3){captions.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),text,start:seconds(start),end:Math.max(seconds(end),seconds(start)+.2)});renderCaptions();}
  function renderCaptions(){
    captionList.replaceChildren();emptyState.classList.toggle('hidden',captions.length>0);
    captionCount.textContent=`${captions.length} caption ${captions.length===1?'line':'lines'}`;
    captions.forEach((c,i)=>{
      const row=document.createElement('div');row.className='caption-row';
      const times=document.createElement('div');times.className='time-inputs';
      const start=document.createElement('input');start.type='number';start.min='0';start.step='.1';start.value=c.start;start.setAttribute('aria-label',`Caption ${i+1} start time in seconds`);
      const end=document.createElement('input');end.type='number';end.min='0';end.step='.1';end.value=c.end;end.setAttribute('aria-label',`Caption ${i+1} end time in seconds`);
      start.addEventListener('change',()=>{c.start=seconds(start.value);if(c.end<=c.start)c.end=c.start+.2;renderCaptions();});
      end.addEventListener('change',()=>{c.end=Math.max(seconds(end.value),c.start+.2);renderCaptions();});times.append(start,end);
      const textarea=document.createElement('textarea');textarea.className='caption-text';textarea.value=c.text;textarea.placeholder='Type caption text…';textarea.setAttribute('aria-label',`Caption ${i+1} text`);textarea.addEventListener('input',()=>c.text=textarea.value);
      const del=document.createElement('button');del.className='delete-line';del.type='button';del.textContent='×';del.setAttribute('aria-label',`Delete caption ${i+1}`);del.addEventListener('click',()=>{captions=captions.filter(x=>x.id!==c.id);renderCaptions();});
      row.append(times,textarea,del);captionList.append(row);
    });
    renderBtn.disabled=busy||!videoInput.files?.[0]||!captions.some(c=>c.text.trim());
  }
  function setProgress(prefix,pct,label){const base=prefix==='render'?'renderProgress':'progress';$(base+'Wrap').classList.remove('hidden');$(base+'Bar').style.width=Math.max(0,Math.min(100,pct))+'%';$(base+'Percent').textContent=Math.round(pct)+'%';$(base+'Label').textContent=label;}
  function useFile(file){
    if(!file)return;if(!file.type.startsWith('video/'))return notify('Please choose a video file.');
    if(file.size>300*1024*1024&&!confirm('This video is over 300 MB and may exceed browser memory. Continue?'))return;
    if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl=URL.createObjectURL(file);videoPreview.src=videoUrl;videoPreview.classList.remove('hidden');
    videoMeta.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`;videoMeta.classList.remove('hidden');generateBtn.disabled=false;renderCaptions();
    $('downloadVideo').classList.add('hidden');$('renderHint').textContent='Ready when captions are generated. Processing happens on this device.';
  }
  videoInput.addEventListener('change',()=>useFile(videoInput.files[0]));
  ['dragenter','dragover'].forEach(t=>dropZone.addEventListener(t,e=>{e.preventDefault();dropZone.classList.add('dragover');}));
  ['dragleave','drop'].forEach(t=>dropZone.addEventListener(t,e=>{e.preventDefault();dropZone.classList.remove('dragover');}));
  dropZone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f){try{videoInput.files=e.dataTransfer.files;}catch{}useFile(f);}});
  $('addLineBtn').addEventListener('click',()=>{const s=captions.length?captions[captions.length-1].end:0;addCaption('',s,s+3);});
  $('clearBtn').addEventListener('click',()=>{captions=[];renderCaptions();});
  $('resetBtn').addEventListener('click',()=>{if(busy)return notify('Wait for the current task to finish first.');captions=[];renderCaptions();if(videoUrl)URL.revokeObjectURL(videoUrl);if(renderUrl)URL.revokeObjectURL(renderUrl);videoUrl=renderUrl=null;videoInput.value='';videoPreview.removeAttribute('src');videoPreview.load();videoPreview.classList.add('hidden');videoMeta.classList.add('hidden');generateBtn.disabled=true;$('downloadVideo').classList.add('hidden');$('progressWrap').classList.add('hidden');$('renderProgressWrap').classList.add('hidden');notify('Project reset.');});
  async function loadFfmpeg(onProgress){
    if(ffmpeg)return ffmpeg;
    const {FFmpeg}=await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
    const {toBlobURL}=await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js');
    const engine=new FFmpeg();engine.on('progress',({progress})=>onProgress?.(Math.max(0,Math.min(100,progress*100))));
    engine.on('log',({message})=>{if(/error|failed|not found|unknown encoder|filter.*not found/i.test(message))$('renderHint').textContent=message.slice(0,260);});
    const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    await engine.load({coreURL:await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),wasmURL:await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm')});
    ffmpeg=engine;return engine;
  }
  async function extractAudio(file){
    // Extract audio through browser-native media APIs. This avoids creating a
    // cross-origin FFmpeg Web Worker, which browsers block on Pages domains.
    const media=videoPreview;
    if(!media.src)throw new Error('Please select a video first.');
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('This browser does not support Web Audio. Try Chrome.');
    const ctx=new AudioCtx();
    await ctx.resume();
    let source;
    try{source=ctx.createMediaElementSource(media);}catch(e){await ctx.close();throw new Error('Audio extraction could not initialize. Reset the project and select the video again.');}
    const destination=ctx.createMediaStreamDestination();
    source.connect(destination);
    // Keep the video audible to the recording graph but do not play it through
    // the phone speaker while extracting.
    const silent=ctx.createGain();silent.gain.value=0;source.connect(silent);silent.connect(ctx.destination);
    const stream=destination.stream;
    if(!window.MediaRecorder){source.disconnect();await ctx.close();throw new Error('MediaRecorder is unavailable in this browser.');}
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
    const chunks=[];
    recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
    const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>reject(new Error('Browser audio capture failed.'));});
    const wasMuted=media.muted,oldTime=media.currentTime;
    media.muted=true;
    media.currentTime=0;
    await new Promise((resolve,reject)=>{if(media.readyState>=2)return resolve();media.addEventListener('loadeddata',resolve,{once:true});media.addEventListener('error',()=>reject(new Error('Video could not be decoded by this browser.')),{once:true});});
    recorder.start(500);
    const duration=Number.isFinite(media.duration)?media.duration:0;
    const playbackEnded=new Promise((resolve,reject)=>{
      media.addEventListener('ended',resolve,{once:true});
      media.addEventListener('error',()=>reject(new Error('Video playback failed while extracting audio.')),{once:true});
    });
    try{
      await media.play();
      // Safety timeout for files that fail to signal ended.
      await Promise.race([playbackEnded,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Audio extraction took too long. Try a shorter video.')),Math.max(120000,(duration||30)*3000)))]);
    }catch(e){
      if(recorder.state!=='inactive')recorder.stop();
      await stopped.catch(()=>{});
      source.disconnect();await ctx.close();media.pause();media.muted=wasMuted;
      throw e;
    }
    if(recorder.state!=='inactive')recorder.stop();
    await stopped;
    const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
    source.disconnect();silent.disconnect();await ctx.close();media.pause();media.currentTime=oldTime;media.muted=wasMuted;
    if(!blob.size)throw new Error('No audio track could be extracted from this video.');
    const decodeCtx=new AudioCtx();
    const decoded=await decodeCtx.decodeAudioData(await blob.arrayBuffer());
    const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);
    const audioSource=offline.createBufferSource();audioSource.buffer=decoded;
    const mono=offline.createGain();mono.gain.value=1;audioSource.connect(mono);mono.connect(offline.destination);audioSource.start();
    const resampled=await offline.startRendering();const data=resampled.getChannelData(0).slice();
    await decodeCtx.close();
    return {data,duration:duration||decoded.duration};
  }
  function languageForWhisper(v){return ({english:'english',hindi:'hindi',marathi:'marathi',bengali:'bengali',tamil:'tamil',telugu:'telugu',urdu:'urdu',auto:undefined})[v];}
  function chunksToCaptions(chunks,duration){
    const out=[];let words=[];
    for(const chunk of chunks||[]){
      const text=(chunk.text||'').trim(),ts=chunk.timestamp||[];
      if(!text||!Number.isFinite(ts[0])||!Number.isFinite(ts[1]))continue;
      const parts=text.match(/\S+\s*/g)||[text];
      for(const part of parts)words.push({text:part.trim(),start:ts[0],end:ts[1]});
    }
    if(!words.length)return out;
    let group=[];
    const flush=()=>{if(!group.length)return;out.push({id:String(Date.now()+Math.random()),text:group.map(w=>w.text).join(' ').replace(/\s+([,.!?;:])/g,'$1'),start:Math.max(0,group[0].start),end:Math.min(duration||group[group.length-1].end,Math.max(group[group.length-1].end,group[0].start+.3))});group=[];};
    for(const w of words){group.push(w);if(group.length>=5||/[.!?]$/.test(w.text))flush();}flush();return out;
  }
  generateBtn.addEventListener('click',async()=>{
    const file=videoInput.files[0];if(!file)return notify('Choose a video first.');if(busy)return;
    busy=true;generateBtn.disabled=true;generateBtn.textContent='Preparing transcription…';
    try{
      setProgress(' ',0,'Loading video tools…');
      $('progressWrap').classList.remove('hidden');
      const {data,duration}=await extractAudio(file);
      setProgress('',15,'Loading speech model…');
      const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
      env.allowLocalModels=false;env.useBrowserCache=true;
      const transcriber=await pipeline('automatic-speech-recognition','onnx-community/whisper-base',{device:'wasm',progress_callback:(p)=>{if(p.status==='progress'&&p.total)setProgress('',15+Math.min(1,p.loaded/p.total)*40,`Downloading speech model: ${p.file||'model'}`);}});
      setProgress('',58,'Transcribing speech…');
      const opts={chunk_length_s:30,stride_length_s:5,return_timestamps:'word'};
      const lang=languageForWhisper($('languageSelect').value);if(lang)opts.language=lang;
      const result=await transcriber(data,opts);
      captions=chunksToCaptions(result.chunks,duration);
      if(!captions.length&&result.text?.trim())captions=[{id:String(Date.now()),text:result.text.trim(),start:0,end:Math.max(2,duration)}];
      renderCaptions();setProgress('',100,'Transcription complete');
      $('processHint').textContent='Review transcript and timestamps. You can edit each line before rendering.';
      if(!captions.length)notify('No speech was detected. Try another language or add captions manually.');else notify(`Created ${captions.length} caption lines. Review them before rendering.`);
    }catch(e){console.error(e);notify('Could not transcribe this video: '+(e.message||'browser processing failed'));$('processHint').textContent='If the browser ran out of memory, try a shorter/smaller video or use a newer Chrome browser.';}
    finally{busy=false;generateBtn.disabled=!videoInput.files[0];generateBtn.textContent='✦ Generate automatic captions';renderCaptions();}
  });
  function exportFile(type){
    const items=captions.filter(c=>c.text.trim()).sort((a,b)=>a.start-b.start);if(!items.length)return notify('Generate or add caption text first.');
    const content=type==='srt'?items.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text.trim()}\n`).join('\n'):'WEBVTT\n\n'+items.map(c=>`${stamp(c.start,false)} --> ${stamp(c.end,false)}\n${c.text.trim()}\n`).join('\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`captioncraft-captions.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('exportSrt').addEventListener('click',()=>exportFile('srt'));$('exportVtt').addEventListener('click',()=>exportFile('vtt'));
  function assTime(s){const n=seconds(s),h=Math.floor(n/3600),m=Math.floor(n%3600/60),sec=(n%60).toFixed(2).padStart(5,'0');return `${h}:${String(m).padStart(2,'0')}:${sec}`;}
  function assEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/{/g,'\\{').replace(/}/g,'\\}').replace(/\r?\n/g,'\\N');}
  renderBtn.addEventListener('click',async()=>{
    if(busy)return;const file=videoInput.files[0],items=captions.filter(c=>c.text.trim()).sort((a,b)=>a.start-b.start);if(!file||!items.length)return notify('Choose a video and create captions first.');
    busy=true;renderBtn.disabled=true;renderBtn.textContent='Rendering…';$('downloadVideo').classList.add('hidden');
    try{
      const engine=await loadFfmpeg(p=>setProgress('render',Math.min(98,p),'Rendering captioned video…'));
      const ext=(file.name.split('.').pop()||'mp4').replace(/[^a-z0-9]/gi,'').toLowerCase();
      await engine.writeFile('render-input.'+ext,new Uint8Array(await file.arrayBuffer()));
      const font=Number($('fontSizeSelect').value),pos=$('positionSelect').value,alignment=pos==='top'?8:pos==='middle'?5:2;
      const st=styles[$('styleSelect').value]||styles.creator;
      const ass=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,Arial,${font},${st.color},&H000000FF,${st.outline},&HAA111111,-1,0,0,0,100,100,0,0,${st.box==='1'?3:1},${st.border},1,${alignment},60,60,90,1\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`+items.map(c=>`Dialogue: 0,${assTime(c.start)},${assTime(Math.max(c.end,c.start+.2))},Default,,0,0,0,,{${'\\'}an${alignment}}${assEscape(c.text)}`).join('\n');
      await engine.writeFile('captions.ass',new TextEncoder().encode(ass));
      setProgress('render',2,'Burning captions into video…');
      await engine.exec(['-i','render-input.'+ext,'-vf','ass=captions.ass','-c:v','libx264','-preset','ultrafast','-crf','28','-c:a','aac','-b:a','128k','-movflags','+faststart','captioncraft-captioned.mp4']);
      const output=await engine.readFile('captioncraft-captioned.mp4');const blob=new Blob([output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength)],{type:'video/mp4'});
      if(renderUrl)URL.revokeObjectURL(renderUrl);renderUrl=URL.createObjectURL(blob);
      const link=$('downloadVideo');link.href=renderUrl;link.download='captioncraft-captioned.mp4';link.classList.remove('hidden');setProgress('render',100,'Finished — video ready');$('renderHint').textContent=`Finished MP4 · ${(blob.size/1024/1024).toFixed(1)} MB. Captions are burned into the video.`;notify('Your captioned video is ready to download.');
    }catch(e){console.error(e);notify('Video render failed: '+(e.message||'this browser build may not support the required subtitle filter/MP4 encoder.'));$('renderHint').textContent='Rendering may fail on low-memory phones or if this FFmpeg build lacks the ASS subtitle filter / H.264 encoder. SRT/VTT exports remain available.';}
    finally{busy=false;renderBtn.textContent='🎬 Render captioned MP4';renderCaptions();}
  });
  polishBtn.addEventListener('click',async()=>{
    const endpoint=(window.CAPTIONCRAFT_API_URL||'').trim(),usable=captions.filter(c=>c.text.trim());if(!usable.length)return notify('Generate or add captions first.');if(!endpoint)return notify('Cloudflare Worker URL is not configured.');if(busy)return;
    const original=usable.map(c=>c.text),label=polishBtn.textContent;polishBtn.disabled=true;polishBtn.textContent='Improving…';
    try{const response=await fetch(endpoint.replace(/\/$/,'')+'/polish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:$('languageSelect').value,captions:original})});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Request failed (${response.status})`);if(!Array.isArray(payload.captions)||payload.captions.length!==usable.length||payload.captions.some(x=>typeof x!=='string'))throw new Error('AI response format mismatch.');usable.forEach((c,i)=>c.text=payload.captions[i].trim()||original[i]);renderCaptions();notify('Transcript improved. Review it before rendering.');}catch(e){notify(e.message||'Could not reach NVIDIA cleanup service. Check Worker secret and URL.');}finally{polishBtn.disabled=false;polishBtn.textContent=label;}
  });
  window.addEventListener('beforeunload',()=>{if(videoUrl)URL.revokeObjectURL(videoUrl);if(renderUrl)URL.revokeObjectURL(renderUrl);});
  renderCaptions();
})();