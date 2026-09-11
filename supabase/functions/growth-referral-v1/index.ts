import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("DISCOVERY_SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const BOT_TOKEN =
  Deno.env.get("TELEGRAM_BOT_TOKEN") ||
  Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN") ||
  "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-telegram-init-data, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256(key: Uint8Array, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function validateTelegramInitData(initData: string) {
  if (!BOT_TOKEN || !initData) return { ok: false, error: "telegram_auth_missing", user: null as any };
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  const authDate = Number(params.get("auth_date") || "0");
  if (!receivedHash || !Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: "telegram_auth_invalid", user: null as any };
  }
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < -300 || ageSeconds > 86400) {
    return { ok: false, error: "telegram_auth_expired", user: null as any };
  }
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), BOT_TOKEN);
  const calculated = bytesToHex(await hmacSha256(secretKey, dataCheckString));
  if (!constantTimeEqual(calculated, receivedHash.toLowerCase())) {
    return { ok: false, error: "telegram_auth_invalid", user: null as any };
  }
  let user: any = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch { user = null; }
  const telegramUserId = Number(user?.id);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    return { ok: false, error: "telegram_user_missing", user: null as any };
  }
  return { ok: true, user, error: null as any };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("growth_backend_not_configured");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.message || body?.hint || body?.details || `rest_${response.status}`;
    const error = new Error(String(message)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return { response, body };
}

async function countRows(resource: string) {
  const separator = resource.includes("?") ? "&" : "?";
  const { response } = await rest(`${resource}${separator}select=*`, {
    method: "GET",
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  const range = response.headers.get("content-range") || "";
  const total = Number(range.split("/")[1] || "0");
  return Number.isFinite(total) ? total : 0;
}

async function botIdentity() {
  if (!BOT_TOKEN) throw new Error("telegram_bot_not_configured");
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.result?.username) {
    throw new Error(data?.description || "telegram_bot_identity_failed");
  }
  return data.result as { id: number; username: string };
}

function tokenValue() {
  return `g_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

async function findLink(ownerId: number, kind: "invite" | "post", targetId?: string) {
  const params = new URLSearchParams({
    select: "id,token,owner_telegram_user_id,kind,target_id,source,metadata,is_active,created_at",
    owner_telegram_user_id: `eq.${ownerId}`,
    kind: `eq.${kind}`,
    is_active: "eq.true",
    limit: "1",
  });
  if (targetId) params.set("target_id", `eq.${targetId}`);
  const { body } = await rest(`growth_links?${params.toString()}`);
  return Array.isArray(body) ? body[0] || null : null;
}

async function createLink(
  ownerId: number,
  kind: "invite" | "post",
  targetId: string | null,
  metadata: Record<string, unknown>,
) {
  const existing = await findLink(ownerId, kind, targetId || undefined);
  if (existing) return existing;
  const row = {
    token: tokenValue(),
    owner_telegram_user_id: ownerId,
    kind,
    target_id: targetId,
    source: "miniapp",
    metadata,
  };
  try {
    const { body } = await rest("growth_links", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    return Array.isArray(body) ? body[0] : body;
  } catch (error) {
    if ((error as any)?.status === 409) {
      const raced = await findLink(ownerId, kind, targetId || undefined);
      if (raced) return raced;
    }
    throw error;
  }
}

async function invitationStats(ownerId: number, token: string) {
  const params = new URLSearchParams({
    select: "telegram_user_id,occurred_at",
    start_payload: `eq.${token}`,
    order: "occurred_at.desc",
    limit: "5000",
  });
  const { body } = await rest(`bot_start_events?${params.toString()}`);
  const starters = Array.isArray(body) ? body : [];
  const unique = new Set<number>();
  for (const row of starters) {
    const id = Number(row?.telegram_user_id);
    if (Number.isSafeInteger(id) && id > 0 && id !== ownerId) unique.add(id);
  }
  const shareParams = new URLSearchParams({ token: `eq.${token}`, event_type: "eq.share" });
  const openParams = new URLSearchParams({ token: `eq.${token}`, event_type: "eq.miniapp_open" });
  const [shares, opens] = await Promise.all([
    countRows(`growth_events?${shareParams.toString()}`),
    countRows(`growth_events?${openParams.toString()}`),
  ]);
  return {
    successful_invites: unique.size,
    bot_starts: starters.length,
    share_clicks: shares,
    miniapp_opens: opens,
  };
}

async function recordEvent(
  ownerId: number,
  token: string,
  eventType: "share" | "miniapp_open",
  sessionId: string | null,
  metadata: Record<string, unknown> = {},
  requireOwner = false,
) {
  const params = new URLSearchParams({
    select: "token,owner_telegram_user_id",
    token: `eq.${token}`,
    is_active: "eq.true",
    limit: "1",
  });
  const { body } = await rest(`growth_links?${params.toString()}`);
  const link = Array.isArray(body) ? body[0] : null;
  if (!link) throw new Error("growth_link_not_found");
  if (requireOwner && Number(link.owner_telegram_user_id) !== ownerId) throw new Error("growth_link_forbidden");
  await rest("growth_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      token,
      event_type: eventType,
      actor_telegram_user_id: ownerId,
      session_id: sessionId?.slice(0, 128) || null,
      metadata,
    }),
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const auth = await validateTelegramInitData(req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const ownerId = Number(auth.user.id);
    const bot = await botIdentity();

    if (req.method === "GET") {
      const invite = await createLink(ownerId, "invite", null, { username: auth.user?.username || null });
      const [stats, activeUsers, botStarts, sources, contents] = await Promise.all([
        invitationStats(ownerId, invite.token),
        countRows("users?is_active=eq.true"),
        countRows("bot_start_events"),
        countRows("telegram_sources?enabled=eq.true"),
        countRows("contents"),
      ]);
      return json({
        ok: true,
        invite: {
          token: invite.token,
          url: `https://t.me/${bot.username}?start=${encodeURIComponent(invite.token)}`,
          ...stats,
        },
        social_proof: {
          active_users: activeUsers,
          bot_starts: botStarts,
          active_sources: sources,
          contents,
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (action === "create_post_link") {
      const postId = String(body?.post_id || "").trim().slice(0, 200);
      if (!postId) return json({ ok: false, error: "post_id_required" }, 400);
      const title = String(body?.title || "").trim().slice(0, 240);
      const telegramUrl = String(body?.telegram_url || "").trim().slice(0, 600);
      const link = await createLink(ownerId, "post", postId, { title, telegram_url: telegramUrl || null });
      return json({
        ok: true,
        token: link.token,
        url: `https://t.me/${bot.username}?start=${encodeURIComponent(link.token)}`,
      }, 201);
    }

    if (action === "share") {
      const token = String(body?.token || "").trim();
      if (!/^g_[A-Za-z0-9_-]{8,50}$/.test(token)) return json({ ok: false, error: "invalid_token" }, 400);
      await recordEvent(ownerId, token, "share", String(body?.session_id || "") || null, {}, true);
      return json({ ok: true });
    }

    if (action === "open_ref") {
      const token = String(body?.token || "").trim();
      if (!/^g_[A-Za-z0-9_-]{8,50}$/.test(token)) return json({ ok: false, error: "invalid_token" }, 400);
      await recordEvent(ownerId, token, "miniapp_open", String(body?.session_id || "") || null, { source: "miniapp" }, false);
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (error) {
    console.error("growth-referral-v1", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
