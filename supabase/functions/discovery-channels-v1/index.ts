declare const Deno: any;

const CORS: Record<string,string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-request-id",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=20, s-maxage=30, stale-while-revalidate=120",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });

async function rest(resource: string) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase server credentials are not configured");
  const response = await fetch(new URL(`/rest/v1/${resource}`, SUPABASE_URL).toString(), {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: "application/json" },
  });
  const text = await response.text();
  let data: any = [];
  try { data = text ? JSON.parse(text) : []; } catch { data = []; }
  if (!response.ok) throw new Error(data?.message || `Supabase REST ${response.status}`);
  return data;
}

const recentEnough = (value: unknown, minutes = 15) => {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) && Date.now() - ms <= minutes * 60_000;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "GET") return json({ ok:false, error:"Method not allowed" }, 405);

  try {
    const incoming = new URL(request.url);
    const requested = Number(incoming.searchParams.get("limit") || 12);
    const limit = Math.min(30, Math.max(4, Number.isFinite(requested) ? Math.floor(requested) : 12));

    const [sourceRows, creatorRows, creatorChannelRows] = await Promise.all([
      rest(`telegram_sources?select=id,telegram_peer_id,username,title,peer_kind,enabled,last_synced_at,last_success_at,last_error,discovery_priority&enabled=eq.true&peer_kind=eq.channel&order=discovery_priority.desc,last_synced_at.desc.nullslast,created_at.desc&limit=${limit}`),
      rest("creators?select=id,name,username,avatar_url,source_url,verified,is_active&is_active=eq.true"),
      rest("creator_channels?select=id,creator_id,telegram_channel_id,username,is_bot_admin,verified&order=created_at.desc"),
    ]);

    const creatorsByUsername = new Map<string,any>();
    for (const creator of Array.isArray(creatorRows) ? creatorRows : []) {
      const key = String(creator?.username || "").trim().toLowerCase();
      if (key) creatorsByUsername.set(key, creator);
    }

    const channelByCreator = new Map<string,any>();
    for (const channel of Array.isArray(creatorChannelRows) ? creatorChannelRows : []) {
      const creatorId = String(channel?.creator_id || "").trim();
      if (!creatorId) continue;
      const current = channelByCreator.get(creatorId);
      if (!current || (channel?.is_bot_admin === true && current?.is_bot_admin !== true)) channelByCreator.set(creatorId, channel);
    }

    const channels = (Array.isArray(sourceRows) ? sourceRows : []).map((source:any) => {
      const username = String(source?.username || "").trim();
      const creator = creatorsByUsername.get(username.toLowerCase()) || null;
      const creatorChannel = creator?.id ? channelByCreator.get(String(creator.id)) || null : null;
      const trackingAvailable = Boolean(creator?.id && creatorChannel?.id && creatorChannel?.is_bot_admin === true && creatorChannel?.verified === true);
      const fresh = recentEnough(source?.last_synced_at);
      const syncState = !source?.last_synced_at ? "never" : !fresh ? "stale" : source?.last_error ? "partial" : "healthy";

      return {
        source_id: source.id,
        telegram_peer_id: source.telegram_peer_id,
        username,
        title: creator?.name || source.title || username,
        peer_kind: source.peer_kind,
        enabled: source.enabled === true,
        discovery_priority: Number(source.discovery_priority || 0),
        last_synced_at: source.last_synced_at || null,
        last_success_at: source.last_success_at || null,
        sync_ok: fresh,
        sync_state: syncState,
        sync_warning: source.last_error || null,
        creator_id: creator?.id || null,
        creator_channel_id: creatorChannel?.id || null,
        creator_name: creator?.name || source.title || username,
        avatar_url: creator?.avatar_url || null,
        source_url: creator?.source_url || (username ? `https://t.me/${username}` : null),
        verified: creator?.verified === true || creatorChannel?.verified === true,
        bot_admin: creatorChannel?.is_bot_admin === true,
        tracking_available: trackingAvailable,
      };
    });

    return json({ ok:true, source:"telegram_sources", ranking:"priority_then_sync_recency", count:channels.length, channels });
  } catch (error) {
    console.error("discovery-channels-v1", error);
    return json({ ok:false, error:error instanceof Error ? error.message : "Internal server error", channels:[], count:0 }, 500);
  }
});
