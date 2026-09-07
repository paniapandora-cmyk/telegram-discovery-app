import type { Channel } from '../types';
import { ORIGIN, requestJson } from './live';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const contexts = (source: Row): Row[] => [
  source,
  ...['channel', 'source', 'telegram_source', 'creator']
    .map((key) => source[key])
    .filter(isRow),
];

const pick = (source: Row, keys: string[]) => {
  for (const ctx of contexts(source)) {
    for (const key of keys) {
      const value = ctx[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return '';
};

const rowsFrom = (value: unknown, depth = 0): Row[] => {
  if (Array.isArray(value)) return value.filter(isRow);
  if (!isRow(value) || depth > 4) return [];

  for (const key of ['channels', 'items', 'results', 'sources', 'data']) {
    const child = value[key];

    if (Array.isArray(child)) {
      const rows = child.filter(isRow);
      if (rows.length) return rows;
    }

    if (isRow(child)) {
      const rows = rowsFrom(child, depth + 1);
      if (rows.length) return rows;
    }
  }

  return [];
};

const usernameFromUrl = (value: string) =>
  value.match(
    /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]{4,32})(?:\/|$)/i,
  )?.[1] || '';

const normalizeUsername = (value: string) =>
  value.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '').split(/[/?#]/)[0];

const accentFor = (value: string) => {
  const accents = ['orange', 'light', 'navy', 'gold'];
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return accents[hash % accents.length];
};

const toChannel = (source: Row): Channel | null => {
  const rawUrl = pick(source, [
    'url',
    'channel_url',
    'telegram_url',
    'source_url',
    'public_url',
  ]);

  const username = normalizeUsername(
    pick(source, [
      'username',
      'channel_username',
      'source_username',
      'handle',
      'channel_handle',
      'telegram_username',
    ]) || usernameFromUrl(rawUrl),
  );

  const title =
    pick(source, [
      'title',
      'channel_title',
      'source_title',
      'name',
      'channel_name',
      'display_name',
    ]) ||
    username ||
    'Telegram';

  const id =
    pick(source, [
      'id',
      'channel_id',
      'source_id',
      'telegram_source_id',
      'creator_channel_id',
    ]) ||
    username ||
    title;

  if (!id) return null;

  const directAvatar = pick(source, [
    'avatar_url',
    'photo_url',
    'image_url',
    'thumbnail_url',
  ]);

  const avatarUrl =
    directAvatar ||
    (username
      ? `${ORIGIN}/api/telegram/channel-avatar?username=${encodeURIComponent(username)}`
      : undefined);

  return {
    id,
    title,
    username: username ? `@${username}` : '',
    initials: title.trim().slice(0, 1).toUpperCase() || 'T',
    accent: accentFor(username || title),
    avatarUrl,
  };
};

export async function loadRecommendedChannels(
  signal?: AbortSignal,
): Promise<Channel[]> {
  const raw = await requestJson('/api/discovery/channels?limit=12', {
    signal,
    timeout: 7000,
  });

  const seen = new Set<string>();

  return rowsFrom(raw)
    .map(toChannel)
    .filter((channel): channel is Channel => Boolean(channel))
    .filter((channel) => {
      const key = (channel.username || channel.title).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}
