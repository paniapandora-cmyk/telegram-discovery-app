import type { Post } from '../types';
import {
  getSessionId,
  getTelegramInitData,
  openTelegramUrl,
  requestJson,
} from './live';

const GROWTH_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/growth-referral-v1';

export type GrowthSummary = {
  ok: true;
  invite: {
    token: string;
    url: string;
    successful_invites: number;
    bot_starts: number;
    share_clicks: number;
    miniapp_opens: number;
    last_success_at?: string | null;
    last_7d?: {
      successful_invites: number;
      bot_starts: number;
      share_clicks: number;
      miniapp_opens: number;
    };
  };
  social_proof: {
    active_users: number;
    bot_starts: number;
    active_sources: number;
    contents: number;
  };
};

type GrowthPostLink = {
  ok: true;
  token: string;
  url: string;
};

async function growthRequest<T>(
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const initData = getTelegramInitData();
  if (!initData) {
    throw new Error('برای استفاده از دعوت، مینی‌اپ را داخل تلگرام باز کن.');
  }

  const response = await fetch(GROWTH_API, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      'x-request-id': crypto.randomUUID?.() || `${Date.now()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data as T;
}

export const loadGrowthSummary = (signal?: AbortSignal) =>
  growthRequest<GrowthSummary>('GET', undefined, signal);

export async function createPostGrowthLink(post: Post) {
  return growthRequest<GrowthPostLink>('POST', {
    action: 'create_post_link',
    post_id: post.contentId || post.id,
    title: post.title,
    telegram_url: post.telegramUrl || '',
  });
}

export async function recordGrowthShare(
  token: string,
  channel: 'telegram' | 'native' | 'copy' | 'post' | 'unknown' = 'unknown',
) {
  return growthRequest<{ ok: true }>('POST', {
    action: 'share',
    token,
    channel,
    session_id: getSessionId(),
  });
}

export async function recordIncomingReferral(token: string) {
  return growthRequest<{ ok: true }>('POST', {
    action: 'open_ref',
    token,
    session_id: getSessionId(),
  });
}

export async function recordIncomingReferralFromLocation() {
  const token = new URLSearchParams(window.location.search).get('ref') || '';
  if (!/^g_[A-Za-z0-9_-]{8,50}$/.test(token)) return false;
  await recordIncomingReferral(token);
  return true;
}

function telegramShare(url: string, text: string) {
  return openTelegramUrl(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  );
}

export const inviteShareText =
  '✨ بیا «کشف»؛ بهترین کانال‌ها و پست‌های تلگرام رو راحت‌تر پیدا کن.';

export async function shareInvite(summary: GrowthSummary) {
  await recordGrowthShare(summary.invite.token, 'telegram').catch(() => {});
  return telegramShare(summary.invite.url, inviteShareText);
}

export async function nativeShareInvite(summary: GrowthSummary) {
  const share = navigator.share;
  if (typeof share !== 'function') return shareInvite(summary);

  try {
    await navigator.share({
      title: 'کشف',
      text: inviteShareText,
      url: summary.invite.url,
    });
    await recordGrowthShare(summary.invite.token, 'native').catch(() => {});
    return true;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return false;
    return shareInvite(summary);
  }
}

export async function copyInviteLink(summary: GrowthSummary) {
  const value = summary.invite.url;

  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.focus();
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  await recordGrowthShare(summary.invite.token, 'copy').catch(() => {});
  return true;
}

export async function shareDiscoveryPost(post: Post) {
  try {
    const link = await createPostGrowthLink(post);
    await Promise.all([
      recordGrowthShare(link.token, 'post').catch(() => {}),
      post.contentId
        ? requestJson('/api/discovery/events', {
            method: 'POST',
            body: {
              content_id: post.contentId,
              event_type: 'share',
              session_id: getSessionId(),
            },
          }).catch(() => {})
        : Promise.resolve(),
    ]);

    return telegramShare(
      link.url,
      `📨 این پست رو در «کشف» ببین:\n${post.title}`,
    );
  } catch {
    if (!post.telegramUrl) return false;
    return telegramShare(post.telegramUrl, post.title);
  }
}
