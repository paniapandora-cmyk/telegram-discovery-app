import type { CreatorChannel } from './account';
import { openTelegramUrl, requestJson } from './live';

export type CreatorPromoLink = {
  ok: true;
  url: string;
  tracking_link?: {
    id?: string;
    token?: string;
  };
};

export async function createCreatorPromoLink(channel: CreatorChannel) {
  return requestJson('/api/creator/tracking-link', {
    method: 'POST',
    body: {
      channel_id: channel.id,
      source: 'creator_promo_kit',
    },
  }) as Promise<CreatorPromoLink>;
}

export function creatorPromoText(channel: CreatorChannel) {
  const name = channel.title || (channel.username ? `@${channel.username}` : 'کانال ما');
  return `✨ ${name} رو در «کشف» ببین\nپست‌های بهتر، جست‌وجوی سریع‌تر و کانال‌های مرتبط رو یکجا پیدا کن.`;
}

export function shareCreatorPromo(channel: CreatorChannel, url: string) {
  return openTelegramUrl(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(
      creatorPromoText(channel),
    )}`,
  );
}
