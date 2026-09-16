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
const list = (value: unknown): Row[] =>
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
  if (!isRow(raw) || depth > 6) return [];

  for (const key of [
    'channels',
    'creators',
    'items',
    'rows',
    'results',
    'data',
    'dashboard',
    'analytics',
    'content',
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
  // id is always the id that should be sent back to creator dashboard/content APIs.
  id: string;
  creatorChannelId: string;
  sourceId: string;
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
  botStartsTotal: number;
  botStartUsersTotal: number;
  botStartsToday: number;
  botStartUsersNonOwner: number;
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

export type CreatorOwnershipResult = {
  status: 'approved' | 'pending';
  botAdmin: boolean;
};

const normalizeChannelUsername = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .trim();

export async function claimCreatorOwnership(
  value: string,
): Promise<CreatorOwnershipResult> {
  const username = normalizeChannelUsername(value);

  if (!/^[A-Za-z0-9_]{4,32}$/.test(username)) {
    throw new Error('نام کاربری یا لینک عمومی کانال معتبر نیست.');
  }

  try {
    const response = row(
      await requestJson('/api/creator/channel/add', {
        method: 'POST',
        body: { username },
      }),
    );

    return {
      status: 'approved',
      botAdmin: Boolean(response.bot_admin ?? row(response.channel).is_bot_admin),
    };
  } catch (cause) {
    const status = (cause as Error & { status?: number }).status;

    // Preserve the original ownership-request flow when Telegram cannot verify
    // the owner/admin role immediately. Verified owners use /channel/add and
    // receive Creator Center access without waiting for manual review.
    if (status !== 403) throw cause;

    await requestJson('/api/creator/claim', {
      method: 'POST',
      body: { username },
    });

    return { status: 'pending', botAdmin: false };
  }
}

const normalizeChannels = (raw: unknown): CreatorChannel[] => {
  const currentTelegramUserId = String(getTelegramUser()?.id ?? '');
  const top = candidateList(raw);
  const expanded: Row[] = [];

  for (const item of top) {
    const children = list(item.channels);

    if (children.length) {
      for (const child of children) {
        // Preserve parent creator/ownership identifiers when the nested row only
        // contains the Telegram/source metadata.
        expanded.push({ ...item, ...child });
      }
    } else {
      expanded.push(item);
    }
  }

  const normalized = expanded
    .map((source) => {
      const channelObject = isRow(source.channel)
        ? (source.channel as Row)
        : {};

      const telegramSourceObject = isRow(source.telegram_source)
        ? (source.telegram_source as Row)
        : {};

      const displayObject =
        Object.keys(channelObject).length > 0
          ? channelObject
          : Object.keys(telegramSourceObject).length > 0
            ? telegramSourceObject
            : source;

      /*
       * IMPORTANT:
       * Metrics RPCs are keyed by creator_channels.id.
       *
       * The previous React normalizer preferred nested channel/source `id`
       * before `creator_channel_id`. When /channels returned a nested
       * telegram_source, the UI could therefore send telegram_sources.id to
       * /dashboard. That id is a valid UUID, so the backend can answer 200 with
       * an all-zero dashboard instead of throwing an obvious error.
       *
       * Explicit creator-channel identifiers must win.
       */
      const creatorChannelId =
        text(source, [
          'creator_channel_id',
          'owner_creator_channel_id',
          'claimed_channel_id',
        ]) ||
        text(channelObject, [
          'creator_channel_id',
          'owner_creator_channel_id',
          'claimed_channel_id',
        ]) ||
        // Some creator APIs return the creator_channels row directly.
        text(source, ['channel_id']) ||
        text(channelObject, ['channel_id']) ||
        // Only after explicit creator identifiers do we trust a generic id.
        text(source, ['id']) ||
        text(channelObject, ['id']);

      const sourceId =
        text(source, ['telegram_source_id', 'source_id']) ||
        text(telegramSourceObject, [
          'telegram_source_id',
          'source_id',
          'id',
        ]) ||
        (Object.keys(telegramSourceObject).length ? text(displayObject, ['id']) : '');

      const username = (
        text(displayObject, [
          'username',
          'channel_username',
          'source_username',
          'handle',
          'telegram_username',
        ]) ||
        text(source, [
          'username',
          'channel_username',
          'source_username',
          'handle',
          'telegram_username',
        ])
      ).replace(/^@/, '');

      const title =
        text(displayObject, [
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
          displayObject.owner_telegram_user_id ??
          '',
      );

      const id = creatorChannelId || username || sourceId;

      return {
        id,
        creatorChannelId: creatorChannelId || id,
        sourceId,
        username,
        title,
        ownerTelegramUserId,
        verified: Boolean(
          displayObject.verified ??
            displayObject.ownership_verified ??
            source.verified ??
            source.ownership_verified ??
            source.claim_verified,
        ),
        botAdmin: Boolean(
          displayObject.bot_admin ??
            displayObject.is_bot_admin ??
            source.bot_admin ??
            source.is_bot_admin,
        ),
      };
    })
    .filter((item) => Boolean(item.id));

  // The /channels route is already user-scoped. Keep rows without explicit
  // ownership metadata, but reject rows explicitly owned by somebody else.
  const scoped = currentTelegramUserId
    ? normalized.filter(
        (item) =>
          !item.ownerTelegramUserId ||
          item.ownerTelegramUserId === currentTelegramUserId,
      )
    : normalized;

  const seen = new Set<string>();

  return scoped.filter((item) => {
    const key = (item.username || item.creatorChannelId || item.id).toLowerCase();

    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

const metricPayload = (raw: unknown, channelId = ''): Row => {
  if (Array.isArray(raw)) {
    const rows = raw.filter(isRow);
    if (!rows.length) return {};

    if (channelId) {
      const matched = rows.find((item) =>
        [
          text(item, ['creator_channel_id']),
          text(item, ['channel_id']),
          text(item, ['id']),
        ].includes(channelId),
      );

      if (matched) return matched;
    }

    return rows[0];
  }

  const root = row(raw);

  // If a response wraps a list (analytics fallback commonly does), select the
  // requested channel instead of normalizing the wrapper into zeros.
  for (const key of ['channels', 'items', 'rows', 'results']) {
    if (Array.isArray(root[key])) {
      return metricPayload(root[key], channelId);
    }
  }

  if (Array.isArray(root.data)) {
    return metricPayload(root.data, channelId);
  }

  return root;
};

const normalizeMetrics = (
  raw: unknown,
  channelId = '',
): CreatorMetrics => {
  const root = metricPayload(raw, channelId);

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

const metricWeight = (metrics: CreatorMetrics) =>
  metrics.views +
  metrics.uniqueViewers +
  metrics.telegramOpens +
  metrics.joinClicks +
  metrics.telegramJoins +
  metrics.activeJoins +
  metrics.leaves +
  metrics.saves +
  metrics.botStarts;

const normalizeContent = (raw: unknown): CreatorContent[] => {
  const root = row(raw);
  let items: Row[] = [];

  if (Array.isArray(raw)) {
    items = list(raw);
  } else {
    for (const key of [
      'items',
      'content',
      'contents',
      'rows',
      'results',
      'data',
    ]) {
      if (Array.isArray(root[key])) {
        items = list(root[key]);
        break;
      }

      if (isRow(root[key])) {
        const nested = row(root[key]);

        for (const inner of [
          'items',
          'content',
          'contents',
          'rows',
          'results',
        ]) {
          if (Array.isArray(nested[inner])) {
            items = list(nested[inner]);
            break;
          }
        }
      }

      if (items.length) break;
    }
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

export async function loadProfileHub(
  signal?: AbortSignal,
): Promise<HubData> {
  const paths = [
    '/api/discovery/profile',
    '/api/discovery/notifications?limit=20',
    '/api/discovery/notification-preferences',
    '/api/discovery/topics',
    // Use the real creator catalog route directly. Do not depend on the
    // temporary Pages rewrite from /dashboard -> /channels.
    '/api/creator/channels',
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

  const username = (
    text(user, ['username']) || text(tg, ['username'])
  ).replace(/^@/, '');

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

  let dashboard: CreatorMetrics | null = null;

  try {
    dashboard = normalizeMetrics(
      await requestJson(
        `/api/creator/dashboard?channel_id=${id}&days=${period}`,
        { signal },
      ),
      channelId,
    );
  } catch {
    dashboard = null;
  }

  // creator-dashboard-v2 can legally answer 200 with an all-zero dashboard.
  // If that happens, check the analytics compatibility route before accepting
  // the zeros. This also handles array-shaped analytics responses.
  if (!dashboard || metricWeight(dashboard) === 0) {
    try {
      const analytics = normalizeMetrics(
        await requestJson(
          `/api/creator/analytics?channel_id=${id}&days=${period}`,
          { signal },
        ),
        channelId,
      );

      if (!dashboard || metricWeight(analytics) > metricWeight(dashboard)) {
        return analytics;
      }
    } catch {
      // Keep the dashboard response if it existed.
    }
  }

  if (dashboard) return dashboard;

  throw new Error('Creator metrics unavailable');
}

export async function loadCreatorContent(
  channelId: string,
  days = 30,
  signal?: AbortSignal,
) {
  const id = encodeURIComponent(channelId);
  const period = encodeURIComponent(String(days));

  try {
    const primary = normalizeContent(
      await requestJson(
        `/api/creator/content?channel_id=${id}&days=${period}&limit=50`,
        { signal },
      ),
    );

    if (primary.length) return primary;
  } catch {
    // Try compatibility route below.
  }

  return normalizeContent(
    await requestJson(
      `/api/creator/content-performance?channel_id=${id}&days=${period}&limit=50`,
      { signal },
    ),
  );
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
    botStartsTotal: number(stats, ['bot_starts_total']),
    botStartUsersTotal: number(stats, ['bot_start_users_total']),
    botStartsToday: number(stats, ['bot_starts_today']),
    botStartUsersNonOwner: number(stats, ['bot_start_users_non_owner']),
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

export async function createCreatorTrackingLink(
  channelId: string,
  signal?: AbortSignal,
): Promise<string> {
  const raw = row(
    await requestJson('/api/creator/tracking-link', {
      method: 'POST',
      body: {
        channel_id: channelId,
        source: 'creator_center_react_v7',
      },
      signal,
    }),
  );

  const url = text(raw, ['url', 'tracking_url', 'link']);

  if (!url) {
    throw new Error('لینک ردیابی ساخته نشد.');
  }

  return url;
}
