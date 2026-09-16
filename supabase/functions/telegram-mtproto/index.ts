import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const API_ID = Number(Deno.env.get("TELEGRAM_API_ID") ?? "0");
const API_HASH = Deno.env.get("TELEGRAM_API_HASH") ?? "";
const SESSION = Deno.env.get("TELEGRAM_STRING_SESSION") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (!API_ID || !API_HASH) {
      return json({
        ok: false,
        error: "Telegram API credentials are not configured"
      }, 500);
    }

    if (!SESSION) {
      return json({
        ok: false,
        error: "Telegram session is not configured"
      }, 500);
    }

    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean).pop();

    if (req.method === "GET" && path === "health") {
      const client = new TelegramClient(
        new StringSession(SESSION),
        API_ID,
        API_HASH,
        {
          connectionRetries: 2
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

    return json({
      ok: false,
      error: "Not found"
    }, 404);

  } catch (error) {
    console.error(error);

    return json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : "Internal error"
    }, 500);
  }
});
