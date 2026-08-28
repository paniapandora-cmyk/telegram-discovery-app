import { TelegramClient } from "npm:teleproto@1.229.0";
import { StringSession } from "npm:teleproto@1.229.0/sessions";

interface Env {
  ASSETS: Fetcher;
  TELEGRAM_API_ID: string;
  TELEGRAM_API_HASH: string;
  TELEGRAM_STRING_SESSION: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function telegramHealth(env: Env) {
  const apiId = Number(env.TELEGRAM_API_ID);
  const apiHash = env.TELEGRAM_API_HASH;
  const session = env.TELEGRAM_STRING_SESSION;

  if (!apiId  !apiHash  !session) {
    return json({
      ok: false,
      error: "Telegram Cloudflare secrets are not configured"
    }, 500);
  }

  const client = new TelegramClient(
    new StringSession(session),
    apiId,
    apiHash,
    {
      connectionRetries: 2,
      autoReconnect: false
    }
  );

  try {
    await client.connect();

    const authorized = await client.checkAuthorization();

    if (!authorized) {
      return json({
        ok: false,
        authorized: false
      }, 401);
    }

    const me = await client.getMe();

    return json({
      ok: true,
      authorized: true,
      telegram_user_id: me?.id?.toString() ?? null,
      telegram_username: me?.username ?? null
    });
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/telegram/health") {
      try {
        return await telegramHealth(env);
      } catch (error) {
        console.error("Telegram health error", error);

        return json({
          ok: false,
          error: error instanceof Error
            ? error.message
            : "Telegram connection failed"
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
