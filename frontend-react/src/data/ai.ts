export type AIMode = 'auto'|'discover'|'trending'|'saved'|'creator'|'draft'|'summarize'|'translate'|'help';
export type AISource = { id:string; title:string; url:string; channel:string; number:number; kind:'discovery'|'selected' };
export type AISelection = { title:string; text:string; url?:string };
export type AIOpenDetail = { selected?:AISelection; mode?:AIMode; prompt?:string };
export type AIOptions = { mode?:AIMode; history?:{role:'user'|'assistant';text:string}[]; selected?:AISelection };
export const safeSourceUrl = (value:unknown) => typeof value==='string' && /^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}\/\d+$/.test(value) ? value : '';
export function normalizeSources(value:unknown):AISource[] {
  if(!Array.isArray(value))return [];
  return value.filter(x=>x&&typeof x.title==='string').slice(0,7).map((x,i)=>({id:typeof x.id==='string'&&/^[0-9a-f-]{36}$/i.test(x.id)?x.id:'',title:x.title.slice(0,140),url:safeSourceUrl(x.url),channel:typeof x.channel==='string'?x.channel.slice(0,100):'',number:i+1,kind:x.kind==='selected'?'selected':'discovery'}));
}
export function openDiscoveryAssistant(detail:AIOpenDetail) {window.dispatchEvent(new CustomEvent('td-ai-open',{detail}));}
export type AIResponse = {
  ok: boolean;
  sources?: AISource[];
  pages?: string[];
  access?: {ai_remaining?:number;ai_daily_limit?:number};
  reply?: string;
  model?: string;
  response_id?: string | null;
  error?: string;
  provider_message?: string | null;
};

type TelegramWebApp = { initData?: string };
const AI_ENDPOINT = '/api/ai/chat';

const errorMessages: Record<string, string> = {
  membership_required: 'برای ادامه، عضو کانال @hoviateman شو و مینی‌اپ را دوباره باز کن.',
  membership_check_unavailable: 'بررسی عضویت موقتاً ممکن نیست؛ کمی بعد دوباره تلاش کن.',
  quota_check_unavailable: 'بررسی سهمیه موقتاً ممکن نیست؛ دوباره تلاش کن.',
  ai_daily_limit: 'سهمیه امروز تمام شد. با دعوت دوستان سهمیه بیشتری بگیر یا فردا دوباره امتحان کن. VIP با ۳ دعوت معتبر باز می‌شود.',
  telegram_auth_missing: 'اطلاعات ورود تلگرام دریافت نشد. مینی‌اپ را از داخل تلگرام باز کن.',
  telegram_auth_invalid: 'اعتبار ورود تلگرام تأیید نشد. مینی‌اپ را ببند و دوباره باز کن.',
  telegram_auth_expired: 'نشست تلگرام منقضی شده است. مینی‌اپ را دوباره باز کن.',
  ai_provider_error: 'سرویس هوش مصنوعی موقتاً پاسخ نمی‌دهد. کمی بعد دوباره امتحان کن.',
  empty_ai_response: 'پاسخ خالی دریافت شد. دوباره تلاش کن.',
};

export async function sendAIMessage(message: string, telegram: TelegramWebApp | undefined, signal?: AbortSignal, options:AIOptions = {}) {
  const text = message.trim();
  if (!text) throw new Error('پیام خالی است.');
  const initData = telegram?.initData || '';
  if (!initData) throw new Error(errorMessages.telegram_auth_missing);

  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
    body: JSON.stringify({ client_version: 3, message: text, mode:options.mode, history:options.history?.slice(-6).map(x=>({role:x.role,text:x.text.slice(0,1500)})), selected:options.selected ? {title:options.selected.title.slice(0,140),text:options.selected.text.slice(0,6000),url:safeSourceUrl(options.selected.url)}:undefined }),
    cache: 'no-store',
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as AIResponse;
  if (!response.ok || data.ok === false) {
    const code = data.error || '';
    throw new Error(errorMessages[code] || data.provider_message || code || `خطای ${response.status}`);
  }
  if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error(errorMessages.empty_ai_response);
  return { ...data, sources:normalizeSources(data.sources), pages:Array.isArray(data.pages)?data.pages.filter(x=>typeof x==='string'):[] };
}
