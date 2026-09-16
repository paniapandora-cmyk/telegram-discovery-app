import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
import { syncPages } from "./pages.ts";

const env=(n:string)=>{const v=Deno.env.get(n)?.trim();if(!v)throw new Error(`${n} is not configured`);return v;};

Deno.serve(async(req)=>{
 let db:ReturnType<typeof createClient>|null=null;
 let runId:string|null=null;
 let leaseSource=""; const leaseToken=crypto.randomUUID();
 try{
  if(req.method==="OPTIONS")return out({ok:true});
  const u=new URL(req.url),b=req.method==="POST"?await req.json().catch(()=>({})):{};
  const sid=String(u.searchParams.get("source_id")||b?.source_id||"").trim();if(!sid)return out({ok:false,error:"source_id required"},400);
  db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"));
  const lease=await db.rpc("acquire_telegram_sync_lease",{p_source_id:sid,p_token:leaseToken});
  if(lease.error)throw lease.error;
  if(!lease.data)return out({ok:true,status:"busy",source_id:sid});
  leaseSource=sid;
  const {data:src,error:se}=await db.from("telegram_sources").select("*").eq("id",sid).single();
  if(se)throw se;if(!src)throw new Error("Telegram source not found");if(src.enabled===false)throw new Error("Telegram source is disabled");

  const apiId=Number(env("TELEGRAM_API_ID")),apiHash=env("TELEGRAM_API_HASH"),session=env("TELEGRAM_STRING_SESSION");
  if(!Number.isInteger(apiId)||apiId<=0)throw new Error("TELEGRAM_API_ID is invalid");
  const requested=Number(u.searchParams.get("limit")||b?.limit||1),limit=Math.min(100,Math.max(1,Number.isFinite(requested)?Math.floor(requested):1));
  const requestedReconcile=Number(u.searchParams.get("reconcile_limit")||b?.reconcile_limit||200);
  const reconcileLimit=Math.min(1000,Math.max(20,Number.isFinite(requestedReconcile)?Math.floor(requestedReconcile):200));
  const previousCursor=Math.max(0,Number(src.sync_cursor??0));
  const mode=previousCursor>0?"incremental":"backfill";
  const historyLimit=50;

  const runIns=await db.from("telegram_sync_runs").insert({source_id:sid,mode,status:"running",metadata:{previous_cursor:previousCursor,reconcile_limit:reconcileLimit,sync_version:15}}).select("id").single();
  if(!runIns.error)runId=runIns.data.id;

  const username=src.username?String(src.username).replace(/^@/,""):null;
  let creatorId:string|null=null;
  if(username){const q=await db.from("creators").select("id").ilike("username",username.replaceAll("_","\\_")).limit(1);if(q.error)throw q.error;creatorId=q.data?.[0]?.id??null;}
  if(!creatorId){const q=await db.from("creators").insert({name:src.title||username||"Telegram",username,source_url:username?`https://t.me/${username}`:null,is_active:true}).select("id").single();if(q.error)throw q.error;creatorId=q.data.id;}

  if(src.owner_telegram_user_id!=null){
   try{
    const uq=await db.from("users").select("id").eq("telegram_user_id",src.owner_telegram_user_id).limit(1);
    const ownerUserId=uq.data?.[0]?.id;
    if(ownerUserId)await db.from("creator_claims").upsert({creator_id:creatorId,user_id:ownerUserId,status:"APPROVED",reviewed_at:new Date().toISOString()},{onConflict:"creator_id,user_id"});
   }catch(e){console.error("auto claim",e);}
  }

  const {TelegramClient}=await import("npm:telegram@2.26.22");
  const {StringSession}=await import("npm:telegram@2.26.22/sessions/index.js");
  const client=new TelegramClient(new StringSession(session),apiId,apiHash,{connectionRetries:2,autoReconnect:false});

  try{
   await client.connect();
   if(!(await client.checkAuthorization()))throw new Error("Telegram MTProto session is not authorized");
   let entity:any=null,peerError="";
   try{if(src.telegram_peer_id!=null)entity=await client.getEntity(String(src.telegram_peer_id));}catch(e){peerError=e instanceof Error?e.message:String(e);}
   if(!entity&&src.username)entity=await client.getEntity(String(src.username).replace(/^@/,""));
   if(!entity)throw new Error(`Telegram source cannot be resolved${peerError?`: ${peerError}`:""}`);

   let fetched=0,inserted=0,updated=0,skipped=0,errors=0,deleted=0,legacyChecked=0;
   let newestMessageId:number|null=null,oldestMessageId:number|null=null;
   const checkpoint=await syncPages(
    {cursor:previousCursor,before:Number(src.history_before_id??0),complete:src.history_complete===true},
    limit,historyLimit,options=>client.iterMessages(entity,options),async(m,lane)=>{
     fetched++;
     const mid=Number(m.id);
     newestMessageId=newestMessageId===null?mid:Math.max(newestMessageId,mid);
     oldestMessageId=oldestMessageId===null?mid:Math.min(oldestMessageId,mid);
     const text=typeof m?.text==="string"?m.text.trim():"";if(!text&&!m?.media){skipped++;return;}
     const key=`${String(src.telegram_peer_id??username)}:${mid}`;
     const content={creator_id:creatorId,source_type:"TELEGRAM",source_id:key,source_url:username?`https://t.me/${username}/${mid}`:`telegram://${String(src.telegram_peer_id)}/${mid}`,content_type:m?.photo?"IMAGE":m?.video?"VIDEO":m?.audio?"AUDIO":m?.document?"DOCUMENT":m?.media?"MIXED":"TEXT",title:text?text.slice(0,160):null,description:text||null,rights_status:"REFERENCE_ONLY",moderation_status:"PENDING",published_at:m?.date?new Date(Number(m.date)*1000).toISOString():null,text_content:text||null,metadata:{telegram_source_id:sid,telegram_peer_id:String(src.telegram_peer_id??""),telegram_message_id:mid,backfill:lane==="backfill",sync_mode:lane,deleted_on_telegram:false}};
     const ex=await db.from("contents").select("id,metadata,moderation_status").eq("source_type","TELEGRAM").eq("source_id",key).limit(1);if(ex.error)throw ex.error;
     if(lane==="backfill"&&ex.data?.[0]?.id){skipped++;return;}
     if(ex.data?.[0]){content.metadata={...ex.data[0].metadata,...content.metadata};content.moderation_status=ex.data[0].moderation_status;}
     const saved=ex.data?.[0]?.id?await db.from("contents").update(content).eq("id",ex.data[0].id).select("id").single():await db.from("contents").insert(content).select("id").single();if(saved.error)throw saved.error;
     if(ex.data?.[0]?.id)updated++;else inserted++;
     if(!ex.data?.[0]?.id&&text)await db.from("discovery_embedding_jobs").upsert({content_id:saved.data.id,status:"PENDING",requested_at:new Date().toISOString(),attempts:0},{onConflict:"content_id",ignoreDuplicates:true});
     const ev=await db.from("ingestion_events").select("id").eq("source_type","TELEGRAM").eq("source_id",key).limit(1);if(!ev.error&&!ev.data?.length)await db.from("ingestion_events").insert({source_type:"TELEGRAM",source_id:key,event_type:lane==="backfill"?"BACKFILL_UPSERTED":"SYNC_UPSERTED",content_id:saved.data.id,creator_id:creatorId,metadata:{telegram_source_id:sid,telegram_message_id:mid,sync_mode:lane}});

    });

   const liveIds:number[]=[];
   for await(const m of client.iterMessages(entity,{limit:reconcileLimit})){
    const mid=Number(m?.id??0);if(mid>0)liveIds.push(mid);
   }
   const liveSet=new Set(liveIds);
   const fullWindow=liveIds.length<reconcileLimit;
   const minLive=liveIds.length?Math.min(...liveIds):0;
   const maxLive=liveIds.length?Math.max(...liveIds):Number.MAX_SAFE_INTEGER;
   const peerKey=String(src.telegram_peer_id??username??"");
   const channelUrlPrefix=username?`https://t.me/${username}/`:"";

   const stored=await db.from("contents")
     .select("id,source_id,source_url,creator_id,moderation_status,metadata,published_at")
     .eq("source_type","TELEGRAM")
     .eq("creator_id",creatorId)
     .order("published_at",{ascending:false})
     .limit(5000);
   if(stored.error)throw stored.error;

   const now=new Date().toISOString();
   const parseMessageId=(row:any):number=>{
    const metaId=Number(row?.metadata?.telegram_message_id??0);if(metaId>0)return metaId;
    const sourceId=String(row?.source_id??"");
    const sourceMatch=sourceId.match(/:(\d+)$/);if(sourceMatch)return Number(sourceMatch[1]);
    const sourceUrl=String(row?.source_url??"");
    const urlMatch=sourceUrl.match(/\/(\d+)(?:[?#].*)?$/);if(urlMatch)return Number(urlMatch[1]);
    return 0;
   };

   for(const row of stored.data??[]){
    const rowMeta:any=row.metadata||{};
    const taggedSource=String(rowMeta.telegram_source_id??"");
    if(taggedSource&&taggedSource!==sid)continue;

    const rowSourceId=String(row.source_id??"");
    const rowSourceUrl=String(row.source_url??"");
    const belongsToSource=taggedSource===sid||rowSourceId.startsWith(`${peerKey}:`)||(channelUrlPrefix&&rowSourceUrl.startsWith(channelUrlPrefix));
    if(!belongsToSource)continue;

    const mid=parseMessageId(row);if(!mid)continue;
    if(!taggedSource)legacyChecked++;
    const inCheckedWindow=fullWindow||(mid>=minLive&&mid<=maxLive);
    if(!inCheckedWindow||liveSet.has(mid)||String(row.moderation_status)==="REJECTED")continue;

    const metadata={...rowMeta,telegram_source_id:sid,telegram_peer_id:String(src.telegram_peer_id??""),telegram_message_id:mid,deleted_on_telegram:true,deleted_on_telegram_at:now,deletion_reconciled_at:now,deletion_reconcile_version:10};
    const upd=await db.from("contents").update({moderation_status:"REJECTED",metadata,updated_at:now}).eq("id",row.id);
    if(upd.error){errors++;console.error("delete reconcile error",{contentId:row.id,messageId:mid,error:upd.error.message});continue;}
    deleted++;
    await db.from("ingestion_events").insert({source_type:"TELEGRAM",source_id:`${peerKey}:${mid}`,event_type:"SYNC_DELETED",content_id:row.id,creator_id:creatorId,metadata:{telegram_source_id:sid,telegram_message_id:mid,reconciled_at:now,reconcile_version:10}}).then(()=>{},()=>{});
   }

   const status=errors?"partial":"success";const nextCursor=checkpoint.cursor;
   const checkpointWrite=await db.from("telegram_sources").update({sync_cursor:nextCursor,history_before_id:checkpoint.before,history_complete:checkpoint.complete,last_synced_at:now,last_success_at:status==="success"?now:src.last_success_at,last_error:errors?`${errors} item(s) failed during ${mode}`:null,updated_at:now}).eq("id",sid).eq("sync_lease_token",leaseToken).gt("sync_lease_until",new Date().toISOString()).select("id");
   if(checkpointWrite.error)throw checkpointWrite.error;
   if(!checkpointWrite.data?.length)throw Error("Sync lease expired; checkpoints not saved");
   if(runId)await db.from("telegram_sync_runs").update({status,completed_at:now,fetched_count:fetched,inserted_count:inserted,updated_count:updated,skipped_count:skipped,error_count:errors,last_message_id:newestMessageId,error_message:errors?`${errors} item(s) failed during ${mode}`:null,metadata:{previous_cursor:previousCursor,next_cursor:nextCursor,mode,reconcile_limit:reconcileLimit,reconcile_live_count:liveIds.length,reconcile_full_window:fullWindow,deleted_count:deleted,legacy_checked:legacyChecked,sync_version:15,history_before_id:checkpoint.before,history_complete:checkpoint.complete}}).eq("id",runId);
   return out({ok:true,source_id:sid,mode,status,fetched,inserted,updated,deleted,legacy_checked:legacyChecked,skipped,errors,last_message_id:newestMessageId,oldest_message_id:oldestMessageId,previous_cursor:previousCursor,sync_cursor:nextCursor,reconcile_limit:reconcileLimit,reconcile_live_count:liveIds.length,reconcile_full_window:fullWindow,library:"telegram@2.26.22",sync_version:15,history_before_id:checkpoint.before,history_complete:checkpoint.complete,run_id:runId});
  }finally{await client.disconnect().catch(()=>{});}
 }catch(e){
  console.error("telegram-source-sync-v2 fatal",e);const msg=e instanceof Error?e.message:String(e);
  if(db&&runId)await db.from("telegram_sync_runs").update({status:"failed",completed_at:new Date().toISOString(),error_message:msg}).eq("id",runId).then(()=>{},()=>{});
  return out({ok:false,error:msg},500);
 }finally{
  if(db&&leaseSource)await db.from("telegram_sources").update({sync_lease_token:null,sync_lease_until:null}).eq("id",leaseSource).eq("sync_lease_token",leaseToken);
 }
});
