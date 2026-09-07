import type { Channel } from '../types';
import {
  getTelegramInitData,
  openTelegramChannel,
  openTelegramUrl,
  requestJson,
} from './live';

const REFERRAL_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/creator-referral-v2';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cleanUsername = (value: string) =>
  value.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '').split(/[/?#]/)[0];

export async function openTrackedChannel(
  channel: Channel,
  contentId?: string,
  creatorIdOverride?: string,
): Promise<boolean> {
  const creatorId = String(creatorIdOverride || channel.creatorId || '').trim();
  const username = cleanUsername(channel.username || '');

  // Inside Telegram, creator-backed channels always try the verified
  // one-use invite route first. The referral row is the canonical click record.
  if (creatorId && getTelegramInitData()) {
    try {
      const raw = await requestJson(REFERRAL_API, {
        method: 'POST',
        body: {
          creator_id: creatorId,
          content_id: contentId || undefined,
          source: contentId
            ? 'react_post_channel_open'
            : 'react_channel_open',
        },
        timeout: 9000,
      });

      if (isRow(raw)) {
        const inviteUrl =
          typeof raw.invite_url === 'string'
            ? raw.invite_url.trim()
            : typeof raw.url === 'string'
              ? raw.url.trim()
              : '';

        if (inviteUrl) {
          return openTelegramUrl(inviteUrl);
        }
      }
    } catch (error) {
      // A public channel must remain usable even if tracking is temporarily
      // unavailable. The direct channel URL is only the fallback path.
      console.warn('Tracked channel open fallback:', error);
    }
  }

  return username ? openTelegramChannel(username) : false;
}
