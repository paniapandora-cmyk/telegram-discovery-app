import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-request-id","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("DISCOVERY_SUPABASE_SERVICE_ROLE_KEY")||"";
const BOT_TOKEN=Deno.env.get("TELEGRAM_BOT_TOKEN")||Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN")||"";
const WEBHOOK_SECRET=Deno.env.get("TELEGRAM_WEBHOOK_SECRET")||"";
const TELEGRAM_API=`https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_WEBHOOK_URL=`${SUPABASE_URL}/functions/v1/telegram-chat-ui-v1`;
const rid=(r:Request)=>r.headers.get("x-request-id")||crypto.randomUUID();
const out=(x:unknown,status=200,id="")=>new Response(JSON.stringify(x),{status,headers:{...CORS,"X-Request-Id":id}});
const lim=(v:string|null,d=20,m=100)=>{const n=Number(v??d);return Number.isFinite(n)?Math.min(m,Math.max(1,Math.floor(n))):d};
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
let webhookReadyUntil=0;
let botIdentityCache:{id:number;username:string}|null=null;

async function rest(resource:string,init:RequestInit={}){
  if(!SUPABASE_URL||!SERVICE_KEY)throw Error("Supabase server credentials are not configured");
  const base=new URL(SUPABASE_URL);
  if(base.protocol!=="https:"||!base.hostname.endsWith(".supabase.co"))throw Error("Invalid Supabase backend URL");
  const h=new Headers(init.headers);h.set("apikey",SERVICE_KEY);h.set("Authorization",`Bearer ${SERVICE_KEY}`);
  if(init.body&&!h.has("Content-Type"))h.set("Content-Type","application/json");
  const r=await fetch(new URL(`/rest/v1/${resource}`,base).toString(),{...init,headers:h});
  const t=await r.text();let d:any={};try{d=t?JSON.parse(t):{}}catch{d={message:t}}
  if(!r.ok)throw Error(d?.message||`Supabase REST ${r.status}`);
  return d;
}
async function rpc(name:string,args:Record<string,unknown>){return rest(`rpc/${name}`,{method:"POST",body:JSON.stringify(args)})}
async function callTelegram(method:string,body:Record<string,unknown>){
  if(!BOT_TOKEN)throw Error("Telegram bot token is not configured");
  const response=await fetch(`${TELEGRAM_API}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.ok)throw Error(String(data?.description||`Telegram ${method} failed`));
  return data.result;
}
async function botIdentity(){
  if(botIdentityCache)return botIdentityCache;
  const me=await callTelegram("getMe",{});
  if(!Number.isSafeInteger(Number(me?.id))||!me?.username)throw Error("Telegram bot identity unavailable");
  botIdentityCache={id:Number(me.id),username:String(me.username)};
  return botIdentityCache;
}
async function sha256(value:string){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function activeWebhookSecret(){if(WEBHOOK_SECRET)return WEBHOOK_SECRET;if(!BOT_TOKEN)return "";return sha256("telegram-webhook:"+BOT_TOKEN)}
async function ensureReferralWebhook(){
  if(Date.now()<webhookReadyUntil)return;
  const secret=await activeWebhookSecret();
  if(!secret)throw Error("Telegram webhook authentication is not configured");
  await callTelegram("setWebhook",{url:TELEGRAM_WEBHOOK_URL,secret_token:secret,allowed_updates:["my_chat_member","chat_member","channel_post","edited_channel_post","message"],drop_pending_updates:false});
  webhookReadyUntil=Date.now()+10*60*1000;
}
async function telegramUser(initData:string){
  const token=BOT_TOKEN;
  if(!token)throw Error("Telegram bot secret is not configured");
  const p=new URLSearchParams(initData),hash=p.get("hash"),auth=Number(p.get("auth_date")||0);
  if(!hash||!auth)throw Error("Invalid Telegram initData");
  if(Math.floor(Date.now()/1000)-auth>86400)throw Error("Telegram authorization expired");
  p.delete("hash");
  const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
  const enc=new TextEncoder();
  const hmac=async(key:ArrayBuffer,msg:string)=>{const k=await crypto.subtle.importKey("raw",key,{name:"HMAC",hash:"SHA-256"},false,["sign"]);return crypto.subtle.sign("HMAC",k,enc.encode(msg))};
  const secret=await hmac(enc.encode("WebAppData").buffer,token);
  const calc=Array.from(new Uint8Array(await hmac(secret,check))).map(x=>x.toString(16).padStart(2,"0")).join("");
  const constantTime=(a:string,b:string)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0};
  if(!constantTime(calc,hash))throw Error("Telegram authorization signature invalid");
  const raw=p.get("user");if(!raw)throw Error("Telegram user data missing");
  const u=JSON.parse(raw);if(!u?.id)throw Error("Telegram user id missing");
  return u;
}
async function userFrom(r:Request,b:any={}){
  const init=r.headers.get("x-telegram-init-data")||String(b?.initData||"");
  if(!init)throw Error("Telegram initData required");
  const t=await telegramUser(init);
  const display=[t.first_name,t.last_name].filter(Boolean).join(" ")||t.username||null;
  const d=await rest("users?on_conflict=telegram_user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({telegram_user_id:Number(t.id),username:t.username??null,display_name:display,is_active:true,updated_at:new Date().toISOString()})});
  const u=Array.isArray(d)?d[0]:d;if(!u?.id)throw Error("User upsert failed");
  return u;
}
async function channelForUser(userId:string,channelId:string){
  if(!uuid(channelId))return null;
  const rows=await rest(`creator_channels?select=id,creator_user_id,creator_id,telegram_channel_id,username,title,is_bot_admin,verified,created_at&id=eq.${encodeURIComponent(channelId)}&creator_user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  return Array.isArray(rows)?rows[0]||null:null;
}

type Ctx={request:Request,url:URL,id:string};
type Handler=(c:Ctx)=>Promise<Response>;

async function healthRoute({id}:Ctx){let webhookActive=true;try{await ensureReferralWebhook()}catch(error){webhookActive=false;console.error("creator webhook health",id,error)}return out({ok:true,service:"creator-dashboard",version:"5.0-live-membership",verified_telegram_joins:true,creator_channels:true,creator_events:true,daily_stats:true,tracking_links:true,referral_ready:Boolean(BOT_TOKEN&&SUPABASE_URL&&SERVICE_KEY),bot_token_ready:Boolean(BOT_TOKEN),webhook_auth_ready:Boolean(BOT_TOKEN),service_key_ready:Boolean(SERVICE_KEY),webhook_active:webhookActive,request_id:id},200,id)}
async function dashboardRoute({request,id}:Ctx){const user=await userFrom(request);const rows=await rpc("get_creator_dashboard_v3",{p_user_id:user.id});return out({ok:true,creators:Array.isArray(rows)?rows:[],request_id:id},200,id)}
async function contentRoute({request,url,id}:Ctx){const user=await userFrom(request);const creatorId=(url.searchParams.get("creator_id")||"").trim();if(!creatorId)return out({ok:false,error:"creator_id required",request_id:id},400,id);const rows=await rpc("get_creator_content_stats_v3",{p_user_id:user.id,p_creator_id:creatorId,p_limit:lim(url.searchParams.get("limit"),50)});return out({ok:true,items:Array.isArray(rows)?rows:[],request_id:id},200,id)}
async function claimsRoute({request,id}:Ctx){const user=await userFrom(request);const rows=await rest("creator_claims?select=id,creator_id,status,created_at,reviewed_at,creators(id,name,username,avatar_url)&user_id=eq."+encodeURIComponent(user.id)+"&order=created_at.desc");return out({ok:true,claims:Array.isArray(rows)?rows:[],request_id:id},200,id)}
async function claimRoute({request,id}:Ctx){
  const body=await request.json().catch(()=>({}));const user=await userFrom(request,body);const username=String(body?.username||body?.creator_username||"").trim().replace(/^@/,"");
  if(!/^[A-Za-z0-9_]{4,32}$/.test(username))return out({ok:false,error:"نام کاربری معتبر لازم است",request_id:id},400,id);
  const creators=await rest("creators?select=id,name,username,avatar_url&username=ilike."+encodeURIComponent(username)+"&limit=1");const creator=Array.isArray(creators)?creators[0]:null;
  if(!creator?.id)return out({ok:false,error:"کانالی با این نام کاربری در سیستم پیدا نشد",request_id:id},404,id);
  const rows=await rest("creator_claims?on_conflict=creator_id,user_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({user_id:user.id,creator_id:creator.id,status:"PENDING"})});
  const claim=Array.isArray(rows)?rows[0]||null:rows;return out({ok:true,claim:{...claim,creator},request_id:id},201,id)
}
async function channelsRoute({request,id}:Ctx){
  const user=await userFrom(request);
  const rows=await rest(`creator_channels?select=id,creator_id,telegram_channel_id,username,title,is_bot_admin,verified,ownership_role,created_at,updated_at&creator_user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`);
  return out({ok:true,channels:Array.isArray(rows)?rows:[],request_id:id},200,id);
}
async function addChannelRoute({request,id}:Ctx){
  const body=await request.json().catch(()=>({}));const user=await userFrom(request,body);
  const username=String(body?.username||body?.channel_username||"").trim().replace(/^@/,"");
  if(!/^[A-Za-z0-9_]{4,32}$/.test(username))return out({ok:false,error:"نام کاربری کانال معتبر لازم است",request_id:id},400,id);
  const chat=await callTelegram("getChat",{chat_id:`@${username}`});
  if(!["channel","supergroup"].includes(String(chat?.type||"")))return out({ok:false,error:"مقصد باید کانال یا سوپرگروه تلگرام باشد",request_id:id},400,id);
  const telegramChannelId=Number(chat?.id);if(!Number.isSafeInteger(telegramChannelId))throw Error("Invalid Telegram channel id");
  const ownerMember=await callTelegram("getChatMember",{chat_id:telegramChannelId,user_id:Number(user.telegram_user_id)}).catch(()=>null);
  const ownerStatus=String(ownerMember?.status||"");
  if(!["creator","administrator"].includes(ownerStatus))return out({ok:false,error:"برای افزودن کانال باید مالک یا ادمین آن باشید",request_id:id},403,id);
  const bot=await botIdentity();
  const botMember=await callTelegram("getChatMember",{chat_id:telegramChannelId,user_id:bot.id}).catch(()=>null);
  const botAdmin=["creator","administrator"].includes(String(botMember?.status||""));
  const creatorRows=await rest(`creators?select=id,name,username,avatar_url&username=ilike.${encodeURIComponent(username)}&limit=1`);
  let creator=Array.isArray(creatorRows)?creatorRows[0]:null;
  if(!creator?.id){
    const inserted=await rest("creators",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({name:String(chat?.title||username),username,source_url:`https://t.me/${username}`,verified:false,is_active:true})});
    creator=Array.isArray(inserted)?inserted[0]:inserted;
  }
  const sourceRows=await rest(`telegram_sources?select=id&telegram_peer_id=eq.${telegramChannelId}&limit=1`);
  if(Array.isArray(sourceRows)&&sourceRows.length){
    await rest(`telegram_sources?telegram_peer_id=eq.${telegramChannelId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({username,title:String(chat?.title||username),enabled:true,owner_telegram_user_id:Number(user.telegram_user_id),updated_at:new Date().toISOString(),last_error:null})});
  }else{
    await rest("telegram_sources",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({telegram_peer_id:telegramChannelId,username,title:String(chat?.title||username),peer_kind:String(chat?.type)==="channel"?"channel":"supergroup",enabled:true,owner_telegram_user_id:Number(user.telegram_user_id)})});
  }
  const verified=ownerStatus==="creator"||botAdmin;
  const rows=await rest("creator_channels?on_conflict=creator_user_id,telegram_channel_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({creator_user_id:user.id,creator_id:creator.id,telegram_channel_id:telegramChannelId,username,title:String(chat?.title||username),is_bot_admin:botAdmin,verified,ownership_role:ownerStatus,updated_at:new Date().toISOString(),metadata:{added_via:"creator_dashboard_v4"}})});
  const channel=Array.isArray(rows)?rows[0]:rows;
  await rest("creator_claims?on_conflict=creator_id,user_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({creator_id:creator.id,user_id:user.id,status:"APPROVED",reviewed_at:new Date().toISOString()})});
  await ensureReferralWebhook().catch(()=>{});
  return out({ok:true,channel,bot_admin:botAdmin,verified,request_id:id},201,id);
}
async function analyticsRoute({request,url,id}:Ctx){
  const user=await userFrom(request);const channelId=String(url.searchParams.get("channel_id")||"").trim();const days=lim(url.searchParams.get("days"),30,365);
  if(channelId&&!uuid(channelId))return out({ok:false,error:"channel_id معتبر نیست",request_id:id},400,id);
  const rows=await rpc("get_creator_analytics_v4",{p_user_id:user.id,p_creator_channel_id:channelId||null,p_days:days});
  return out({ok:true,days,channels:Array.isArray(rows)?rows:[],request_id:id},200,id);
}
async function contentPerformanceRoute({request,url,id}:Ctx){
  const user=await userFrom(request);const channelId=String(url.searchParams.get("channel_id")||"").trim();if(!uuid(channelId))return out({ok:false,error:"channel_id required",request_id:id},400,id);
  const rows=await rpc("get_creator_content_performance_v4",{p_user_id:user.id,p_creator_channel_id:channelId,p_days:lim(url.searchParams.get("days"),30,365),p_limit:lim(url.searchParams.get("limit"),50)});
  return out({ok:true,items:Array.isArray(rows)?rows:[],request_id:id},200,id);
}
async function trackingLinkRoute({request,id}:Ctx){
  const body=await request.json().catch(()=>({}));const user=await userFrom(request,body);
  const channelId=String(body?.channel_id||body?.creator_channel_id||"").trim();const channel=await channelForUser(user.id,channelId);
  if(!channel)return out({ok:false,error:"کانال پیدا نشد",request_id:id},404,id);
  const contentId=String(body?.content_id||"").trim();if(contentId&&!uuid(contentId))return out({ok:false,error:"content_id معتبر نیست",request_id:id},400,id);
  if(contentId){const c=await rest(`contents?select=id&id=eq.${encodeURIComponent(contentId)}&creator_id=eq.${encodeURIComponent(channel.creator_id)}&limit=1`);if(!Array.isArray(c)||!c.length)return out({ok:false,error:"محتوا متعلق به این کانال نیست",request_id:id},400,id)}
  const token=`cr_${crypto.randomUUID().replaceAll("-","").slice(0,28)}`;const bot=await botIdentity();
  const rows=await rest("creator_tracking_links",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({creator_channel_id:channel.id,creator_user_id:user.id,creator_id:channel.creator_id,content_id:contentId||null,token,source:String(body?.source||"creator_dashboard"),target_type:"bot_start",metadata:{channel_username:channel.username}})});
  const link=Array.isArray(rows)?rows[0]:rows;
  return out({ok:true,tracking_link:link,url:`https://t.me/${bot.username}?start=${token}`,request_id:id},201,id);
}
async function eventRoute({request,id}:Ctx){
  const body=await request.json().catch(()=>({}));const viewer=await userFrom(request,body);const token=String(body?.token||"").trim();const eventType=String(body?.event_type||"").trim();
  if(!["impression","open","click_telegram","start_bot","save"].includes(eventType))return out({ok:false,error:"event_type معتبر نیست",request_id:id},400,id);
  const links=await rest(`creator_tracking_links?select=id,creator_channel_id,creator_user_id,creator_id,content_id,is_active,expires_at&token=eq.${encodeURIComponent(token)}&limit=1`);const link=Array.isArray(links)?links[0]:null;
  if(!link?.id||link.is_active===false)return out({ok:false,error:"tracking link پیدا نشد",request_id:id},404,id);
  if(link.expires_at&&new Date(link.expires_at).getTime()<Date.now())return out({ok:false,error:"tracking link منقضی شده است",request_id:id},410,id);
  const idem=String(body?.idempotency_key||"").trim()||null;
  const rows=await rest("creator_events",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({creator_channel_id:link.creator_channel_id,creator_user_id:link.creator_user_id,creator_id:link.creator_id,content_id:link.content_id,tracking_link_id:link.id,viewer_user_id:viewer.id,telegram_user_id:Number(viewer.telegram_user_id),event_type:eventType,source:String(body?.source||"discovery"),session_id:String(body?.session_id||"")||null,idempotency_key:idem,metadata:body?.metadata||{}})}).catch(async(error)=>{if(idem&&/duplicate key/i.test(String(error)))return [];throw error});
  return out({ok:true,event:Array.isArray(rows)?rows[0]||null:rows,request_id:id},201,id);
}
async function referralLinkRoute({request,id}:Ctx){
  const body=await request.json().catch(()=>({}));const user=await userFrom(request,body);const creatorId=String(body?.creator_id||body?.creatorId||"").trim();const contentId=String(body?.content_id||body?.contentId||"").trim();
  if(!uuid(creatorId))return out({ok:false,error:"شناسه کانال معتبر نیست",request_id:id},400,id);
  const creators=await rest("creators?select=id,name,username,is_active&id=eq."+encodeURIComponent(creatorId)+"&is_active=eq.true&limit=1");const creator=Array.isArray(creators)?creators[0]:null;const username=String(creator?.username||"").replace(/^@/,"");
  if(!creator?.id||!/^[A-Za-z0-9_]{4,32}$/.test(username))return out({ok:false,error:"این کانال برای عضویت قابل ردیابی نیست",request_id:id},404,id);
  if(contentId){const contents=await rest("contents?select=id&id=eq."+encodeURIComponent(contentId)+"&creator_id=eq."+encodeURIComponent(creatorId)+"&limit=1");if(!Array.isArray(contents)||!contents.length)return out({ok:false,error:"محتوا متعلق به این کانال نیست",request_id:id},400,id)}
  const since=encodeURIComponent(new Date(Date.now()-60*60*1000).toISOString());const recent=await rest("creator_referrals?select=id&user_id=eq."+encodeURIComponent(user.id)+"&creator_id=eq."+encodeURIComponent(creatorId)+"&created_at=gte."+since+"&limit=11");if(Array.isArray(recent)&&recent.length>=10)return out({ok:false,error:"تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کن",request_id:id},429,id);
  try{await ensureReferralWebhook();const chat=await callTelegram("getChat",{chat_id:`@${username}`});const telegramChatId=Number(chat?.id);if(!Number.isSafeInteger(telegramChatId)||!["channel","supergroup"].includes(String(chat?.type||"")))return out({ok:false,error:"مقصد تلگرام کانال یا گروه معتبر نیست",request_id:id},409,id);
    const referralId=crypto.randomUUID();const inviteName=`td_${referralId.replaceAll("-","").slice(0,24)}`;const expiresAt=new Date(Date.now()+7*24*60*60*1000);const invite=await callTelegram("createChatInviteLink",{chat_id:telegramChatId,name:inviteName,expire_date:Math.floor(expiresAt.getTime()/1000),member_limit:1,creates_join_request:false});const inviteUrl=String(invite?.invite_link||"");if(!/^https:\/\/t\.me\/(?:\+|joinchat\/)/i.test(inviteUrl))throw Error("Telegram did not return a valid invite link");
    try{await rest("creator_referrals",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id:referralId,creator_id:creatorId,content_id:contentId||null,user_id:user.id,telegram_user_id:Number(user.telegram_user_id),telegram_chat_id:telegramChatId,invite_link_hash:await sha256(inviteUrl),invite_link_name:inviteName,status:"CLICKED",expires_at:expiresAt.toISOString(),metadata:{source:"telegram_discovery_mini_app"}})})}catch(error){callTelegram("revokeChatInviteLink",{chat_id:telegramChatId,invite_link:inviteUrl}).catch(()=>{});throw error}
    return out({ok:true,invite_url:inviteUrl,expires_at:expiresAt.toISOString(),creator:{id:creator.id,name:creator.name,username},request_id:id},201,id);
  }catch(error){console.error("creator referral link",id,error);return out({ok:false,error:"برای شمارش عضویت، ربات باید ادمین کانال و مجاز به ساخت لینک دعوت باشد",request_id:id},409,id)}
}

const ROUTES:Record<string,Handler>={
  "GET /":healthRoute,"GET /health":healthRoute,"GET /dashboard":dashboardRoute,"GET /content":contentRoute,"GET /claims":claimsRoute,"POST /claim":claimRoute,"POST /referral-link":referralLinkRoute,
  "GET /channels":channelsRoute,"POST /channel/add":addChannelRoute,"GET /analytics":analyticsRoute,"GET /content-performance":contentPerformanceRoute,"POST /tracking-link":trackingLinkRoute,"POST /event":eventRoute
};
Deno.serve(async(request:Request)=>{
  const id=rid(request);
  try{
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{...CORS,"X-Request-Id":id}});
    const url=new URL(request.url);const path=url.pathname.replace(/^\/functions\/v1\/creator-dashboard(?:-v2)?/,"").replace(/^\/creator-dashboard(?:-v2)?/,"")||"/";const handler=ROUTES[request.method+" "+path];
    if(!handler)return out({ok:false,error:"Not found",path,request_id:id},404,id);
    return await handler({request,url,id});
  }catch(error){console.error("creator-dashboard-v2",id,error);const message=error instanceof Error?error.message:"Internal server error";const status=/initData|authorization|signature|expired|Telegram user/i.test(message)?401:/مالک|ادمین|Forbidden/i.test(message)?403:/required|معتبر/i.test(message)?400:500;return out({ok:false,error:message,request_id:id},status,id)}
});

