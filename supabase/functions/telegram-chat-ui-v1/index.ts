import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const BOT_TOKEN =
  Deno.env.get("TELEGRAM_BOT_TOKEN") ||
  Deno.env.get("DISCOVERY_TELEGRAM_BOT_TOKEN") ||
  "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("DISCOVERY_SUPABASE_SERVICE_ROLE_KEY") ||
  "";

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function activeWebhookSecret() {
  if (WEBHOOK_SECRET) return WEBHOOK_SECRET;
  if (!BOT_TOKEN) return "";
  return sha256(`telegram-webhook:${BOT_TOKEN}`);
}

const MINI_APP_URL = "https://telegram-discovery-app.paniapandora.workers.dev/";
const CORE_URL = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
const MEMBER_URL = `${SUPABASE_URL}/functions/v1/creator-member-attribution-v1`;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const H = { "Content-Type": "application/json" };

async function tg(method: string, body: any) {
  const response = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json?.ok) throw new Error(json?.description || method);
  return json.result;
}

function replyKeyboard() {
  return {
    keyboard: [
      [{ text: "🚀 ورود به مینی‌اپ" }],
      [{ text: "🔥 داغ امروز" }, { text: "🔎 جستجو" }],
      [{ text: "❤️ ذخیره‌ها" }, { text: "📊 کانال من" }],
      [{ text: "📣 معرفی کشف" }, { text: "🔔 دریافت پیشنهادها" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function inlineWebApp(
  share = false,
  appUrl = MINI_APP_URL,
  telegramUrl = "",
) {
  const rows: any[] = [[{
    text: "🚀 ورود به مینی‌اپ",
    web_app: { url: appUrl },
  }]];

  if (telegramUrl && /^https:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i.test(telegramUrl)) {
    rows.push([{ text: "📨 دیدن پست در تلگرام", url: telegramUrl }]);
  }

  if (share) {
    rows.push([{
      text: "📤 معرفی به دوست",
      url: `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent("✨ کشف — بهترین کانال‌ها و پست‌های تلگرام")}`,
    }]);
  }

  return { inline_keyboard: rows };
}

async function cta(
  chatId: number,
  title: string,
  text: string,
  share = false,
  appUrl = MINI_APP_URL,
  telegramUrl = "",
) {
  await tg("sendMessage", {
    chat_id: chatId,
    text: `${title}\n\n${text}`,
    reply_markup: inlineWebApp(share, appUrl, telegramUrl),
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

async function configureChatMenu(chatId: number) {
  await tg("setChatMenuButton", {
    chat_id: chatId,
    menu_button: {
      type: "web_app",
      text: "باز کردن کشف",
      web_app: { url: MINI_APP_URL },
    },
  });
}

async function forward(url: string, update: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = await activeWebhookSecret();
  if (secret) headers["x-telegram-bot-api-secret-token"] = secret;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
  });
  return { status: response.status, text: await response.text() };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!SERVICE_KEY || !SUPABASE_URL) throw new Error("Growth tracking not configured");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || `REST ${response.status}`);
  return data;
}

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
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/bot_start_events?on_conflict=chat_id,message_id`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
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

async function resolveGrowthLink(payload: string) {
  if (!/^g_[A-Za-z0-9_-]{8,50}$/.test(payload)) return null;
  const params = new URLSearchParams({
    select: "token,kind,target_id,metadata,is_active",
    token: `eq.${payload}`,
    is_active: "eq.true",
    limit: "1",
  });
  const rows = await rest(`growth_links?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function setMarketingPreference(userId: number, chatId: number, optedIn: boolean) {
  await fetch(`${SUPABASE_URL}/rest/v1/bot_marketing_preferences?on_conflict=telegram_user_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      telegram_user_id: userId,
      chat_id: chatId,
      opted_in: optedIn,
      updated_at: new Date().toISOString(),
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Marketing preference failed (${response.status})`);
  });
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method !== "POST") return new Response("ok");

    const expectedSecret = await activeWebhookSecret();
    if (!expectedSecret || request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
      return new Response("unauthorized", { status: 401 });
    }

    const update = await request.json();
    await recordPrivateBotStart(update);

    if (update?.chat_member?.chat?.id) {
      const member = await forward(MEMBER_URL, update);
      return new Response(member.text, { status: member.status, headers: H });
    }

    const message = update?.message;
    const chatId = Number(message?.chat?.id);
    const userId = Number(message?.from?.id);
    const text = String(message?.text || "").trim();

    if (message?.chat?.type === "private" && Number.isSafeInteger(chatId)) {
      const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+([\s\S]*))?$/i);

      if (startMatch || /^\/(?:menu|home)(?:@\w+)?$/i.test(text)) {
        await forward(CORE_URL, update);
        await configureChatMenu(chatId);

        const payload = (startMatch?.[1] || "").trim();
        const growth = payload ? await resolveGrowthLink(payload).catch(() => null) : null;

        if (growth) {
          const metadata = growth?.metadata && typeof growth.metadata === "object" ? growth.metadata : {};
          const ref = encodeURIComponent(String(growth.token));

          if (growth.kind === "post") {
            const target = encodeURIComponent(String(growth.target_id || ""));
            const title = String(metadata?.title || "یک پست از کشف برای تو فرستاده شده").slice(0, 180);
            const telegramUrl = String(metadata?.telegram_url || "");
            await cta(
              chatId,
              "📨 یک پیشنهاد برای تو",
              title,
              false,
              `${MINI_APP_URL}?post=${target}&ref=${ref}`,
              telegramUrl,
            );
          } else {
            await cta(
              chatId,
              "✨ دعوت به کشف",
              "به «کشف» دعوت شدی؛ بهترین کانال‌ها و پست‌های تلگرام را یکجا ببین.",
              false,
              `${MINI_APP_URL}?ref=${ref}`,
            );
          }

          await menu(chatId);
          return new Response(JSON.stringify({ ok: true, type: "growth_start", payload }), { headers: H });
        }

        await menu(chatId);
        return new Response(JSON.stringify({ ok: true, type: "start", mini_app_url: MINI_APP_URL }), { headers: H });
      }

      await configureChatMenu(chatId);

      if (text === "🚀 ورود به مینی‌اپ") {
        await cta(chatId, "🚀 ورود به مینی‌اپ", "برای باز کردن Telegram Discovery روی دکمه زیر بزن.");
        return new Response(JSON.stringify({ ok: true, type: "open" }), { headers: H });
      }

      if (text === "🔥 داغ امروز") {
        await cta(chatId, "🔥 داغ امروز", "محبوب‌ترین و تازه‌ترین پست‌ها را داخل «کشف» ببین.");
        return new Response(JSON.stringify({ ok: true }), { headers: H });
      }

      if (text === "🔎 جستجو") {
        await cta(chatId, "🔎 جستجو در تلگرام", "کانال، پست یا موضوع موردنظرت را داخل مینی‌اپ جستجو کن.");
        return new Response(JSON.stringify({ ok: true }), { headers: H });
      }

      if (text === "❤️ ذخیره‌ها") {
        await cta(chatId, "❤️ ذخیره‌های تو", "پست‌های ذخیره‌شده‌ات را داخل مینی‌اپ ببین.");
        return new Response(JSON.stringify({ ok: true }), { headers: H });
      }

      if (text === "📊 کانال من") {
        await cta(chatId, "📊 کانال من", "آمار کانالت را در Creator Center ببین.");
        return new Response(JSON.stringify({ ok: true }), { headers: H });
      }

      if (text === "📣 معرفی کشف") {
        await cta(chatId, "📣 کشف را معرفی کن", "اگر «کشف» برات مفید بوده، برای دوستات هم بفرست.", true);
        return new Response(JSON.stringify({ ok: true }), { headers: H });
      }

      if (text === "🔔 دریافت پیشنهادها") {
        if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid Telegram user");
        await setMarketingPreference(userId, chatId, true);
        await tg("sendMessage", {
          chat_id: chatId,
          text: "🔔 فعال شد. فقط پیشنهادهای خود «کشف» را دریافت می‌کنی. هر زمان خواستی با /stop_promos لغوش کن.",
          reply_markup: replyKeyboard(),
        });
        return new Response(JSON.stringify({ ok: true, type: "promos_opt_in" }), { headers: H });
      }

      if (/^\/stop_promos(?:@\w+)?$/i.test(text)) {
        if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid Telegram user");
        await setMarketingPreference(userId, chatId, false);
        await tg("sendMessage", {
          chat_id: chatId,
          text: "🔕 دریافت پیشنهادهای تبلیغاتی متوقف شد.",
          reply_markup: replyKeyboard(),
        });
        return new Response(JSON.stringify({ ok: true, type: "promos_opt_out" }), { headers: H });
      }

      await menu(chatId);
      return new Response(JSON.stringify({ ok: true, type: "menu" }), { headers: H });
    }

    const core = await forward(CORE_URL, update);
    return new Response(core.text, { status: core.status, headers: H });
  } catch (error) {
    console.error("telegram-chat-ui-v1", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: H },
    );
  }
});
