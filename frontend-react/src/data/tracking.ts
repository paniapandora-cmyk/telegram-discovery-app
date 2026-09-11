import type { Channel } from '../types';
import { recordPromotionEvent } from './ads';
import {
  getTelegramInitData,
  openTelegramChannel,
  openTelegramUrl,
  requestJson,
} from './live';

const REFERRAL_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/creator-referral-v2';

const OPEN_GUARD_MS = 1800;
const recentOpens = new Map<string, number>();
const inFlight = new Map<string, Promise<boolean>>();
type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const cleanUsername = (value: string) => value.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '').split(/[/?#]/)[0];

const openKey = (channel: Channel, contentId?: string, creatorIdOverride?: string, promotionId?: string) => {
  const creatorId = String(creatorIdOverride || channel.creatorId || '').trim();
  const username = cleanUsername(channel.username || '').toLowerCase();
  return `${creatorId}|${contentId || ''}|${username}|${promotionId || ''}`;
};

export async function openTrackedChannel(
  channel: Channel,
  contentId?: string,
  creatorIdOverride?: string,
  promotionId?: string,
): Promise<boolean> {
  const key = openKey(channel, contentId, creatorIdOverride, promotionId);
  const now = Date.now();
  const existing = inFlight.get(key);
  if (existing) return existing;
  const lastOpen = recentOpens.get(key) || 0;
  if (now - lastOpen < OPEN_GUARD_MS) return true;
  recentOpens.set(key, now);

  const task = (async () => {
    const creatorId = String(creatorIdOverride || channel.creatorId || '').trim();
    const username = cleanUsername(channel.username || '');

    if (promotionId) {
      void recordPromotionEvent({ promotionId, contentId }, 'click_telegram').catch(() => {});
    }

    if (creatorId && getTelegramInitData()) {
      try {
        const raw = await requestJson(REFERRAL_API, {
          method: 'POST',
          body: {
            creator_id: creatorId,
            content_id: contentId || undefined,
            source: promotionId
              ? `sponsored:${promotionId}`
              : contentId
                ? 'react_post_channel_open'
                : 'react_channel_open',
          },
          timeout: 9000,
        });

        if (isRow(raw)) {
          const inviteUrl = typeof raw.invite_url === 'string'
            ? raw.invite_url.trim()
            : typeof raw.url === 'string'
              ? raw.url.trim()
              : '';
          if (inviteUrl) return openTelegramUrl(inviteUrl);
        }
      } catch (error) {
        console.warn('Tracked channel open fallback:', error);
      }
    }

    return username ? openTelegramChannel(username) : false;
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
    window.setTimeout(() => {
      const current = recentOpens.get(key);
      if (current && Date.now() - current >= OPEN_GUARD_MS) recentOpens.delete(key);
    }, OPEN_GUARD_MS + 100);
  }
}
