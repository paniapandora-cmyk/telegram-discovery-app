import type { Channel, Post, PostKind } from '../types';
import { ORIGIN, requestJson } from './live';

type Row = Record<string, unknown>;

const known: Record<
  string,
  { title: string; initials: string; accent: string; category: string }
> = {
  wooooowmusic: {
    title: 'Persian Music',
    initials: '♫',
    accent: 'orange',
    category: 'موسیقی',
  },
  hoviateman: {
    title: 'هویت',
    initials: 'ه',
    accent: 'light',
    category: 'هویت',
  },
  piping_bpv: {
    title: 'Piping',
    initials: 'P',
    accent: 'navy',
    category: 'مهندسی',
  },
  body_language2: {
    title: 'Body Language',
    initials: 'B',
    accent: 'gold',
    category: 'روانشناسی',
  },
};

const isRow = (value: unknown): value is Row =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nested = (source: Row): Row[] => [
  source,
  ...['post', 'channel', 'source', 'telegram_source', 'media', 'asset', 'preview']
    .map((key) => source[key])
    .filter(isRow),
];

const pick = (source: Row, keys: string[]) => {
  for (const ctx of nested(source)) {
    for (const key of keys) {
      const value = ctx[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return '';
};

const numberValue = (source: Row, keys: string[]) => {
  const raw = pick(source, keys);
  const value = Number(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(value) ? value : 0;
};

const boolValue = (source: Row, keys: string[]) => {
  for (const ctx of nested(source)) {
    for (const key of keys) {
      const value = ctx[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string' && value.trim()) {
        return /^(1|true|yes|saved)$/i.test(value.trim());
      }
    }
  }
  return false;
};

const extractRows = (value: unknown, depth = 0): Row[] => {
  if (Array.isArray(value)) return value.filter(isRow);
  if (!isRow(value) || depth > 5) return [];

  for (const key of [
    'items',
    'results',
    'posts',
    'feed',
    'explore',
    'content',
    'data',
  ]) {
    const child = value[key];

    if (Array.isArray(child)) {
      const rows = child.filter(isRow);
      if (rows.length) return rows;
    }

    if (isRow(child)) {
      const rows = extractRows(child, depth + 1);
      if (rows.length) return rows;
    }
  }

  return [];
};

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeUser = (value: string) => value.replace(/^@/, '').trim();

const sourceUrl = (source: Row) =>
  pick(source, [
    'source_url',
    'telegram_url',
    'post_url',
    'permalink',
    'channel_url',
    'url',
  ]);

const userFromUrl = (value: string) =>
  value.match(
    /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]{4,32})(?:\/|$)/i,
  )?.[1] || '';

const avatarProxy = (username: string) =>
  username
    ? `${ORIGIN}/api/telegram/channel-avatar?username=${encodeURIComponent(
        username,
      )}`
    : undefined;

const channelFrom = (source: Row): Channel => {
  const rawUrl = sourceUrl(source);

  const username = normalizeUser(
    pick(source, [
      'channel_username',
      'creator_username',
      'source_username',
      'username',
      'channel_handle',
      'source_handle',
    ]) || userFromUrl(rawUrl),
  );

  const preset = known[username.toLowerCase()];

  const title =
    pick(source, [
      'channel_title',
      'creator_name',
      'source_title',
      'channel_name',
    ]) ||
    preset?.title ||
    username ||
    'Telegram';

  return {
    id: username || title,
    username: username ? `@${username}` : '',
    title,
    initials: preset?.initials || title.slice(0, 1).toUpperCase() || 'T',
    accent: preset?.accent || 'navy',
    avatarUrl: avatarProxy(username),
  };
};

const postUrl = (source: Row, username: string) => {
  const direct = sourceUrl(source);

  if (
    /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_]{4,32}\/\d+/i.test(
      direct,
    )
  ) {
    return direct;
  }

  const messageId = pick(source, [
    'telegram_message_id',
    'message_id',
    'post_id',
  ]);

  return username && /^\d+$/.test(messageId)
    ? `https://t.me/${username}/${messageId}`
    : '';
};

const mediaUrl = (source: Row, username: string) => {
  const direct = pick(source, [
    'image_url',
    'photo_url',
    'preview_url',
    'poster_url',
    'video_thumbnail_url',
    'media_thumbnail_url',
    'thumbnail_url',
  ]);

  if (/^https?:\/\//i.test(direct)) return direct;

  const url = postUrl(source, username);

  return url
    ? `${ORIGIN}/api/telegram/preview-image?url=${encodeURIComponent(url)}`
    : undefined;
};

const compact = (value: number) =>
  value
    ? new Intl.NumberFormat('fa-IR', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value)
    : '۰';

const formatDate = (raw: string) => {
  if (!raw) return 'تازه';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.length > 14 ? raw.slice(0, 14) : raw;

  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const hashTone = (value: string): Post['tone'] => {
  const tones: Post['tone'][] = ['blue', 'violet', 'amber', 'teal'];
  let hash = 0;

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return tones[hash % tones.length];
};

const headline = (value: string) => {
  const text = clean(value);
  if (!text) return 'پست تازه تلگرام';

  const first = text.split(/[\n.!؟]/)[0]?.trim() || text;
  return first.length > 72 ? `${first.slice(0, 69)}…` : first;
};

const hasPostSignal = (source: Row) =>
  Boolean(
    pick(source, [
      'content_id',
      'telegram_message_id',
      'message_id',
      'post_id',
      'text_content',
      'text',
      'caption',
      'message',
      'content',
      'post_url',
      'telegram_url',
      'source_url',
    ]),
  );

const normalizePost = (source: Row, index: number): Post => {
  const channel = channelFrom(source);
  const username = normalizeUser(channel.username);

  const text = clean(
    pick(source, [
      'text_content',
      'text',
      'caption',
      'message',
      'content',
      'description',
      'excerpt',
    ]),
  );

  const title =
    clean(pick(source, ['headline', 'post_title', 'title'])) || headline(text);

  const media = mediaUrl(source, username);

  const type = (
    `${pick(source, ['content_type', 'media_type', 'post_type', 'type', 'kind'])} ` +
    pick(source, ['video_url'])
  ).toLowerCase();

  const kind: PostKind = /video|mp4|reel/.test(type)
    ? 'video'
    : /audio|document|text/.test(type) ? 'text' : media
      ? 'image'
      : 'text';

  const contentId = pick(source, ['content_id', 'id', 'uuid']);
  const creatorId = pick(source, ['creator_id', 'owner_creator_id']);
  const telegramUrl = postUrl(source, username);

  const id =
    contentId ||
    pick(source, ['telegram_message_id', 'message_id', 'post_id']) ||
    `${username}-${index}-${title.slice(0, 16)}`;

  const category =
    pick(source, ['category', 'topic', 'label', 'tag']) ||
    known[username.toLowerCase()]?.category ||
    'تلگرام';

  return {
    id: String(id),
    contentId: contentId || undefined,
    creatorId: creatorId || undefined,
    telegramUrl: telegramUrl || undefined,
    score: numberValue(source, ['score', 'rank_score']) || undefined,
    reason:
      pick(source, ['reason', 'recommendation_reason']) || undefined,
    channel,
    category,
    title,
    excerpt: text || title,
    kind,
    tone: hashTone(`${id}${username}`),
    mediaUrl: media,
    date: formatDate(
      pick(source, [
        'published_at',
        'posted_at',
        'created_at',
        'date',
        'timestamp',
      ]),
    ),
    likes: compact(
      numberValue(source, [
        'reactions_count',
        'reaction_count',
        'likes',
        'likes_count',
        'reactions',
      ]),
    ),
    comments: compact(
      numberValue(source, [
        'comments_count',
        'replies_count',
        'reply_count',
        'comments',
      ]),
    ),
    saved: boolValue(source, ['is_saved', 'saved']),
  };
};

const dedupe = (posts: Post[]) => {
  const seen = new Set<string>();

  return posts.filter((post) => {
    const key = `${post.id}|${post.channel.username}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function loadExpandedExplore(
  signal?: AbortSignal,
  limit = 100,
): Promise<Post[]> {
  const safeLimit = Math.max(18, Math.min(limit, 120));

  const raw = await requestJson(
    `/api/discovery/explore?limit=${safeLimit}`,
    {
      signal,
      timeout: 11000,
    },
  );

  const rows = extractRows(raw).filter(hasPostSignal);

  return dedupe(rows.map(normalizePost)).slice(0, safeLimit);
}

export async function loadExplorePage(excludeIds: string[], signal?: AbortSignal): Promise<{ posts: Post[]; hasMore: boolean }> {
  const raw = await requestJson('/api/discovery/explore', {
    method: 'POST', body: { limit: 24, exclude_ids: excludeIds }, signal, timeout: 20000,
  });
  if (!isRow(raw) || !Array.isArray(raw.items) || typeof raw.has_more !== 'boolean') {
    throw new Error('پاسخ دریافت پست‌ها معتبر نیست. دوباره تلاش کن.');
  }
  const posts = dedupe(raw.items.filter(isRow).filter(hasPostSignal).map(normalizePost));
  return { posts, hasMore: raw.has_more };
}
