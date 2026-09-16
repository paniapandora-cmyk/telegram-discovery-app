import { getTelegramInitData } from './live';

const BROADCAST_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/growth-broadcast-v1';

type BroadcastStatus = {
  ok: true;
  eligible_recipients: number;
  policy: 'explicit_opt_in_only';
  max_per_campaign: number;
};

export type BroadcastPreview = BroadcastStatus & {
  dry_run: true;
  preview: string;
  note: string;
};

export type BroadcastResult = BroadcastStatus & {
  campaign_id: string;
  sent: number;
  failed: number;
};

async function request<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('این بخش فقط داخل Telegram Mini App در دسترس است.');

  const response = await fetch(BROADCAST_API, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      'x-request-id': crypto.randomUUID?.() || `${Date.now()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data as T;
}

export const loadBroadcastStatus = () => request<BroadcastStatus>('GET');

export const previewBroadcast = (message: string) =>
  request<BroadcastPreview>('POST', { message, confirm: false });

export const sendBroadcast = (message: string) =>
  request<BroadcastResult>('POST', { message, confirm: true });
