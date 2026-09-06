/*
 * Telegram Discovery — Media Consistency v1
 *
 * Load AFTER creator-growth-ui.js and home-compact-controls-stable-v2.js.
 *
 * Goals:
 * - Keep avatar/media sizing consistent across Home + Explore.
 * - Recover broken/missing Telegram post previews.
 * - Never leave empty/broken media boxes.
 * - Make true text-only posts look intentional.
 * - Do not change Discovery ranking/data logic.
 */
(() => {
  "use strict";

  const STYLE_ID = "tdMediaConsistencyV1";
  const POST_PREVIEW_API = "/api/telegram/preview-image";
  const CHANNEL_AVATAR_API = "/api/telegram/channel-avatar";

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeAttr(value) {
    return encodeURIComponent(String(value || ""));
  }

  function liveItems() {
    try {
      return typeof S !== "undefined" && Array.isArray(S?.items) ? S.items : [];
    } catch {
      return [];
    }
  }

  function itemForCard(card) {
    const opener = q(".cardOpen", card);
    const index = Number(opener?.dataset?.open);
    if (!Number.isInteger(index) || index < 0) return null;
    return liveItems()[index] || null;
  }

  function sourceUrl(item) {
    return String(
      item?.source_url ||
      item?.telegram_url ||
      item?.channel_url ||
      item?.url ||
      ""
    ).trim();
  }

  function username(item) {
    const direct = String(
      item?.channel_username ||
      item?.creator_username ||
      item?.username ||
      ""
    ).replace(/^@/, "").trim();

    if (direct) return direct;

    const url = sourceUrl(item);
    return url.match(
      /^https?:\/\/(?:www\.)?t\.me\/(?:s\/)?([A-Za-z0-9_]{4,32})(?:\/|$)/i
    )?.[1] || "";
  }

  function previewUrl(item) {
    const url = sourceUrl(item);

    if (!/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_]{4,32}\/\d+/i.test(url)) {
      return "";
    }

    return `${POST_PREVIEW_API}?url=${escapeAttr(url)}`;
  }

  function avatarUrl(item) {
    const user = username(item);
    return user ? `${CHANNEL_AVATAR_API}?username=${escapeAttr(user)}` : "";
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ---------- Avatar consistency ---------- */
      #grid .avatar,
      #grid .nativeAvatar{
        position:relative!important;
        overflow:hidden!important;
        border-radius:50%!important;
        background:#242424!important;
        flex-shrink:0!important;
      }

      #grid .avatar img,
      #grid .nativeAvatar img,
      .v6-creator-card img{
        display:block!important;
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        object-position:center!important;
        border-radius:inherit!important;
      }

      #grid .td-avatar-fallback{
        position:absolute!important;
        inset:0!important;
        display:grid!important;
        place-items:center!important;
        color:#BFC5CC!important;
        background:#242424!important;
        font-size:11px!important;
        font-weight:800!important;
        line-height:1!important;
      }

      /* ---------- Media geometry ---------- */
      #grid .mediaStage,
      #grid .v6-auto-media-stage,
      #grid .td-media-stage{
        position:relative!important;
        width:100%!important;
        overflow:hidden!important;
        background:#111!important;
        border-radius:0!important;
        isolation:isolate!important;
      }

      /* 2-column Home/Explore: consistent square visual rhythm */
      body.mode-feed[data-discovery-channel-count="2"] #grid .mediaStage,
      body.mode-feed[data-discovery-channel-count="3"] #grid .mediaStage,
      body.mode-feed[data-discovery-channel-count="4"] #grid .mediaStage,
      body.mode-feed[data-discovery-channel-count="2"] #grid .v6-auto-media-stage,
      body.mode-feed[data-discovery-channel-count="3"] #grid .v6-auto-media-stage,
      body.mode-feed[data-discovery-channel-count="4"] #grid .v6-auto-media-stage,
      body.mode-feed[data-discovery-channel-count="2"] #grid .td-media-stage,
      body.mode-feed[data-discovery-channel-count="3"] #grid .td-media-stage,
      body.mode-feed[data-discovery-channel-count="4"] #grid .td-media-stage,
      body.mode-explore[data-discovery-channel-count="2"] #grid .mediaStage,
      body.mode-explore[data-discovery-channel-count="3"] #grid .mediaStage,
      body.mode-explore[data-discovery-channel-count="4"] #grid .mediaStage,
      body.mode-explore[data-discovery-channel-count="2"] #grid .v6-auto-media-stage,
      body.mode-explore[data-discovery-channel-count="3"] #grid .v6-auto-media-stage,
      body.mode-explore[data-discovery-channel-count="4"] #grid .v6-auto-media-stage,
      body.mode-explore[data-discovery-channel-count="2"] #grid .td-media-stage,
      body.mode-explore[data-discovery-channel-count="3"] #grid .td-media-stage,
      body.mode-explore[data-discovery-channel-count="4"] #grid .td-media-stage{
        aspect-ratio:1/1!important;
      }

      /* Larger single-column cards */
      body[data-discovery-channel-count="1"] #grid .mediaStage,
      body[data-discovery-channel-count="1"] #grid .v6-auto-media-stage,
      body[data-discovery-channel-count="1"] #grid .td-media-stage{
        aspect-ratio:16/10!important;
      }

      #grid .mediaStage img,
      #grid .mediaStage video,
      #grid .mediaStage .media,
      #grid .v6-auto-media-stage img,
      #grid .td-media-stage img,
      #grid .td-media-stage video{
        display:block!important;
        width:100%!important;
        height:100%!important;
        max-width:none!important;
        object-fit:cover!important;
        object-position:center!important;
        background:#111!important;
      }

      /* Avoid distorted Telegram screenshots/doc thumbs. */
      #grid .document-card .mediaStage img,
      #grid .document-card .td-media-stage img{
        object-fit:contain!important;
        padding:8px!important;
        background:#151515!important;
      }

      /* ---------- Loading / failure states ---------- */
      #grid .td-media-loading:after{
        content:""!important;
        position:absolute!important;
        inset:0!important;
        background:
          linear-gradient(105deg,
            transparent 35%,
            rgba(255,255,255,.035) 46%,
            rgba(255,255,255,.055) 50%,
            transparent 62%
          )!important;
        transform:translateX(-100%)!important;
        animation:tdMediaShimmer 1.35s ease-in-out infinite!important;
        pointer-events:none!important;
      }

      @keyframes tdMediaShimmer{
        to{transform:translateX(100%)}
      }

      #grid .td-media-failed{
        display:none!important;
      }

      /* ---------- Intentional text-only card ---------- */
      #grid .card.td-text-only{
        background:#181818!important;
      }

      #grid .card.td-text-only .nativePreview,
      #grid .card.td-text-only .copy{
        min-height:132px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:space-between!important;
      }

      #grid .card.td-text-only .nativeMessage,
      #grid .card.td-text-only .title{
        -webkit-line-clamp:7!important;
        line-clamp:7!important;
      }

      body.mode-feed[data-discovery-channel-count="4"] #grid .card.td-text-only .nativePreview,
      body.mode-feed[data-discovery-channel-count="4"] #grid .card.td-text-only .copy,
      body.mode-explore[data-discovery-channel-count="4"] #grid .card.td-text-only .nativePreview,
      body.mode-explore[data-discovery-channel-count="4"] #grid .card.td-text-only .copy{
        min-height:155px!important;
      }

      /* Remove any browser broken-image visual residue. */
      #grid img.td-broken-media{
        display:none!important;
      }

      @media(prefers-reduced-motion:reduce){
        #grid .td-media-loading:after{
          animation:none!important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function avatarInitial(card, item) {
    const label = String(
      item?.channel_title ||
      item?.creator_name ||
      item?.channel_username ||
      item?.creator_username ||
      "T"
    ).trim();

    return label.slice(0, 1).toUpperCase() || "T";
  }

  function ensureAvatar(card, item) {
    qa(".avatar, .nativeAvatar", card).forEach((holder) => {
      const existing = q("img", holder);

      if (existing) {
        existing.loading = "lazy";
        existing.decoding = "async";
        existing.addEventListener("error", () => {
          existing.remove();
          ensureAvatar(card, item);
        }, { once: true });
        return;
      }

      if (q(".td-avatar-fallback", holder)) return;

      const url = avatarUrl(item);

      if (!url) {
        const fallback = document.createElement("span");
        fallback.className = "td-avatar-fallback";
        fallback.textContent = avatarInitial(card, item);
        holder.appendChild(fallback);
        return;
      }

      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      img.addEventListener("error", () => {
        img.remove();

        if (!q(".td-avatar-fallback", holder)) {
          const fallback = document.createElement("span");
          fallback.className = "td-avatar-fallback";
          fallback.textContent = avatarInitial(card, item);
          holder.appendChild(fallback);
        }
      }, { once: true });

      holder.appendChild(img);
      img.src = url;
    });
  }

  function existingVisual(card) {
    return (
      q(".mediaStage", card) ||
      q(".v6-auto-media-stage", card) ||
      q(".td-media-stage", card)
    );
  }

  function validateExistingMedia(stage, card, item) {
    const images = qa("img", stage);
    const videos = qa("video", stage);

    if (!images.length && !videos.length) return;

    stage.classList.add("td-media-loading");

    let settled = false;

    const success = () => {
      if (settled) return;
      settled = true;
      stage.classList.remove("td-media-loading", "td-media-failed");
      card.classList.remove("td-text-only");
      card.classList.add("td-has-media");
    };

    const maybeFail = () => {
      const usableImage = images.some(
        (img) => img.complete && img.naturalWidth > 1 && img.naturalHeight > 1
      );

      const usableVideo = videos.some(
        (video) => video.readyState >= 1 || Boolean(video.poster)
      );

      if (usableImage || usableVideo) {
        success();
        return;
      }

      stage.classList.remove("td-media-loading");
      stage.classList.add("td-media-failed");

      recoverPreview(card, item, stage);
    };

    images.forEach((img) => {
      img.loading = "lazy";
      img.decoding = "async";

      if (img.complete) {
        if (img.naturalWidth > 1) success();
        else img.classList.add("td-broken-media");
      } else {
        img.addEventListener("load", success, { once: true });
        img.addEventListener("error", () => {
          img.classList.add("td-broken-media");
          maybeFail();
        }, { once: true });
      }
    });

    videos.forEach((video) => {
      video.preload = "metadata";
      video.playsInline = true;
      video.addEventListener("loadedmetadata", success, { once: true });
      video.addEventListener("error", maybeFail, { once: true });

      if (video.readyState >= 1) success();
    });

    setTimeout(maybeFail, 3500);
  }

  function recoverPreview(card, item, replaceStage = null) {
    if (q(".td-media-stage", card)) return;

    const url = previewUrl(item);

    if (!url) {
      if (replaceStage) replaceStage.remove();
      card.classList.add("td-text-only");
      return;
    }

    const stage = document.createElement("div");
    stage.className = "td-media-stage td-media-loading";

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";

    img.addEventListener("load", () => {
      stage.classList.remove("td-media-loading");
      card.classList.remove("td-text-only");
      card.classList.add("td-has-media");

      if (replaceStage && replaceStage !== stage) {
        replaceStage.remove();
      }
    }, { once: true });

    img.addEventListener("error", () => {
      stage.remove();

      if (replaceStage) {
        replaceStage.remove();
      }

      card.classList.add("td-text-only");
    }, { once: true });

    stage.appendChild(img);

    const target =
      q(".nativePreview", card) ||
      q(".copy", card);

    if (replaceStage?.parentElement === card) {
      card.insertBefore(stage, replaceStage);
    } else if (target?.parentElement === card) {
      card.insertBefore(stage, target);
    } else {
      card.prepend(stage);
    }

    img.src = url;
  }

  function normalizeCard(card) {
    if (card.dataset.tdMediaConsistent === "1") return;
    card.dataset.tdMediaConsistent = "1";

    const item = itemForCard(card);
    if (!item) return;

    ensureAvatar(card, item);

    const stage = existingVisual(card);

    if (stage) {
      validateExistingMedia(stage, card, item);
      return;
    }

    recoverPreview(card, item);
  }

  function scan() {
    qa("#grid .card").forEach(normalizeCard);
  }

  function boot() {
    installStyle();
    scan();

    const grid = document.getElementById("grid");
    if (!grid) return;

    const observer = new MutationObserver(() => {
      requestAnimationFrame(scan);
    });

    observer.observe(grid, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
