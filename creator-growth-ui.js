/*
 * Telegram Discovery — v6.1 Pixel Tuning
 * Load AFTER creator-growth-ui.js v6.
 * Purpose: screenshot-driven refinement without changing Discovery/Creator APIs.
 */
(() => {
  "use strict";

  const VERSION = "6.1.0";

  function installHostTuning() {
    if (document.getElementById("creatorGrowthV61HostTuning")) return;

    const style = document.createElement("style");
    style.id = "creatorGrowthV61HostTuning";
    style.textContent = `
      /* ===== HOME / DISCOVERY ===== */

      .app{
        padding-right:9px!important;
        padding-left:9px!important;
      }

      /* Add Channel should be a compact utility CTA, not a hero block. */
      .add-channel-card{
        min-height:54px!important;
        margin-bottom:8px!important;
        padding:7px 9px!important;
        border-radius:13px!important;
      }
      .add-channel-icon{
        width:34px!important;
        height:34px!important;
        flex-basis:34px!important;
        border-radius:11px!important;
      }
      .add-channel-content h3{
        margin:0!important;
        font-size:12px!important;
        line-height:15px!important;
      }
      .add-channel-content p{
        margin-top:2px!important;
        font-size:8px!important;
        line-height:11px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      .add-channel-content button{
        min-height:32px!important;
        height:32px!important;
        padding:0 10px!important;
        border-radius:10px!important;
        font-size:9px!important;
      }

      /* Reference-like horizontal creator cards: slightly smaller and tighter. */
      .v6-creator-rail{
        gap:7px!important;
        margin-bottom:9px!important;
        padding:0 2px 3px!important;
        scroll-padding-inline:2px!important;
        overscroll-behavior-inline:contain!important;
      }
      .v6-creator-card{
        flex-basis:126px!important;
        min-height:118px!important;
        padding:8px 7px 7px!important;
        border-radius:13px!important;
      }
      .v6-creator-card img,
      .v6-creator-avatar-fallback{
        width:44px!important;
        height:44px!important;
        flex-basis:44px!important;
      }
      .v6-creator-card strong{
        margin-top:6px!important;
        font-size:9px!important;
        line-height:12px!important;
      }
      .v6-creator-card small{
        font-size:7px!important;
        line-height:10px!important;
      }
      .v6-creator-card button{
        min-height:26px!important;
        font-size:8px!important;
      }

      /* Feed should resemble the supplied social-feed references more closely. */
      .mode-feed .grid{
        gap:9px!important;
      }
      .mode-feed .card{
        border-radius:14px!important;
      }
      .mode-feed .mediaStage,
      .mode-feed .card.hero .mediaStage,
      .mode-feed .card.wide .mediaStage{
        aspect-ratio:16/9!important;
        max-height:330px!important;
      }
      .mode-feed .copy,
      .mode-feed .card.hero .copy{
        padding:10px 10px 11px!important;
      }
      .mode-feed .title{
        font-size:12px!important;
        line-height:1.75!important;
      }
      .mode-feed .channel{
        font-size:10px!important;
      }
      .mode-feed .meta{
        font-size:8px!important;
      }

      /* Bottom navigation: flatter, closer to black social app references. */
      .nav{
        border-color:#242424!important;
        background:#050505!important;
        box-shadow:0 -4px 14px rgba(0,0,0,.28)!important;
        backdrop-filter:none!important;
      }
      .nav button.active{
        background:transparent!important;
        color:#fff!important;
      }
      .nav button.active:after{
        background:#fff!important;
        box-shadow:none!important;
      }

      /* Hub: remove unnecessary visual mass. */
      .hubHero,.hubPanel,.v6-hub-creator-entry{
        box-shadow:none!important;
      }

      @media(max-width:360px){
        .v6-creator-card{flex-basis:118px!important}
        .mode-feed .mediaStage,
        .mode-feed .card.hero .mediaStage,
        .mode-feed .card.wide .mediaStage{
          max-height:285px!important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function latinizeNumberText(value) {
    return String(value ?? "")
      .replace(/[۰٠]/g, "0")
      .replace(/[۱١]/g, "1")
      .replace(/[۲٢]/g, "2")
      .replace(/[۳٣]/g, "3")
      .replace(/[۴٤]/g, "4")
      .replace(/[۵٥]/g, "5")
      .replace(/[۶٦]/g, "6")
      .replace(/[۷٧]/g, "7")
      .replace(/[۸٨]/g, "8")
      .replace(/[۹٩]/g, "9")
      .replace(/٪/g, "%");
  }

  function tuneCreatorRoot(root) {
    if (!root || root.getElementById("creatorGrowthV61ShadowTuning")) return;

    const style = document.createElement("style");
    style.id = "creatorGrowthV61ShadowTuning";
    style.textContent = `
      /* Creator Center is now accessed from "من"; hide redundant floating FAB. */
      .fab{display:none!important}

      .sheet{
        background:#0A0A0A!important;
      }
      .wrap{
        padding:11px 10px 18px!important;
      }

      .top{
        margin-bottom:8px!important;
      }
      .logo{
        width:40px!important;
        height:40px!important;
        border-radius:12px!important;
        background:#FF7348!important;
        box-shadow:none!important;
      }
      .title b{
        font-size:15px!important;
      }
      .title span{
        font-size:8px!important;
      }
      .close{
        width:38px!important;
        height:38px!important;
        border-radius:11px!important;
      }

      .channelState{
        min-height:44px!important;
        padding:8px 10px!important;
        border-radius:12px!important;
      }

      /* Tighter metric cards like the analytics references. */
      .metrics{
        gap:6px!important;
      }
      .metric{
        min-height:82px!important;
        padding:9px 8px!important;
        border-radius:11px!important;
        background:#181818!important;
      }
      .metric.accent{
        background:#1B1715!important;
      }
      .metric small{
        font-size:8px!important;
        line-height:10px!important;
      }
      .metric strong{
        margin-top:7px!important;
        font-size:18px!important;
        line-height:18px!important;
        font-variant-numeric:tabular-nums!important;
      }
      .metric .hint{
        margin-top:6px!important;
        font-size:7px!important;
        line-height:9px!important;
      }

      .section{
        margin-top:8px!important;
        padding:10px!important;
        border-radius:13px!important;
      }
      .sectionHead b{
        font-size:12px!important;
      }
      .sectionHead span{
        font-size:7px!important;
      }

      /* Funnel: do not visually fake activity when the metric is zero. */
      .funnelRow .bar{
        min-width:0!important;
      }
      .funnelRow{
        min-height:34px!important;
      }

      /* Content Performance should scan like analytics rows, not a long stack of cards. */
      .list{
        gap:5px!important;
      }
      .item{
        padding:8px!important;
        border-radius:10px!important;
        background:#171717!important;
      }
      .itemTitle{
        font-size:10px!important;
        line-height:14px!important;
      }
      .mini{
        gap:4px!important;
        margin-top:6px!important;
      }
      .mini div{
        padding:5px 4px!important;
        border-radius:8px!important;
        background:#101010!important;
      }
      .mini span{
        font-size:7px!important;
      }
      .mini b{
        font-size:10px!important;
        font-variant-numeric:tabular-nums!important;
      }

      /* First screen should stay compact. Keep deeper history available after scrolling. */
      .list .item:nth-child(n+9){
        display:none!important;
      }

      @media(max-width:360px){
        .metrics{
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:5px!important;
        }
        .metric{
          min-height:78px!important;
          padding:8px 6px!important;
        }
        .metric strong{
          font-size:16px!important;
        }
      }
    `;
    root.appendChild(style);

    const clean = () => {
      // Keep dashboard numerals visually unambiguous.
      root.querySelectorAll(".metric strong,.funnelRow b,.mini b").forEach((node) => {
        const next = latinizeNumberText(node.textContent);
        if (node.textContent !== next) node.textContent = next;
      });

      // Missing content titles are a backend-data limitation; use a cleaner fallback.
      root.querySelectorAll(".itemTitle").forEach((node) => {
        if (node.textContent.trim() === "بدون عنوان") {
          node.textContent = "پست تلگرام";
        }
      });

      // The v6 funnel intentionally gave zero-value stages a minimum width.
      // That reads as fake activity in the screenshot, so force true zero to 0%.
      root.querySelectorAll(".funnelRow").forEach((row) => {
        const valueNode = row.querySelector("b");
        const bar = row.querySelector(".bar");
        if (!valueNode || !bar) return;
        const normalized = latinizeNumberText(valueNode.textContent)
          .replace(/[^\d.-]/g, "");
        const value = Number(normalized || 0);
        if (value === 0) bar.style.width = "0%";
      });
    };

    clean();

    const observer = new MutationObserver(() => {
      requestAnimationFrame(clean);
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
  }

  function attachCreatorTuning() {
    const attach = () => {
      const host = document.getElementById("creatorCenterV6Root");
      if (host?.shadowRoot) {
        tuneCreatorRoot(host.shadowRoot);
        return true;
      }
      return false;
    };

    if (attach()) return;

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function boot() {
    installHostTuning();
    attachCreatorTuning();
    document.documentElement.dataset.creatorGrowthTuning = VERSION;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
