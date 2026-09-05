/*
 * Telegram Discovery — Creator Center v3
 * Dense / Deep / Premium creator analytics UI.
 * Keeps "Add Channel to Discovery" separate from Creator Center.
 * Compatible with current /api/creator/* routes and /api/add-channel.
 */
(() => {
  "use strict";

  const tg = window.Telegram?.WebApp || null;
  const CREATOR_API = "/api/creator";
  const ADD_CHANNEL_API = "/api/add-channel";

  const S = {
    channels: [],
    selectedChannelId: "",
    days: 30,
    dashboard: null,
    content: [],
    loading: false
  };

  const fmt = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const percent = v => {
    const n = num(v);
    const normalized = n > 1 ? n : n * 100;
    return `${normalized.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
  };

  function initData() {
    return tg?.initData || "";
  }

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    const data = initData();
    if (data) headers.set("x-telegram-init-data", data);

    const res = await fetch(url, { ...options, headers });
    const raw = await res.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; }
    catch { body = { error: raw || "پاسخ نامعتبر از سرور" }; }

    if (!res.ok || body?.ok === false) {
      const err = new Error(body?.error || body?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  const api = (path, options) => request(`${CREATOR_API}${path}`, options);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function firstDefined(obj, keys, fallback = 0) {
    if (!obj || typeof obj !== "object") return fallback;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return fallback;
  }

  function normalizeDashboard(raw) {
    const d = raw?.dashboard || raw?.data || raw?.analytics || raw?.summary || raw || {};
    const m = d?.metrics || d?.totals || d;

    return {
      title: firstDefined(d, ["title", "channel_title", "name"], ""),
      username: firstDefined(d, ["username", "channel_username"], ""),
      views: num(firstDefined(m, ["views", "impressions", "total_views"])),
      uniqueViewers: num(firstDefined(m, ["unique_viewers", "unique_views", "unique_users"])),
      telegramOpens: num(firstDefined(m, ["telegram_opens", "opens", "open_count"])),
      joinClicks: num(firstDefined(m, ["join_clicks", "clicks_telegram", "telegram_clicks", "clicks"])),
      telegramJoins: num(firstDefined(m, ["telegram_joins", "joins", "join_count"])),
      activeJoins: num(firstDefined(m, ["active_joins", "active_members", "current_joins"])),
      leaves: num(firstDefined(m, ["leaves", "leave_count"])),
      saves: num(firstDefined(m, ["saves", "save_count"])),
      botStarts: num(firstDefined(m, ["starts_bot", "bot_starts", "starts"])),
      conversion: firstDefined(m, ["join_conversion_rate", "join_rate", "conversion_rate", "conversion"], 0),
      ctr: firstDefined(m, ["ctr", "click_through_rate"], 0),
      range7: d?.last_7_days || d?.days_7 || d?.range_7d || null,
      range30: d?.last_30_days || d?.days_30 || d?.range_30d || null,
      raw
    };
  }

  function normalizeContent(raw) {
    const list =
      raw?.items ||
      raw?.content ||
      raw?.contents ||
      raw?.rows ||
      raw?.data ||
      [];
    if (!Array.isArray(list)) return [];
    return list.map(item => ({
      id: item.id || item.content_id || "",
      title: item.title || item.text || item.caption || "بدون عنوان",
      views: num(firstDefined(item, ["views", "impressions"])),
      unique: num(firstDefined(item, ["unique_viewers", "unique_views"])),
      opens: num(firstDefined(item, ["telegram_opens", "opens"])),
      clicks: num(firstDefined(item, ["join_clicks", "clicks_telegram", "clicks"])),
      joins: num(firstDefined(item, ["telegram_joins", "joins"])),
      active: num(firstDefined(item, ["active_joins"])),
      leaves: num(firstDefined(item, ["leaves"])),
      saves: num(firstDefined(item, ["saves"])),
      ctr: firstDefined(item, ["ctr"], 0),
      conversion: firstDefined(item, ["join_conversion_rate", "join_rate", "conversion_rate"], 0)
    }));
  }

  function normalizeChannels(raw) {
    const list = raw?.channels || raw?.items || raw?.data || [];
    if (!Array.isArray(list)) return [];
    return list.map(ch => ({
      id: ch.id || ch.creator_channel_id || ch.channel_id || "",
      title: ch.title || ch.name || ch.username || "کانال",
      username: ch.username || ch.channel_username || "",
      verified: !!(ch.verified || ch.ownership_verified),
      botAdmin: !!(ch.bot_admin || ch.is_bot_admin),
      tracking: ch.tracking_available ?? ch.is_bot_admin ?? false
    })).filter(ch => ch.id);
  }

  const host = document.createElement("div");
  host.id = "creatorCenterV3Root";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      button,select{font:inherit}
      .fab{
        position:fixed;z-index:2147483000;left:12px;bottom:78px;
        height:38px;padding:0 13px;border-radius:14px;border:1px solid rgba(120,196,255,.24);
        display:flex;align-items:center;gap:7px;color:#eef8ff;cursor:pointer;
        background:linear-gradient(145deg,rgba(15,53,82,.96),rgba(48,34,96,.96));
        box-shadow:0 10px 28px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.05);
        font:750 11px/1 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif
      }
      .fab i{
        width:20px;height:20px;display:grid;place-items:center;border-radius:8px;
        background:linear-gradient(145deg,#29a7ec,#7b5df0);font-style:normal;font-size:11px
      }
      .backdrop{
        position:fixed;z-index:2147483001;inset:0;display:none;
        background:rgba(2,7,14,.74);backdrop-filter:blur(10px)
      }
      .backdrop.open{display:block}
      .sheet{
        position:absolute;inset:auto 0 0;max-height:91dvh;overflow:auto;
        direction:rtl;color:#eef5fb;background:
          radial-gradient(700px 240px at 95% -5%,rgba(36,142,221,.12),transparent 65%),
          radial-gradient(560px 220px at 15% 0,rgba(112,78,214,.10),transparent 65%),
          #07121e;
        border:1px solid rgba(129,182,222,.14);border-radius:24px 24px 0 0;
        box-shadow:0 -24px 70px rgba(0,0,0,.48);
        font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif
      }
      .wrap{width:min(100%,700px);margin:auto;padding:12px 10px 24px}
      .top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
      .title{display:flex;align-items:center;gap:9px}
      .logo{
        width:36px;height:36px;border-radius:13px;display:grid;place-items:center;
        background:linear-gradient(145deg,#289fe5,#6c5fe8);
        box-shadow:0 8px 20px rgba(61,120,220,.25);font-weight:900
      }
      .title b{display:block;font-size:15px;line-height:1.2}
      .title span{display:block;margin-top:3px;color:#8196a9;font-size:9px}
      .close{
        width:34px;height:34px;border-radius:12px;border:1px solid rgba(139,191,230,.14);
        color:#c9d7e2;background:#0d1e2d;cursor:pointer
      }
      .toolbar{
        display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-bottom:8px
      }
      .channels{
        display:flex;gap:6px;overflow:auto;padding:1px 1px 3px;scrollbar-width:none
      }
      .channels::-webkit-scrollbar{display:none}
      .chip{
        flex:0 0 auto;height:32px;padding:0 10px;border-radius:12px;
        border:1px solid rgba(130,187,226,.13);color:#9fb1c1;background:#0b1a28;cursor:pointer;
        font-size:10px;white-space:nowrap
      }
      .chip.active{color:#fff;border-color:rgba(71,181,244,.55);background:#102c43}
      .chip em{font-style:normal;color:#58dda6;margin-inline-start:4px;font-size:9px}
      select{
        height:32px;padding:0 8px;border-radius:11px;border:1px solid rgba(130,187,226,.13);
        color:#d9e4ec;background:#0b1a28;outline:0;font-size:10px
      }
      .status{
        display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:8px 9px;
        border:1px solid rgba(130,187,226,.11);border-radius:13px;background:rgba(255,255,255,.018)
      }
      .status .dot{width:7px;height:7px;border-radius:50%;background:#54dca0;box-shadow:0 0 14px rgba(84,220,160,.55)}
      .status b{font-size:10px}
      .status span{color:#7f94a7;font-size:9px;margin-inline-start:auto}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .metric{
        position:relative;overflow:hidden;min-height:74px;padding:10px;border-radius:15px;
        border:1px solid rgba(127,184,225,.11);
        background:linear-gradient(145deg,rgba(17,39,58,.86),rgba(8,24,37,.92));
        box-shadow:inset 0 1px rgba(255,255,255,.025)
      }
      .metric:after{
        content:"";position:absolute;width:70px;height:70px;left:-28px;top:-32px;border-radius:50%;
        background:rgba(73,155,226,.045)
      }
      .metric small{display:block;color:#7890a4;font-size:9px}
      .metric strong{display:block;margin-top:7px;font-size:20px;line-height:1;font-weight:850}
      .metric .hint{display:block;margin-top:6px;color:#6f8498;font-size:8px}
      .metric.primary{
        background:linear-gradient(145deg,rgba(23,62,91,.95),rgba(22,31,66,.92));
        border-color:rgba(76,177,240,.18)
      }
      .section{
        margin-top:8px;padding:9px;border-radius:16px;border:1px solid rgba(128,185,224,.10);
        background:rgba(255,255,255,.015)
      }
      .sectionHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
      .sectionHead b{font-size:11px}
      .sectionHead span{color:#788da1;font-size:8px}
      .list{display:grid;gap:6px}
      .item{
        padding:8px;border-radius:13px;border:1px solid rgba(128,185,224,.09);
        background:#081724
      }
      .itemTitle{font-size:10px;font-weight:700;line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mini{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin-top:6px}
      .mini div{padding:5px 3px;border-radius:8px;background:#0c1e2d;text-align:center;min-width:0}
      .mini span{display:block;color:#71879a;font-size:7px;white-space:nowrap}
      .mini b{display:block;margin-top:2px;font-size:9px;white-space:nowrap}
      .empty,.error,.loading{padding:18px;text-align:center;color:#8499ab;font-size:10px}
      .error{color:#ff91a2}
      .foot{
        display:flex;align-items:center;gap:6px;margin-top:8px;color:#71879a;font-size:8px
      }
      .foot button{
        margin-inline-start:auto;height:30px;padding:0 9px;border-radius:10px;
        border:1px solid rgba(125,187,228,.14);color:#cfe1ed;background:#102437;cursor:pointer;font-size:9px
      }
      @media(min-width:560px){
        .sheet{inset:4dvh max(12px,calc((100vw - 720px)/2)) auto;border-radius:24px;max-height:92dvh}
        .grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      }
    </style>

    <button class="fab" id="open" type="button"><i>↗</i> Creator Center</button>
    <div class="backdrop" id="backdrop">
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Creator Center">
        <div class="wrap">
          <header class="top">
            <div class="title">
              <div class="logo">C</div>
              <div>
                <b>Creator Center</b>
                <span>رشد، عضویت و عملکرد محتوا</span>
              </div>
            </div>
            <button class="close" id="close" type="button">✕</button>
          </header>

          <div class="toolbar">
            <div class="channels" id="channels"></div>
            <select id="days">
              <option value="7">۷ روز</option>
              <option value="30" selected>۳۰ روز</option>
              <option value="90">۹۰ روز</option>
              <option value="365">۱ سال</option>
            </select>
          </div>

          <div id="body"><div class="loading">در حال دریافت اطلاعات…</div></div>
        </div>
      </section>
    </div>
  `;

  const $ = id => root.getElementById(id);

  function renderChannels() {
    const el = $("channels");
    if (!S.channels.length) {
      el.innerHTML = `<span class="empty" style="padding:7px">کانالی ثبت نشده</span>`;
      return;
    }
    el.innerHTML = S.channels.map(ch => `
      <button class="chip ${ch.id === S.selectedChannelId ? "active" : ""}" data-id="${escapeHtml(ch.id)}" type="button">
        ${escapeHtml(ch.title || ch.username || "کانال")}
        ${ch.verified ? `<em>✓</em>` : ""}
      </button>
    `).join("");

    el.querySelectorAll("[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        S.selectedChannelId = btn.dataset.id || "";
        renderChannels();
        await loadSelected();
      });
    });
  }

  function metric(label, value, hint = "", primary = false) {
    return `
      <div class="metric ${primary ? "primary" : ""}">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
        ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
      </div>
    `;
  }

  function render() {
    const body = $("body");
    const d = S.dashboard;
    if (!d) {
      body.innerHTML = `<div class="empty">برای مشاهده آمار، یک کانال را انتخاب کن.</div>`;
      return;
    }

    const ch = S.channels.find(x => x.id === S.selectedChannelId);
    const statusText = ch?.botAdmin
      ? "Tracking دقیق عضویت فعال"
      : "Discovery فعال؛ Tracking عضویت محدود";

    body.innerHTML = `
      <div class="status">
        <span class="dot"></span>
        <b>${escapeHtml(ch?.title || d.title || "کانال")}</b>
        ${ch?.username ? `<span>@${escapeHtml(ch.username)}</span>` : ""}
        <span>${escapeHtml(statusText)}</span>
      </div>

      <div class="grid">
        ${metric("Views", fmt.format(d.views), "نمایش محتوا", true)}
        ${metric("Unique Viewers", fmt.format(d.uniqueViewers), "کاربر یکتا")}
        ${metric("Telegram Opens", fmt.format(d.telegramOpens), "بازشدن تلگرام")}
        ${metric("Join Clicks", fmt.format(d.joinClicks), "کلیک مسیر عضویت")}
        ${metric("Telegram Joins", fmt.format(d.telegramJoins), "عضویت ثبت‌شده", true)}
        ${metric("Active Joins", fmt.format(d.activeJoins), "عضویت فعال")}
        ${metric("Leaves", fmt.format(d.leaves), "خروج")}
        ${metric("Join Conversion", percent(d.conversion), "Join / Click")}
      </div>

      <section class="section">
        <div class="sectionHead">
          <b>عملکرد محتوا</b>
          <span>${Number(S.days).toLocaleString("fa-IR")} روز اخیر</span>
        </div>
        <div class="list">
          ${S.content.length ? S.content.map(item => `
            <article class="item">
              <div class="itemTitle">${escapeHtml(item.title)}</div>
              <div class="mini">
                <div><span>Views</span><b>${fmt.format(item.views)}</b></div>
                <div><span>Unique</span><b>${fmt.format(item.unique)}</b></div>
                <div><span>Clicks</span><b>${fmt.format(item.clicks)}</b></div>
                <div><span>Joins</span><b>${fmt.format(item.joins)}</b></div>
                <div><span>Conv.</span><b>${percent(item.conversion)}</b></div>
              </div>
            </article>
          `).join("") : `<div class="empty">هنوز داده‌ای برای عملکرد محتوا ثبت نشده است.</div>`}
        </div>
      </section>

      <div class="foot">
        <span>${ch?.botAdmin ? "✓ Bot Admin" : "Bot Admin لازم برای Join Tracking دقیق"}</span>
        <button id="tracking" type="button" ${ch?.botAdmin ? "" : "disabled"}>ساخت Tracking Link</button>
      </div>
    `;

    root.getElementById("tracking")?.addEventListener("click", createTrackingLink);
  }

  async function loadChannels() {
    const raw = await api("/channels");
    S.channels = normalizeChannels(raw);
    if (!S.selectedChannelId || !S.channels.some(x => x.id === S.selectedChannelId)) {
      S.selectedChannelId = S.channels[0]?.id || "";
    }
    renderChannels();
  }

  async function loadDashboardForChannel() {
    const id = encodeURIComponent(S.selectedChannelId);
    const days = encodeURIComponent(S.days);

    // Prefer v3 dashboard route; fall back to analytics route for compatibility.
    try {
      const raw = await api(`/dashboard?channel_id=${id}&days=${days}`);
      return normalizeDashboard(raw);
    } catch (e) {
      const raw = await api(`/analytics?channel_id=${id}&days=${days}`);
      const candidates = raw?.channels || raw?.items || raw?.data || raw;
      const selected = Array.isArray(candidates)
        ? candidates.find(x => (x.channel_id || x.id || x.creator_channel_id) === S.selectedChannelId) || candidates[0] || {}
        : candidates;
      return normalizeDashboard(selected);
    }
  }

  async function loadContentForChannel() {
    const id = encodeURIComponent(S.selectedChannelId);
    const days = encodeURIComponent(S.days);
    try {
      const raw = await api(`/content?channel_id=${id}&days=${days}&limit=50`);
      return normalizeContent(raw);
    } catch {
      const raw = await api(`/content-performance?channel_id=${id}&days=${days}&limit=50`);
      return normalizeContent(raw);
    }
  }

  async function loadSelected() {
    if (!S.selectedChannelId) {
      S.dashboard = null;
      S.content = [];
      render();
      return;
    }

    $("body").innerHTML = `<div class="loading">در حال دریافت آمار…</div>`;
    try {
      const [dashboard, content] = await Promise.all([
        loadDashboardForChannel(),
        loadContentForChannel()
      ]);
      S.dashboard = dashboard;
      S.content = content;
      render();
    } catch (err) {
      $("body").innerHTML = `<div class="error">${escapeHtml(err?.message || String(err))}</div>`;
    }
  }

  async function refreshAll() {
    try {
      await loadChannels();
      await loadSelected();
    } catch (err) {
      $("body").innerHTML = `<div class="error">${escapeHtml(err?.message || String(err))}</div>`;
    }
  }

  async function createTrackingLink() {
    const ch = S.channels.find(x => x.id === S.selectedChannelId);
    if (!ch?.botAdmin) return;
    const btn = root.getElementById("tracking");
    if (!btn) return;

    btn.disabled = true;
    try {
      const raw = await api("/tracking-link", {
        method: "POST",
        body: JSON.stringify({
          channel_id: S.selectedChannelId,
          source: "creator_center_v3"
        })
      });
      const url = raw?.url || raw?.tracking_url || raw?.link || "";
      if (!url) throw new Error("لینک Tracking ساخته نشد.");

      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "کپی شد ✓";
      } catch {
        tg?.openTelegramLink?.(url);
        btn.textContent = "باز شد ✓";
      }
      setTimeout(() => { btn.textContent = "ساخت Tracking Link"; }, 1600);
    } catch (err) {
      btn.textContent = err?.message || "خطا";
      setTimeout(() => { btn.textContent = "ساخت Tracking Link"; }, 1800);
    } finally {
      btn.disabled = false;
    }
  }

  // Separate "Add Channel to Discovery" flow in the host page.
  function upgradeAddChannelFlow() {
    const style = document.createElement("style");
    style.id = "creatorV3HostPatch";
    style.textContent = `
      .add-channel-card{
        min-height:42px!important;margin:0 0 9px!important;padding:7px 9px!important;
        border-radius:15px!important;gap:8px!important;
        background:linear-gradient(145deg,rgba(13,35,53,.96),rgba(18,25,48,.96))!important;
        box-shadow:0 8px 24px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.025)!important
      }
      .add-channel-icon{
        width:34px!important;height:34px!important;border-radius:12px!important;font-size:15px!important
      }
      .add-channel-content h3{font-size:12px!important;margin:0 0 1px!important}
      .add-channel-content p{font-size:9px!important;line-height:1.4!important;margin:0!important;color:#7e94a7!important}
      .add-channel-content button{
        min-height:30px!important;height:30px!important;padding:0 10px!important;border-radius:10px!important;
        font-size:9px!important;white-space:nowrap!important
      }
      .add-channel-content{
        display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;column-gap:8px!important;align-items:center!important
      }
      .add-channel-content h3,.add-channel-content p{grid-column:1}
      .add-channel-content button{grid-column:2;grid-row:1/3}
      .add-channel-box{width:min(100%,390px)!important;padding:14px!important;border-radius:20px!important}
      .add-channel-box h3{font-size:14px!important}
      .add-channel-box input{height:42px!important;border-radius:12px!important;font-size:12px!important}
      .add-channel-actions button{height:38px!important;border-radius:12px!important;font-size:11px!important}
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const submit = document.getElementById("addChannelSubmit");
    const input = document.getElementById("addChannelInput");
    const msg = document.getElementById("addChannelMessage");
    const modal = document.getElementById("addChannelModal");
    if (!submit || !input || !msg) return;

    submit.addEventListener("click", async ev => {
      // Block the old /api/creator/channel/add handler in index.html.
      ev.preventDefault();
      ev.stopImmediatePropagation();

      let channel = input.value.trim()
        .replace(/^https?:\/\/t\.me\//i, "")
        .replace(/^t\.me\//i, "")
        .replace(/^@/, "")
        .split(/[/?#]/)[0]
        .trim();

      if (!channel) {
        msg.textContent = "نام کاربری یا لینک کانال را وارد کن.";
        return;
      }

      submit.disabled = true;
      msg.textContent = "در حال بررسی و ثبت کانال…";

      try {
        const data = await request(ADD_CHANNEL_API, {
          method: "POST",
          body: JSON.stringify({
            username: channel,
            channel,
            channel_username: channel
          })
        });

        const botAdmin = !!(data?.bot_admin || data?.is_bot_admin);
        const verified = !!(data?.verified || data?.ownership_verified);

        msg.textContent = botAdmin
          ? "✓ کانال ثبت شد؛ Sync و Join Tracking دقیق فعال است."
          : verified
            ? "✓ کانال ثبت شد؛ برای Join Tracking دقیق، ربات را Admin کن."
            : "✓ کانال عمومی ثبت شد و Sync می‌شود؛ مالکیت هنوز تایید نشده است.";

        input.value = "";
        setTimeout(() => {
          modal?.classList.remove("open");
          msg.textContent = "";
        }, 2100);
      } catch (err) {
        msg.textContent = `✕ ${err?.message || "ثبت کانال انجام نشد."}`;
      } finally {
        submit.disabled = false;
      }
    }, true);
  }

  $("open").addEventListener("click", async () => {
    $("backdrop").classList.add("open");
    tg?.expand?.();
    await refreshAll();
  });

  $("close").addEventListener("click", () => $("backdrop").classList.remove("open"));
  $("backdrop").addEventListener("click", e => {
    if (e.target === $("backdrop")) $("backdrop").classList.remove("open");
  });

  $("days").addEventListener("change", async e => {
    S.days = Number(e.target.value || 30);
    await loadSelected();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", upgradeAddChannelFlow, { once: true });
  } else {
    upgradeAddChannelFlow();
  }

  tg?.ready?.();
})();
