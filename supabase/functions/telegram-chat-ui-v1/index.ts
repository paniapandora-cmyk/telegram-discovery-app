import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "";

const BOT_TOKEN =
  Deno.env.get("TELEGRAM_BOT_TOKEN") ||
  Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN") ||
  "";

const WEBHOOK_SECRET =
  Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function activeWebhookSecret() {
  if (WEBHOOK_SECRET) return WEBHOOK_SECRET;
  if (!BOT_TOKEN) return "";
  return sha256(`telegram-webhook:${BOT_TOKEN}`);
}

const MINI_APP_URL =
  "https://telegram-discovery-app.paniapandora.workers.dev/";

const CORE_URL =
  `${SUPABASE_URL}/functions/v1/telegram-webhook`;

const MEMBER_URL =
  `${SUPABASE_URL}/functions/v1/creator-member-attribution-v1`;

const TG =
  `https://api.telegram.org/bot${BOT_TOKEN}`;

const H = {
  "Content-Type": "application/json",
};

async function tg(
  method: string,
  body: any,
) {
  const response = await fetch(
    `${TG}/${method}`,
    {
      method: "POST",
      headers: H,
      body: JSON.stringify(body),
    },
  );

  const json = await response.json();

  if (!json?.ok) {
    throw new Error(
      json?.description || method,
    );
  }

  return json.result;
}

function replyKeyboard() {
  return {
    keyboard: [
      [{ text: "🚀 ورود به مینی‌اپ" }],
      [
        { text: "🔥 داغ امروز" },
        { text: "🔎 جستجو" },
      ],
      [
        { text: "❤️ ذخیره‌ها" },
        { text: "📊 کانال من" },
      ],
      [{ text: "📣 معرفی کشف" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function inlineWebApp(share = false) {
  const rows: any[] = [
    [
      {
        text: "🚀 ورود به مینی‌اپ",
        web_app: {
          url: MINI_APP_URL,
        },
      },
    ],
  ];

  if (share) {
    rows.push([
      {
        text: "📤 معرفی به دوست",
        url:
          `https://t.me/share/url?url=` +
          `${encodeURIComponent(MINI_APP_URL)}` +
          `&text=` +
          `${encodeURIComponent(
            "✨ کشف — بهترین کانال‌ها و پست‌های تلگرام",
          )}`,
      },
    ]);
  }

  return {
    inline_keyboard: rows,
  };
}

async function cta(
  chatId: number,
  title: string,
  text: string,
  share = false,
) {
  await tg("sendMessage", {
    chat_id: chatId,
    text: `${title}\n\n${text}`,
    reply_markup: inlineWebApp(share),
    disable_web_page_preview: true,
  });
}

async function menu(chatId: number) {
  await tg("sendMessage", {
    chat_id: chatId,
    text: "از دکمه‌های پایین استفاده کن 👇",
    reply_markup: replyKeyboard(),
  });
}

async function configureChatMenu(
  chatId: number,
) {
  await tg("setChatMenuButton", {
    chat_id: chatId,
    menu_button: {
      type: "web_app",
      text: "باز کردن کشف",
      web_app: {
        url: MINI_APP_URL,
      },
    },
  });
}

async function forward(
  url: string,
  update: any,
) {
  const headers: Record<
    string,
    string
  > = {
    "Content-Type": "application/json",
  };

  const secret = await activeWebhookSecret();
  if (secret) {
    headers[
      "x-telegram-bot-api-secret-token"
    ] = secret;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
  });

  return {
    status: response.status,
    text: await response.text(),
  };
}

const START_SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("DISCOVERY_SUPABASE_SERVICE_ROLE_KEY") || "";

async function recordPrivateBotStart(update: any) {
  const message = update?.message;
  const match = String(message?.text || "").trim()
    .match(/^\/start(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (message?.chat?.type !== "private" || !match || message?.from?.is_bot) return;
  const userId = Number(message?.from?.id);
  const chatId = Number(message?.chat?.id);
  const messageId = Number(message?.message_id);
  const updateId = Number(update?.update_id);
  const sentAt = Number(message?.date);
  if (![userId, chatId, messageId, updateId, sentAt].every(Number.isSafeInteger) ||
      userId <= 0 || messageId <= 0 || sentAt <= 0) {
    throw new Error("Invalid bot start update");
  }
  if (!START_SERVICE_KEY || !SUPABASE_URL) throw new Error("Start tracking not configured");
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/bot_start_events?on_conflict=chat_id,message_id`,
    {
      method: "POST",
      headers: {
        apikey: START_SERVICE_KEY,
        Authorization: `Bearer ${START_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        telegram_update_id: updateId,
        telegram_user_id: userId,
        start_payload: (match[1] || "").trim().slice(0, 512) || null,
        occurred_at: new Date(sentAt * 1000).toISOString(),
      }),
    },
  );
  if (!response.ok) throw new Error(`Bot start recording failed (${response.status})`);
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method !== "POST") {
      return new Response("ok");
    }

    const expectedSecret =
      await activeWebhookSecret();

    if (
      !expectedSecret ||
      request.headers.get(
        "x-telegram-bot-api-secret-token",
      ) !== expectedSecret
    ) {
      return new Response(
        "unauthorized",
        { status: 401 },
      );
    }

    const update = await request.json();
    await recordPrivateBotStart(update);

    // Membership attribution must be handled first.
    if (update?.chat_member?.chat?.id) {
      const member = await forward(
        MEMBER_URL,
        update,
      );

      return new Response(
        member.text,
        {
          status: member.status,
          headers: H,
        },
      );
    }

    const message = update?.message;
    const chatId = Number(
      message?.chat?.id,
    );
    const text = String(
      message?.text || "",
    ).trim();

    if (
      message?.chat?.type === "private" &&
      Number.isSafeInteger(chatId)
    ) {
      if (
        /^\/start(?:@\w+)?(?:\s+.*)?$/i.test(
          text,
        ) ||
        /^\/(?:menu|home)(?:@\w+)?$/i.test(
          text,
        )
      ) {
        await forward(
          CORE_URL,
          update,
        );

        await configureChatMenu(
          chatId,
        );

        await menu(chatId);

        return new Response(
          JSON.stringify({
            ok: true,
            type: "start",
            mini_app_url: MINI_APP_URL,
          }),
          { headers: H },
        );
      }

      await configureChatMenu(chatId);

      if (text === "🚀 ورود به مینی‌اپ") {
        await cta(
          chatId,
          "🚀 ورود به مینی‌اپ",
          "برای باز کردن Telegram Discovery روی دکمه زیر بزن.",
        );

        return new Response(
          JSON.stringify({
            ok: true,
            type: "open",
          }),
          { headers: H },
        );
      }

      if (text === "🔥 داغ امروز") {
        await cta(
          chatId,
          "🔥 داغ امروز",
          "محبوب‌ترین و تازه‌ترین پست‌ها را داخل «کشف» ببین.",
        );

        return new Response(
          JSON.stringify({ ok: true }),
          { headers: H },
        );
      }

      if (text === "🔎 جستجو") {
        await cta(
          chatId,
          "🔎 جستجو در تلگرام",
          "کانال، پست یا موضوع موردنظرت را داخل مینی‌اپ جستجو کن.",
        );

        return new Response(
          JSON.stringify({ ok: true }),
          { headers: H },
        );
      }

      if (text === "❤️ ذخیره‌ها") {
        await cta(
          chatId,
          "❤️ ذخیره‌های تو",
          "پست‌های ذخیره‌شده‌ات را داخل مینی‌اپ ببین.",
        );

        return new Response(
          JSON.stringify({ ok: true }),
          { headers: H },
        );
      }

      if (text === "📊 کانال من") {
        await cta(
          chatId,
          "📊 کانال من",
          "آمار کانالت را در Creator Center ببین.",
        );

        return new Response(
          JSON.stringify({ ok: true }),
          { headers: H },
        );
      }

      if (text === "📣 معرفی کشف") {
        await cta(
          chatId,
          "📣 کشف را معرفی کن",
          "اگر «کشف» برات مفید بوده، برای دوستات هم بفرست.",
          true,
        );

        return new Response(
          JSON.stringify({ ok: true }),
          { headers: H },
        );
      }

      await menu(chatId);

      return new Response(
        JSON.stringify({
          ok: true,
          type: "menu",
        }),
        { headers: H },
      );
    }

    const core = await forward(
      CORE_URL,
      update,
    );

    return new Response(
      core.text,
      {
        status: core.status,
        headers: H,
      },
    );
  } catch (error) {
    console.error(
      "telegram-chat-ui-v1",
      error,
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,
        headers: H,
      },
    );
  }
});
