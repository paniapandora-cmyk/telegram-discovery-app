/*
 * Telegram Discovery — Telegram Sources Rail
 * Reads the real Discovery channel catalog from /api/discovery/channels,
 * which is backed directly by public.telegram_sources.
 *
 * Load AFTER creator-growth-ui.js.
 */
(() => {
  "use strict";

  const API = "/api/discovery/channels";
  const tg = window.Telegram?.WebApp || null;
  let latestChannels = [];
  let loading = false;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  async function loadChannels() {
    if (loading) return latestChannels;
    loading = true;

    try {
      const headers = new Headers();
      if (tg?.initData) {
        headers.set("x-telegram-init-data", tg.initData);
      }

      const response = await fetch(API, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const raw = await response.text();
      let body = {};

      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }

      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      latestChannels = Array.isArray(body?.channels)
        ? body.channels.filter((channel) => channel?.enabled !== false)
        : [];

      return latestChannels;
    } finally {
      loading = false;
    }
  }

  function openChannel(username, url) {
    const target =
      url ||
      (username ? `https://t.me/${String(username).replace(/^@/, "")}` : "");

    if (!target) return;

    try {
      if (tg?.openTelegramLink && /^https:\/\/t\.me\//i.test(target)) {
        tg.openTelegramLink(target);
        return;
      }
    } catch {}

    window.open(target, "_blank", "noopener,noreferrer");
  }

  function ensureRail() {
    let rail = document.getElementById("v6CreatorRail");
    if (rail) return rail;

    const tabs = document.querySelector(".tabs");
    if (!tabs) return null;

    rail = document.createElement("section");
    rail.id = "v6CreatorRail";
    rail.className = "v6-creator-rail";
    rail.setAttribute("aria-label", "کانال‌های Discovery");

    const addCard = document.getElementById("addChannelCard");
    (addCard || tabs).insertAdjacentElement("afterend", rail);

    return rail;
  }

  function render(channels) {
    const rail = ensureRail();
    if (!rail) return;

    if (!document.body.classList.contains("mode-feed")) {
      return;
    }

    if (!channels.length) {
      rail.innerHTML = "";
      return;
    }

    rail.innerHTML = channels.map((channel, index) => {
      const title =
        channel.title ||
        channel.creator_name ||
        channel.username ||
        "کانال";

      const username = String(channel.username || "").replace(/^@/, "");
      const avatar = channel.avatar_url || "";

      return `
        <article class="v6-creator-card" data-source-channel="${index}">
          ${
            avatar
              ? `<img src="${escapeHtml(avatar)}" alt="">`
              : `<span class="v6-creator-avatar-fallback">${escapeHtml(title.slice(0, 1))}</span>`
          }
          <strong>${escapeHtml(title)}</strong>
          <small>${username ? `@${escapeHtml(username)}` : "کانال تلگرام"}</small>
          <button type="button">مشاهده</button>
        </article>
      `;
    }).join("");

    rail.querySelectorAll("[data-source-channel]").forEach((card) => {
      card.querySelector("button")?.addEventListener("click", () => {
        const channel = channels[Number(card.dataset.sourceChannel)];
        if (!channel) return;
        openChannel(channel.username, channel.source_url);
      });
    });
  }

  async function refresh() {
    try {
      render(await loadChannels());
    } catch (error) {
      console.warn("telegram-sources-rail", error);
    }
  }

  function boot() {
    void refresh();

    const observer = new MutationObserver(() => {
      if (latestChannels.length) {
        render(latestChannels);
      } else {
        void refresh();
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("focus", () => {
      void refresh();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
