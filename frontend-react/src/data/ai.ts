export type AIResponse = {
  ok: boolean;
  reply?: string;
  model?: string;
  response_id?: string | null;
  error?: string;
  provider_message?: string | null;
};

type TelegramWebApp = { initData?: string };
const AI_ENDPOINT = '/api/ai/chat';

const errorMessages: Record<string, string> = {
  telegram_auth_missing: 'اطلاعات ورود تلگرام دریافت نشد. مینی‌اپ را از داخل تلگرام باز کن.',
  telegram_auth_invalid: 'اعتبار ورود تلگرام تأیید نشد. مینی‌اپ را ببند و دوباره باز کن.',
  telegram_auth_expired: 'نشست تلگرام منقضی شده است. مینی‌اپ را دوباره باز کن.',
  ai_provider_error: 'سرویس هوش مصنوعی موقتاً پاسخ نمی‌دهد. کمی بعد دوباره امتحان کن.',
  empty_ai_response: 'پاسخ خالی دریافت شد. دوباره تلاش کن.',
};

export async function sendAIMessage(message: string, telegram: TelegramWebApp | undefined, signal?: AbortSignal) {
  const text = message.trim();
  if (!text) throw new Error('پیام خالی است.');
  const initData = telegram?.initData || '';
  if (!initData) throw new Error(errorMessages.telegram_auth_missing);

  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
    body: JSON.stringify({ message: text }),
    cache: 'no-store',
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as AIResponse;
  if (!response.ok || data.ok === false) {
    const code = data.error || '';
    throw new Error(errorMessages[code] || data.provider_message || code || `خطای ${response.status}`);
  }
  if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error(errorMessages.empty_ai_response);
  return data;
}
