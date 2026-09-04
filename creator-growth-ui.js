/*
 * Telegram Discovery — Creator Growth UI v1
 * Add this file beside index.html and load it with:
 * <script src="./creator-growth-ui.js" defer></script>
 *
 * This file intentionally does not change Discovery Feed/Search/Explore.
 * It adds a self-contained Creator Center overlay and uses the existing
 * Cloudflare Worker /api/creator/* proxy.
 */
(() => {
  "use strict";

  const API_BASE = "/api/creator";
  const tg = window.Telegram?.WebApp || null;

  const state = {
    channels: [],
    analytics: [],
    selectedChannelId: "",
    content: [],
    days: 30,
    busy: false
  };

  const fmt = new Intl.NumberFormat("fa-IR");
  const pct = value => `${(Number(value || 0) * 100).toLocaleString("fa-IR", {
    maximumFractionDigits: 1
  })}٪`;

  function initData() {
    return tg?.initData || "";
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    const data = initData();
    if (data) headers.set("x-telegram-init-data", data);

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    const raw = await response.text();
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = { error: raw || "پاسخ نامعتبر از سرور" };
    }

    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || `HTTP ${response.status}`);
    }
    return body;
  }

  const host = document.createElement("div");
  host.id = "creatorGrowthRoot";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      button,input,select{font:inherit}
      .cg-fab{
        position:fixed;z-index:2147483000;left:16px;bottom:94px;
        min-height:48px;padding:0 16px;border:1px solid rgba(140,198,242,.28);
        border-radius:18px;color:#fff;background:linear-gradient(145deg,#168fdf,#735eea);
        box-shadow:0 14px 34px rgba(0,0,0,.34);font:700 13px system-ui;cursor:pointer
      }
      .cg-backdrop{
        position:fixed;z-index:2147483001;inset:0;display:none;
        background:rgba(1,7,14,.72);backdrop-filter:blur(8px)
      }
      .cg-backdrop.open{display:block}
      .cg-panel{
        position:absolute;inset:auto 0 0;max-height:92dvh;overflow:auto;
        direction:rtl;color:#f5f8fc;background:#071523;
        border:1px solid rgba(153,195,231,.16);border-radius:28px 28px 0 0;
        box-shadow:0 -20px 60px rgba(0,0,0,.45);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif
      }
      .cg-wrap{width:min(100%,720px);margin:auto;padding:18px 16px 30px}
      .cg-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .cg-title{font-weight:850;font-size:20px}
      .cg-sub{margin-top:4px;color:#92a7ba;font-size:12px}
      .cg-close{
        width:44px;height:44px;border:1px solid rgba(153,195,231,.18);
        border-radius:15px;color:#dbe8f3;background:#102238;cursor:pointer
      }
      .cg-card{
        margin:12px 0;padding:14px;border:1px solid rgba(153,195,231,.16);
        border-radius:20px;background:linear-gradient(145deg,#0e2032,#091624)
      }
      .cg-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .cg-input,.cg-select{
        min-height:44px;border:1px solid rgba(153,195,231,.18);border-radius:14px;
        color:#f5f8fc;background:#081827;padding:0 12px;outline:0
      }
      .cg-input{flex:1;min-width:180px}
      .cg-btn{
        min-height:44px;padding:0 14px;border:0;border-radius:14px;
        color:#fff;background:#168fdf;font-weight:750;cursor:pointer
      }
      .cg-btn.secondary{background:#152b43;color:#bcd0e2;border:1px solid rgba(153,195,231,.16)}
      .cg-btn:disabled{opacity:.55;cursor:wait}
      .cg-channels{display:flex;gap:8px;overflow:auto;padding-bottom:4px}
      .cg-chip{
        flex:0 0 auto;min-height:42px;padding:0 13px;border:1px solid rgba(153,195,231,.16);
        border-radius:999px;color:#bcd0e2;background:#0a1928;cursor:pointer
      }
      .cg-chip.active{color:#fff;border-color:#4bb4f4;background:#12314a}
      .cg-badge{font-size:10px;color:#54dca0;margin-inline-start:5px}
      .cg-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}
      .cg-metric{
        padding:12px;border:1px solid rgba(153,195,231,.13);border-radius:16px;
        background:rgba(255,255,255,.025)
      }
      .cg-metric span{display:block;color:#8fa5b9;font-size:11px}
      .cg-metric b{display:block;margin-top:5px;font-size:19px}
      .cg-table{display:grid;gap:8px}
      .cg-item{
        padding:12px;border:1px solid rgba(153,195,231,.13);border-radius:16px;
        background:rgba(255,255,255,.022)
      }
      .cg-item-title{font-weight:750;line-height:1.6}
      .cg-item-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}
      .cg-item-meta div{padding:7px;border-radius:10px;background:#081827;text-align:center}
      .cg-item-meta span{display:block;color:#8097ac;font-size:9px}
      .cg-item-meta b{font-size:12px}
      .cg-empty{padding:20px;text-align:center;color:#8fa5b9}
      .cg-error{margin:9px 0;color:#ff8e9f;font-size:12px;line-height:1.7}
      .cg-success{margin:9px 0;color:#54dca0;font-size:12px;line-height:1.7}
      .cg-loader{padding:24px;text-align:center;color:#8fa5b9}
      @media(min-width:560px){
        .cg-panel{inset:5dvh max(12px,calc((100vw - 760px)/2)) auto;border-radius:28px;max-height:90dvh}
        .cg-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}
      }
    </style>

    <button class="cg-fab" type="button" id="cgOpen">Creator Center</button>

    <div class="cg-backdrop" id="cgBackdrop">
      <section class="cg-panel" role="dialog" aria-modal="true" aria-label="Creator Center">
        <div class="cg-wrap">
          <div class="cg-top">
            <div>
              <div class="cg-title">Creator Center</div>
              <div class="cg-sub">آمار رشد، کلیک تلگرام و عضویت‌های قابل انتساب</div>
            </div>
            <button class="cg-close" id="cgClose" type="button">✕</button>
          </div>

          <div class="cg-card">
            <div class="cg-row">
              <input class="cg-input" id="cgUsername" inputmode="text"
                placeholder="نام کاربری کانال، مثال: hoviateman">
              <button class="cg-btn" id="cgAdd" type="button">افزودن کانال</button>
            </div>
            <div id="cgMessage"></div>
          </div>

          <div class="cg-card">
            <div class="cg-row" style="justify-content:space-between">
              <b>کانال‌های من</b>
              <select class="cg-select" id="cgDays">
                <option value="7">۷ روز</option>
                <option value="30" selected>۳۰ روز</option>
                <option value="90">۹۰ روز</option>
                <option value="365">۱ سال</option>
              </select>
            </div>
            <div class="cg-channels" id="cgChannels" style="margin-top:12px"></div>
          </div>

          <div id="cgBody"><div class="cg-loader">در حال بارگذاری…</div></div>
        </div>
      </section>
    </div>
  `;

  const $ = id => root.getElementById(id);
  const backdrop = $("cgBackdrop");
  const body = $("cgBody");
  const message = $("cgMessage");

  function showMessage(text, ok = false) {
    message.className = ok ? "cg-success" : "cg-error";
    message.textContent = text || "";
  }

  function metric(label, value) {
    return `<div class="cg-metric"><span>${label}</span><b>${value}</b></div>`;
  }

  function selectedAnalytics() {
    return state.analytics.find(x => x.channel_id === state.selectedChannelId) || null;
  }

  function renderChannels() {
    const box = $("cgChannels");
    if (!state.channels.length) {
      box.innerHTML = `<div class="cg-empty">هنوز کانالی ثبت نشده است.</div>`;
      return;
    }
    box.innerHTML = state.channels.map(ch => `
      <button type="button" class="cg-chip ${ch.id === state.selectedChannelId ? "active" : ""}"
        data-channel="${ch.id}">
        ${escapeHtml(ch.title || ch.username || "کانال")}
        ${ch.verified ? '<span class="cg-badge">✓ تایید</span>' : ""}
      </button>
    `).join("");

    box.querySelectorAll("[data-channel]").forEach(btn => {
      btn.addEventListener("click", async () => {
        state.selectedChannelId = btn.dataset.channel || "";
        renderChannels();
        await refreshAnalyticsAndContent();
      });
    });
  }

  function renderDashboard() {
    const a = selectedAnalytics();
    if (!a) {
      body.innerHTML = `<div class="cg-card cg-empty">برای دیدن آمار، یک کانال اضافه یا انتخاب کن.</div>`;
      return;
    }

    body.innerHTML = `
      <div class="cg-card">
        <div class="cg-row" style="justify-content:space-between">
          <div>
            <b>${escapeHtml(a.title || a.username || "کانال")}</b>
            <div class="cg-sub">@${escapeHtml(a.username || "")}</div>
          </div>
          <button type="button" class="cg-btn secondary" id="cgTracking">ساخت لینک Tracking</button>
        </div>
        <div class="cg-metrics">
          ${metric("نمایش", fmt.format(a.impressions || 0))}
          ${metric("کلیک تلگرام", fmt.format(a.clicks_telegram || 0))}
          ${metric("Start ربات", fmt.format(a.starts_bot || 0))}
          ${metric("عضویت", fmt.format(a.joins || 0))}
          ${metric("CTR", pct(a.ctr))}
          ${metric("نرخ عضویت", pct(a.join_rate))}
          ${metric("Save", fmt.format(a.saves || 0))}
          ${metric("خروج", fmt.format(a.leaves || 0))}
        </div>
      </div>

      <div class="cg-card">
        <div class="cg-row" style="justify-content:space-between;margin-bottom:10px">
          <b>عملکرد محتوا</b>
          <span class="cg-sub">${state.days.toLocaleString("fa-IR")} روز اخیر</span>
        </div>
        <div class="cg-table">
          ${state.content.length ? state.content.map(item => `
            <div class="cg-item">
              <div class="cg-item-title">${escapeHtml(item.title || "بدون عنوان")}</div>
              <div class="cg-item-meta">
                <div><span>Views</span><b>${fmt.format(item.views || 0)}</b></div>
                <div><span>Clicks</span><b>${fmt.format(item.clicks || 0)}</b></div>
                <div><span>Starts</span><b>${fmt.format(item.starts || 0)}</b></div>
                <div><span>Joins</span><b>${fmt.format(item.joins || 0)}</b></div>
                <div><span>Save</span><b>${fmt.format(item.saves || 0)}</b></div>
                <div><span>CTR</span><b>${pct(item.ctr)}</b></div>
                <div><span>Join Rate</span><b>${pct(item.join_rate)}</b></div>
              </div>
            </div>
          `).join("") : `<div class="cg-empty">برای این بازه هنوز داده محتوایی ثبت نشده است.</div>`}
        </div>
      </div>
    `;

    root.getElementById("cgTracking")?.addEventListener("click", createTrackingLink);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadChannels() {
    const result = await api("/channels");
    state.channels = Array.isArray(result.channels) ? result.channels : [];
    if (!state.selectedChannelId && state.channels[0]) {
      state.selectedChannelId = state.channels[0].id;
    }
    if (state.selectedChannelId && !state.channels.some(c => c.id === state.selectedChannelId)) {
      state.selectedChannelId = state.channels[0]?.id || "";
    }
    renderChannels();
  }

  async function refreshAnalyticsAndContent() {
    if (!state.selectedChannelId) {
      state.analytics = [];
      state.content = [];
      renderDashboard();
      return;
    }

    body.innerHTML = `<div class="cg-loader">در حال دریافت آمار…</div>`;
    try {
      const [analytics, content] = await Promise.all([
        api(`/analytics?channel_id=${encodeURIComponent(state.selectedChannelId)}&days=${state.days}`),
        api(`/content-performance?channel_id=${encodeURIComponent(state.selectedChannelId)}&days=${state.days}&limit=50`)
      ]);
      state.analytics = Array.isArray(analytics.channels) ? analytics.channels : [];
      state.content = Array.isArray(content.items) ? content.items : [];
      renderDashboard();
    } catch (error) {
      body.innerHTML = `<div class="cg-card cg-error">${escapeHtml(error.message || error)}</div>`;
    }
  }

  async function refreshAll() {
    try {
      await loadChannels();
      await refreshAnalyticsAndContent();
    } catch (error) {
      body.innerHTML = `<div class="cg-card cg-error">${escapeHtml(error.message || error)}</div>`;
    }
  }

  async function addChannel() {
    const button = $("cgAdd");
    const input = $("cgUsername");
    const username = input.value.trim().replace(/^@/, "");
    if (!username) {
      showMessage("نام کاربری کانال را وارد کن.");
      return;
    }

    button.disabled = true;
    showMessage("");
    try {
      const result = await api("/channel/add", {
        method: "POST",
        body: JSON.stringify({ username })
      });
      showMessage(
        result.bot_admin
          ? "کانال ثبت و دسترسی ربات تایید شد."
          : "کانال ثبت شد؛ برای شمارش دقیق Join ربات را ادمین کانال کن.",
        true
      );
      input.value = "";
      await refreshAll();
    } catch (error) {
      showMessage(error.message || String(error));
    } finally {
      button.disabled = false;
    }
  }

  async function createTrackingLink() {
    const button = root.getElementById("cgTracking");
    if (!state.selectedChannelId || !button) return;

    button.disabled = true;
    try {
      const result = await api("/tracking-link", {
        method: "POST",
        body: JSON.stringify({
          channel_id: state.selectedChannelId,
          source: "creator_center"
        })
      });

      const url = result.url || "";
      if (!url) throw new Error("لینک Tracking ساخته نشد.");

      try {
        await navigator.clipboard.writeText(url);
        button.textContent = "کپی شد ✓";
      } catch {
        tg?.openTelegramLink?.(url);
        button.textContent = "باز شد ✓";
      }
      setTimeout(() => { button.textContent = "ساخت لینک Tracking"; }, 1800);
    } catch (error) {
      showMessage(error.message || String(error));
    } finally {
      button.disabled = false;
    }
  }

  $("cgOpen").addEventListener("click", async () => {
    backdrop.classList.add("open");
    tg?.expand?.();
    await refreshAll();
  });

  $("cgClose").addEventListener("click", () => {
    backdrop.classList.remove("open");
  });

  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) backdrop.classList.remove("open");
  });

  $("cgAdd").addEventListener("click", addChannel);
  $("cgUsername").addEventListener("keydown", event => {
    if (event.key === "Enter") addChannel();
  });

  $("cgDays").addEventListener("change", async event => {
    state.days = Number(event.target.value || 30);
    await refreshAnalyticsAndContent();
  });

  tg?.ready?.();
})();
