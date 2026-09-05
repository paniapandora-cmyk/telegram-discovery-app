/*
 * Telegram Discovery — Creator Growth UI v7 — Reference-led Social + Analytics
 * Dark Social + Telegram-native cues + Compact Creator Analytics
 *
 * Goals:
 * - Keep Discovery/Search/Explore data logic untouched.
 * - Replace v4/v5 Aurora/glass visuals with a flat-premium social feed.
 * - Keep Add Channel separate from Creator Center.
 * - Prefer creator v3 endpoints with backward-compatible fallbacks.
 */
(() => {
  "use strict";

  const tg = window.Telegram?.WebApp || null;
  const CREATOR_API = "/api/creator";
  const ADD_CHANNEL_API = "/api/add-channel";
  const VERSION = "7.0.0";

  const state = {
    channels: [],
    selectedChannelId: "",
    days: 30,
    dashboard: null,
    content: [],
    creatorOpen: false,
    gridObserver: null,
    bodyObserver: null,
    decorateTimer: 0,
  };

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
  const compact = (() => {
    try {
      return new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 });
    } catch {
      return fa;
    }
  })();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function firstDefined(object, keys, fallback = 0) {
    if (!object || typeof object !== "object") return fallback;
    for (const key of keys) {
      if (object[key] !== undefined && object[key] !== null) return object[key];
    }
    return fallback;
  }

  function percent(value) {
    const n = num(value);
    const p = Math.abs(n) <= 1 ? n * 100 : n;
    return `${p.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
  }

  function initData() {
    return tg?.initData || "";
  }

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const data = initData();
    if (data) headers.set("x-telegram-init-data", data);

    const response = await fetch(url, { ...options, headers });
    const text = await response.text();

    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { error: text || "پاسخ نامعتبر از سرور" };
    }

    if (!response.ok || body?.ok === false) {
      const error = new Error(body?.error || body?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  const creatorApi = (path, options) => request(`${CREATOR_API}${path}`, options);

  function normalizeChannels(raw) {
    const list = raw?.channels || raw?.items || raw?.data || [];
    if (!Array.isArray(list)) return [];

    return list.map((channel) => ({
      id: channel.id || channel.creator_channel_id || channel.channel_id || "",
      title: channel.title || channel.name || channel.username || "کانال",
      username: channel.username || channel.channel_username || "",
      verified: Boolean(channel.verified || channel.ownership_verified),
      botAdmin: Boolean(channel.bot_admin || channel.is_bot_admin),
      tracking: channel.tracking_available ?? channel.bot_admin ?? channel.is_bot_admin ?? false,
    })).filter((channel) => channel.id);
  }

  function normalizeDashboard(raw) {
    const source = raw?.dashboard || raw?.data || raw?.analytics || raw?.summary || raw || {};
    const metrics = source?.metrics || source?.totals || source;

    return {
      title: firstDefined(source, ["title", "channel_title", "name"], ""),
      username: firstDefined(source, ["username", "channel_username"], ""),
      views: num(firstDefined(metrics, ["views", "impressions", "total_views"])),
      uniqueViewers: num(firstDefined(metrics, ["unique_viewers", "unique_views", "unique_users"])),
      telegramOpens: num(firstDefined(metrics, ["telegram_opens", "opens", "open_count"])),
      joinClicks: num(firstDefined(metrics, ["join_clicks", "clicks_telegram", "telegram_clicks", "clicks"])),
      telegramJoins: num(firstDefined(metrics, ["telegram_joins", "joins", "attributed_joins", "join_count"])),
      activeJoins: num(firstDefined(metrics, ["active_joins", "active_members", "current_joins"])),
      leaves: num(firstDefined(metrics, ["leaves", "leave_count"])),
      saves: num(firstDefined(metrics, ["saves", "save_count"])),
      botStarts: num(firstDefined(metrics, ["starts_bot", "bot_starts", "starts"])),
      joinConversion: firstDefined(metrics, ["join_conversion_rate", "join_rate", "conversion_rate", "conversion"], 0),
      ctr: firstDefined(metrics, ["ctr", "click_through_rate"], 0),
      raw,
    };
  }

  function normalizeContent(raw) {
    const list = raw?.items || raw?.content || raw?.contents || raw?.rows || raw?.data || [];
    if (!Array.isArray(list)) return [];

    return list.map((item) => ({
      id: item.id || item.content_id || "",
      title: item.title || item.text || item.caption || "پست تلگرام",
      views: num(firstDefined(item, ["views", "impressions"])),
      unique: num(firstDefined(item, ["unique_viewers", "unique_views"])),
      opens: num(firstDefined(item, ["telegram_opens", "opens"])),
      clicks: num(firstDefined(item, ["join_clicks", "clicks_telegram", "clicks"])),
      joins: num(firstDefined(item, ["telegram_joins", "joins", "attributed_joins"])),
      active: num(firstDefined(item, ["active_joins"])),
      leaves: num(firstDefined(item, ["leaves"])),
      saves: num(firstDefined(item, ["saves"])),
      conversion: firstDefined(item, ["join_conversion_rate", "join_rate", "conversion_rate"], 0),
    }));
  }

  function parseChannelInput(value) {
    return String(value || "")
      .trim()
      .replace(/^https?:\/\/t\.me\//i, "")
      .replace(/^t\.me\//i, "")
      .replace(/^@/, "")
      .split(/[/?#]/)[0]
      .trim();
  }

  function installHostTheme() {
    if (document.getElementById("creatorGrowthV6Theme")) return;

    const style = document.createElement("style");
    style.id = "creatorGrowthV6Theme";
    style.textContent = `
      :root{
        --v6-bg:#0A0A0A;
        --v6-surface:#161616;
        --v6-surface-2:#1A1A1A;
        --v6-surface-3:#1D1D1D;
        --v6-line:#2A2A2A;
        --v6-line-soft:#232323;
        --v6-text:#F5F5F5;
        --v6-text-2:#B7B7B7;
        --v6-text-3:#858585;
        --v6-blue:#2AABEE;
        --v6-blue-2:#3793EF;
        --v6-orange:#FF7A45;
        --v6-purple:#8B5CF6;
        --v6-green:#37C98B;
        --v6-red:#FF5D67;
        --v6-card-shadow:0 3px 10px rgba(0,0,0,.18);
        --v6-float-shadow:0 6px 16px rgba(0,0,0,.28);
        --v6-modal-shadow:0 18px 52px rgba(0,0,0,.46);
        --v6-safe-top:0px;
        --v6-safe-bottom:0px;
        --bg:var(--v6-bg)!important;
        --surface:var(--v6-surface)!important;
        --surface-strong:var(--v6-surface-3)!important;
        --surface-soft:var(--v6-surface)!important;
        --text:var(--v6-text)!important;
        --muted:var(--v6-text-2)!important;
        --accent:var(--v6-blue)!important;
        --cyan:var(--v6-blue)!important;
        --violet:var(--v6-purple)!important;
        --success:var(--v6-green)!important;
        --line:var(--v6-line)!important;
        --line-strong:#3A3A3A!important;
        --shadow:var(--v6-card-shadow)!important;
        --radius-card:14px!important;
        --radius-hero:14px!important;
        --nav-h:58px!important;
        --safe-t:max(58px,var(--v6-safe-top),var(--tg-content-safe-area-inset-top,0px),var(--tg-safe-area-inset-top,0px),env(safe-area-inset-top,0px))!important;
        --safe-b:max(6px,var(--v6-safe-bottom),var(--tg-content-safe-area-inset-bottom,0px),var(--tg-safe-area-inset-bottom,0px),env(safe-area-inset-bottom,0px))!important;
      }

      html,body{background:var(--v6-bg)!important;color:var(--v6-text)!important}
      body{
        background:var(--v6-bg)!important;
        color:var(--v6-text)!important;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif!important;
      }
      body:before,body:after{display:none!important}

      button,input,select{font:inherit}
      button:focus-visible,input:focus-visible,select:focus-visible{
        outline:2px solid var(--v6-blue)!important;
        outline-offset:2px!important;
      }

      .app{
        width:min(100%,700px)!important;
        padding:calc(var(--safe-t) + 1px) 9px 14px!important;
        scrollbar-width:none!important;
      }
      .app::-webkit-scrollbar{display:none}

      .top{
        top:0!important;
        min-height:44px!important;
        padding:1px 1px 5px!important;
        gap:7px!important;
        background:rgba(10,10,10,.992)!important;
        background-image:none!important;
        box-shadow:none!important;
        backdrop-filter:none!important;
      }
      .brand{gap:8px!important}
      .mark{
        width:32px!important;height:32px!important;flex:0 0 32px!important;
        border:0!important;border-radius:10px!important;
        color:#fff!important;background:var(--v6-blue)!important;
        box-shadow:none!important;font-size:15px!important;
      }
      h1{font-size:15px!important;line-height:19px!important;font-weight:780!important;letter-spacing:-.01em!important}
      .eyebrow{margin-top:1px!important;color:var(--v6-text-3)!important;font-size:9px!important;line-height:12px!important}
      .status{
        min-height:28px!important;padding:0 8px!important;gap:5px!important;
        border:1px solid var(--v6-line)!important;border-radius:999px!important;
        color:var(--v6-text-3)!important;background:#111!important;
        box-shadow:none!important;font-size:9px!important;
      }
      .status:before{width:6px!important;height:6px!important;flex:0 0 6px!important}
      .status.online:before{background:var(--v6-green)!important;box-shadow:none!important}

      .discover{display:none!important}

      .searchbar{
        top:44px!important;
        min-height:42px!important;height:42px!important;
        margin:0 0 9px!important;padding:2px 4px!important;gap:2px!important;
        border:1px solid #303030!important;border-radius:18px!important;
        background:#202020!important;background-image:none!important;
        box-shadow:none!important;backdrop-filter:none!important;
      }
      .searchbar input{
        min-height:34px!important;height:34px!important;padding:0 10px!important;
        color:var(--v6-text)!important;font-size:11px!important;
      }
      .searchbar input::placeholder{color:#858585!important}
      .icon{
        width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;
        border-radius:50%!important;color:#A6A6A6!important;background:transparent!important;
        font-size:16px!important;
      }

      .tabs{
        min-height:32px!important;display:flex!important;grid-template-columns:none!important;
        align-items:center!important;gap:6px!important;overflow-x:auto!important;
        margin:0 0 9px!important;padding:0 1px 1px!important;border:0!important;border-radius:0!important;
        background:transparent!important;box-shadow:none!important;scrollbar-width:none!important;
      }
      .tabs::-webkit-scrollbar{display:none}
      .tab{
        flex:0 0 auto!important;min-height:31px!important;height:31px!important;min-width:max-content!important;
        padding:0 12px!important;border:1px solid #404040!important;border-radius:999px!important;
        color:#C9C9C9!important;background:#0D0D0D!important;box-shadow:none!important;
        font-size:10px!important;font-weight:650!important;
      }
      .tab.active{
        color:#0A0A0A!important;background:#F0F0F0!important;background-image:none!important;
        border-color:#F0F0F0!important;box-shadow:none!important;
      }

      .head{margin:0 2px 7px!important;align-items:center!important;gap:8px!important}
      .head h2{margin:0!important;font-size:13px!important;line-height:18px!important;font-weight:740!important;letter-spacing:0!important}
      .head h2:after{display:none!important}
      .head span{display:block!important;color:var(--v6-text-3)!important;font-size:8px!important}

      .globalSearchPanel{
        margin:0 0 8px!important;padding:8px!important;gap:7px!important;
        border:1px solid var(--v6-line)!important;border-radius:14px!important;
        background:var(--v6-surface)!important;background-image:none!important;box-shadow:none!important;
      }
      .globalSearchGlyph{width:32px!important;height:32px!important;flex:0 0 32px!important;border-radius:10px!important;background:#202020!important;color:var(--v6-blue)!important;font-size:14px!important}
      .globalSearchIntro{gap:7px!important}
      .globalSearchCopy b{font-size:11px!important}
      .globalSearchCopy span{margin-top:2px!important;color:var(--v6-text-3)!important;font-size:8px!important;line-height:12px!important}
      .searchFilters{gap:5px!important;overflow-x:auto!important;scrollbar-width:none!important}
      .searchFilters::-webkit-scrollbar{display:none}
      .searchFilter{
        flex:0 0 auto!important;min-height:29px!important;padding:0 8px!important;
        border:1px solid #343434!important;border-radius:999px!important;background:#101010!important;color:#BDBDBD!important;
        font-size:9px!important;
      }
      .searchFilter.active{background:#ECECEC!important;color:#0B0B0B!important;border-color:#ECECEC!important}
      .searchFilter span{min-width:16px!important;padding:1px 4px!important;border-radius:999px!important;background:#252525!important;color:#AFAFAF!important;font-size:7px!important}
      .searchFilter.active span{background:#D7D7D7!important;color:#111!important}

      .grid{
        display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-auto-rows:auto!important;
        gap:9px!important;padding-bottom:8px!important;
      }
      .mode-explore .grid{grid-template-columns:minmax(0,1fr)!important}

      .card{
        position:relative!important;min-width:0!important;height:auto!important;overflow:hidden!important;
        border:1px solid #2A2A2A!important;border-radius:15px!important;
        color:var(--v6-text)!important;background:#181818!important;background-image:none!important;
        box-shadow:0 4px 14px rgba(0,0,0,.16)!important;transform:none!important;transition:border-color .15s ease!important;
      }
      .card:before,.card:after{display:none!important}
      .card.hero,.card.wide{grid-column:auto!important;border-radius:14px!important}
      .card:hover{transform:none!important;box-shadow:var(--v6-card-shadow)!important;border-color:#343434!important}
      .rank,.freshness{display:none!important}
      .type{display:none!important}

      .media-card{
        display:flex!important;flex-direction:column!important;grid-template-rows:none!important;
      }
      .media-card .copy{
        order:-2!important;padding:10px 10px 9px!important;border:0!important;border-bottom:1px solid #262626!important;
        background:#181818!important;background-image:none!important;
      }
      .media-card .mediaStage{order:-1!important}
      .mediaStage{
        aspect-ratio:16/9!important;border-radius:0!important;background:#111!important;background-image:none!important;
      }
      .hero .mediaStage,.wide .mediaStage{aspect-ratio:16/9!important}
      .mediaStage:after{display:none!important}
      .mediaStage .media{object-position:center!important}
      .videoPlay{
        width:44px!important;height:44px!important;border:2px solid rgba(255,255,255,.88)!important;border-radius:50%!important;
        background:rgba(0,0,0,.50)!important;box-shadow:none!important;backdrop-filter:none!important;
      }
      .videoPlay:after{border-top-width:7px!important;border-bottom-width:7px!important;border-left-width:11px!important}

      .copy{background:#181818!important;background-image:none!important}
      .channel{
        gap:7px!important;margin-bottom:6px!important;color:var(--v6-text)!important;font-size:11px!important;font-weight:690!important;
      }
      .channel>span:not(.avatar):not(.reason){color:var(--v6-text)!important}
      .avatar,.nativeAvatar{
        width:32px!important;height:32px!important;flex:0 0 32px!important;border:1px solid #313131!important;
        box-shadow:none!important;
      }
      .hero .avatar{width:32px!important;height:32px!important;flex-basis:32px!important}
      .reason{
        margin-inline-start:auto!important;padding:2px 6px!important;border:0!important;border-radius:999px!important;
        color:var(--v6-blue)!important;background:rgba(42,171,238,.10)!important;font-size:8px!important;
      }
      .title,.hero .title{
        color:#EEEEEE!important;font-size:12px!important;font-weight:480!important;line-height:19px!important;
        display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:4!important;line-clamp:4!important;overflow:hidden!important;
      }
      .meta{gap:4px!important;margin-top:5px!important;color:#818181!important;font-size:8px!important}

      .native-card{background:#181818!important}
      .nativePreview,.document-card .nativePreview,.audio-card .nativePreview{
        min-height:0!important;padding:10px!important;gap:7px!important;
        background:#181818!important;background-image:none!important;color:var(--v6-text)!important;
      }
      .hero .nativePreview{min-height:0!important;padding:10px!important}
      .nativeHead{gap:8px!important;padding-inline-end:30px!important}
      .nativeName{color:var(--v6-text)!important;font-size:11px!important;font-weight:690!important}
      .nativeMeta{margin-top:2px!important;color:#858585!important;font-size:8px!important}
      .nativeMessage,.hero .nativeMessage{
        padding:4px 0 6px!important;color:#E9E9E9!important;font-size:12px!important;font-weight:450!important;line-height:19px!important;
        display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:7!important;line-clamp:7!important;overflow:hidden!important;
      }
      .nativeFoot{
        gap:6px!important;padding-top:7px!important;border-top:1px solid #292929!important;color:#909090!important;font-size:8px!important;
      }

      .save{
        top:8px!important;right:8px!important;width:30px!important;height:30px!important;padding:0!important;
        border:1px solid #363636!important;border-radius:50%!important;color:#B9B9B9!important;background:#161616!important;
        box-shadow:none!important;backdrop-filter:none!important;font-size:14px!important;
      }
      .save.saved{color:var(--v6-red)!important;border-color:#5B3034!important}
      .media-card>.save{display:none!important}

      .v6-card-actions{
        position:relative;z-index:5;order:2;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
        min-height:40px;border-top:1px solid #2A2A2A;background:#151515;
      }
      .v6-card-actions button{
        min-height:40px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 6px;
        border:0;border-inline-start:1px solid #242424;color:#AFAFAF;background:transparent;cursor:pointer;font-size:9px;
      }
      .v6-card-actions button:first-child{border-inline-start:0}
      .v6-card-actions b{font-size:15px;line-height:1;font-weight:500;color:#D8D8D8}
      .v6-card-actions button[data-v6-save].saved b{color:var(--v6-red)}

      .cardOpen{z-index:3!important}
      .v6-card-actions,.save{z-index:6!important}

      .sk{min-height:170px!important;border-radius:14px!important;background:#181818!important;background-image:none!important;animation:none!important}
      .empty,.searchWelcome{
        border:1px solid var(--v6-line)!important;border-radius:14px!important;background:#151515!important;background-image:none!important;box-shadow:none!important;
        color:var(--v6-text-2)!important;
      }
      .quickSearches button{border-color:#333!important;background:#111!important;color:#BDBDBD!important;border-radius:999px!important}

      .add-channel-card{
        min-height:50px!important;display:grid!important;grid-template-columns:32px minmax(0,1fr) auto!important;
        align-items:center!important;gap:8px!important;margin:0 0 9px!important;padding:7px 8px!important;
        border:1px solid #292929!important;border-radius:13px!important;background:#171717!important;background-image:none!important;
        box-shadow:none!important;
      }
      .add-channel-icon{
        width:32px!important;height:32px!important;border-radius:10px!important;background:#222!important;background-image:none!important;
        color:var(--v6-blue)!important;font-size:13px!important;
      }
      .add-channel-content{
        min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;column-gap:8px!important;align-items:center!important;
      }
      .add-channel-content h3{grid-column:1!important;margin:0!important;color:var(--v6-text)!important;font-size:11px!important;line-height:15px!important}
      .add-channel-content p{grid-column:1!important;margin:1px 0 0!important;color:#818181!important;font-size:8px!important;line-height:11px!important}
      .add-channel-content button{
        grid-column:2!important;grid-row:1/3!important;min-height:31px!important;height:31px!important;padding:0 11px!important;
        border:0!important;border-radius:999px!important;color:#fff!important;background:var(--v6-blue)!important;background-image:none!important;
        box-shadow:none!important;font-size:9px!important;font-weight:700!important;
      }

      .add-channel-modal{
        background:rgba(0,0,0,.70)!important;backdrop-filter:blur(3px)!important;
      }
      .add-channel-box{
        width:min(calc(100% - 20px),390px)!important;padding:14px!important;border:1px solid #303030!important;
        border-radius:18px!important;background:#151515!important;background-image:none!important;box-shadow:var(--v6-modal-shadow)!important;
      }
      .add-channel-box h3{margin:0 0 10px!important;color:#F2F2F2!important;font-size:13px!important}
      .add-channel-box input{
        width:100%!important;height:42px!important;padding:0 12px!important;border:1px solid #323232!important;border-radius:11px!important;
        color:#F5F5F5!important;background:#0F0F0F!important;font-size:11px!important;
      }
      #addChannelMessage{min-height:17px!important;margin-top:7px!important;color:#AFAFAF!important;font-size:9px!important;line-height:14px!important}
      .add-channel-actions{gap:7px!important;margin-top:9px!important}
      .add-channel-actions button{height:38px!important;border-radius:11px!important;font-size:10px!important}
      #addChannelSubmit{color:#fff!important;background:var(--v6-blue)!important;background-image:none!important}
      #addChannelClose{color:#BDBDBD!important;background:#242424!important}

      .v6-creator-rail{
        display:flex;gap:7px;overflow-x:auto;margin:0 0 8px;padding:0 0 2px;scrollbar-width:none;
      }
      .v6-creator-rail::-webkit-scrollbar{display:none}
      .v6-creator-card{
        flex:0 0 154px;min-height:146px;display:flex;flex-direction:column;align-items:center;padding:11px 9px 9px;
        border:1px solid #2B2B2B;border-radius:14px;background:#1B1B1B;box-shadow:0 4px 12px rgba(0,0,0,.14);text-align:center;
      }
      .v6-creator-card img,.v6-creator-avatar-fallback{
        width:56px;height:56px;flex:0 0 56px;border:1px solid #343434;border-radius:50%;object-fit:cover;background:#232323;
      }
      .v6-creator-avatar-fallback{display:grid;place-items:center;color:#BDBDBD;font-size:16px;font-weight:800}
      .v6-creator-card strong{width:100%;margin-top:8px;overflow:hidden;color:#F2F2F2;font-size:10px;line-height:14px;text-overflow:ellipsis;white-space:nowrap}
      .v6-creator-card small{width:100%;margin-top:2px;overflow:hidden;color:#808080;font-size:8px;line-height:11px;text-overflow:ellipsis;white-space:nowrap}
      .v6-creator-card button{
        width:100%;min-height:30px;margin-top:auto;border:0;border-radius:999px;color:#fff;background:var(--v6-blue);font-size:9px;font-weight:700;cursor:pointer;
      }
      .mode-search .v6-creator-rail,.mode-explore .v6-creator-rail,.mode-trending .v6-creator-rail,.mode-fresh .v6-creator-rail,
      .mode-hub .v6-creator-rail,.mode-history .v6-creator-rail,.mode-saved .v6-creator-rail{display:none!important}
      .mode-search .add-channel-card,.mode-hub .add-channel-card,.mode-history .add-channel-card,.mode-saved .add-channel-card{display:none!important}

      .nav{
        width:min(calc(100% - 8px),692px)!important;height:58px!important;min-height:58px!important;
        margin:4px auto max(var(--safe-b),4px)!important;padding:3px 7px!important;gap:1px!important;
        border:1px solid #202020!important;border-radius:16px 16px 0 0!important;
        background:#050505!important;background-image:none!important;box-shadow:none!important;backdrop-filter:none!important;
      }
      .nav button{
        min-width:48px!important;min-height:48px!important;gap:2px!important;border-radius:12px!important;color:#7E7E7E!important;background:transparent!important;
        font-size:8px!important;
      }
      .nav button.active{color:#F2F2F2!important;background:transparent!important;background-image:none!important;box-shadow:none!important}
      .nav button.active:after{width:10px!important;height:2px!important;background:#F2F2F2!important;box-shadow:none!important}
      .nav svg{width:20px!important;height:20px!important;stroke:#9C9C9C!important;stroke-width:1.7!important}
      .nav button.active svg{stroke:#F5F5F5!important}
      .navBadge{font-size:7px!important;background:var(--v6-red)!important}

      .viewer{
        width:min(100%,700px)!important;background:#0A0A0A!important;background-image:none!important;
      }
      .viewerMedia{width:calc(100% - 20px)!important;border-radius:14px!important;box-shadow:none!important;background:#111!important}
      .viewerBody{padding:11px 11px 18px!important}
      .viewer h3{font-size:13px!important;line-height:19px!important}
      .desc{font-size:11px!important;line-height:18px!important;color:#C2C2C2!important}
      .feedback button{min-height:34px!important;border-radius:10px!important;font-size:9px!important;background:#171717!important;border-color:#2B2B2B!important}
      .actions button{min-height:40px!important;border-radius:11px!important;font-size:10px!important}
      .close{background:#171717!important;border-color:#303030!important;backdrop-filter:none!important}
      .back{background:rgba(0,0,0,.72)!important;backdrop-filter:blur(2px)!important}
      .toast{background:#1A1A1A!important;border:1px solid #303030!important;color:#F0F0F0!important;box-shadow:var(--v6-float-shadow)!important}

      .hub{gap:8px!important}
      .hubHero,.hubPanel{
        border:1px solid #292929!important;border-radius:14px!important;background:#171717!important;background-image:none!important;box-shadow:none!important;
      }
      .hubHero{padding:11px!important;gap:9px!important}
      .hubAvatar{width:44px!important;height:44px!important;flex:0 0 44px!important;border-radius:13px!important;background:#232323!important;background-image:none!important;color:var(--v6-blue)!important}
      .hubIdentity b{font-size:12px!important}
      .hubIdentity span,.hubHint{margin-top:2px!important;color:#858585!important;font-size:8px!important;line-height:13px!important}
      .hubStats b{color:var(--v6-blue)!important;font-size:14px!important}
      .hubStats span{font-size:7px!important}
      .hubQuick{gap:6px!important}
      .hubQuick button,.hubButton{min-height:40px!important;padding:6px 8px!important;border:1px solid #2C2C2C!important;border-radius:11px!important;background:#1A1A1A!important;color:#DADADA!important;font-size:9px!important}
      .hubPanel{padding:10px!important}
      .hubPanelHead{margin-bottom:8px!important}
      .hubPanelHead h3{font-size:11px!important}
      .hubRow{min-height:44px!important;padding:7px!important;border-radius:10px!important;background:#1B1B1B!important;border-color:#292929!important}
      .topicChip{min-height:30px!important;padding:0 9px!important;border-radius:999px!important;background:#111!important;border-color:#333!important;font-size:9px!important}
      .topicChip.selected{background:#EDEDED!important;color:#111!important;border-color:#EDEDED!important}
      .v6-legacy-creator-panel{display:none!important}
      .v6-hub-creator-entry{
        display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;
        border:1px solid #2B2B2B;border-radius:12px;background:#191919;
      }
      .v6-hub-creator-entry i{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:#222;color:var(--v6-orange);font-style:normal;font-weight:800}
      .v6-hub-creator-entry b{display:block;font-size:10px}
      .v6-hub-creator-entry span{display:block;margin-top:2px;color:#858585;font-size:8px}
      .v6-hub-creator-entry button{min-height:30px;padding:0 9px;border:0;border-radius:9px;background:var(--v6-blue);color:#fff;font-size:9px;font-weight:700}

      @media(max-width:340px){
        .app{padding-right:8px!important;padding-left:8px!important}
        .v6-creator-card{flex-basis:128px}
      }
      @media(min-width:360px){
        .mode-explore .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
        .mode-explore .title,.mode-explore .hero .title{font-size:10px!important;line-height:16px!important}
        .mode-explore .channel{font-size:9px!important}
      }
      @media(min-width:680px){
        .mode-explore .grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }
      @media(prefers-reduced-motion:reduce){
        *,*:before,*:after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}
      }
    `;

    document.head.appendChild(style);
  }

  function syncTelegramChrome() {
    const root = document.documentElement;
    const safe = tg?.contentSafeAreaInset || tg?.safeAreaInset || {};
    const top = Math.max(0, num(safe.top));
    const bottom = Math.max(0, num(safe.bottom));

    root.style.setProperty("--v6-safe-top", `${top}px`);
    root.style.setProperty("--v6-safe-bottom", `${bottom}px`);

    try { tg?.setHeaderColor?.("#0A0A0A"); } catch {}
    try { tg?.setBackgroundColor?.("#0A0A0A"); } catch {}
    try { tg?.setBottomBarColor?.("#050505"); } catch {}
  }

  function bindTelegramEvents() {
    syncTelegramChrome();
    try { tg?.expand?.(); } catch {}
    try { tg?.ready?.(); } catch {}

    ["safeAreaChanged", "contentSafeAreaChanged", "viewportChanged", "themeChanged"].forEach((event) => {
      try { tg?.onEvent?.(event, syncTelegramChrome); } catch {}
    });
  }

  function relocateDiscoveryModules() {
    const tabs = q(".tabs");
    const add = q("#addChannelCard");
    if (tabs && add && tabs.nextElementSibling !== add) {
      tabs.insertAdjacentElement("afterend", add);
    }

    let rail = q("#v6CreatorRail");
    if (!rail && tabs) {
      rail = document.createElement("section");
      rail.id = "v6CreatorRail";
      rail.className = "v6-creator-rail";
      rail.setAttribute("aria-label", "کانال‌های پیشنهادی");
      const anchor = add || tabs;
      anchor.insertAdjacentElement("afterend", rail);
    }
  }

  function decorateMediaCards() {
    qa("#grid .media-card").forEach((card) => {
      if (card.dataset.v6Actions === "1") return;
      card.dataset.v6Actions = "1";

      const open = q(".cardOpen", card);
      const originalSave = q(".save", card);
      const actions = document.createElement("div");
      actions.className = "v6-card-actions";

      actions.innerHTML = `
        <button type="button" data-v6-open><b>↗</b><span>باز کردن</span></button>
        <button type="button" data-v6-save ${originalSave ? "" : "disabled"} class="${originalSave?.classList.contains("saved") ? "saved" : ""}"><b>${originalSave?.classList.contains("saved") ? "♥" : "♡"}</b><span>ذخیره</span></button>
        <button type="button" data-v6-details><b>◉</b><span>جزئیات</span></button>
      `;

      q("[data-v6-open]", actions)?.addEventListener("click", (event) => {
        event.stopPropagation();
        open?.click();
      });

      q("[data-v6-details]", actions)?.addEventListener("click", (event) => {
        event.stopPropagation();
        open?.click();
      });

      q("[data-v6-save]", actions)?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!originalSave) return;
        originalSave.click();
        setTimeout(() => {
          const active = originalSave.classList.contains("saved");
          const button = q("[data-v6-save]", actions);
          button?.classList.toggle("saved", active);
          const icon = q("b", button);
          if (icon) icon.textContent = active ? "♥" : "♡";
        }, 40);
      });

      card.appendChild(actions);
    });
  }

  function creatorCardData(card, index) {
    const channel = q(".channel", card);
    const nativeName = q(".nativeName", card);
    const name = (channel?.querySelector("span:not(.avatar):not(.reason)")?.textContent || nativeName?.textContent || "کانال").trim();
    const avatar = q(".avatar img, .nativeAvatar img, img.avatar, img.nativeAvatar", card)?.src ||
      q(".avatar, .nativeAvatar", card)?.style?.backgroundImage?.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
    const meta = (q(".meta", card)?.textContent || q(".nativeMeta", card)?.textContent || "تلگرام").replace(/\s+/g, " ").trim();
    return { name, avatar, meta, card, index };
  }

  function renderCreatorRail() {
    const rail = q("#v6CreatorRail");
    if (!rail) return;

    if (!document.body.classList.contains("mode-feed")) {
      rail.innerHTML = "";
      return;
    }

    const unique = [];
    const seen = new Set();

    qa("#grid .card").forEach((card, index) => {
      if (unique.length >= 6) return;
      const data = creatorCardData(card, index);
      const key = data.name.toLowerCase();
      if (!data.name || seen.has(key)) return;
      seen.add(key);
      unique.push(data);
    });

    if (unique.length < 2) {
      rail.innerHTML = "";
      return;
    }

    rail.innerHTML = unique.map((item, index) => `
      <article class="v6-creator-card" data-v6-creator="${index}">
        ${item.avatar
          ? `<img src="${escapeHtml(item.avatar)}" alt="">`
          : `<span class="v6-creator-avatar-fallback">${escapeHtml(item.name.slice(0,1))}</span>`}
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.meta || "کانال تلگرام")}</small>
        <button type="button">مشاهده</button>
      </article>
    `).join("");

    qa("[data-v6-creator]", rail).forEach((element) => {
      element.querySelector("button")?.addEventListener("click", () => {
        const item = unique[Number(element.dataset.v6Creator)];
        q(".cardOpen", item?.card)?.click();
      });
    });
  }

  function decorateHub() {
    if (!document.body.classList.contains("mode-hub")) return;
    const hub = q("#grid .hub");
    if (!hub) return;

    qa(".hubPanel", hub).forEach((panel) => {
      const title = q(".hubPanelHead h3", panel)?.textContent?.trim() || "";
      if (title.includes("داشبورد سازنده")) panel.classList.add("v6-legacy-creator-panel");
    });

    if (!q(".v6-hub-creator-entry", hub)) {
      const entry = document.createElement("div");
      entry.className = "v6-hub-creator-entry";
      entry.innerHTML = `
        <i>↗</i>
        <div><b>Creator Center</b><span>رشد، عضویت و عملکرد محتوا</span></div>
        <button type="button">باز کردن</button>
      `;
      entry.querySelector("button")?.addEventListener("click", openCreatorCenter);
      const hero = q(".hubHero", hub);
      hero ? hero.insertAdjacentElement("afterend", entry) : hub.prepend(entry);
    }
  }

  function decorateHost() {
    relocateDiscoveryModules();
    decorateMediaCards();
    renderCreatorRail();
    decorateHub();
  }

  function scheduleDecorate() {
    clearTimeout(state.decorateTimer);
    state.decorateTimer = setTimeout(decorateHost, 20);
  }

  function watchHost() {
    const grid = q("#grid");
    if (grid && !state.gridObserver) {
      state.gridObserver = new MutationObserver(scheduleDecorate);
      state.gridObserver.observe(grid, { childList: true, subtree: true });
    }

    if (!state.bodyObserver) {
      state.bodyObserver = new MutationObserver(scheduleDecorate);
      state.bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function bindExistingAddChannel() {
    const openBtn = q("#openAddChannel");
    const modal = q("#addChannelModal");
    const closeBtn = q("#addChannelClose");
    const submit = q("#addChannelSubmit");
    const input = q("#addChannelInput");
    const message = q("#addChannelMessage");

    if (!openBtn || !modal || !closeBtn || !submit || !input || !message) return false;
    if (submit.dataset.v6Bound === "1") return true;
    submit.dataset.v6Bound = "1";

    openBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      modal.classList.add("open");
      requestAnimationFrame(() => input.focus());
    }, true);

    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      modal.classList.remove("open");
    }, true);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.remove("open");
    }, true);

    submit.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const channel = parseChannelInput(input.value);
      if (!channel) {
        message.textContent = "نام کاربری یا لینک کانال را وارد کن.";
        return;
      }

      submit.disabled = true;
      message.textContent = "در حال بررسی و ثبت کانال…";

      try {
        const result = await request(ADD_CHANNEL_API, {
          method: "POST",
          body: JSON.stringify({
            username: channel,
            channel,
            channel_username: channel,
          }),
        });

        const botAdmin = Boolean(result?.bot_admin || result?.is_bot_admin);
        const verified = Boolean(result?.verified || result?.ownership_verified);

        message.textContent = botAdmin
          ? "✓ کانال ثبت شد؛ Sync و Join Tracking دقیق فعال است."
          : verified
            ? "✓ کانال ثبت شد؛ برای Join Tracking دقیق، ربات را Admin کن."
            : "✓ کانال عمومی ثبت شد و Sync می‌شود؛ مالکیت هنوز تأیید نشده است.";

        input.value = "";
        scheduleDecorate();
        setTimeout(() => {
          modal.classList.remove("open");
          message.textContent = "";
        }, 1900);
      } catch (error) {
        message.textContent = `✕ ${error?.message || "ثبت کانال انجام نشد."}`;
      } finally {
        submit.disabled = false;
      }
    }, true);

    return true;
  }

  function installFallbackAddChannel() {
    if (q("#openAddChannel") || !q(".tabs")) return;

    const card = document.createElement("section");
    card.id = "addChannelCard";
    card.className = "add-channel-card";
    card.innerHTML = `
      <div class="add-channel-icon">＋</div>
      <div class="add-channel-content">
        <h3>کانالت را به Discovery اضافه کن</h3>
        <p>کانال عمومی بدون Bot Admin هم قابل ثبت و Sync است.</p>
        <button id="openAddChannel" type="button">افزودن</button>
      </div>
    `;
    q(".tabs").insertAdjacentElement("afterend", card);

    const modal = document.createElement("div");
    modal.className = "add-channel-modal";
    modal.id = "addChannelModal";
    modal.innerHTML = `
      <div class="add-channel-box" role="dialog" aria-modal="true" aria-label="افزودن کانال">
        <h3>افزودن کانال به Discovery</h3>
        <input id="addChannelInput" dir="ltr" placeholder="@channel یا t.me/channel">
        <div id="addChannelMessage"></div>
        <div class="add-channel-actions">
          <button id="addChannelSubmit" type="button">ثبت کانال</button>
          <button id="addChannelClose" type="button">لغو</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    bindExistingAddChannel();
  }

  const creatorHost = document.createElement("div");
  creatorHost.id = "creatorCenterV6Root";
  document.body.appendChild(creatorHost);
  const creatorRoot = creatorHost.attachShadow({ mode: "open" });

  creatorRoot.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      button,select{font:inherit}
      .launcher{display:none!important}
      .launcher i{width:19px;height:19px;display:grid;place-items:center;border-radius:50%;background:#FF7A45;color:#fff;font-style:normal;font-size:10px}
      .backdrop{position:fixed;z-index:2147483001;inset:0;display:none;background:#0A0A0A;backdrop-filter:none}
      .backdrop.open{display:block}
      .sheet{
        position:absolute;inset:0;max-height:100dvh;overflow:auto;direction:rtl;color:#F5F5F5;background:#0A0A0A;
        border:0;border-radius:0;box-shadow:none;
        font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif
      }
      .wrap{width:min(100%,700px);margin:auto;padding:12px 10px 24px}
      .top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 10px;background:#0A0A0A}
      .identity{display:flex;align-items:center;gap:9px}
      .logo{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#FF7147;color:#fff;font-weight:900;font-size:14px}
      .title b{display:block;font-size:15px;line-height:19px}
      .title span{display:block;margin-top:2px;color:#858585;font-size:8px;line-height:11px}
      .close{width:36px;height:36px;border:1px solid #303030;border-radius:11px;color:#D8D8D8;background:#171717;cursor:pointer}
      .toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-bottom:7px}
      .channels{display:flex;gap:5px;overflow:auto;padding-bottom:2px;scrollbar-width:none}
      .channels::-webkit-scrollbar{display:none}
      .chip{flex:0 0 auto;height:30px;padding:0 9px;border:1px solid #373737;border-radius:999px;color:#BDBDBD;background:#101010;font-size:9px;cursor:pointer;white-space:nowrap}
      .chip.active{color:#0A0A0A;background:#EFEFEF;border-color:#EFEFEF}
      .chip em{margin-inline-start:4px;color:#249B68;font-style:normal}
      select{height:30px;padding:0 8px;border:1px solid #333;border-radius:9px;color:#D7D7D7;background:#161616;outline:0;font-size:9px}
      .overview{display:flex;align-items:end;justify-content:space-between;gap:10px;margin:2px 1px 8px}
      .overview b{font-size:13px;line-height:17px}
      .overview span{color:#777;font-size:7px}
      .channelState{display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:9px 10px;border:1px solid #282828;border-radius:12px;background:#151515}
      .channelState .dot{width:7px;height:7px;border-radius:50%;background:#37C98B}
      .channelState b{font-size:10px}
      .channelState span{margin-inline-start:auto;color:#858585;font-size:7px}
      .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .metric{min-width:0;min-height:72px;padding:9px 9px;border:1px solid #2B2B2B;border-radius:11px;background:#181818}
      .metric.accent{border-color:#3A302B;background:#1C1715}
      .metric small{display:block;overflow:hidden;color:#8B8B8B;font-size:8px;line-height:10px;text-overflow:ellipsis;white-space:nowrap}
      .metric strong{display:block;margin-top:7px;color:#F5F5F5;font-size:19px;line-height:20px;font-weight:820;white-space:nowrap;font-variant-numeric:tabular-nums}
      .metric .hint{display:block;margin-top:6px;color:#707070;font-size:7px;line-height:9px}
      .section{margin-top:9px;padding:10px;border:1px solid #2B2B2B;border-radius:13px;background:#151515}
      .sectionHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
      .sectionHead b{font-size:11px}
      .sectionHead span{color:#777;font-size:7px}
      .funnel{display:grid;gap:8px}
      .funnelRow{display:grid;grid-template-columns:72px minmax(0,1fr) 44px;align-items:center;gap:7px;min-height:26px}
      .funnelRow span{color:#9D9D9D;font-size:8px}
      .funnelRow b{text-align:left;color:#E0E0E0;font-size:9px;font-variant-numeric:tabular-nums}
      .track{height:7px;overflow:hidden;border-radius:999px;background:#242424}
      .bar{height:100%;min-width:0;border-radius:999px;background:#2AABEE}
      .bar.orange{background:#FF7A45}.bar.purple{background:#8B5CF6}.bar.green{background:#37C98B}
      .list{display:grid;gap:6px}
      .item{padding:8px;border:1px solid #292929;border-radius:10px;background:#181818}
      .itemTitle{font-size:10px;font-weight:650;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mini{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin-top:6px}
      .mini div{min-width:0;padding:5px 2px;border-radius:7px;background:#101010;text-align:center}
      .mini span{display:block;color:#777;font-size:6px;white-space:nowrap}
      .mini b{display:block;margin-top:3px;font-size:8px;white-space:nowrap;font-variant-numeric:tabular-nums}
      .empty,.error,.loading{padding:18px;text-align:center;color:#898989;font-size:9px}
      .error{color:#FF7D85}
      .foot{display:flex;align-items:center;gap:6px;margin-top:8px;color:#777;font-size:7px}
      .foot button{margin-inline-start:auto;min-height:31px;padding:0 9px;border:0;border-radius:9px;color:#fff;background:#2AABEE;cursor:pointer;font-size:8px;font-weight:700}
      .foot button:disabled{opacity:.45;cursor:default}
      @media(max-width:340px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.metric{min-height:68px}.metric strong{font-size:17px}.funnelRow{grid-template-columns:62px minmax(0,1fr) 38px}}
      @media(min-width:560px){.sheet{inset:4dvh max(10px,calc((100vw - 720px)/2)) auto;border:1px solid #292929;border-radius:20px;max-height:92dvh;box-shadow:0 18px 60px rgba(0,0,0,.48)}}
      @media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
    </style>

    <button class="launcher" id="openCreator" type="button"><i>↗</i> Creator</button>
    <div class="backdrop" id="creatorBackdrop">
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Creator Center">
        <div class="wrap">
          <header class="top">
            <div class="identity">
              <div class="logo">C</div>
              <div class="title"><b>Creator Center</b><span>رشد، عضویت و عملکرد محتوا</span></div>
            </div>
            <button class="close" id="closeCreator" type="button" aria-label="بستن">✕</button>
          </header>
          <div class="toolbar">
            <div class="channels" id="creatorChannels"></div>
            <select id="creatorDays" aria-label="بازه زمانی">
              <option value="7">۷ روز</option>
              <option value="30" selected>۳۰ روز</option>
              <option value="90">۹۰ روز</option>
              <option value="365">۱ سال</option>
            </select>
          </div>
          <div id="creatorBody"><div class="loading">در حال دریافت اطلاعات…</div></div>
        </div>
      </section>
    </div>
  `;

  const cq = (selector) => creatorRoot.querySelector(selector);
  const cqa = (selector) => [...creatorRoot.querySelectorAll(selector)];

  function renderCreatorChannels() {
    const target = cq("#creatorChannels");
    if (!target) return;

    if (!state.channels.length) {
      target.innerHTML = `<span class="empty" style="padding:7px">کانالی ثبت نشده</span>`;
      return;
    }

    target.innerHTML = state.channels.map((channel) => `
      <button class="chip ${channel.id === state.selectedChannelId ? "active" : ""}" data-channel-id="${escapeHtml(channel.id)}" type="button">
        ${escapeHtml(channel.title || channel.username || "کانال")}${channel.verified ? "<em>✓</em>" : ""}
      </button>
    `).join("");

    cqa("[data-channel-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.selectedChannelId = button.dataset.channelId || "";
        renderCreatorChannels();
        await loadCreatorSelected();
      });
    });
  }

  function metric(label, value, hint = "", accent = false) {
    return `
      <div class="metric ${accent ? "accent" : ""}">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
        ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
      </div>
    `;
  }

  function funnelWidth(value, max) {
    if (max <= 0) return 0;
    const current = num(value);
    if (current <= 0) return 0;
    return Math.max(2, Math.min(100, (current / max) * 100));
  }

  function renderCreatorBody() {
    const body = cq("#creatorBody");
    const dashboard = state.dashboard;
    if (!body) return;

    if (!dashboard) {
      body.innerHTML = `<div class="empty">برای مشاهده آمار، یک کانال را انتخاب کن.</div>`;
      return;
    }

    const channel = state.channels.find((item) => item.id === state.selectedChannelId);
    const views = Math.max(dashboard.views, dashboard.uniqueViewers, 1);
    const statusText = channel?.botAdmin ? "Tracking دقیق عضویت فعال" : "Discovery فعال · Join Tracking محدود";

    body.innerHTML = `
      <div class="overview">
        <b>Overview</b>
        <span>${Number(state.days).toLocaleString("fa-IR")} روز اخیر</span>
      </div>

      <div class="channelState">
        <span class="dot"></span>
        <b>${escapeHtml(channel?.title || dashboard.title || "کانال")}</b>
        ${channel?.username ? `<span>@${escapeHtml(channel.username)}</span>` : ""}
        <span>${escapeHtml(statusText)}</span>
      </div>

      <div class="metrics">
        ${metric("Views", compact.format(dashboard.views), "نمایش", false)}
        ${metric("Unique", compact.format(dashboard.uniqueViewers), "کاربر یکتا", false)}
        ${metric("TG Opens", compact.format(dashboard.telegramOpens), "بازشدن تلگرام", false)}
        ${metric("Join Clicks", compact.format(dashboard.joinClicks), "کلیک عضویت", false)}
        ${metric("TG Joins", compact.format(dashboard.telegramJoins), "عضویت", true)}
        ${metric("Active", compact.format(dashboard.activeJoins), "فعال", false)}
        ${metric("Leaves", compact.format(dashboard.leaves), "خروج", false)}
        ${metric("Conversion", percent(dashboard.joinConversion), "Join / Click", true)}
      </div>

      <section class="section">
        <div class="sectionHead"><b>Conversion Funnel</b><span>${Number(state.days).toLocaleString("fa-IR")} روز اخیر</span></div>
        <div class="funnel">
          <div class="funnelRow"><span>Views</span><div class="track"><div class="bar" style="width:${funnelWidth(dashboard.views, views)}%"></div></div><b>${compact.format(dashboard.views)}</b></div>
          <div class="funnelRow"><span>TG Opens</span><div class="track"><div class="bar purple" style="width:${funnelWidth(dashboard.telegramOpens, views)}%"></div></div><b>${compact.format(dashboard.telegramOpens)}</b></div>
          <div class="funnelRow"><span>Join Clicks</span><div class="track"><div class="bar orange" style="width:${funnelWidth(dashboard.joinClicks, views)}%"></div></div><b>${compact.format(dashboard.joinClicks)}</b></div>
          <div class="funnelRow"><span>TG Joins</span><div class="track"><div class="bar green" style="width:${funnelWidth(dashboard.telegramJoins, views)}%"></div></div><b>${compact.format(dashboard.telegramJoins)}</b></div>
        </div>
      </section>

      <section class="section">
        <div class="sectionHead"><b>Content Performance</b><span>${state.content.length.toLocaleString("fa-IR")} محتوا</span></div>
        <div class="list">
          ${state.content.length ? state.content.slice(0, 8).map((item) => `
            <article class="item">
              <div class="itemTitle">${escapeHtml(item.title)}</div>
              <div class="mini">
                <div><span>Views</span><b>${compact.format(item.views)}</b></div>
                <div><span>Unique</span><b>${compact.format(item.unique)}</b></div>
                <div><span>Clicks</span><b>${compact.format(item.clicks)}</b></div>
                <div><span>Joins</span><b>${compact.format(item.joins)}</b></div>
                <div><span>Conv.</span><b>${percent(item.conversion)}</b></div>
              </div>
            </article>
          `).join("") : `<div class="empty">هنوز داده‌ای برای عملکرد محتوا ثبت نشده است.</div>`}
        </div>
      </section>

      <div class="foot">
        <span>${channel?.botAdmin ? "✓ Bot Admin" : "Bot Admin برای Join Tracking دقیق لازم است"}</span>
        <button id="creatorTracking" type="button" ${channel?.botAdmin ? "" : "disabled"}>Tracking Link</button>
      </div>
    `;

    cq("#creatorTracking")?.addEventListener("click", createTrackingLink);
  }

  async function loadCreatorChannels() {
    const raw = await creatorApi("/channels");
    state.channels = normalizeChannels(raw);
    if (!state.selectedChannelId || !state.channels.some((item) => item.id === state.selectedChannelId)) {
      state.selectedChannelId = state.channels[0]?.id || "";
    }
    renderCreatorChannels();
  }

  async function loadDashboardForChannel() {
    const id = encodeURIComponent(state.selectedChannelId);
    const days = encodeURIComponent(state.days);

    try {
      return normalizeDashboard(await creatorApi(`/dashboard?channel_id=${id}&days=${days}`));
    } catch {
      const raw = await creatorApi(`/analytics?channel_id=${id}&days=${days}`);
      const candidates = raw?.channels || raw?.items || raw?.data || raw;
      const selected = Array.isArray(candidates)
        ? candidates.find((item) => (item.channel_id || item.id || item.creator_channel_id) === state.selectedChannelId) || candidates[0] || {}
        : candidates;
      return normalizeDashboard(selected);
    }
  }

  async function loadContentForChannel() {
    const id = encodeURIComponent(state.selectedChannelId);
    const days = encodeURIComponent(state.days);

    try {
      return normalizeContent(await creatorApi(`/content?channel_id=${id}&days=${days}&limit=50`));
    } catch {
      return normalizeContent(await creatorApi(`/content-performance?channel_id=${id}&days=${days}&limit=50`));
    }
  }

  async function loadCreatorSelected() {
    const body = cq("#creatorBody");
    if (!state.selectedChannelId) {
      state.dashboard = null;
      state.content = [];
      renderCreatorBody();
      return;
    }

    if (body) body.innerHTML = `<div class="loading">در حال دریافت آمار…</div>`;

    try {
      const [dashboard, content] = await Promise.all([
        loadDashboardForChannel(),
        loadContentForChannel(),
      ]);
      state.dashboard = dashboard;
      state.content = content;
      renderCreatorBody();
    } catch (error) {
      if (body) body.innerHTML = `<div class="error">${escapeHtml(error?.message || String(error))}</div>`;
    }
  }

  async function refreshCreatorCenter() {
    const body = cq("#creatorBody");
    try {
      await loadCreatorChannels();
      await loadCreatorSelected();
    } catch (error) {
      if (body) body.innerHTML = `<div class="error">${escapeHtml(error?.message || String(error))}</div>`;
    }
  }

  async function createTrackingLink() {
    const channel = state.channels.find((item) => item.id === state.selectedChannelId);
    if (!channel?.botAdmin) return;

    const button = cq("#creatorTracking");
    if (!button) return;
    button.disabled = true;

    try {
      const raw = await creatorApi("/tracking-link", {
        method: "POST",
        body: JSON.stringify({
          channel_id: state.selectedChannelId,
          source: "creator_center_v6",
        }),
      });

      const url = raw?.url || raw?.tracking_url || raw?.link || "";
      if (!url) throw new Error("لینک Tracking ساخته نشد.");

      try {
        await navigator.clipboard.writeText(url);
        button.textContent = "کپی شد ✓";
      } catch {
        try { tg?.openTelegramLink?.(url); } catch {}
        button.textContent = "باز شد ✓";
      }

      setTimeout(() => { button.textContent = "Tracking Link"; }, 1500);
    } catch (error) {
      button.textContent = error?.message || "خطا";
      setTimeout(() => { button.textContent = "Tracking Link"; }, 1800);
    } finally {
      button.disabled = false;
    }
  }

  async function openCreatorCenter() {
    state.creatorOpen = true;
    cq("#creatorBackdrop")?.classList.add("open");
    try { tg?.expand?.(); } catch {}
    await refreshCreatorCenter();
  }

  function closeCreatorCenter() {
    state.creatorOpen = false;
    cq("#creatorBackdrop")?.classList.remove("open");
  }

  function bindCreatorCenter() {
    cq("#openCreator")?.addEventListener("click", openCreatorCenter);
    cq("#closeCreator")?.addEventListener("click", closeCreatorCenter);
    cq("#creatorBackdrop")?.addEventListener("click", (event) => {
      if (event.target === cq("#creatorBackdrop")) closeCreatorCenter();
    });
    cq("#creatorDays")?.addEventListener("change", async (event) => {
      state.days = Number(event.target.value || 30);
      await loadCreatorSelected();
    });
  }

  function boot() {
    installHostTheme();
    bindTelegramEvents();
    installFallbackAddChannel();
    bindExistingAddChannel();
    relocateDiscoveryModules();
    bindCreatorCenter();
    watchHost();
    decorateHost();

    document.documentElement.dataset.creatorGrowthUi = `v${VERSION}`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
