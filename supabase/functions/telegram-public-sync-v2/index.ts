import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parse } from "npm:node-html-parser@6.1.13";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const env=(name:string)=>{const v=Deno.env.get(name)?.trim();if(!v)throw new Error(`${name} is not configured`);return v;};
const cleanUsername=(v:unknown)=>String(v??"").trim().replace(/^@/,"");
const cleanUrl=(v:unknown)=>{const s=String(v??"").replace(/&amp;/g,"&").trim();return /^https?:\/\//i.test(s)?s:null;};

type Post={id:number;text:string;publishedAt:string|null;contentType:"TEXT"|"IMAGE"|"VIDEO"|"AUDIO"|"DOCUMENT"|"MIXED";preview:string|null};
type Page={posts:Post[];channelTitle:string|null;channelBio:string|null;avatar:string|null};

function media(node:any){
  const photo=node.querySelector(".tgme_widget_message_photo_wrap");
  const video=node.querySelector(".tgme_widget_message_video_player, video");
  const audio=node.querySelector(".tgme_widget_message_voice_player, audio");
  const document=node.querySelector(".tgme_widget_message_document");
  const media=node.querySelector(".tgme_widget_message_media_wrap");
  let preview:string|null=null;
  const style=photo?.getAttribute?.("style")||media?.getAttribute?.("style")||video?.getAttribute?.("style")||"";
  const m=String(style).match(/url\(['\"]?([^'\")]+)['\"]?\)/i);
  if(m?.[1])preview=cleanUrl(m[1]);
  if(!preview){
    preview=cleanUrl(video?.getAttribute?.("poster"))||cleanUrl(node.querySelector("img")?.getAttribute?.("src"));
  }
  const contentType:Post["contentType"]=photo&&video?"MIXED":video?"VIDEO":audio?"AUDIO":document?"DOCUMENT":photo||media?"IMAGE":"TEXT";
  return {contentType,preview};
}

async function fetchPage(username:string,before=0):Promise<Page>{
  const url=new URL(`https://t.me/s/${encodeURIComponent(username)}`);if(before>0)url.searchParams.set("before",String(before));
  const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (compatible; TelegramDiscovery/2.0; +https://t.me)","accept-language":"fa,en;q=0.8"},redirect:"follow"});
  if(!r.ok)throw new Error(`Telegram public preview returned HTTP ${r.status}`);
  const root=parse(await r.text());
  const channelTitle=String(root.querySelector(".tgme_channel_info_header_title, .tgme_page_title")?.innerText||"").trim()||null;
  const channelBio=String(root.querySelector(".tgme_channel_info_description, .tgme_page_description")?.innerText||"").trim()||null;
  const avatar=cleanUrl(root.querySelector(".tgme_channel_info_header img, .tgme_page_photo_image")?.getAttribute?.("src"));
  const unique=new Map<number,Post>();
  for(const node of root.querySelectorAll(".tgme_widget_message")){
    const key=String(node.getAttribute("data-post")||"");const mm=key.match(/\/(\d+)$/);if(!mm)continue;
    const id=Number(mm[1]);if(!Number.isSafeInteger(id)||id<=0)continue;
    const text=String(node.querySelector(".tgme_widget_message_text")?.innerText||"").replace(/\u00a0/g," ").trim();
    const publishedAt=node.querySelector("time")?.getAttribute("datetime")||null;
    const mi=media(node);if(!text&&mi.contentType==="TEXT")continue;
    unique.set(id,{id,text,publishedAt,...mi});
  }
  return {posts:[...unique.values()].sort((a,b)=>b.id-a.id),channelTitle,channelBio,avatar};
}

Deno.serve(async(req)=>{
  let db:ReturnType<typeof createClient>|null=null;let runId:string|null=null;let leaseSource="";const leaseToken=crypto.randomUUID();
  try{
    if(req.method==="OPTIONS")return json({ok:true});
    const u=new URL(req.url),body=req.method==="POST"?await req.json().catch(()=>({})):{};
    const sourceId=String(u.searchParams.get("source_id")||body?.source_id||"").trim();if(!sourceId)return json({ok:false,error:"source_id required"},400);
    db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"));
    const lease=await db.rpc("acquire_telegram_sync_lease",{p_source_id:sourceId,p_token:leaseToken});if(lease.error)throw lease.error;if(!lease.data)return json({ok:true,status:"busy",source_id:sourceId});leaseSource=sourceId;
    const sq=await db.from("telegram_sources").select("*").eq("id",sourceId).single();if(sq.error)throw sq.error;const source=sq.data;if(!source||source.enabled===false)throw new Error("Telegram source is disabled or missing");
    const username=cleanUsername(source.username);if(!username)throw new Error("Public Telegram sync requires a channel username");
    let creatorId:string|null=null;
    const cq=await db.from("creators").select("id").ilike("username",username.replaceAll("_","\\_")).limit(1);if(cq.error)throw cq.error;creatorId=cq.data?.[0]?.id??null;
    if(!creatorId){const ins=await db.from("creators").insert({name:source.title||username,username,source_url:`https://t.me/${username}`,is_active:true}).select("id").single();if(ins.error)throw ins.error;creatorId=ins.data.id;}
    const run=await db.from("telegram_sync_runs").insert({source_id:sourceId,mode:Number(source.sync_cursor||0)>0?"incremental":"backfill",status:"running",metadata:{sync_provider:"telegram_public_preview",sync_version:2}}).select("id").single();if(!run.error)runId=run.data.id;

    const latest=await fetchPage(username,0);
    const historyBefore=Number(source.history_before_id||0);
    const history=historyBefore>0&&source.history_complete!==true?await fetchPage(username,historyBefore).catch(()=>({posts:[],channelTitle:null,channelBio:null,avatar:null} as Page)):({posts:[]} as Page);
    await db.from("creators").update({name:latest.channelTitle||source.title||username,bio:latest.channelBio||undefined,avatar_url:latest.avatar||undefined,source_url:`https://t.me/${username}`,updated_at:new Date().toISOString()}).eq("id",creatorId);
    const combined=new Map<number,Post>();for(const p of [...latest.posts,...(history.posts||[])])combined.set(p.id,p);const posts=[...combined.values()].sort((a,b)=>a.id-b.id);
    let inserted=0,updated=0,errors=0,newest=Number(source.sync_cursor||0),oldest=historyBefore>0?historyBefore:0;
    const peerKey=String(source.telegram_peer_id??username);
    for(const p of posts){
      try{
        newest=Math.max(newest,p.id);oldest=oldest>0?Math.min(oldest,p.id):p.id;const sourceKey=`${peerKey}:${p.id}`;
        const ex=await db.from("contents").select("id,metadata,moderation_status,thumbnail_url,media_url").eq("source_type","TELEGRAM").eq("source_id",sourceKey).limit(1);if(ex.error)throw ex.error;
        const old=ex.data?.[0];const thumb=p.preview||old?.thumbnail_url||old?.metadata?.media_preview_url||null;
        const content={creator_id:creatorId,source_type:"TELEGRAM",source_id:sourceKey,source_url:`https://t.me/${username}/${p.id}`,content_type:p.contentType,title:p.text?p.text.slice(0,160):null,description:p.text||null,rights_status:"REFERENCE_ONLY",moderation_status:old?.moderation_status||"PENDING",published_at:p.publishedAt,text_content:p.text||null,thumbnail_url:thumb,media_url:p.contentType==="IMAGE"?(p.preview||old?.media_url||null):(old?.media_url||null),metadata:{...(old?.metadata||{}),telegram_source_id:sourceId,telegram_peer_id:String(source.telegram_peer_id??""),telegram_message_id:p.id,public_preview_sync:true,sync_provider:"telegram_public_preview",sync_version:2,media_preview_url:p.preview,deleted_on_telegram:false}};
        const saved=old?.id?await db.from("contents").update(content).eq("id",old.id).select("id").single():await db.from("contents").insert(content).select("id").single();if(saved.error)throw saved.error;
        old?.id?updated++:inserted++;
        await db.rpc("refresh_discovery_content_feature",{p_content_id:saved.data.id}).catch(()=>{});
        if(!old?.id&&p.text)await db.from("discovery_embedding_jobs").upsert({content_id:saved.data.id,status:"PENDING",requested_at:new Date().toISOString(),attempts:0},{onConflict:"content_id",ignoreDuplicates:true});
      }catch(e){errors++;console.error("public sync item failed",p.id,e);}
    }
    const now=new Date().toISOString(),historyComplete=source.history_complete===true||(historyBefore>0&&(history.posts||[]).length===0),status=errors?"partial":"success";
    const checkpoint=await db.from("telegram_sources").update({sync_cursor:newest,history_before_id:oldest,history_complete:historyComplete,last_synced_at:now,last_success_at:status==="success"?now:source.last_success_at,last_error:errors?`${errors} public-preview item(s) failed`:null,updated_at:now}).eq("id",sourceId).eq("sync_lease_token",leaseToken).select("id");if(checkpoint.error)throw checkpoint.error;if(!checkpoint.data?.length)throw new Error("Sync lease expired; checkpoints not saved");
    if(runId)await db.from("telegram_sync_runs").update({status,completed_at:now,fetched_count:posts.length,inserted_count:inserted,updated_count:updated,error_count:errors,last_message_id:newest||null,error_message:errors?`${errors} public-preview item(s) failed`:null,metadata:{sync_provider:"telegram_public_preview",sync_version:2,latest_count:latest.posts.length,history_count:(history.posts||[]).length,history_before_id:oldest,history_complete:historyComplete,channel_metadata_enriched:true}}).eq("id",runId);
    return json({ok:true,provider:"telegram_public_preview",sync_version:2,source_id:sourceId,username,status,fetched:posts.length,inserted,updated,errors,sync_cursor:newest,history_before_id:oldest,history_complete:historyComplete,channel_metadata_enriched:true,run_id:runId});
  }catch(e){const message=e instanceof Error?e.message:String(e);console.error("telegram-public-sync-v2 fatal",e);if(db&&runId)await db.from("telegram_sync_runs").update({status:"failed",completed_at:new Date().toISOString(),error_message:message}).eq("id",runId).then(()=>{},()=>{});return json({ok:false,error:message},500);}
  finally{if(db&&leaseSource)await db.from("telegram_sources").update({sync_lease_token:null,sync_lease_until:null}).eq("id",leaseSource).eq("sync_lease_token",leaseToken);}
});
