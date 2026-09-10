declare const Deno: any;
declare const Supabase: any;

const CORS: Record<string,string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-request-id",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("DISCOVERY_SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DISCOVERY_SUPABASE_SERVICE_ROLE_KEY") || "";
const WORKER_URL = "https://telegram-discovery-app.paniapandora.workers.dev";

const requestId = (r: Request) => r.headers.get("x-request-id") || crypto.randomUUID();
const json = (body: unknown, status = 200, id = "") => new Response(JSON.stringify(body), { status, headers: { ...CORS, "X-Request-Id": id } });
const limitValue = (v: string | null) => { const n = Number(v ?? 20); return Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 20; };
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const optionalUuid = (v: unknown) => {
  const value = String(v ?? "").trim();
  return isUuid(value) ? value : null;
};
const boundedNumber = (v: unknown, min: number, max: number, fallback: number | null = null) => {
  const value = Number(v);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

async function rest(resource: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase server credentials are not configured");
  const base = new URL(SUPABASE_URL);
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co")) throw new Error("Invalid Supabase backend URL");
  const headers = new Headers(init.headers);
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(`/rest/v1/${resource}`, base).toString(), { ...init, headers });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Supabase REST ${response.status}`);
  return data;
}

async function rpc(name: string, args: Record<string, unknown>) {
  return rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
const constantTime = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
async function hmac(key: ArrayBuffer, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
}

async function telegramUser(initData: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN") || "";
  if (!token) throw new Error("Telegram bot secret is not configured");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date") || 0);
  if (!hash || !authDate) throw new Error("Invalid Telegram initData");
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < -60 || age > 86400) throw new Error("Telegram authorization expired");
  params.delete("hash");
  const check = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("\n");
  const enc = new TextEncoder();
  const secret = await hmac(enc.encode("WebAppData").buffer, token);
  const calculated = hex(await hmac(secret, check));
  if (!constantTime(calculated, hash)) throw new Error("Telegram authorization signature invalid");
  const raw = params.get("user");
  if (!raw) throw new Error("Telegram user data missing");
  const user = JSON.parse(raw);
  if (!user?.id) throw new Error("Telegram user id missing");
  return user;
}

async function userFrom(request: Request, body: any = {}) {
  const initData = request.headers.get("x-telegram-init-data") || String(body?.initData || "");
  if (!initData) throw new Error("Telegram initData required");
  const t = await telegramUser(initData);
  const displayName = [t.first_name, t.last_name].filter(Boolean).join(" ") || t.username || null;
  const data = await rest("users?on_conflict=telegram_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ telegram_user_id: Number(t.id), username: t.username ?? null, display_name: displayName, is_active: true, updated_at: new Date().toISOString() }),
  });
  const user = Array.isArray(data) ? data[0] : data;
  if (!user?.id) throw new Error("User upsert failed");
  await rest("notification_preferences?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: user.id }),
  });
  return user;
}

async function decorateItems(items: any[], userId: string) {
  if (!Array.isArray(items) || !items.length) return [];
  const ids = [...new Set(items.map(x => String(x?.content_id ?? x?.id ?? "")).filter(isUuid))];
  if (!ids.length) return items.map(x => ({ ...x, is_saved: false, ui_meta: { quality_tier: "LIVE", substance_score: null } }));
  const inIds = ids.join(",");
  const [saveRows, contentRows, featureRows] = await Promise.all([
    rest(`saves?select=content_id&user_id=eq.${encodeURIComponent(userId)}&content_id=in.(${inIds})`),
    rest(`contents?select=id,creator_id,content_type,text_content,thumbnail_url,media_url&source_type=eq.TELEGRAM&id=in.(${inIds})`),
    rest(`discovery_content_features?select=content_id,substance_score,quality_tier,normalized_quality&content_id=in.(${inIds})`),
  ]);
  const saved = new Set((Array.isArray(saveRows) ? saveRows : []).map((x: any) => String(x.content_id)));
  const contentMap = new Map((Array.isArray(contentRows) ? contentRows : []).map((x: any) => [String(x.id), x]));
  const creatorIds = [...new Set((Array.isArray(contentRows) ? contentRows : []).map((x:any)=>String(x.creator_id||"")).filter(isUuid))];
  const [creatorRows, followRows] = creatorIds.length ? await Promise.all([
    rest(`creators?select=id,username,name,avatar_url,source_url&id=in.(${creatorIds.join(",")})`),
    rest(`follows?select=creator_id&user_id=eq.${encodeURIComponent(userId)}&creator_id=in.(${creatorIds.join(",")})`),
  ]) : [[], []];
  const creatorMap = new Map((Array.isArray(creatorRows) ? creatorRows : []).map((x:any)=>[String(x.id),x]));
  const followed = new Set((Array.isArray(followRows) ? followRows : []).map((x:any)=>String(x.creator_id)));
  const featureMap = new Map((Array.isArray(featureRows) ? featureRows : []).map((x:any)=>[String(x.content_id),x]));

  return items.map((x:any) => {
    const id = String(x?.content_id ?? x?.id ?? "");
    const c:any = contentMap.get(id) || {};
    const f:any = featureMap.get(id) || {};
    const cr:any = creatorMap.get(String(c.creator_id ?? x.creator_id ?? "")) || {};
    return {
      ...x,
      is_saved: saved.has(id),
      content_type: c.content_type ?? x.content_type ?? null,
      text_content: c.text_content ?? x.text_content ?? null,
      thumbnail_url: c.thumbnail_url ?? x.thumbnail_url ?? null,
      media_url: c.media_url ?? x.media_url ?? null,
      channel_username: cr.username ?? x.channel_username ?? null,
      channel_name: cr.name ?? x.channel_name ?? null,
      channel_avatar_url: cr.avatar_url ?? x.channel_avatar_url ?? null,
      channel_url: cr.source_url ?? x.channel_url ?? null,
      is_following: followed.has(String(c.creator_id ?? x.creator_id ?? "")),
      ui_meta: {
        quality_tier: f.quality_tier ?? null,
        substance_score: f.substance_score ?? null,
        normalized_quality: f.normalized_quality ?? null,
      },
    };
  });
}

async function recordEvent(userId: string, contentId: string, type: string, value: number, sessionId: any = null, position: any = null, watch: any = null, metadata: any = {}) {
  return rpc("record_discovery_event", {
    p_user_id: userId,
    p_content_id: contentId,
    p_event_type: type,
    p_value: value,
    p_session_id: sessionId,
    p_position: position == null ? null : Number(position),
    p_watch_duration_seconds: watch == null ? null : Number(watch),
    p_metadata: metadata && typeof metadata === "object" ? metadata : {},
  });
}

function feedbackValue(v: unknown) {
  const k = String(v ?? "").trim().toLowerCase().replaceAll("-", "_");
  const map: Record<string,{db:string,event:string,value:number}> = {
    dislike: { db: "DISLIKE", event: "dislike", value: -1 },
    not_interested: { db: "NOT_INTERESTED", event: "not_interested", value: -1 },
    not_relevant: { db: "NOT_RELEVANT", event: "not_relevant", value: -1.5 },
    hide: { db: "HIDE_CREATOR", event: "hide", value: -2.5 },
    hide_creator: { db: "HIDE_CREATOR", event: "hide", value: -2.5 },
    report: { db: "REPORT", event: "report", value: -4 },
    like: { db: "LIKE", event: "like", value: 2.5 },
    skip: { db: "NOT_INTERESTED", event: "skip", value: -0.5 },
  };
  return map[k] ?? map.not_interested;
}

async function queryEmbedding(query: string): Promise<number[] | null> {
  try {
    const model = new Supabase.ai.Session("gte-small");
    const embedding = await model.run(query, { mean_pool: true, normalize: true });
    const vector = Array.from(embedding as Iterable<number>);
    if (vector.length !== 384) throw new Error(`unexpected query embedding dimension: ${vector.length}`);
    return vector;
  } catch (error) {
    console.error("query embedding failed", error instanceof Error ? error.message : error);
    return null;
  }
}

async function indexedSearch(query: string, userId: string, n: number) {
  const vector = await queryEmbedding(query);
  if (vector) {
    try {
      const hybrid = await rpc("search_discovery_hybrid_v1", { p_user_id: userId, p_query: query, p_query_embedding: vector, p_limit: n });
      const items = Array.isArray(hybrid) ? hybrid : [];
      if (items.length) return { items, source: "discovery_hybrid" };
    } catch (error) { console.error("hybrid search failed", error instanceof Error ? error.message : error); }
  }
  const lexical = await rpc("search_discovery_v2", { p_user_id: userId, p_query: query, p_limit: n });
  return { items: Array.isArray(lexical) ? lexical : [], source: "discovery_lexical" };
}

async function liveSearch(query: string, n: number, id: string) {
  const response = await fetch(`${WORKER_URL}/api/telegram/search?q=${encodeURIComponent(query)}&limit=${n}`, { headers: { "x-request-id": id } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `Telegram search ${response.status}`);
  return Array.isArray(data?.items) ? data.items : [];
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/initData|authorization|signature|expired|Telegram user/i.test(message)) return 401;
  if (/required|invalid|too_many|not found|violates|malformed/i.test(message)) return 400;
  return 500;
}

type RouteContext = {
  request: Request;
  url: URL;
  id: string;
};

type RouteHandler = (context: RouteContext) => Promise<Response>;

const bodyFrom = (request: Request) =>
  request.json().catch(() => ({}));

const offsetFrom = (url: URL) =>
  Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);

async function healthRoute({ id }: RouteContext) {
  return json({
    ok: true,
    status: "online",
    service: "telegram-discovery",
    version: "33.1-revenue-attribution",
    feed: "adaptive-v9-fresh",
    features: ["saved", "history", "notifications", "interests", "follows"],
    request_id: id
  }, 200, id);
}

async function authRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  return json({
    ok: true,
    authenticated: true,
    user: await userFrom(request, body),
    request_id: id
  }, 200, id);
}

async function searchRoute({ request, url, id }: RouteContext) {
  const query = (url.searchParams.get("q") || "").trim();
  if (!query) return json({ ok:false, error:"q required", request_id:id }, 400, id);

  const user = await userFrom(request);
  const n = limitValue(url.searchParams.get("limit"));
  const indexed = await indexedSearch(query, user.id, n);
  let items = indexed.items;
  let source = indexed.source;

  if (!items.length) {
    items = await liveSearch(query, n, id);
    source = items.length ? "telegram_live" : "empty";
  }

  return json({
    items: await decorateItems(items, user.id),
    count: items.length,
    query,
    source,
    semantic: source === "discovery_hybrid",
    request_id: id
  }, 200, id);
}

async function feedRoute({ request, url, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rpc("get_personalized_feed_v9", {
    p_user_id: user.id,
    p_session_id: optionalUuid(url.searchParams.get("session_id")),
    p_limit: limitValue(url.searchParams.get("limit")),
    p_offset: offsetFrom(url)
  });
  const items = Array.isArray(rows) ? rows : [];

  return json({
    items: await decorateItems(items, user.id),
    count: items.length,
    algorithm: "adaptive-v9-fresh-semantic-quality",
    request_id: id
  }, 200, id);
}

async function trendingRoute({ request, url, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rpc("get_trending_discovery_v2", {
    p_limit: limitValue(url.searchParams.get("limit"))
  });
  const items = Array.isArray(rows) ? rows : [];
  return json({ items:await decorateItems(items, user.id), count:items.length, mode:"trending", request_id:id }, 200, id);
}

async function exploreRoute({ request, url, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rpc("get_explore_discovery_v2", {
    p_user_id: user.id,
    p_limit: limitValue(url.searchParams.get("limit"))
  });
  const items = Array.isArray(rows) ? rows : [];
  return json({ items:await decorateItems(items, user.id), count:items.length, mode:"explore", request_id:id }, 200, id);
}

async function explorePageRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const excluded = body.exclude_ids ?? [];
  if (!Array.isArray(excluded) || excluded.length > 5000 || excluded.some((x: unknown) => typeof x !== 'string' || !isUuid(x))) {
    return json({ ok: false, error: 'Invalid exclude_ids' }, 400, id);
  }
  const limit = Math.min(100, limitValue(String(body.limit ?? 24)));
  const rows = await rpc('get_explore_discovery_page_v1', {
    p_user_id: user.id, p_limit: limit + 1, p_exclude: [...new Set(excluded)]
  });
  const items = Array.isArray(rows) ? rows : [];
  return json({ items: await decorateItems(items.slice(0, limit), user.id), has_more: items.length > limit, mode: 'explore', request_id: id }, 200, id);
}

async function impressionRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const contentId = String(body?.content_id || body?.contentId || "").trim();

  if (!contentId) return json({ ok:false, error:"content_id required", request_id:id }, 400, id);
  if (!isUuid(contentId)) return json({ ok:true, recorded:false, request_id:id }, 200, id);

  await rpc("record_discovery_impression_v2", {
    p_user_id: user.id,
    p_content_id: contentId,
    p_session_id: optionalUuid(body?.session_id ?? body?.sessionId),
    p_position: boundedNumber(body?.position, 0, 10000, 0),
    p_score: boundedNumber(body?.score, 0, 1, 0),
    p_reason: String(body?.reason ?? "discovery").slice(0, 80)
  });
  return json({ ok:true, recorded:true, request_id:id }, 200, id);
}

async function eventRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const contentId = String(body?.content_id || body?.contentId || "").trim();
  if (!isUuid(contentId)) return json({ ok:false, error:"valid content_id required", request_id:id }, 400, id);

  const eventType = String(body?.event_type || body?.type || "open").trim().toLowerCase().replaceAll("-", "_");
  const values: Record<string,number> = {
    open:0.25,
    view:0.1,
    long_view:0.75,
    telegram_open:0.4,
    share:1.5,
    skip:-0.5
  };
  if (!(eventType in values)) return json({ ok:false, error:"invalid event_type", request_id:id }, 400, id);

  await recordEvent(
    user.id,
    contentId,
    eventType,
    values[eventType],
    optionalUuid(body?.session_id ?? body?.sessionId),
    boundedNumber(body?.position, 0, 10000),
    boundedNumber(body?.watch_duration_seconds, 0, 86400),
    { source:"mini_app", ...(body?.metadata && typeof body.metadata === "object" ? body.metadata : {}) }
  );
  return json({ ok:true, recorded:true, event_type:eventType, request_id:id }, 200, id);
}

async function saveRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const contentId = String(body?.content_id || body?.contentId || "").trim();

  if (!contentId) return json({ ok:false, error:"content_id required", request_id:id }, 400, id);
  if (!isUuid(contentId)) return json({ ok:true, saved:false, recorded:false, request_id:id }, 200, id);

  await rest("saves?on_conflict=user_id,content_id", {
    method:"POST",
    headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
    body:JSON.stringify({ user_id:user.id, content_id:contentId })
  });
  await recordEvent(
    user.id,
    contentId,
    "save",
    1,
    optionalUuid(body?.session_id ?? body?.sessionId),
    boundedNumber(body?.position, 0, 10000),
    boundedNumber(body?.watch_duration_seconds, 0, 86400),
    { source:"mini_app", ...(body?.metadata && typeof body.metadata === "object" ? body.metadata : {}) }
  );
  return json({ ok:true, saved:true, recorded:true, content_id:contentId, request_id:id }, 200, id);
}

async function unsaveRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const contentId = String(body?.content_id || body?.contentId || "").trim();
  if (!isUuid(contentId)) return json({ ok:false, error:"valid content_id required", request_id:id }, 400, id);

  await rest(
    "saves?user_id=eq." + encodeURIComponent(user.id) + "&content_id=eq." + encodeURIComponent(contentId),
    { method:"DELETE", headers:{ Prefer:"return=minimal" } }
  );
  return json({ ok:true, saved:false, content_id:contentId, request_id:id }, 200, id);
}

async function savedRoute({ request, url, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rpc("get_saved_items_v1", {
    p_user_id:user.id,
    p_limit:limitValue(url.searchParams.get("limit")),
    p_offset:offsetFrom(url)
  });
  const items = Array.isArray(rows) ? rows : [];
  return json({ ok:true, items:await decorateItems(items, user.id), count:items.length, request_id:id }, 200, id);
}

async function historyRoute({ request, url, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rpc("get_user_history_v1", {
    p_user_id:user.id,
    p_limit:limitValue(url.searchParams.get("limit")),
    p_offset:offsetFrom(url)
  });
  const items = Array.isArray(rows) ? rows : [];
  return json({ ok:true, items:await decorateItems(items, user.id), count:items.length, request_id:id }, 200, id);
}

async function clearHistoryRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const result = await rpc("clear_user_history_v1", { p_user_id:user.id });
  return json({ ok:true, deleted:Number(Array.isArray(result) ? result[0] : result) || 0, request_id:id }, 200, id);
}

async function searchHistoryRoute({ request, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rest(
    "search_history?select=query,normalized_query,result_count,created_at&user_id=eq." +
    encodeURIComponent(user.id) + "&order=created_at.desc&limit=30"
  );
  const seen = new Set<string>();
  const items = (Array.isArray(rows) ? rows : []).filter((row:any) => {
    const key = String(row.normalized_query || row.query || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
  return json({ ok:true, items, count:items.length, request_id:id }, 200, id);
}

async function addSearchHistoryRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const query = String(body?.query || body?.q || "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (query.length < 2) return json({ ok:false, error:"valid query required", request_id:id }, 400, id);

  await rest("search_history", {
    method:"POST",
    headers:{ Prefer:"return=minimal" },
    body:JSON.stringify({
      user_id:user.id,
      query,
      normalized_query:query.toLocaleLowerCase("fa"),
      result_count:Math.floor(boundedNumber(body?.result_count, 0, 100000, 0) || 0)
    })
  });
  return json({ ok:true, recorded:true, request_id:id }, 201, id);
}

async function clearSearchHistoryRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  await rest("search_history?user_id=eq." + encodeURIComponent(user.id), {
    method:"DELETE",
    headers:{ Prefer:"return=minimal" }
  });
  return json({ ok:true, request_id:id }, 200, id);
}

async function topicsRoute({ request, id }: RouteContext) {
  const user = await userFrom(request);
  const [topics, selected] = await Promise.all([
    rest("topics?select=id,name,slug,description&order=name.asc"),
    rest("user_interests?select=topic_id,weight&user_id=eq." + encodeURIComponent(user.id))
  ]);
  const weights = new Map((Array.isArray(selected) ? selected : []).map((row:any) => [String(row.topic_id), Number(row.weight)]));
  const items = (Array.isArray(topics) ? topics : []).map((topic:any) => ({
    ...topic,
    selected:weights.has(String(topic.id)),
    weight:weights.get(String(topic.id)) ?? 0
  }));
  return json({ ok:true, items, count:items.length, request_id:id }, 200, id);
}

async function interestsRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const topicIds = [...new Set((Array.isArray(body?.topic_ids) ? body.topic_ids : []).map(String).filter(isUuid))].slice(0, 13);
  if (topicIds.length > 12) return json({ ok:false, error:"too_many_topics", request_id:id }, 400, id);

  const rows = await rpc("set_user_interests_v1", { p_user_id:user.id, p_topic_ids:topicIds });
  return json({ ok:true, items:Array.isArray(rows) ? rows : [], request_id:id }, 200, id);
}

async function followRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const creatorId = String(body?.creator_id || "").trim();
  if (!isUuid(creatorId)) return json({ ok:false, error:"valid creator_id required", request_id:id }, 400, id);

  const following = body?.following !== false;
  if (following) {
    await rest("follows?on_conflict=user_id,creator_id", {
      method:"POST",
      headers:{ Prefer:"resolution=ignore-duplicates,return=minimal" },
      body:JSON.stringify({ user_id:user.id, creator_id:creatorId })
    });
  } else {
    await rest(
      "follows?user_id=eq." + encodeURIComponent(user.id) + "&creator_id=eq." + encodeURIComponent(creatorId),
      { method:"DELETE", headers:{ Prefer:"return=minimal" } }
    );
  }
  return json({ ok:true, following, creator_id:creatorId, request_id:id }, 200, id);
}

async function notificationsRoute({ request, url, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rest(
    "notifications?select=id,kind,title,body,content_id,creator_id,action_url,payload,read_at,created_at&user_id=eq." +
    encodeURIComponent(user.id) + "&order=created_at.desc&limit=" + limitValue(url.searchParams.get("limit"))
  );
  const items = Array.isArray(rows) ? rows : [];
  return json({ ok:true, items, count:items.length, unread:items.filter((row:any) => !row.read_at).length, request_id:id }, 200, id);
}

async function readNotificationsRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const notificationId = optionalUuid(body?.notification_id || body?.id);
  const filter = notificationId ? "&id=eq." + encodeURIComponent(notificationId) : "&read_at=is.null";

  await rest("notifications?user_id=eq." + encodeURIComponent(user.id) + filter, {
    method:"PATCH",
    headers:{ Prefer:"return=minimal" },
    body:JSON.stringify({ read_at:new Date().toISOString() })
  });
  return json({ ok:true, request_id:id }, 200, id);
}

async function preferencesRoute({ request, id }: RouteContext) {
  const user = await userFrom(request);
  const rows = await rest(
    "notification_preferences?select=in_app_enabled,followed_creators,personalized_digest,timezone,updated_at&user_id=eq." +
    encodeURIComponent(user.id) + "&limit=1"
  );
  return json({ ok:true, preferences:Array.isArray(rows) ? rows[0] || null : rows, request_id:id }, 200, id);
}

async function updatePreferencesRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const rows = await rpc("set_notification_preferences_v1", {
    p_user_id:user.id,
    p_in_app_enabled:body?.in_app_enabled !== false,
    p_followed_creators:body?.followed_creators !== false,
    p_personalized_digest:body?.personalized_digest !== false,
    p_timezone:String(body?.timezone || "UTC").slice(0, 64)
  });
  return json({ ok:true, preferences:Array.isArray(rows) ? rows[0] || null : rows, request_id:id }, 200, id);
}

async function profileRoute({ request, id }: RouteContext) {
  const user = await userFrom(request);
  const encodedUser = encodeURIComponent(user.id);
  const [interests, follows, unread] = await Promise.all([
    rest("user_interests?select=topic_id,weight,topics(id,name,slug)&user_id=eq." + encodedUser),
    rest("follows?select=creator_id,created_at,creators(id,name,username,avatar_url)&user_id=eq." + encodedUser + "&order=created_at.desc&limit=50"),
    rest("notifications?select=id&user_id=eq." + encodedUser + "&read_at=is.null&limit=100")
  ]);
  return json({
    ok:true,
    user:{ id:user.id, username:user.username, display_name:user.display_name },
    interests:Array.isArray(interests) ? interests : [],
    follows:Array.isArray(follows) ? follows : [],
    unread_notifications:Array.isArray(unread) ? unread.length : 0,
    request_id:id
  }, 200, id);
}

async function feedbackRoute({ request, id }: RouteContext) {
  const body = await bodyFrom(request);
  const user = await userFrom(request, body);
  const contentId = String(body?.content_id || body?.contentId || "").trim();
  const creatorId = optionalUuid(body?.creator_id);
  const feedback = feedbackValue(body?.feedback_type || body?.feedbackType || body?.type || "not_interested");

  if (!contentId || !isUuid(contentId)) {
    return json({ ok:true, recorded:false, feedback_type:feedback.db, request_id:id }, 200, id);
  }

  await rest("feedback", {
    method:"POST",
    headers:{ Prefer:"return=minimal" },
    body:JSON.stringify({
      user_id:user.id,
      content_id:contentId,
      creator_id:creatorId,
      feedback_type:feedback.db,
      reason:body?.reason ? String(body.reason).slice(0, 500) : null
    })
  });
  await recordEvent(
    user.id,
    contentId,
    feedback.event,
    feedback.value,
    optionalUuid(body?.session_id ?? body?.sessionId),
    boundedNumber(body?.position, 0, 10000),
    boundedNumber(body?.watch_duration_seconds, 0, 86400),
    { source:"mini_app", reason:body?.reason ?? null, ...(body?.metadata && typeof body.metadata === "object" ? body.metadata : {}) }
  );
  return json({ ok:true, recorded:true, feedback_type:feedback.db, request_id:id }, 200, id);
}

const ROUTES: Record<string, RouteHandler> = {
  "GET /": healthRoute,
  "GET /health": healthRoute,
  "POST /auth/telegram": authRoute,
  "GET /search": searchRoute,
  "GET /feed": feedRoute,
  "GET /trending": trendingRoute,
  "GET /explore": exploreRoute,
  "POST /explore": explorePageRoute,
  "POST /impression": impressionRoute,
  "POST /events": eventRoute,
  "POST /save": saveRoute,
  "DELETE /save": unsaveRoute,
  "POST /unsave": unsaveRoute,
  "GET /saved": savedRoute,
  "GET /history": historyRoute,
  "DELETE /history": clearHistoryRoute,
  "GET /search-history": searchHistoryRoute,
  "POST /search-history": addSearchHistoryRoute,
  "DELETE /search-history": clearSearchHistoryRoute,
  "GET /topics": topicsRoute,
  "PUT /interests": interestsRoute,
  "POST /follow": followRoute,
  "GET /notifications": notificationsRoute,
  "POST /notifications/read": readNotificationsRoute,
  "GET /notification-preferences": preferencesRoute,
  "PUT /notification-preferences": updatePreferencesRoute,
  "GET /profile": profileRoute,
  "POST /feedback": feedbackRoute
};

Deno.serve(async (request: Request) => {
  const id = requestId(request);
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status:204, headers:{ ...CORS, "X-Request-Id":id } });
    }

    const url = new URL(request.url);
    const path = url.pathname
      .replace(/^\/functions\/v1\/(?:discovery-api-live|discovery-api-v33)/, "")
      .replace(/^\/(?:discovery-api-live|discovery-api-v33)/, "") || "/";
    const handler = ROUTES[request.method + " " + path];

    if (!handler) {
      return json({ ok:false, error:"Not found", path, request_id:id }, 404, id);
    }

    return await handler({ request, url, id });
  } catch (error) {
    console.error("discovery-api-v33", id, error);
    const status = errorStatus(error);
    return json({ ok:false, error:error instanceof Error ? error.message : "Internal server error", request_id:id }, status, id);
  }
});
