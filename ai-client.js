/*
 * Telegram Discovery — AI Client v1
 *
 * Exposes:
 *   window.TelegramDiscoveryAI.send(message)
 *
 * The OpenAI API key never reaches the browser. Requests are authenticated
 * with Telegram Mini App initData and handled by Supabase ai-gateway-v1.
 */
(() => {
  "use strict";

  const AI_ENDPOINT =
    "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/ai-gateway-v1";

  const tg = window.Telegram?.WebApp || null;

  async function send(message) {
    const text = String(message ?? "").trim();

    if (!text) {
      throw new Error("پیام خالی است.");
    }

    const initData = tg?.initData || "";

    if (!initData) {
      throw new Error(
        "Telegram initData در دسترس نیست. مینی‌اپ را از داخل تلگرام باز کن."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": initData,
        },
        body: JSON.stringify({ message: text }),
        cache: "no-store",
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        const details =
          data?.provider_message ||
          data?.error ||
          `HTTP ${response.status}`;

        throw new Error(details);
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.TelegramDiscoveryAI = Object.freeze({
    send,
    endpoint: AI_ENDPOINT,
  });

  console.info("Telegram Discovery AI Client v1 loaded");
})();
