import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5";
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
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content?.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    if (req.method === "GET") {
      return json({
        ok: true,
        service: "ai-gateway-v1",
        openai_configured: Boolean(OPENAI_API_KEY),
        telegram_auth_configured: Boolean(BOT_TOKEN),
        model: OPENAI_MODEL,
      });
    }

    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

    if (!OPENAI_API_KEY) {
      return json({ ok: false, error: "OPENAI_API_KEY is not configured" }, 503);
    }

    const initData = req.headers.get("x-telegram-init-data") || "";
    const auth = await validateTelegramInitData(initData);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    if (!message) return json({ ok: false, error: "message is required" }, 400);
    if (message.length > 8000) return json({ ok: false, error: "message too long" }, 413);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        instructions:
          "You are the AI assistant inside Telegram Discovery. For now, answer the user's message directly in the user's language. Do not claim access to project data or tools unless they are explicitly provided later.",
        input: message,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("OpenAI error", response.status, payload?.error?.type || "unknown");
      return json({
        ok: false,
        error: "ai_provider_error",
        provider_status: response.status,
        provider_message: payload?.error?.message || null,
      }, 502);
    }

    const text = extractOutputText(payload);
    if (!text) return json({ ok: false, error: "empty_ai_response" }, 502);

    return json({
      ok: true,
      reply: text,
      model: payload?.model || OPENAI_MODEL,
      response_id: payload?.id || null,
      user: (auth as any).user || null,
    });
  } catch (error) {
    console.error("ai-gateway-v1", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
