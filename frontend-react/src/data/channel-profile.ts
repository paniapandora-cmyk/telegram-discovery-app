import type { Channel, Post, PostKind } from '../types';
import { getTelegramInitData, ORIGIN } from './live';

const API = 'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/channel-profile-v1';
type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asRows = (value: unknown) => Array.isArray(value) ? value.filter(isRow) : [];
const text = (source: Row, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};
const num = (source: Row, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
};
const bool = (source: Row, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return /^(true|1|yes)$/i.test(value);
  }
  return false;
};
const faDate = (value: string) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'تازه';
  return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(date);
};
const toneFor = (value: string): Post['tone'] => {
  const tones: Post['tone'][] = ['blue', 'violet', 'amber', 'teal'];
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
};

export type ChannelProfileStats = {
  posts: number;
  followers: number;
  saves: number;
  views30d: number;
  unique30d: number;
  recentPosts: number;
  quality: number;
  lastPostAt: string;
};
export type ChannelProfileTopic = { id: string; name: string; slug: string; weight: number };
export type SimilarChannel = Channel & {
  bio?: string;
  following: boolean;
  score: number;
  topicOverlap: number;
  quality: number;
  freshness: number;
  postsCount: number;
  verified: boolean;
};
export type ChannelProfileData = {
  channel: Channel;
  bio: string;
  sourceUrl: string;
  verified: boolean;
  following: boolean;
  stats: ChannelProfileStats;
  topics: ChannelProfileTopic[];
  posts: Post[];
  similar: SimilarChannel[];
  algorithm: string;
};

function mapChannel(source: Row): Channel {
  const creatorId = text(source, ['creator_id', 'id']);
  const username = text(source, ['username', 'channel_username']).replace(/^@/, '');
  const title = text(source, ['title', 'name', 'channel_name']) || username || 'Telegram';
  return {
    id: creatorId || username || title,
    creatorId: creatorId || undefined,
    title,
    username: username ? `@${username}` : '',
    initials: title.slice(0, 1).toUpperCase() || 'T',
    accent: 'navy',
    avatarUrl: text(source, ['avatar_url', 'channel_avatar_url']) || (username ? `${ORIGIN}/api/telegram/channel-avatar?username=${encodeURIComponent(username)}` : undefined),
    trackingAvailable: Boolean(creatorId),
  };
}

function mapPost(source: Row, index: number, fallbackChannel: Channel): Post {
  const contentId = text(source, ['content_id', 'id']);
  const title = text(source, ['title']) || text(source, ['description', 'text_content']).slice(0, 120) || 'پست تلگرام';
  const excerpt = text(source, ['text_content', 'description']) || title;
  const directMedia = text(source, ['media_url', 'thumbnail_url']);
  const telegramUrl = text(source, ['source_url']);
  const mediaUrl = /^https?:\/\//i.test(directMedia)
    ? directMedia
    : telegramUrl
      ? `${ORIGIN}/api/telegram/preview-image?url=${encodeURIComponent(telegramUrl)}`
      : undefined;
  const contentType = text(source, ['content_type']).toLowerCase();
  const kind: PostKind = /video/.test(contentType) ? 'video' : mediaUrl ? 'image' : 'text';
  const id = contentId || `${fallbackChannel.id}-${index}`;
  return {
    id,
    contentId: contentId || undefined,
    creatorId: fallbackChannel.creatorId,
    telegramUrl: telegramUrl || undefined,
    channel: fallbackChannel,
    category: text(source, ['category']) || 'تلگرام',
    title,
    excerpt,
    kind,
    tone: toneFor(id),
    mediaUrl,
    date: faDate(text(source, ['published_at'])),
    likes: '۰',
    comments: '۰',
    saved: bool(source, ['is_saved', 'saved']),
  };
}

function parse(raw: unknown): ChannelProfileData {
  if (!isRow(raw) || raw.ok === false || raw.found === false) throw new Error(text(raw as Row, ['error']) || 'اطلاعات کانال پیدا نشد.');
  const creator = isRow(raw.creator) ? raw.creator : {};
  const stats = isRow(raw.stats) ? raw.stats : {};
  const channel = mapChannel(creator);
  const posts = asRows(raw.posts).map((item, index) => mapPost(item, index, channel));
  const similar = asRows(raw.similar).map((item) => {
    const mapped = mapChannel(item);
    return {
      ...mapped,
      bio: text(item, ['bio']) || undefined,
      following: bool(item, ['following']),
      score: num(item, ['score']),
      topicOverlap: num(item, ['topic_overlap']),
      quality: num(item, ['quality']),
      freshness: num(item, ['freshness']),
      postsCount: num(item, ['posts_count']),
      verified: bool(item, ['verified']),
    };
  });
  return {
    channel,
    bio: text(creator, ['bio']),
    sourceUrl: text(creator, ['source_url']),
    verified: bool(creator, ['verified']),
    following: bool(raw, ['following']),
    stats: {
      posts: num(stats, ['posts_count']),
      followers: num(stats, ['followers_count']),
      saves: num(stats, ['saves_count']),
      views30d: num(stats, ['views_30d']),
      unique30d: num(stats, ['unique_viewers_30d']),
      recentPosts: num(stats, ['recent_posts']),
      quality: num(stats, ['avg_quality']),
      lastPostAt: text(stats, ['last_post_at']),
    },
    topics: asRows(raw.topics).map((topic) => ({
      id: text(topic, ['id']),
      name: text(topic, ['name']) || text(topic, ['slug']),
      slug: text(topic, ['slug']),
      weight: num(topic, ['weight']),
    })),
    posts,
    similar,
    algorithm: text(raw, ['algorithm']),
  };
}

async function call(creatorId: string, init: RequestInit, signal?: AbortSignal) {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('صفحه کانال داخل مینی‌اپ تلگرام فعال می‌شود.');
  const response = await fetch(`${API}?creator_id=${encodeURIComponent(creatorId)}&limit=24`, {
    ...init,
    signal,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      'x-request-id': crypto.randomUUID?.() || `${Date.now()}`,
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`);
  return parse(data);
}

export function loadChannelProfile(creatorId: string, signal?: AbortSignal) {
  return call(creatorId, { method: 'GET' }, signal);
}

export function setChannelFollow(creatorId: string, following: boolean) {
  return call(creatorId, {
    method: 'POST',
    body: JSON.stringify({ action: 'follow', creator_id: creatorId, following }),
  });
}
