import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BOT_TOKEN =
  Deno.env.get("TELEGRAM_BOT_TOKEN") ||
  Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN") ||
  "";
const WEBHOOK_SECRET =
  Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

const ACTIVE_WEBHOOK_URL =
  `${SUPABASE_URL}/functions/v1/telegram-chat-ui-v1`;

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const db = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-request-id",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

let webhookReadyUntil = 0;

const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: CORS,
  });

async function callTelegram(
  method: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    throw new Error(
      String(
        data?.description ||
          `Telegram ${method} failed`,
      ),
    );
  }

  return data.result;
}

async function ensureMemberUpdates() {
  if (Date.now() < webhookReadyUntil) return;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Telegram webhook secret is not configured",
    );
  }

  await callTelegram("setWebhook", {
    url: ACTIVE_WEBHOOK_URL,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: [
      "message",
      "my_chat_member",
      "chat_member",
      "channel_post",
      "edited_channel_post",
    ],
    drop_pending_updates: false,
  });

  webhookReadyUntil = Date.now() + 10 * 60 * 1000;
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(bytes))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

async function telegramUser(initData: string) {
  if (!BOT_TOKEN) {
    throw new Error(
      "Telegram bot secret is not configured",
    );
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(
    params.get("auth_date") || 0,
  );

  if (!hash || !authDate) {
    throw new Error("Invalid Telegram initData");
  }

  if (
    Math.floor(Date.now() / 1000) - authDate >
    86400
  ) {
    throw new Error(
      "Telegram authorization expired",
    );
  }

  params.delete("hash");

  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const encoder = new TextEncoder();

  const hmac = async (
    key: ArrayBuffer,
    message: string,
  ) => {
    const cryptoKey =
      await crypto.subtle.importKey(
        "raw",
        key,
        {
          name: "HMAC",
          hash: "SHA-256",
        },
        false,
        ["sign"],
      );

    return crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(message),
    );
  };

  const secret = await hmac(
    encoder.encode("WebAppData").buffer,
    BOT_TOKEN,
  );

  const calculated = Array.from(
    new Uint8Array(
      await hmac(secret, checkString),
    ),
  )
    .map((value) =>
      value.toString(16).padStart(2, "0")
    )
    .join("");

  const constantTime = (a: string, b: string) => {
    if (a.length !== b.length) return false;

    let diff = 0;

    for (let i = 0; i < a.length; i++) {
      diff |=
        a.charCodeAt(i) ^
        b.charCodeAt(i);
    }

    return diff === 0;
  };

  if (!constantTime(calculated, hash)) {
    throw new Error(
      "Telegram authorization signature invalid",
    );
  }

  const raw = params.get("user");
  if (!raw) {
    throw new Error("Telegram user data missing");
  }

  const user = JSON.parse(raw);

  if (!user?.id) {
    throw new Error("Telegram user id missing");
  }

  return user;
}

async function currentUser(request: Request) {
  const initData =
    request.headers.get("x-telegram-init-data") || "";

  if (!initData) {
    throw new Error("Telegram initData required");
  }

  const telegram = await telegramUser(initData);

  const displayName =
    [telegram.first_name, telegram.last_name]
      .filter(Boolean)
      .join(" ") ||
    telegram.username ||
    null;

  const { data, error } = await db
    .from("users")
    .upsert(
      {
        telegram_user_id: Number(telegram.id),
        username: telegram.username ?? null,
        display_name: displayName,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "telegram_user_id",
      },
    )
    .select("id,telegram_user_id")
    .single();

  if (error) throw error;

  return data;
}

async function stableTrackingLink(channel: any) {
  const existing = await db
    .from("creator_channel_tracking_links")
    .select(
      "creator_channel_id,creator_id,telegram_chat_id,invite_link_hash,invite_link_name,invite_url,is_active",
    )
    .eq("creator_channel_id", channel.id)
    .eq("is_active", true)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data?.invite_url) {
    return existing.data;
  }

  const name =
    `td_channel_${String(channel.id)
      .replaceAll("-", "")
      .slice(0, 20)}`;

  const invite = await callTelegram(
    "createChatInviteLink",
    {
      chat_id: Number(
        channel.telegram_channel_id,
      ),
      name,
      creates_join_request: false,
    },
  );

  const inviteUrl = String(
    invite?.invite_link || "",
  );

  if (
    !/^https:\/\/t\.me\/(?:\+|joinchat\/)/i.test(
      inviteUrl,
    )
  ) {
    throw new Error(
      "Telegram did not return a valid invite link",
    );
  }

  const record = {
    creator_channel_id: channel.id,
    creator_id: channel.creator_id,
    telegram_chat_id: Number(
      channel.telegram_channel_id,
    ),
    invite_link_hash: await sha256(inviteUrl),
    invite_link_name: name,
    invite_url: inviteUrl,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const saved = await db
    .from("creator_channel_tracking_links")
    .upsert(record, {
      onConflict: "creator_channel_id",
    })
    .select()
    .single();

  if (saved.error) throw saved.error;

  return saved.data;
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS,
      });
    }

    if (request.method !== "POST") {
      return out(
        { ok: false, error: "POST required" },
        405,
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));

    const user = await currentUser(request);

    const creatorId = String(
      body?.creator_id || "",
    ).trim();

    const contentId = String(
      body?.content_id || "",
    ).trim();

    if (
      !/^[0-9a-f-]{36}$/i.test(creatorId)
    ) {
      return out(
        {
          ok: false,
          error: "creator_id required",
        },
        400,
      );
    }

    const creator = await db
      .from("creators")
      .select("id,name,username,is_active")
      .eq("id", creatorId)
      .eq("is_active", true)
      .maybeSingle();

    if (creator.error) throw creator.error;

    if (!creator.data?.id) {
      return out(
        {
          ok: false,
          error: "Creator not found",
        },
        404,
      );
    }

    if (contentId) {
      const content = await db
        .from("contents")
        .select("id")
        .eq("id", contentId)
        .eq("creator_id", creatorId)
        .maybeSingle();

      if (content.error) throw content.error;

      if (!content.data?.id) {
        return out(
          {
            ok: false,
            error:
              "Content does not belong to creator",
          },
          400,
        );
      }
    }

    const channels = await db
      .from("creator_channels")
      .select(
        "id,creator_user_id,creator_id,telegram_channel_id,username,title,is_bot_admin,verified,updated_at",
      )
      .eq("creator_id", creatorId)
      .eq("is_bot_admin", true)
      .order("verified", {
        ascending: false,
      })
      .order("updated_at", {
        ascending: false,
      })
      .limit(1);

    if (channels.error) throw channels.error;

    const channel = channels.data?.[0];

    if (!channel?.id) {
      return out(
        {
          ok: false,
          error:
            "Bot Admin is required for tracked joins",
        },
        409,
      );
    }

    await ensureMemberUpdates();

    const tracking =
      await stableTrackingLink(channel);

    const bucket = Math.floor(
      Date.now() / 3000,
    );

    const clickKey =
      `${channel.id}:` +
      `${contentId || "channel"}:` +
      `${bucket}`;

    const existing = await db
      .from("creator_referrals")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("click_key", clickKey)
      .maybeSingle();

    if (existing.error) throw existing.error;

    if (!existing.data?.id) {
      const expiresAt = new Date(
        Date.now() +
          7 * 24 * 60 * 60 * 1000,
      );

      const inserted = await db
        .from("creator_referrals")
        .insert({
          creator_channel_id: channel.id,
          creator_id: creatorId,
          content_id: contentId || null,
          user_id: user.id,
          telegram_user_id: Number(
            user.telegram_user_id,
          ),
          telegram_chat_id: Number(
            channel.telegram_channel_id,
          ),
          invite_link_hash:
            tracking.invite_link_hash,
          invite_link_name:
            tracking.invite_link_name,
          status: "CLICKED",
          expires_at: expiresAt.toISOString(),
          source: String(
            body?.source || "discovery",
          ),
          click_key: clickKey,
          metadata: {
            stable_channel_tracking: true,
            source: String(
              body?.source || "discovery",
            ),
          },
        })
        .select("id")
        .single();

      if (inserted.error) {
        if (
          !String(
            inserted.error.message || "",
          )
            .toLowerCase()
            .includes("duplicate")
        ) {
          throw inserted.error;
        }
      } else if (inserted.data?.id) {
        const event = await db
          .from("creator_events")
          .upsert(
            {
              creator_channel_id:
                channel.id,
              creator_user_id:
                channel.creator_user_id,
              creator_id: creatorId,
              content_id:
                contentId || null,
              viewer_user_id: user.id,
              telegram_user_id: Number(
                user.telegram_user_id,
              ),
              event_type:
                "CLICK_TELEGRAM",
              source: String(
                body?.source ||
                  "discovery",
              ),
              idempotency_key:
                `refclick:${inserted.data.id}`,
              metadata: {
                referral_id:
                  inserted.data.id,
              },
            },
            {
              onConflict:
                "idempotency_key",
              ignoreDuplicates: true,
            },
          );

        if (event.error) {
          console.error(
            "creator click event",
            event.error,
          );
        }
      }
    }

    return out(
      {
        ok: true,
        invite_url: tracking.invite_url,
        tracking: "automatic",
        creator_channel_id: channel.id,
      },
      201,
    );
  } catch (error) {
    console.error(
      "creator-referral-v2",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const status =
      /initData|authorization|signature|expired/i.test(
        message,
      )
        ? 401
        : 500;

    return out(
      {
        ok: false,
        error: message,
      },
      status,
    );
  }
});
