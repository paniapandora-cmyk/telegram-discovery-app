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

const MINI_APP_URL =
  "https://telegram-discovery-react-preview.pages.dev/";

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

  if (WEBHOOK_SECRET) {
    headers[
      "x-telegram-bot-api-secret-token"
    ] = WEBHOOK_SECRET;
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

Deno.serve(async (request: Request) => {
  try {
    if (request.method !== "POST") {
      return new Response("ok");
    }

    if (
      WEBHOOK_SECRET &&
      request.headers.get(
        "x-telegram-bot-api-secret-token",
      ) !== WEBHOOK_SECRET
    ) {
      return new Response(
        "unauthorized",
        { status: 401 },
      );
    }

    const update = await request.json();

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
