/* Telegram Discovery — AI Chat UI v1 */
(() => {
  "use strict";

  const ROOT_ID = "td-ai-chat-v1";
  if (document.getElementById(ROOT_ID)) return;

  const style = document.createElement("style");
  style.textContent = `
    #${ROOT_ID}{position:fixed;inset:0;z-index:12000;pointer-events:none;font-family:inherit}
    #${ROOT_ID} .tdai-launch{position:absolute;right:16px;bottom:98px;min-height:48px;padding:0 16px;border:1px solid rgba(120,205,255,.28);border-radius:999px;color:#fff;background:linear-gradient(145deg,#229ee8,#655de4);box-shadow:0 14px 32px rgba(0,0,0,.35);font:700 .78rem inherit;pointer-events:auto;cursor:pointer}
    #${ROOT_ID} .tdai-panel{position:absolute;right:12px;left:12px;bottom:88px;max-width:520px;height:min(68vh,560px);margin:auto;display:none;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid rgba(132,198,235,.18);border-radius:24px;overflow:hidden;background:#07111d;box-shadow:0 24px 70px rgba(0,0,0,.55);pointer-events:auto}
    #${ROOT_ID}.open .tdai-panel{display:grid}
    #${ROOT_ID}.open .tdai-launch{display:none}
    #${ROOT_ID} .tdai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(140,195,230,.1);background:linear-gradient(145deg,#10243a,#0a1726)}
    #${ROOT_ID} .tdai-title b{display:block;color:#fff;font-size:.92rem}
    #${ROOT_ID} .tdai-title span{display:block;margin-top:3px;color:#86a0b8;font-size:.67rem}
    #${ROOT_ID} .tdai-close{width:40px;height:40px;border:0;border-radius:13px;color:#d7e7f4;background:rgba(255,255,255,.06);font-size:1.2rem;cursor:pointer}
    #${ROOT_ID} .tdai-log{min-height:0;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:radial-gradient(240px 160px at 100% 0,rgba(50,150,230,.08),transparent 72%),#07111d}
    #${ROOT_ID} .tdai-msg{max-width:86%;padding:10px 12px;border-radius:16px;color:#edf5fb;font-size:.82rem;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}
    #${ROOT_ID} .tdai-msg.user{align-self:flex-start;background:#17496f;border-bottom-left-radius:6px}
    #${ROOT_ID} .tdai-msg.ai{align-self:flex-end;background:#101f30;border:1px solid rgba(135,195,230,.1);border-bottom-right-radius:6px}
    #${ROOT_ID} .tdai-msg.error{align-self:stretch;max-width:none;color:#ffd5d5;background:rgba(149,42,42,.23);border:1px solid rgba(255,122,122,.18)}
    #${ROOT_ID} .tdai-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px;border-top:1px solid rgba(140,195,230,.1);background:#0a1624}
    #${ROOT_ID} .tdai-input{min-width:0;min-height:46px;padding:0 13px;border:1px solid rgba(132,198,235,.16);border-radius:15px;outline:0;color:#fff;background:#07111d;font:inherit}
    #${ROOT_ID} .tdai-send{min-width:76px;border:0;border-radius:15px;color:#fff;background:linear-gradient(145deg,#229ee8,#5663df);font-weight:800;cursor:pointer}
    #${ROOT_ID} .tdai-send:disabled{opacity:.55;cursor:wait}
    @media(max-width:420px){#${ROOT_ID} .tdai-panel{right:8px;left:8px;bottom:82px;height:70vh}#${ROOT_ID} .tdai-launch{right:12px;bottom:92px}}
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <button class="tdai-launch" type="button">✦ دستیار کشف</button>
    <section class="tdai-panel" role="dialog" aria-modal="true" aria-label="دستیار کشف">
      <header class="tdai-head">
        <div class="tdai-title"><b>دستیار کشف</b><span>تست اتصال OpenAI</span></div>
        <button class="tdai-close" type="button" aria-label="بستن">×</button>
      </header>
      <div class="tdai-log" aria-live="polite">
        <div class="tdai-msg ai">سلام! اتصال اولیه دستیار آماده تست است. یک پیام بفرست.</div>
      </div>
      <form class="tdai-form">
        <input class="tdai-input" type="text" maxlength="8000" placeholder="مثلاً: سلام" autocomplete="off">
        <button class="tdai-send" type="submit">ارسال</button>
      </form>
    </section>`;
  document.body.appendChild(root);

  const launch = root.querySelector(".tdai-launch");
  const close = root.querySelector(".tdai-close");
  const form = root.querySelector(".tdai-form");
  const input = root.querySelector(".tdai-input");
  const send = root.querySelector(".tdai-send");
  const log = root.querySelector(".tdai-log");

  const append = (text, type) => {
    const el = document.createElement("div");
    el.className = `tdai-msg ${type}`;
    el.textContent = String(text ?? "");
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  };

  const setOpen = (open) => {
    root.classList.toggle("open", open);
    if (open) setTimeout(() => input.focus(), 50);
  };

  launch.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || send.disabled) return;

    append(message, "user");
    input.value = "";
    send.disabled = true;
    send.textContent = "...";

    try {
      if (!window.TelegramDiscoveryAI?.send) {
        throw new Error("AI client هنوز لود نشده است.");
      }
      const result = await window.TelegramDiscoveryAI.send(message);
      append(result?.reply || "پاسخی دریافت نشد.", "ai");
    } catch (error) {
      append(error?.message || String(error), "error");
    } finally {
      send.disabled = false;
      send.textContent = "ارسال";
      input.focus();
    }
  });

  console.info("Telegram Discovery AI Chat UI v1 loaded");
})();
