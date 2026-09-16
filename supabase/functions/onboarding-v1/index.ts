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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(signature);
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
  const check = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), BOT_TOKEN);
  const calculated = bytesToHex(await hmacSha256(secretKey, check));
  if (!constantTimeEqual(calculated, receivedHash.toLowerCase())) {
    return { ok: false, error: "telegram_auth_invalid", user: null as any };
  }

  let user: any = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }

  const telegramUserId = Number(user?.id);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    return { ok: false, error: "telegram_user_missing", user: null as any };
  }

  return { ok: true, error: null as any, user };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("onboarding_backend_not_configured");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.hint || `rest_${response.status}`);
  return data;
}

async function rpc(name: string, args: Record<string, unknown>) {
  return rest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

async function currentUser(telegram: any) {
  const displayName = [telegram.first_name, telegram.last_name].filter(Boolean).join(" ") || telegram.username || null;
  const rows = await rest("users?on_conflict=telegram_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      telegram_user_id: Number(telegram.id),
      username: telegram.username || null,
      display_name: displayName,
      is_active: true,
      updated_at: new Date().toISOString(),
    }),
  });
  const user = Array.isArray(rows) ? rows[0] : rows;
  if (!user?.id) throw new Error("user_upsert_failed");
  return user;
}

async function onboardingState(user: any) {
  const [topics, selected] = await Promise.all([
    rest("topics?select=id,name,slug,description&order=name.asc"),
    rest(`user_interests?select=topic_id,weight&user_id=eq.${encodeURIComponent(user.id)}`),
  ]);
  const selectedIds = new Set((Array.isArray(selected) ? selected : []).map((row: any) => String(row.topic_id)));
  return {
    onboarding_done: Boolean(user.onboarding_done),
    selected_count: selectedIds.size,
    topics: (Array.isArray(topics) ? topics : []).map((topic: any) => ({
      ...topic,
      selected: selectedIds.has(String(topic.id)),
    })),
  };
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (request.method !== "GET" && request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    const auth = await validateTelegramInitData(request.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const user = await currentUser(auth.user);

    if (request.method === "GET") {
      return json({ ok: true, ...(await onboardingState(user)) });
    }

    const body = await request.json().catch(() => ({}));
    const skip = body?.skip === true;
    const topicIds = [...new Set(
      (Array.isArray(body?.topic_ids) ? body.topic_ids : [])
        .map((value: unknown) => String(value))
        .filter(isUuid),
    )].slice(0, 7);

    if (Boolean(user.onboarding_done)) {
      return json({ ok: true, onboarding_done: true, already_complete: true });
    }

    if (!skip && (topicIds.length < 3 || topicIds.length > 6)) {
      return json({ ok: false, error: "سه تا شش موضوع انتخاب کن" }, 400);
    }

    if (topicIds.length) {
      const rows = await rest(`topics?select=id&id=in.(${topicIds.join(",")})`);
      const valid = new Set((Array.isArray(rows) ? rows : []).map((row: any) => String(row.id)));
      if (valid.size !== topicIds.length) {
        return json({ ok: false, error: "موضوع انتخاب‌شده معتبر نیست" }, 400);
      }
      await rpc("set_user_interests_v1", {
        p_user_id: user.id,
        p_topic_ids: topicIds,
      });
    }

    await rest(`users?id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      }),
    });

    await rest("growth_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        token: null,
        event_type: skip ? "onboarding_skip" : "onboarding_complete",
        actor_telegram_user_id: Number(auth.user.id),
        session_id: String(body?.session_id || "").slice(0, 128) || null,
        metadata: { selected_topics: topicIds.length },
      }),
    }).catch(() => {});

    return json({
      ok: true,
      onboarding_done: true,
      skipped: skip,
      selected_count: topicIds.length,
    });
  } catch (error) {
    console.error("onboarding-v1", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
