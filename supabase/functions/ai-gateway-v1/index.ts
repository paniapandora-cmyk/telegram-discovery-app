import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkHoviatMembership } from '../_shared/hoviat.ts';

declare const Deno: any;

const GEMINI_API_KEY = (Deno.env.get("GEMINI_API_KEY") || "").trim();
const GEMINI_MODEL = (Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash").trim();
const BOT_TOKEN =
  Deno.env.get("TELEGRAM_BOT_TOKEN") ||
  Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN") ||
  "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-telegram-init-data",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
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
  if (!BOT_TOKEN || !initData) return { ok: false, error: "telegram_auth_missing" };

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  const authDate = Number(params.get("auth_date") || "0");
  if (!receivedHash || !Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: "telegram_auth_invalid" };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < -300 || ageSeconds > 86400) {
    return { ok: false, error: "telegram_auth_expired" };
  }

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const webAppDataKey = new TextEncoder().encode("WebAppData");
  const secretKey = await hmacSha256(webAppDataKey, BOT_TOKEN);
  const calculated = bytesToHex(await hmacSha256(secretKey, dataCheckString));

  if (!constantTimeEqual(calculated, receivedHash.toLowerCase())) {
    return { ok: false, error: "telegram_auth_invalid" };
  }

  let user: unknown = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }
  return { ok: true, user };
}

function extractOutputText(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.filter((part: any) => !part.thought && typeof part.text === "string")
    .map((part: any) => part.text).join("").trim();
}

function providerError(status: number, payload: any) {
  const invalidKey = payload?.error?.details?.some?.((detail: any) => detail?.reason === "API_KEY_INVALID");
  const [error, message] = invalidKey || status === 401
    ? ["gemini_key_invalid", "کلید جمینای معتبر نیست؛ مدیر برنامه باید کلید را بررسی کند."]
    : status === 403
    ? ["gemini_access_denied", "دسترسی سرویس به جمینای تأیید نشد؛ مدیر برنامه باید مجوز کلید و دسترسی منطقه را بررسی کند."]
    : status === 429
    ? ["gemini_rate_limit", "سهمیه یا ظرفیت درخواست‌های جمینای به حد مجاز رسیده است؛ بعداً دوباره امتحان کن."]
    : status === 404
    ? ["gemini_model_unavailable", "مدل جمینای در دسترس نیست؛ مدیر برنامه باید تنظیم مدل را بررسی کند."]
    : status === 503
    ? ["gemini_busy", "مدل‌های جمینای فعلاً شلوغ‌اند؛ کمی بعد دوباره امتحان کن."]
    : ["gemini_provider_error", "جمینای نتوانست پاسخ بدهد؛ کمی بعد دوباره امتحان کن."];
  // Return only controlled messages; upstream errors can contain sensitive details.
  return json({ ok: false, error, provider_status: status, provider_message: message }, status === 429 ? 429 : 502);
}

// Both defaults have a free tier. Retry only temporary server failures, never
// authentication/quota failures. The two attempts fit inside the UI's 45s timeout.
async function requestGemini(message: string) {
  const models = [GEMINI_MODEL, GEMINI_MODEL === "gemini-3.7-flash" ? "gemini-3.8-flash" : "gemini-3.7-flash"];
  const body = JSON.stringify({
    store: false,
    systemInstruction: { parts: [{ text:
      "You are the AI assistant inside Telegram Discovery. Answer the user's message directly and concisely in the user's language. Do not claim access to project posts or tools. Each request is independent; ask for any missing text needed to summarize."
    }] },
    contents: [{ role: "user", parts: [{ text: message }] }],
    generationConfig: { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "LOW" } },
  });
  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[attempt];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(attempt === 0 ? 12000 : 16000),
    });
    const payload = await response.json().catch(() => ({}));
    if (attempt === 0 && [500, 502, 503, 504].includes(response.status)) {
      console.warn("Gemini retry", response.status);
      continue;
    }
    return { response, payload, model };
  }
  throw new Error("gemini_unavailable");
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    if (req.method === "GET") {
      return json({
        ok: true,
        service: "ai-gateway-v1",
        provider: "gemini",
        gemini_configured: Boolean(GEMINI_API_KEY),
        telegram_auth_configured: Boolean(BOT_TOKEN),
        model: GEMINI_MODEL,
      });
    }

    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

    if (!GEMINI_API_KEY) {
      return json({ ok: false, error: "gemini_not_configured", provider_message: "کلید جمینای در تنظیمات سرور ثبت نشده است." }, 503);
    }

    const initData = req.headers.get("x-telegram-init-data") || "";
    const auth = await validateTelegramInitData(initData);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    if (!message) return json({ ok: false, error: "message is required" }, 400);
    if (message.length > 8000) return json({ ok: false, error: "message too long" }, 413);

    const userId = Number((auth.user as any)?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) return json({ ok: false, error: 'telegram_auth_invalid' }, 401);
    if (!await checkHoviatMembership(BOT_TOKEN, userId)) return json({ ok: false, error: 'membership_required' }, 403);
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('DISCOVERY_SUPABASE_SERVICE_ROLE_KEY') || '';
    const quotaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/discovery_access_v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ p_user_id: userId, p_verify: true, p_consume_ai: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!quotaResponse.ok) return json({ ok: false, error: 'quota_check_unavailable' }, 503);
    const access = await quotaResponse.json();
    if (!access.allowed) return json({ ok: false, error: 'ai_daily_limit', access }, 429);

    const { response, payload, model } = await requestGemini(message);
    if (!response.ok) {
      console.error("Gemini error", response.status);
      return providerError(response.status, payload);
    }

    const text = extractOutputText(payload);
    if (!text) return json({ ok: false, error: "gemini_empty_response", provider_message: "جمینای پاسخی برای این پیام تولید نکرد؛ سؤال را با بیان دیگری بفرست." }, 502);

    return json({
      ok: true,
      reply: text,
      model: payload?.modelVersion || model,
      response_id: payload?.responseId || null,
      user: (auth as any).user || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'membership_check_unavailable') return json({ ok: false, error: 'membership_check_unavailable' }, 503);
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error("ai-gateway-v1", timedOut ? "timeout" : "request_failed");
    return json({
      ok: false,
      error: timedOut ? "gemini_timeout" : "ai_request_failed",
      provider_message: timedOut ? "پاسخ‌گویی جمینای طول کشید؛ دوباره امتحان کن." : "ارتباط با سرویس دستیار برقرار نشد؛ دوباره تلاش کن.",
    }, timedOut ? 504 : 500);
  }
});
