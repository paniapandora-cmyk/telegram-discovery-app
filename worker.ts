import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions";

interface Env {
  ASSETS: Fetcher;

  TELEGRAM_API_ID: string;
  TELEGRAM_API_HASH: string;
  TELEGRAM_STRING_SESSION: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function telegramHealth(env: Env): Promise<Response> {
  const missing: string[] = [];

  // فقط وجود Secretها را بررسی می‌کنیم.
  // مقدار واقعی آنها هرگز در Response یا Log نمایش داده نمی‌شود.
  if (!env.TELEGRAM_API_ID?.trim()) {
    missing.push("TELEGRAM_API_ID");
  }

  if (!env.TELEGRAM_API_HASH?.trim()) {
    missing.push("TELEGRAM_API_HASH");
  }

  if (!env.TELEGRAM_STRING_SESSION?.trim()) {
    missing.push("TELEGRAM_STRING_SESSION");
  }

  if (missing.length > 0) {
    return json(
      {
        ok: false,
        error: "Telegram Cloudflare secrets are not configured",
        missing,
      },
      500,
    );
  }

  const apiId = Number(env.TELEGRAM_API_ID);

  if (!Number.isInteger(apiId) || apiId <= 0) {
    return json(
      {
        ok: false,
        error: "TELEGRAM_API_ID is invalid",
      },
      500,
    );
  }

  const apiHash = env.TELEGRAM_API_HASH.trim();
  const session = env.TELEGRAM_STRING_SESSION.trim();

  const client = new TelegramClient(
    new StringSession(session),
    apiId,
    apiHash,
    {
      connectionRetries: 2,
      autoReconnect: false,
    },
  );

  try {
    await client.connect();

    const authorized = await client.checkAuthorization();

    if (!authorized) {
      return json(
        {
          ok: false,
          authorized: false,
          error: "Telegram session is not authorized",
        },
        401,
      );
    }

    const me = await client.getMe();

    return json({
      ok: true,
      authorized: true,
      telegram_user_id: me?.id?.toString() ?? null,
      telegram_username: me?.username ?? null,
    });
  } catch (error) {
    console.error("Telegram health error", error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Telegram connection failed",
      },
      500,
    );
  } finally {
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors.
    }
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

        return json(
          {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Telegram connection failed",
          },
          500,
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
