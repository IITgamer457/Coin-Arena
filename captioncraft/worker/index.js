const MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGIN || "*").trim();
  const permitted = allowed === "*" || origin === allowed ? (origin || "*") : allowed;
  return {"Access-Control-Allow-Origin":permitted,"Access-Control-Allow-Methods":"POST, OPTIONS, GET","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
}
function json(data,status,origin,env){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...corsHeaders(origin,env)}});}
export default {
  async fetch(request,env) {
    const origin=request.headers.get("Origin")||"",url=new URL(request.url);
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(origin,env)});
    if(url.pathname==="/health"&&request.method==="GET") return json({ok:true,service:"CaptionCraft Nemotron transcript cleanup"},200,origin,env);
    if(url.pathname!=="/polish"||request.method!=="POST") return json({error:"Not found"},404,origin,env);
    if(!env.NVIDIA_API_KEY) return json({error:"Server is missing NVIDIA_API_KEY secret."},500,origin,env);
    if(env.ALLOWED_ORIGIN&&env.ALLOWED_ORIGIN!=="*"&&origin!==env.ALLOWED_ORIGIN) return json({error:"Origin not allowed."},403,origin,env);
    let body;try{body=await request.json();}catch{return json({error:"Request body must be valid JSON."},400,origin,env);}
    const allowedLanguages=new Set(["en-IN","hi-IN","hinglish","mr-IN","en-US","bn-IN","ta-IN","te-IN","ur-PK"]);
    const language=allowedLanguages.has(body.language)?body.language:"en-IN";
    if(!Array.isArray(body.captions)||body.captions.length<1||body.captions.length>80)return json({error:"Send between 1 and 80 caption lines."},400,origin,env);
    if(body.captions.some(line=>typeof line!=="string"||line.length>1000))return json({error:"Each caption must be text no longer than 1,000 characters."},400,origin,env);
    const source=body.captions.map((line,i)=>`${i+1}. ${line}`).join("\n");
    const names={"en-IN":"Indian English","hi-IN":"Hindi","hinglish":"Hinglish (natural Hindi-English code-switching)","mr-IN":"Marathi","en-US":"US English","bn-IN":"Bengali","ta-IN":"Tamil","te-IN":"Telugu","ur-PK":"Urdu"};
    const prompt=`You are a careful subtitle transcript editor. Improve the provided speech-recognition transcript in ${names[language]}. Correct punctuation, capitalization, obvious recognition errors, and sentence readability. For Hinglish, preserve natural Hindi-English code-switching and do not translate it into pure Hindi or English. Preserve the speaker's meaning, names, numbers, and language. Do not add facts or invent words. Return ONLY a JSON object with a "captions" array containing exactly ${body.captions.length} strings, one improved version for each input line in the same order. Do not merge, split, or reorder lines. If uncertain, keep the original wording.\n\nInput lines:\n${source}`;
    try {
      const upstream=await fetch(NVIDIA_URL,{method:"POST",headers:{"Authorization":`Bearer ${env.NVIDIA_API_KEY}`,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({model:MODEL,messages:[{role:"system",content:"Follow the user task exactly. Output valid JSON only; no markdown or reasoning."},{role:"user",content:prompt}],temperature:.1,max_tokens:Math.min(3000,120+body.captions.reduce((n,s)=>n+s.length,0)*2),stream:false,chat_template_kwargs:{enable_thinking:false}})});
      const data=await upstream.json().catch(()=>({}));
      if(!upstream.ok)return json({error:`NVIDIA API request failed (${upstream.status}). Check your key, quota, and model access.`},502,origin,env);
      const content=data?.choices?.[0]?.message?.content;
      if(typeof content!=="string")return json({error:"NVIDIA returned an empty response."},502,origin,env);
      let parsed;try{const start=content.indexOf("{");const end=content.lastIndexOf("}");if(start<0||end<start)throw new Error("invalid");parsed=JSON.parse(content.slice(start,end+1));}catch{return json({error:"AI returned an invalid format. Please try again."},502,origin,env);}
      if(!Array.isArray(parsed.captions)||parsed.captions.length!==body.captions.length||parsed.captions.some(x=>typeof x!=="string"))return json({error:"AI response did not match the caption format. Please try again."},502,origin,env);
      return json({captions:parsed.captions},200,origin,env);
    }catch{return json({error:"Could not connect to NVIDIA API. Please try again."},502,origin,env);}
  }
};
