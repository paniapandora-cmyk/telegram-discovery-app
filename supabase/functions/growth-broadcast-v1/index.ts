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
const MINI_APP_URL = "https://telegram-discovery-app.paniapandora.workers.dev/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-telegram-init-data, x-request-id",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const out = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

async function hmac(key: ArrayBuffer, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

function constantTime(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function telegramUser(initData: string) {
  if (!BOT_TOKEN || !initData) throw new Error("Telegram initData required");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  const authDate = Number(params.get("auth_date") || 0);
  if (!hash || !authDate) throw new Error("Invalid Telegram initData");
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < -300 || age > 86400) throw new Error("Telegram authorization expired");
  params.delete("hash");
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const encoder = new TextEncoder();
  const secret = await hmac(encoder.encode("WebAppData").buffer, BOT_TOKEN);
  const calculated = Array.from(new Uint8Array(await hmac(secret, check)))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  if (!constantTime(calculated, hash.toLowerCase())) throw new Error("Telegram authorization signature invalid");
  const user = JSON.parse(params.get("user") || "null");
  const id = Number(user?.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Telegram user id missing");
  return user;
}

async function rest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase server credentials are not configured");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.hint || `Supabase REST ${response.status}`);
  return { response, data };
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data } = await rest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
  return data;
}

async function requireOwner(telegramUserId: number) {
  try {
    await rpc("get_bot_owner_stats_v1", { p_telegram_user_id: telegramUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/BOT_OWNER_FORBIDDEN|forbidden/i.test(message)) throw new Error("BOT_OWNER_FORBIDDEN");
    throw error;
  }
}

async function eligibleRecipients() {
  const params = new URLSearchParams({
    select: "telegram_user_id,chat_id",
    opted_in: "eq.true",
    limit: "500",
    order: "updated_at.asc",
  });
  const { data } = await rest(`bot_marketing_preferences?${params.toString()}`);
  return Array.isArray(data) ? data : [];
}

async function sendMessage(chatId: number, message: string) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{
          text: "🚀 باز کردن کشف",
          web_app: { url: MINI_APP_URL },
        }]],
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.description || `Telegram ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "GET" && request.method !== "POST") return out({ ok: false, error: "Method not allowed" }, 405);

    const user = await telegramUser(request.headers.get("x-telegram-init-data") || "");
    const ownerId = Number(user.id);
    await requireOwner(ownerId);

    const recipients = await eligibleRecipients();

    if (request.method === "GET") {
      return out({
        ok: true,
        eligible_recipients: recipients.length,
        policy: "explicit_opt_in_only",
        max_per_campaign: 500,
      });
    }

    const body = await request.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    const confirm = body?.confirm === true;
    if (!message) return out({ ok: false, error: "message_required" }, 400);
    if (message.length > 2000) return out({ ok: false, error: "message_too_long" }, 413);
    if (!confirm) {
      return out({
        ok: true,
        dry_run: true,
        eligible_recipients: recipients.length,
        preview: message,
        note: "Set confirm=true to send only to users who explicitly opted in.",
      });
    }

    const created = await rest("growth_campaigns", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        owner_telegram_user_id: ownerId,
        message,
        status: "sending",
        recipient_count: recipients.length,
      }),
    });
    const campaign = Array.isArray(created.data) ? created.data[0] : created.data;
    const campaignId = String(campaign?.id || "");
    if (!campaignId) throw new Error("campaign_create_failed");

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += 20) {
      const batch = recipients.slice(i, i + 20);
      await Promise.all(batch.map(async (recipient: any) => {
        const telegramUserId = Number(recipient.telegram_user_id);
        const chatId = Number(recipient.chat_id);
        try {
          await sendMessage(chatId, message);
          sent += 1;
          await rest("growth_campaign_deliveries", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              campaign_id: campaignId,
              telegram_user_id: telegramUserId,
              chat_id: chatId,
              status: "sent",
            }),
          });
        } catch (error) {
          failed += 1;
          const errorText = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
          await rest("growth_campaign_deliveries", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              campaign_id: campaignId,
              telegram_user_id: telegramUserId,
              chat_id: chatId,
              status: "failed",
              error: errorText,
            }),
          }).catch(() => {});
          if (/blocked by the user|chat not found|user is deactivated/i.test(errorText)) {
            await rest(`bot_marketing_preferences?telegram_user_id=eq.${telegramUserId}`, {
              method: "PATCH",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({ opted_in: false, updated_at: new Date().toISOString() }),
            }).catch(() => {});
          }
        }
      }));
      if (i + 20 < recipients.length) await sleep(1100);
    }

    await rest(`growth_campaigns?id=eq.${encodeURIComponent(campaignId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: failed === 0 ? "completed" : sent > 0 ? "partial" : "failed",
        sent_count: sent,
        failed_count: failed,
        completed_at: new Date().toISOString(),
      }),
    });

    return out({
      ok: true,
      campaign_id: campaignId,
      eligible_recipients: recipients.length,
      sent,
      failed,
      policy: "explicit_opt_in_only",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /BOT_OWNER_FORBIDDEN/.test(message) ? 403 : /Telegram .*required|authorization|signature|expired|user id/i.test(message) ? 401 : 500;
    console.error("growth-broadcast-v1", message);
    return out({ ok: false, error: message }, status);
  }
});
