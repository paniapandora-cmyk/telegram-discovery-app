/*
 * Telegram Discovery — Bot Owner Analytics v1
 *
 * Owner-only panel for the "Me / Hub" section.
 * The backend validates Telegram initData and returns 403 for non-owners.
 */
(() => {
  "use strict";

  const API =
    "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/bot-owner-analytics-v1";

  const PANEL_ID = "botOwnerAnalyticsV1";
  const STYLE_ID = "botOwnerAnalyticsV1Style";

  const tg = window.Telegram?.WebApp || null;

  let ownerStats = null;
  let loading = false;
  let loaded = false;

  const fa = new Intl.NumberFormat("fa-IR");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{
        margin-top:8px;
        padding:10px;
        border:1px solid #292929;
        border-radius:14px;
        background:#151515;
      }

      #${PANEL_ID} .boa-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-bottom:9px;
      }

      #${PANEL_ID} .boa-title{
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }

      #${PANEL_ID} .boa-icon{
        width:34px;
        height:34px;
        flex:0 0 34px;
        display:grid;
        place-items:center;
        border-radius:11px;
        background:#202020;
        color:#2AABEE;
        font-size:15px;
        font-weight:900;
      }

      #${PANEL_ID} .boa-title b{
        display:block;
        color:#F4F4F4;
        font-size:11px;
        line-height:15px;
      }

      #${PANEL_ID} .boa-title span{
        display:block;
        margin-top:2px;
        color:#7D7D7D;
        font-size:7px;
        line-height:10px;
      }

      #${PANEL_ID} .boa-badge{
        flex:0 0 auto;
        padding:4px 7px;
        border-radius:999px;
        background:rgba(55,201,139,.11);
        color:#49D797;
        font-size:7px;
        font-weight:750;
      }

      #${PANEL_ID} .boa-primary{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr);
        gap:7px;
      }

      #${PANEL_ID} .boa-card{
        min-width:0;
        padding:9px;
        border:1px solid #292929;
        border-radius:11px;
        background:#191919;
      }

      #${PANEL_ID} .boa-card.accent{
        border-color:#253A45;
        background:#141B1F;
      }

      #${PANEL_ID} .boa-card small{
        display:block;
        color:#7F7F7F;
        font-size:7px;
        line-height:10px;
      }

      #${PANEL_ID} .boa-card strong{
        display:block;
        margin-top:5px;
        color:#F5F5F5;
        font-size:21px;
        line-height:22px;
        font-weight:850;
        font-variant-numeric:tabular-nums;
      }

      #${PANEL_ID} .boa-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:6px;
        margin-top:7px;
      }

      #${PANEL_ID} .boa-mini{
        min-width:0;
        padding:7px 5px;
        border-radius:10px;
        background:#111;
        text-align:center;
      }

      #${PANEL_ID} .boa-mini span{
        display:block;
        color:#737373;
        font-size:6.5px;
        line-height:9px;
        white-space:nowrap;
      }

      #${PANEL_ID} .boa-mini b{
        display:block;
        margin-top:4px;
        color:#DADADA;
        font-size:10px;
        line-height:12px;
        font-variant-numeric:tabular-nums;
      }

      #${PANEL_ID} .boa-foot{
        margin-top:8px;
        color:#666;
        font-size:6.5px;
        line-height:10px;
      }

      @media(max-width:340px){
        #${PANEL_ID} .boa-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function loadOwnerStats() {
    if (loading || loaded) return ownerStats;

    loading = true;

    try {
      const initData = tg?.initData || "";
      if (!initData) {
        loaded = true;
        return null;
      }

      const response = await fetch(API, {
        method: "GET",
        headers: {
          "x-telegram-init-data": initData,
          "x-request-id": crypto.randomUUID(),
        },
        cache: "no-store",
      });

      if (response.status === 403 || response.status === 401) {
        loaded = true;
        ownerStats = null;
        return null;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      ownerStats = data;
      loaded = true;
      return ownerStats;
    } catch (error) {
      console.warn("bot-owner-analytics", error);
      return null;
    } finally {
      loading = false;
    }
  }

  function renderPanel(data) {
    const hub = document.querySelector("#grid .hub");
    if (!hub || !data?.stats) return;

    let panel = document.getElementById(PANEL_ID);

    if (!panel) {
      panel = document.createElement("section");
      panel.id = PANEL_ID;

      const hero = hub.querySelector(".hubHero");
      const creatorEntry = hub.querySelector(".v6-hub-creator-entry");

      if (creatorEntry) {
        creatorEntry.insertAdjacentElement("afterend", panel);
      } else if (hero) {
        hero.insertAdjacentElement("afterend", panel);
      } else {
        hub.prepend(panel);
      }
    }

    const stats = data.stats || {};
    const generatedAt = stats.generated_at
      ? new Date(stats.generated_at).toLocaleString("fa-IR")
      : "";

    panel.innerHTML = `
      <div class="boa-head">
        <div class="boa-title">
          <div class="boa-icon">◎</div>
          <div>
            <b>Bot Analytics</b>
            <span>آمار کل کاربران Telegram Discovery</span>
          </div>
        </div>
        <div class="boa-badge">Owner</div>
      </div>

      <div class="boa-primary">
        <div class="boa-card accent">
          <small>کل کاربران یکتا</small>
          <strong>${fa.format(Number(stats.unique_telegram_users || stats.total_users || 0))}</strong>
        </div>

        <div class="boa-card">
          <small>فعال ۳۰ روز</small>
          <strong>${fa.format(Number(stats.active_30d || 0))}</strong>
        </div>
      </div>

      <div class="boa-grid">
        <div class="boa-mini">
          <span>جدید امروز</span>
          <b>${fa.format(Number(stats.new_today || 0))}</b>
        </div>

        <div class="boa-mini">
          <span>جدید ۷ روز</span>
          <b>${fa.format(Number(stats.new_7d || 0))}</b>
        </div>

        <div class="boa-mini">
          <span>جدید ۳۰ روز</span>
          <b>${fa.format(Number(stats.new_30d || 0))}</b>
        </div>

        <div class="boa-mini">
          <span>فعال ۷ روز</span>
          <b>${fa.format(Number(stats.active_7d || 0))}</b>
        </div>

        <div class="boa-mini">
          <span>تعامل ۷ روز</span>
          <b>${fa.format(Number(stats.event_users_7d || 0))}</b>
        </div>

        <div class="boa-mini">
          <span>تعامل ۳۰ روز</span>
          <b>${fa.format(Number(stats.event_users_30d || 0))}</b>
        </div>
      </div>

      ${
        generatedAt
          ? `<div class="boa-foot">آخرین محاسبه: ${escapeHtml(generatedAt)}</div>`
          : ""
      }
    `;
  }

  async function refresh() {
    if (!document.body.classList.contains("mode-hub")) return;

    const data = await loadOwnerStats();
    if (data) renderPanel(data);
  }

  function boot() {
    installStyle();
    void refresh();

    const observer = new MutationObserver(() => {
      if (document.body.classList.contains("mode-hub")) {
        void refresh();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
