import { requestJson } from './live';

export type NotificationPreferences = {
  inAppEnabled: boolean;
  followedCreators: boolean;
  personalizedDigest: boolean;
  timezone: string;
};

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const row = (value: unknown): Row => (isRow(value) ? value : {});

const bool = (value: unknown, fallback = true) =>
  typeof value === 'boolean' ? value : fallback;

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export async function markNotificationsRead(notificationId?: string) {
  await requestJson('/api/discovery/notifications/read', {
    method: 'POST',
    body: notificationId ? { notification_id: notificationId } : {},
  });
}

export async function loadNotificationPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreferences> {
  const raw = row(
    await requestJson('/api/discovery/notification-preferences', {
      signal,
      timeout: 8000,
    }),
  );

  const preferences = row(raw.preferences);

  return {
    inAppEnabled: bool(preferences.in_app_enabled, true),
    followedCreators: bool(preferences.followed_creators, true),
    personalizedDigest: bool(preferences.personalized_digest, true),
    timezone:
      typeof preferences.timezone === 'string' && preferences.timezone.trim()
        ? preferences.timezone.trim()
        : timezone(),
  };
}

export async function updateNotificationPreferences(
  next: NotificationPreferences,
): Promise<NotificationPreferences> {
  const raw = row(
    await requestJson('/api/discovery/notification-preferences', {
      method: 'PUT',
      body: {
        in_app_enabled: next.inAppEnabled,
        followed_creators: next.followedCreators,
        personalized_digest: next.personalizedDigest,
        timezone: next.timezone || timezone(),
      },
      timeout: 8000,
    }),
  );

  const preferences = row(raw.preferences);

  return {
    inAppEnabled: bool(preferences.in_app_enabled, next.inAppEnabled),
    followedCreators: bool(
      preferences.followed_creators,
      next.followedCreators,
    ),
    personalizedDigest: bool(
      preferences.personalized_digest,
      next.personalizedDigest,
    ),
    timezone:
      typeof preferences.timezone === 'string' && preferences.timezone.trim()
        ? preferences.timezone.trim()
        : next.timezone || timezone(),
  };
}
