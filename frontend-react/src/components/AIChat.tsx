import { FormEvent, useMemo, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      initData?: string;
      HapticFeedback?: {
        impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
      };
    };
  };
};

const AI_ENDPOINT =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/ai-gateway-v1';

function nextId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'سلام! اتصال اولیه دستیار آماده تست است. یک پیام بفرست.',
    },
  ]);

  const tg = useMemo(
    () => (window as TelegramWindow).Telegram?.WebApp,
    [],
  );

  const append = (role: ChatMessage['role'], text: string) => {
    setMessages((current) => [
      ...current,
      { id: nextId(), role, text },
    ]);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();

    const message = input.trim();
    if (!message || sending) return;

    append('user', message);
    setInput('');
    setSending(true);

    try {
      const initData = tg?.initData || '';

      if (!initData) {
        throw new Error(
          'Telegram initData در دسترس نیست. مینی‌اپ را از داخل تلگرام باز کن.',
        );
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': initData,
          },
          body: JSON.stringify({ message }),
          cache: 'no-store',
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data?.ok === false) {
          throw new Error(
            data?.provider_message || data?.error || `HTTP ${response.status}`,
          );
        }

        append('assistant', data?.reply || 'پاسخی دریافت نشد.');
        tg?.HapticFeedback?.impactOccurred?.('light');
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (error) {
      append(
        'error',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style>{`
        .tdai-launch{position:fixed;right:14px;bottom:96px;z-index:12000;min-height:48px;padding:0 16px;border:1px solid rgba(120,205,255,.28);border-radius:999px;color:#fff;background:linear-gradient(145deg,#229ee8,#655de4);box-shadow:0 14px 32px rgba(0,0,0,.35);font:700 .78rem inherit;cursor:pointer}
        .tdai-panel{position:fixed;right:10px;left:10px;bottom:86px;z-index:12001;max-width:520px;height:min(68vh,560px);margin:auto;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid rgba(132,198,235,.18);border-radius:24px;overflow:hidden;background:#07111d;box-shadow:0 24px 70px rgba(0,0,0,.55)}
        .tdai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(140,195,230,.1);background:linear-gradient(145deg,#10243a,#0a1726)}
        .tdai-title b{display:block;color:#fff;font-size:.92rem}.tdai-title span{display:block;margin-top:3px;color:#86a0b8;font-size:.67rem}
        .tdai-close{width:40px;height:40px;border:0;border-radius:13px;color:#d7e7f4;background:rgba(255,255,255,.06);font-size:1.2rem;cursor:pointer}
        .tdai-log{min-height:0;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:radial-gradient(240px 160px at 100% 0,rgba(50,150,230,.08),transparent 72%),#07111d}
        .tdai-msg{max-width:86%;padding:10px 12px;border-radius:16px;color:#edf5fb;font-size:.82rem;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}.tdai-msg.user{align-self:flex-start;background:#17496f;border-bottom-left-radius:6px}.tdai-msg.assistant{align-self:flex-end;background:#101f30;border:1px solid rgba(135,195,230,.1);border-bottom-right-radius:6px}.tdai-msg.error{align-self:stretch;max-width:none;color:#ffd5d5;background:rgba(149,42,42,.23);border:1px solid rgba(255,122,122,.18)}
        .tdai-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px;border-top:1px solid rgba(140,195,230,.1);background:#0a1624}.tdai-input{min-width:0;min-height:46px;padding:0 13px;border:1px solid rgba(132,198,235,.16);border-radius:15px;outline:0;color:#fff;background:#07111d;font:inherit}.tdai-send{min-width:76px;border:0;border-radius:15px;color:#fff;background:linear-gradient(145deg,#229ee8,#5663df);font-weight:800;cursor:pointer}.tdai-send:disabled{opacity:.55;cursor:wait}
        @media(max-width:420px){.tdai-panel{right:8px;left:8px;bottom:82px;height:70vh}.tdai-launch{right:12px;bottom:92px}}
      `}</style>

      {!open && (
        <button
          className="tdai-launch"
          type="button"
          onClick={() => setOpen(true)}
        >
          ✦ دستیار کشف
        </button>
      )}

      {open && (
        <section
          className="tdai-panel"
          role="dialog"
          aria-modal="true"
          aria-label="دستیار کشف"
        >
          <header className="tdai-head">
            <div className="tdai-title">
              <b>دستیار کشف</b>
              <span>تست اتصال OpenAI</span>
            </div>
            <button
              className="tdai-close"
              type="button"
              aria-label="بستن"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="tdai-log" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`tdai-msg ${message.role}`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form className="tdai-form" onSubmit={send}>
            <input
              className="tdai-input"
              type="text"
              maxLength={8000}
              placeholder="مثلاً: سلام"
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={sending}
            />
            <button
              className="tdai-send"
              type="submit"
              disabled={sending || !input.trim()}
            >
              {sending ? '...' : 'ارسال'}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
