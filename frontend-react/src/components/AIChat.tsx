import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { sendAIMessage } from '../data/ai';

type ChatMessage = { id: string; role: 'user' | 'assistant' | 'error'; text: string };
type TelegramWindow = Window & { Telegram?: { WebApp?: { initData?: string; HapticFeedback?: { impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void } } } };

const STORAGE_KEY = 'telegram-discovery-ai-chat-v2';
const starters = ['پست‌های داغ امروز را خلاصه کن', 'برای جست‌وجوی بهتر چه بنویسم؟', 'چند موضوع تازه پیشنهاد بده'];
const welcome: ChatMessage = { id: 'welcome', role: 'assistant', text: 'سلام! من دستیار کشف هستم. بگو دنبال چه موضوع یا محتوایی می‌گردی.' };

const nextId = () => {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};

const loadMessages = (): ChatMessage[] => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) && value.length ? value.slice(-30) : [welcome];
  } catch { return [welcome]; }
};

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const logRef = useRef<HTMLDivElement>(null);
  const tg = useMemo(() => (window as TelegramWindow).Telegram?.WebApp, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const append = (role: ChatMessage['role'], text: string) =>
    setMessages((current) => [...current, { id: nextId(), role, text }].slice(-30));

  const submitMessage = async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;
    append('user', message);
    setInput('');
    setSending(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const result = await sendAIMessage(message, tg, controller.signal);
      append('assistant', result.reply || 'پاسخی دریافت نشد.');
      tg?.HapticFeedback?.impactOccurred?.('light');
    } catch (error) {
      append('error', error instanceof DOMException && error.name === 'AbortError' ? 'زمان پاسخ‌گویی تمام شد. دوباره امتحان کن.' : error instanceof Error ? error.message : String(error));
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  };

  const send = (event: FormEvent) => { event.preventDefault(); void submitMessage(input); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitMessage(input); }
  };

  return (
    <>
      <style>{`
        .tdai-launch{position:fixed;right:14px;bottom:96px;z-index:12000;min-height:50px;padding:0 17px;display:flex;align-items:center;gap:8px;border:1px solid rgba(120,205,255,.32);border-radius:999px;color:#fff;background:linear-gradient(145deg,#159fe8,#6758e6);box-shadow:0 14px 36px rgba(18,111,218,.32);font:800 .8rem inherit;cursor:pointer}.tdai-launch svg{width:17px}
        .tdai-panel{position:fixed;right:10px;left:10px;bottom:84px;z-index:12001;max-width:520px;height:min(72vh,610px);margin:auto;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid rgba(132,198,235,.2);border-radius:26px;overflow:hidden;background:#07111d;box-shadow:0 28px 80px rgba(0,0,0,.62)}
        .tdai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(140,195,230,.1);background:linear-gradient(145deg,#102943,#0a1726)}.tdai-brand{display:flex;align-items:center;gap:10px}.tdai-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,#25abea,#6959e6)}.tdai-avatar svg{width:19px}.tdai-title b{display:block;color:#fff;font-size:.92rem}.tdai-title span{display:block;margin-top:3px;color:#77d7a8;font-size:.67rem}.tdai-actions{display:flex;gap:5px}.tdai-icon{width:39px;height:39px;display:grid;place-items:center;border:0;border-radius:13px;color:#d7e7f4;background:rgba(255,255,255,.06);cursor:pointer}.tdai-icon svg{width:18px}
        .tdai-log{min-height:0;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:radial-gradient(280px 190px at 100% 0,rgba(50,150,230,.09),transparent 72%),#07111d}.tdai-msg{max-width:88%;padding:10px 12px;border-radius:17px;color:#edf5fb;font-size:.82rem;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}.tdai-msg.user{align-self:flex-start;background:#18527d;border-bottom-left-radius:6px}.tdai-msg.assistant{align-self:flex-end;background:#101f30;border:1px solid rgba(135,195,230,.11);border-bottom-right-radius:6px}.tdai-msg.error{align-self:stretch;max-width:none;color:#ffd5d5;background:rgba(149,42,42,.23);border:1px solid rgba(255,122,122,.18)}
        .tdai-starters{display:flex;flex-wrap:wrap;gap:7px;margin-top:3px}.tdai-starter{padding:8px 10px;border:1px solid rgba(83,172,232,.2);border-radius:12px;color:#a9cde4;background:rgba(19,64,95,.3);font:700 .7rem inherit;cursor:pointer}.tdai-thinking{align-self:flex-end;color:#8da7bb;font-size:.72rem}
        .tdai-form{display:grid;grid-template-columns:minmax(0,1fr) 48px;gap:8px;padding:10px;border-top:1px solid rgba(140,195,230,.1);background:#0a1624}.tdai-input{min-width:0;max-height:110px;resize:none;padding:11px 13px;border:1px solid rgba(132,198,235,.16);border-radius:15px;outline:0;color:#fff;background:#07111d;font:inherit;line-height:1.6}.tdai-input:focus{border-color:rgba(54,173,239,.55);box-shadow:0 0 0 3px rgba(31,156,228,.1)}.tdai-send{display:grid;place-items:center;border:0;border-radius:15px;color:#fff;background:linear-gradient(145deg,#229ee8,#5663df);cursor:pointer}.tdai-send svg{width:19px}.tdai-send:disabled{opacity:.5;cursor:wait}
        @media(max-width:420px){.tdai-panel{right:7px;left:7px;bottom:80px;height:74vh}.tdai-launch{right:12px;bottom:92px}}
      `}</style>
      {!open && <button className="tdai-launch" type="button" onClick={() => setOpen(true)}><Sparkles /> دستیار کشف</button>}
      {open && <section className="tdai-panel" role="dialog" aria-modal="true" aria-label="دستیار کشف">
        <header className="tdai-head"><div className="tdai-brand"><div className="tdai-avatar"><Bot /></div><div className="tdai-title"><b>دستیار کشف</b><span>● متصل به هوش مصنوعی</span></div></div><div className="tdai-actions"><button className="tdai-icon" type="button" aria-label="پاک کردن گفتگو" title="پاک کردن گفتگو" onClick={() => setMessages([welcome])}><RotateCcw /></button><button className="tdai-icon" type="button" aria-label="بستن" onClick={() => setOpen(false)}><X /></button></div></header>
        <div className="tdai-log" ref={logRef} aria-live="polite">{messages.map((message) => <div key={message.id} className={`tdai-msg ${message.role}`}>{message.text}</div>)}{messages.length === 1 && <div className="tdai-starters">{starters.map((item) => <button key={item} className="tdai-starter" type="button" onClick={() => void submitMessage(item)}>{item}</button>)}</div>}{sending && <div className="tdai-thinking">در حال فکر کردن…</div>}</div>
        <form className="tdai-form" onSubmit={send}><textarea className="tdai-input" rows={1} maxLength={8000} placeholder="پیامت را بنویس…" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} disabled={sending} aria-label="پیام به دستیار"/><button className="tdai-send" type="submit" aria-label="ارسال" disabled={sending || !input.trim()}><Send /></button></form>
      </section>}
    </>
  );
}
