import type { Channel, Post, PostKind } from '../types';
import { getSessionId, getTelegramInitData, ORIGIN, requestJson } from './live';

type Row = Record<string, unknown>;

const RELATED_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/related-content-v1';

const isRow = (value: unknown): value is Row =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const rows = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value.filter(isRow);
  if (!isRow(value)) return [];
  for (const key of ['items', 'results', 'data']) {
    if (Array.isArray(value[key])) return (value[key] as unknown[]).filter(isRow);
  }
  return [];
};

const text = (source: Row, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const number = (source: Row, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

const boolean = (source: Row, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return /^(1|true|yes)$/i.test(value.trim());
  }
  return false;
};

const normalizeUsername = (value: string) => value.replace(/^@+/, '').trim();

const dateLabel = (raw: string) => {
  if (!raw) return 'تازه';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const hashTone = (value: string): Post['tone'] => {
  const tones: Post['tone'][] = ['blue', 'violet', 'amber', 'teal'];
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
};

const sourcePostUrl = (source: Row, username: string) => {
  const direct = text(source, ['source_url', 'telegram_url', 'post_url']);
  if (/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_]{4,32}\/\d+/i.test(direct)) {
    return direct;
  }
  const messageId = text(source, ['telegram_message_id', 'message_id', 'post_id']);
  return username && /^\d+$/.test(messageId) ? `https://t.me/${username}/${messageId}` : '';
};

const normalizePost = (source: Row, index: number): Post => {
  const username = normalizeUsername(
    text(source, ['channel_username', 'creator_username', 'username']),
  );
  const channelTitle =
    text(source, ['channel_name', 'channel_title', 'creator_name']) ||
    username ||
    'Telegram';
  const creatorId = text(source, ['creator_id']);
  const contentId = text(source, ['content_id', 'id']);
  const title = text(source, ['title', 'headline']) || 'پست تلگرام';
  const excerpt =
    text(source, ['text_content', 'description', 'excerpt', 'text']) || title;
  const contentType = text(source, ['content_type', 'media_type', 'type']).toLowerCase();
  const directMedia = text(source, [
    'media_url',
    'thumbnail_url',
    'image_url',
    'photo_url',
    'preview_url',
  ]);
  const telegramUrl = sourcePostUrl(source, username);
  const mediaUrl = /^https?:\/\//i.test(directMedia)
    ? directMedia
    : telegramUrl
      ? `${ORIGIN}/api/telegram/preview-image?url=${encodeURIComponent(telegramUrl)}`
      : undefined;
  const kind: PostKind = /video|reel|mp4/.test(contentType)
    ? 'video'
    : mediaUrl
      ? 'image'
      : 'text';
  const id = contentId || `${username}-${index}-${title.slice(0, 16)}`;

  const channel: Channel = {
    id: creatorId || username || channelTitle,
    creatorId: creatorId || undefined,
    title: channelTitle,
    username: username ? `@${username}` : '',
    initials: channelTitle.slice(0, 1).toUpperCase() || 'T',
    accent: 'navy',
    avatarUrl: text(source, ['channel_avatar_url', 'avatar_url']) ||
      (username
        ? `${ORIGIN}/api/telegram/channel-avatar?username=${encodeURIComponent(username)}`
        : undefined),
    trackingAvailable: Boolean(creatorId),
  };

  return {
    id,
    contentId: contentId || undefined,
    creatorId: creatorId || undefined,
    telegramUrl: telegramUrl || undefined,
    channel,
    category: text(source, ['category', 'topic']) || 'تلگرام',
    title,
    excerpt,
    kind,
    tone: hashTone(id),
    mediaUrl,
    date: dateLabel(text(source, ['published_at', 'created_at'])),
    likes: '۰',
    comments: '۰',
    saved: boolean(source, ['is_saved', 'saved']) || Boolean(text(source, ['saved_at'])),
    savedAt: text(source, ['saved_at']) || undefined,
    viewedAt: text(source, ['viewed_at']) || undefined,
    historyEvent: text(source, ['event_type']) || undefined,
    watchSeconds: number(source, ['watch_duration_seconds']) || undefined,
    relatedScore: number(source, ['related_score']) || undefined,
    relatedReason: text(source, ['related_reason']) || undefined,
  };
};

export async function loadLibrarySaved(signal?: AbortSignal) {
  const raw = await requestJson('/api/discovery/saved?limit=100', { signal, timeout: 12000 });
  return rows(raw).map(normalizePost).map((post) => ({ ...post, saved: true }));
}

export async function loadLibraryHistory(signal?: AbortSignal) {
  const raw = await requestJson('/api/discovery/history?limit=100', { signal, timeout: 12000 });
  return rows(raw).map(normalizePost);
}

export async function clearViewingHistory() {
  return requestJson('/api/discovery/history', {
    method: 'DELETE',
    body: {},
    timeout: 12000,
  });
}

export async function recordViewerExit(post: Post, elapsedMs: number) {
  if (!post.contentId) return;
  const seconds = Math.max(0, Math.min(86400, Math.round(elapsedMs / 1000)));
  const eventType = seconds >= 12 ? 'long_view' : 'view';
  await requestJson('/api/discovery/events', {
    method: 'POST',
    body: {
      content_id: post.contentId,
      event_type: eventType,
      session_id: getSessionId(),
      watch_duration_seconds: seconds,
      metadata: { source: 'viewer_v12' },
    },
  });
}

export async function loadRelatedPosts(post: Post, signal?: AbortSignal) {
  if (!post.contentId) return [];
  const initData = getTelegramInitData();
  if (!initData) return [];

  const response = await fetch(
    `${RELATED_API}?content_id=${encodeURIComponent(post.contentId)}&limit=8`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-telegram-init-data': initData,
        'x-request-id': crypto.randomUUID?.() || `${Date.now()}`,
      },
      cache: 'no-store',
      signal,
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return rows(data)
    .map(normalizePost)
    .filter((item) => item.id !== post.id);
}
