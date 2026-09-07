import {
  getTelegramInitData,
  getTelegramUser,
  openTelegramUrl,
  requestJson,
} from './live';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const row = (value: unknown): Row => (isRow(value) ? value : {});
const list = (value: unknown) =>
  Array.isArray(value) ? value.filter(isRow) : [];

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
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

const firstObject = (source: Row, keys: string[]) => {
  for (const key of keys) {
    if (isRow(source[key])) return source[key] as Row;
  }
  return source;
};

const candidateList = (raw: unknown, depth = 0): Row[] => {
  if (Array.isArray(raw)) return raw.filter(isRow);
  if (!isRow(raw) || depth > 5) return [];

  for (const key of [
    'channels',
    'creators',
    'items',
    'rows',
    'results',
    'data',
    'dashboard',
  ]) {
    const value = raw[key];

    if (Array.isArray(value)) {
      const items = value.filter(isRow);
      if (items.length) return items;
    }

    if (isRow(value)) {
      const nested = candidateList(value, depth + 1);
      if (nested.length) return nested;
    }
  }

  return [];
};

export type CreatorChannel = {
  id: string;
  title: string;
  username: string;
  ownerTelegramUserId: string;
  verified: boolean;
  botAdmin: boolean;
};

export type CreatorMetrics = {
  title: string;
  username: string;
  views: number;
  uniqueViewers: number;
  telegramOpens: number;
  joinClicks: number;
  telegramJoins: number;
  activeJoins: number;
  leaves: number;
  saves: number;
  botStarts: number;
  joinConversion: number;
  ctr: number;
};

export type CreatorContent = {
  id: string;
  title: string;
  views: number;
  unique: number;
  opens: number;
  clicks: number;
  joins: number;
  active: number;
  leaves: number;
  saves: number;
  conversion: number;
};

export type BotOwnerStats = {
  uniqueUsers: number;
  active30d: number;
  newToday: number;
  new7d: number;
  new30d: number;
  active7d: number;
  eventUsers7d: number;
  eventUsers30d: number;
  generatedAt: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  date: string;
  actionUrl: string;
  unread: boolean;
};

export type HubData = {
  displayName: string;
  username: string;
  initials: string;
  followsCount: number;
  notificationsCount: number;
  topicsCount: number;
  claimsCount: number;
  creators: CreatorChannel[];
  sourceLive: boolean;
  needsTelegram: boolean;
};

const normalizeChannels = (raw: unknown): CreatorChannel[] => {
  const currentId = String(getTelegramUser()?.id ?? '');
  const top = candidateList(raw);
  const expanded: Row[] = [];

  for (const item of top) {
    const children = list(item.channels);

    if (children.length) {
      for (const child of children) {
        // Keep parent ownership fields when child rows only contain channel data.
        expanded.push({ ...item, ...child });
      }
    } else {
      expanded.push(item);
    }
  }

  const normalized = expanded
    .map((source) => {
      const channel = isRow(source.channel)
        ? (source.channel as Row)
        : isRow(source.telegram_source)
          ? (source.telegram_source as Row)
          : source;

      const id =
        text(channel, [
          'id',
          'creator_channel_id',
          'channel_id',
          'telegram_source_id',
          'source_id',
        ]) ||
        text(source, [
          'id',
          'creator_channel_id',
          'channel_id',
          'telegram_source_id',
          'source_id',
        ]);

      const username = (
        text(channel, [
          'username',
          'channel_username',
          'source_username',
          'handle',
        ]) ||
        text(source, [
          'username',
          'channel_username',
          'source_username',
          'handle',
        ])
      ).replace(/^@/, '');

      const title =
        text(channel, [
          'title',
          'channel_title',
          'source_title',
          'name',
          'display_name',
        ]) ||
        text(source, [
          'title',
          'channel_title',
          'source_title',
          'name',
          'display_name',
        ]) ||
        username ||
        'کانال';

      const ownerTelegramUserId = String(
        source.owner_telegram_user_id ??
          source.telegram_user_id ??
          source.creator_telegram_user_id ??
          row(source.creator).telegram_user_id ??
          channel.owner_telegram_user_id ??
          '',
      );

      return {
        id: id || username,
        username,
        title,
        ownerTelegramUserId,
        verified: Boolean(
          channel.verified ??
            channel.ownership_verified ??
            source.verified ??
            source.ownership_verified ??
            source.claim_verified,
        ),
        botAdmin: Boolean(
          channel.bot_admin ??
            channel.is_bot_admin ??
            source.bot_admin ??
            source.is_bot_admin,
        ),
      };
    })
    .filter((item) => Boolean(item.id));

  // The Creator API is already user-scoped. Some legitimate rows do not carry
  // owner_telegram_user_id. Previously, as soon as one row had an owner id,
  // every owner-less row was dropped. That is why a 4-channel response could
  // collapse to only 2 visible channels. Keep owner-less rows, but still reject
  // rows explicitly belonging to another Telegram user.
  const scoped = currentId
    ? normalized.filter(
        (item) =>
          !item.ownerTelegramUserId || item.ownerTelegramUserId === currentId,
      )
    : normalized;

  const seen = new Set<string>();

  return scoped.filter((item) => {
    const key = (item.username || item.id).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeMetrics = (raw: unknown): CreatorMetrics => {
  const root = row(raw);
  const source = firstObject(root, [
    'dashboard',
    'data',
    'analytics',
    'summary',
  ]);
  const metrics = firstObject(source, ['metrics', 'totals', 'stats']);

  return {
    title: text(source, ['title', 'channel_title', 'name']),
    username: text(source, ['username', 'channel_username']),
    views: number(metrics, ['views', 'impressions', 'total_views']),
    uniqueViewers: number(metrics, [
      'unique_viewers',
      'unique_views',
      'unique_users',
    ]),
    telegramOpens: number(metrics, [
      'telegram_opens',
      'opens',
      'open_count',
    ]),
    joinClicks: number(metrics, [
      'join_clicks',
      'clicks_telegram',
      'telegram_clicks',
      'clicks',
    ]),
    telegramJoins: number(metrics, [
      'telegram_joins',
      'joins',
      'attributed_joins',
      'join_count',
    ]),
    activeJoins: number(metrics, [
      'active_joins',
      'active_members',
      'current_joins',
    ]),
    leaves: number(metrics, ['leaves', 'leave_count']),
    saves: number(metrics, ['saves', 'save_count']),
    botStarts: number(metrics, ['starts_bot', 'bot_starts', 'starts']),
    joinConversion: number(metrics, [
      'join_conversion_rate',
      'join_rate',
      'conversion_rate',
      'conversion',
    ]),
    ctr: number(metrics, ['ctr', 'click_through_rate']),
  };
};

const normalizeContent = (raw: unknown): CreatorContent[] => {
  const root = row(raw);
  let items: Row[] = [];

  for (const key of ['items', 'content', 'contents', 'rows', 'data']) {
    if (Array.isArray(root[key])) {
      items = list(root[key]);
      break;
    }

    if (isRow(root[key])) {
      const nested = row(root[key]);
      for (const inner of ['items', 'content', 'rows']) {
        if (Array.isArray(nested[inner])) {
          items = list(nested[inner]);
          break;
        }
      }
    }

    if (items.length) break;
  }

  return items
    .map((item) => ({
      id: text(item, ['id', 'content_id']) || Math.random().toString(36),
      title: text(item, ['title', 'text', 'caption']) || 'پست تلگرام',
      views: number(item, ['views', 'impressions']),
      unique: number(item, ['unique_viewers', 'unique_views']),
      opens: number(item, ['telegram_opens', 'opens']),
      clicks: number(item, ['join_clicks', 'clicks_telegram', 'clicks']),
      joins: number(item, ['telegram_joins', 'joins', 'attributed_joins']),
      active: number(item, ['active_joins']),
      leaves: number(item, ['leaves']),
      saves: number(item, ['saves']),
      conversion: number(item, [
        'join_conversion_rate',
        'join_rate',
        'conversion_rate',
      ]),
    }))
    .slice(0, 50);
};

const dateLabel = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('fa-IR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(parsed);
};

export async function loadProfileHub(signal?: AbortSignal): Promise<HubData> {
  const paths = [
    '/api/discovery/profile',
    '/api/discovery/notifications?limit=20',
    '/api/discovery/notification-preferences',
    '/api/discovery/topics',
    '/api/creator/dashboard',
    '/api/creator/claims',
  ];

  const settled = await Promise.allSettled(
    paths.map((path) => requestJson(path, { signal })),
  );

  const value = (index: number) =>
    settled[index]?.status === 'fulfilled'
      ? (settled[index] as PromiseFulfilledResult<unknown>).value
      : {};

  const profile = row(value(0));
  const user = row(profile.user);
  const tg = getTelegramUser() || {};
  const first = text(user, ['first_name']) || text(tg, ['first_name']);
  const last = text(user, ['last_name']) || text(tg, ['last_name']);
  const displayName =
    text(user, ['display_name', 'name', 'full_name']) ||
    [first, last].filter(Boolean).join(' ') ||
    'کاربر تلگرام';
  const username = (text(user, ['username']) || text(tg, ['username'])).replace(
    /^@/,
    '',
  );
  const initials = (
    displayName.trim().slice(0, 1) ||
    username.slice(0, 1) ||
    'T'
  ).toUpperCase();
  const notifications = row(value(1));
  const topics = value(3);
  const claims = value(5);
  const creators = normalizeChannels(value(4));

  return {
    displayName,
    username: username ? `@${username}` : '',
    initials,
    followsCount: list(profile.follows).length,
    notificationsCount: list(notifications.items).length,
    topicsCount: candidateList(topics).length,
    claimsCount: candidateList(claims).length,
    creators,
    sourceLive: settled.some((item) => item.status === 'fulfilled'),
    needsTelegram: !getTelegramInitData(),
  };
}

export async function loadCreatorMetrics(
  channelId: string,
  days = 30,
  signal?: AbortSignal,
) {
  const id = encodeURIComponent(channelId);
  const period = encodeURIComponent(String(days));

  try {
    return normalizeMetrics(
      await requestJson(`/api/creator/dashboard?channel_id=${id}&days=${period}`, {
        signal,
      }),
    );
  } catch {
    return normalizeMetrics(
      await requestJson(`/api/creator/analytics?channel_id=${id}&days=${period}`, {
        signal,
      }),
    );
  }
}

export async function loadCreatorContent(
  channelId: string,
  days = 30,
  signal?: AbortSignal,
) {
  const id = encodeURIComponent(channelId);
  const period = encodeURIComponent(String(days));

  try {
    return normalizeContent(
      await requestJson(
        `/api/creator/content?channel_id=${id}&days=${period}&limit=50`,
        { signal },
      ),
    );
  } catch {
    return normalizeContent(
      await requestJson(
        `/api/creator/content-performance?channel_id=${id}&days=${period}&limit=50`,
        { signal },
      ),
    );
  }
}

export async function loadBotOwnerStats(
  signal?: AbortSignal,
): Promise<BotOwnerStats | null> {
  if (!getTelegramInitData()) return null;

  const raw = row(
    await requestJson(
      'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/bot-owner-analytics-v1',
      { signal, timeout: 7000 },
    ),
  );
  const stats = row(raw.stats);

  return {
    uniqueUsers: number(stats, ['unique_telegram_users', 'total_users']),
    active30d: number(stats, ['active_30d']),
    newToday: number(stats, ['new_today']),
    new7d: number(stats, ['new_7d']),
    new30d: number(stats, ['new_30d']),
    active7d: number(stats, ['active_7d']),
    eventUsers7d: number(stats, ['event_users_7d']),
    eventUsers30d: number(stats, ['event_users_30d']),
    generatedAt: text(stats, ['generated_at']),
  };
}

export async function loadNotifications(
  signal?: AbortSignal,
): Promise<NotificationItem[]> {
  const raw = row(
    await requestJson('/api/discovery/notifications?limit=20', { signal }),
  );
  const items = list(raw.items).length ? list(raw.items) : candidateList(raw);

  return items.map((item) => ({
    id: text(item, ['id', 'notification_id']) || Math.random().toString(36),
    title: text(item, ['title', 'subject', 'type']) || 'اعلان',
    body: text(item, ['body', 'message', 'text', 'description']),
    date: dateLabel(text(item, ['created_at', 'published_at', 'date'])),
    actionUrl: text(item, ['action_url', 'url', 'link']),
    unread: !Boolean(item.read_at ?? item.is_read ?? false),
  }));
}

export const openNotification = (item: NotificationItem) =>
  item.actionUrl ? openTelegramUrl(item.actionUrl) : false;
