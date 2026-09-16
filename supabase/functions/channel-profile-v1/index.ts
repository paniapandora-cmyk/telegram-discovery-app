import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DISCOVERY_SUPABASE_SERVICE_ROLE_KEY") || "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-telegram-init-data, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)));
}
async function validateTelegramInitData(initData: string) {
  if (!BOT_TOKEN || !initData) return { ok: false, error: "telegram_auth_missing", user: null as any };
  const params = new URLSearchParams(initData);
  const receivedHash = (params.get("hash") || "").toLowerCase();
  const authDate = Number(params.get("auth_date") || "0");
  if (!receivedHash || !Number.isFinite(authDate) || authDate <= 0) return { ok: false, error: "telegram_auth_invalid", user: null as any };
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < -300 || ageSeconds > 86400) return { ok: false, error: "telegram_auth_expired", user: null as any };
  params.delete("hash");
  const check = Array.from(params.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("\n");
  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), BOT_TOKEN);
  const calculated = bytesToHex(await hmacSha256(secretKey, check));
  if (!constantTimeEqual(calculated, receivedHash)) return { ok: false, error: "telegram_auth_invalid", user: null as any };
  let user: any = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch { user = null; }
  const telegramUserId = Number(user?.id);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) return { ok: false, error: "telegram_user_missing", user: null as any };
  return { ok: true, error: null, user };
}
async function rest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("channel_profile_backend_not_configured");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(body?.message || body?.hint || body?.details || `rest_${response.status}`);
  return body;
}
async function ensureUser(user: any) {
  const body = await rest("users?on_conflict=telegram_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      telegram_user_id: Number(user.id),
      username: user.username || null,
      display_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }),
  });
  const row = Array.isArray(body) ? body[0] : body;
  if (!row?.id) throw new Error("user_upsert_failed");
  return String(row.id);
}
async function profile(userId: string, creatorId: string, limit = 18) {
  const raw = await rest("rpc/get_channel_profile_v1", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_creator_id: creatorId, p_limit: limit }),
  });
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.found) return null;
  return value;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    const auth = await validateTelegramInitData(req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);
    const userId = await ensureUser(auth.user);
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const creatorId = String(body?.creator_id || url.searchParams.get("creator_id") || "").trim();
    if (!UUID.test(creatorId)) return json({ ok: false, error: "valid_creator_id_required" }, 400);

    if (req.method === "POST") {
      const action = String(body?.action || "follow");
      if (action !== "follow") return json({ ok: false, error: "unknown_action" }, 400);
      const following = body?.following !== false;
      const creatorRows = await rest(`creators?select=id&is_active=eq.true&id=eq.${encodeURIComponent(creatorId)}&limit=1`);
      if (!Array.isArray(creatorRows) || !creatorRows.length) return json({ ok: false, error: "creator_not_found" }, 404);
      if (following) {
        await rest("follows?on_conflict=user_id,creator_id", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({ user_id: userId, creator_id: creatorId }),
        });
      } else {
        await rest(`follows?user_id=eq.${encodeURIComponent(userId)}&creator_id=eq.${encodeURIComponent(creatorId)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
      }
    }

    const limit = Math.max(1, Math.min(40, Number(url.searchParams.get("limit") || body?.limit || 18) || 18));
    const data = await profile(userId, creatorId, limit);
    if (!data) return json({ ok: false, error: "creator_not_found" }, 404);
    return json({ ok: true, ...data });
  } catch (error) {
    console.error("channel-profile-v1", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
