import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

declare const Deno: any;

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WEBHOOK_SECRET =
  Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

const db = createClient(
  SUPABASE_URL,
  SERVICE_KEY,
);

const HEADERS = {
  "content-type": "application/json",
};

const out = (
  body: unknown,
  status = 200,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: HEADERS,
  });

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

function isMember(member: any) {
  const status = String(
    member?.status || "",
  );

  return (
    [
      "member",
      "administrator",
      "creator",
    ].includes(status) ||
    (
      status === "restricted" &&
      member?.is_member === true
    )
  );
}

async function creatorEvent(
  referral: any,
  eventType: "JOIN" | "LEAVE",
  update: any,
) {
  const channel = await db
    .from("creator_channels")
    .select(
      "id,creator_user_id,creator_id",
    )
    .eq(
      "id",
      referral.creator_channel_id,
    )
    .maybeSingle();

  if (channel.error) throw channel.error;
  if (!channel.data?.id) return;

  const event = await db
    .from("creator_events")
    .upsert(
      {
        creator_channel_id:
          channel.data.id,
        creator_user_id:
          channel.data.creator_user_id,
        creator_id:
          referral.creator_id ||
          channel.data.creator_id,
        content_id:
          referral.content_id || null,
        viewer_user_id:
          referral.user_id || null,
        telegram_user_id: Number(
          referral.telegram_user_id,
        ),
        event_type: eventType,
        source: "telegram_webhook",
        idempotency_key:
          `${eventType.toLowerCase()}:` +
          `${referral.id}:` +
          `${eventType === "JOIN"
            ? "joined"
            : update?.update_id || Date.now()}`,
        metadata: {
          referral_id: referral.id,
          telegram_update_id:
            update?.update_id ?? null,
          verified: true,
        },
      },
      {
        onConflict: "idempotency_key",
        ignoreDuplicates: true,
      },
    );

  if (event.error) throw event.error;
}

async function latestClickedReferral(
  chatId: number,
  telegramUserId: number,
  inviteUrl: string,
) {
  let creatorChannelId = "";

  if (inviteUrl) {
    const inviteHash =
      await sha256(inviteUrl);

    const tracking = await db
      .from(
        "creator_channel_tracking_links",
      )
      .select("creator_channel_id")
      .eq("invite_link_hash", inviteHash)
      .eq("is_active", true)
      .maybeSingle();

    if (tracking.error) {
      throw tracking.error;
    }

    creatorChannelId =
      tracking.data?.creator_channel_id ||
      "";
  }

  let query = db
    .from("creator_referrals")
    .select(
      "id,creator_channel_id,creator_id,content_id,user_id,telegram_user_id,telegram_chat_id,status,joined_at,left_at,expires_at,metadata",
    )
    .eq("telegram_chat_id", chatId)
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "CLICKED")
    .gte(
      "expires_at",
      new Date().toISOString(),
    )
    .order("clicked_at", {
      ascending: false,
    })
    .limit(1);

  if (creatorChannelId) {
    query = query.eq(
      "creator_channel_id",
      creatorChannelId,
    );
  }

  const result = await query.maybeSingle();

  if (result.error) throw result.error;

  return result.data;
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method !== "POST") {
      return out({ ok: true });
    }

    if (
      WEBHOOK_SECRET &&
      request.headers.get(
        "x-telegram-bot-api-secret-token",
      ) !== WEBHOOK_SECRET
    ) {
      return out(
        {
          ok: false,
          error: "Unauthorized",
        },
        401,
      );
    }

    const update = await request.json();
    const member = update?.chat_member;

    if (!member?.chat?.id) {
      return out({
        ok: true,
        type: "ignored",
      });
    }

    const chatId = Number(
      member.chat.id,
    );

    const telegramUserId = Number(
      member?.new_chat_member?.user?.id ||
      member?.old_chat_member?.user?.id,
    );

    if (
      !Number.isSafeInteger(chatId) ||
      !Number.isSafeInteger(
        telegramUserId,
      )
    ) {
      return out({
        ok: true,
        type: "invalid_member_update",
      });
    }

    const joined =
      !isMember(member.old_chat_member) &&
      isMember(member.new_chat_member);

    const left =
      isMember(member.old_chat_member) &&
      !isMember(member.new_chat_member);

    const now = new Date().toISOString();

    if (joined) {
      const inviteUrl = String(
        member?.invite_link?.invite_link ||
        "",
      );

      const referral =
        await latestClickedReferral(
          chatId,
          telegramUserId,
          inviteUrl,
        );

      if (!referral?.id) {
        return out({
          ok: true,
          type: "join_unattributed",
        });
      }

      const updated = await db
        .from("creator_referrals")
        .update({
          status: "JOINED",
          joined_at:
            referral.joined_at || now,
          left_at: null,
          last_checked_at: now,
          updated_at: now,
          metadata: {
            ...(referral.metadata || {}),
            joined_via:
              inviteUrl
                ? "stable_tracking_invite"
                : "latest_tracked_click",
            telegram_update_id:
              update?.update_id ?? null,
          },
        })
        .eq("id", referral.id);

      if (updated.error) {
        throw updated.error;
      }

      await creatorEvent(
        referral,
        "JOIN",
        update,
      );

      return out({
        ok: true,
        type: "join_attributed",
        referral_id: referral.id,
      });
    }

    if (left) {
      const referral = await db
        .from("creator_referrals")
        .select(
          "id,creator_channel_id,creator_id,content_id,user_id,telegram_user_id,telegram_chat_id,status,metadata",
        )
        .eq("telegram_chat_id", chatId)
        .eq(
          "telegram_user_id",
          telegramUserId,
        )
        .eq("status", "JOINED")
        .order("joined_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (referral.error) {
        throw referral.error;
      }

      if (!referral.data?.id) {
        return out({
          ok: true,
          type: "leave_unattributed",
        });
      }

      const updated = await db
        .from("creator_referrals")
        .update({
          status: "LEFT",
          left_at: now,
          last_checked_at: now,
          updated_at: now,
        })
        .eq("id", referral.data.id);

      if (updated.error) {
        throw updated.error;
      }

      await creatorEvent(
        referral.data,
        "LEAVE",
        update,
      );

      return out({
        ok: true,
        type: "leave_attributed",
        referral_id:
          referral.data.id,
      });
    }

    return out({
      ok: true,
      type: "member_status_unchanged",
    });
  } catch (error) {
    console.error(
      "creator-member-attribution-v1",
      error,
    );

    return out(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
    );
  }
});
