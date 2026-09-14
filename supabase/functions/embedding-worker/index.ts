import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL=Deno.env.get("DISCOVERY_SUPABASE_URL")??Deno.env.get("SUPABASE_URL")??"";
const KEY=Deno.env.get("DISCOVERY_SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const BATCH=3;
const MAX_TEXT_CHARS=6000;
const json=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Cache-Control":"no-store"}});
const errorText=(e:unknown)=>{if(e instanceof Error)return e.message;if(e&&typeof e==='object'){try{return JSON.stringify(e);}catch{return String(e);}}return String(e??'internal error');};

async function run(){
  if(!URL||!KEY)return {ok:false,error:"database secrets missing"};
  const started=Date.now();
  const db=createClient(URL,KEY);
  const q=await db.rpc("claim_embedding_jobs",{p_batch:BATCH});
  if(q.error)throw q.error;
  const jobs:any[]=q.data??[];
  const model=new Supabase.ai.Session("gte-small");
  let completed=0,failed=0;
  const errors:Array<{content_id:string;error:string}>=[];

  for(const job of jobs){
    try{
      const text=String(job.text_content??"").replace(/\s+/g," ").trim().slice(0,MAX_TEXT_CHARS);
      if(!text)throw new Error("empty text_content");
      const emb=await model.run(text,{mean_pool:true,normalize:true});
      const vector=Array.from(emb as Iterable<number>);
      if(vector.length!==384)throw new Error(`unexpected embedding dimension: ${vector.length}`);
      const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
      const hash=Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("");
      const st=await db.rpc("store_content_embedding",{p_content_id:job.content_id,p_embedding:vector,p_model:"gte-small:384",p_source_hash:hash});
      if(st.error)throw st.error;
      const done=await db.rpc("mark_embedding_job_complete",{p_content_id:job.content_id,p_model:"gte-small:384",p_error:null});
      if(done.error)throw done.error;
      completed++;
    }catch(e){
      failed++;
      const message=errorText(e);
      if(errors.length<5)errors.push({content_id:String(job.content_id),error:message.slice(0,500)});
      await db.rpc("mark_embedding_job_failed",{p_content_id:job.content_id,p_error:message});
    }
  }
  return {ok:true,claimed:jobs.length,completed,failed,batch:BATCH,duration_ms:Date.now()-started,errors};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{status:204});
  if(req.method!=="GET"&&req.method!=="POST")return json({ok:false,error:"GET or POST required"},405);
  try{
    const result=await run();
    return json(result,(result as {ok?:boolean}).ok===false?500:200);
  }catch(e){return json({ok:false,error:errorText(e)},500)}
});
