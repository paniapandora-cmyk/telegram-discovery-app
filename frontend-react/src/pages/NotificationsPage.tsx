import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCheck,
  ExternalLink,
  RefreshCw,
  Settings2,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import {
  openNotification,
  type NotificationItem,
} from '../data/account';
import {
  loadNotificationPreferences,
  markNotificationsRead,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../data/notifications';
import '../styles/notifications-center-v9.css';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';
type Filter = 'all' | 'unread' | 'action';

type Props = {
  items: NotificationItem[];
  state: LoadState;
  onBack: () => void;
  onChange: (items: NotificationItem[]) => void;
  onRefresh: () => void;
};

const fa = new Intl.NumberFormat('fa-IR');

const defaultPreferences = (): NotificationPreferences => ({
  inAppEnabled: true,
  followedCreators: true,
  personalizedDigest: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
});

export default function NotificationsPage({
  items,
  state,
  onBack,
  onChange,
  onRefresh,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [readBusy, setReadBusy] = useState('');
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    defaultPreferences,
  );
  const [preferencesState, setPreferencesState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [preferenceBusy, setPreferenceBusy] = useState<
    keyof NotificationPreferences | ''
  >('');

  useEffect(() => {
    const controller = new AbortController();
    setPreferencesState('loading');

    loadNotificationPreferences(controller.signal)
      .then((next) => {
        setPreferences(next);
        setPreferencesState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreferencesState('error');
      });

    return () => controller.abort();
  }, []);

  const unreadCount = useMemo(
    () => items.filter((item) => item.unread).length,
    [items],
  );

  const actionableCount = useMemo(
    () => items.filter((item) => Boolean(item.actionUrl)).length,
    [items],
  );

  const visibleItems = useMemo(() => {
    if (filter === 'unread') return items.filter((item) => item.unread);
    if (filter === 'action') return items.filter((item) => item.actionUrl);
    return items;
  }, [items, filter]);

  const markOne = async (item: NotificationItem, openAfter = false) => {
    if (readBusy) return;
    setError('');
    setReadBusy(item.id);

    try {
      if (item.unread) {
        await markNotificationsRead(item.id);
        onChange(
          items.map((current) =>
            current.id === item.id ? { ...current, unread: false } : current,
          ),
        );
      }

      if (openAfter && item.actionUrl) openNotification(item);
    } catch {
      setError('ثبت وضعیت اعلان انجام نشد. دوباره تلاش کن.');
    } finally {
      setReadBusy('');
    }
  };

  const markAll = async () => {
    if (!unreadCount || readBusy) return;
    setError('');
    setReadBusy('all');

    try {
      await markNotificationsRead();
      onChange(items.map((item) => ({ ...item, unread: false })));
    } catch {
      setError('خوانده‌شدن اعلان‌ها ثبت نشد. دوباره تلاش کن.');
    } finally {
      setReadBusy('');
    }
  };

  const togglePreference = async (
    key: 'inAppEnabled' | 'followedCreators' | 'personalizedDigest',
  ) => {
    if (preferenceBusy) return;

    const before = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setPreferenceBusy(key);
    setError('');

    try {
      const saved = await updateNotificationPreferences(next);
      setPreferences(saved);
      setPreferencesState('ready');
    } catch {
      setPreferences(before);
      setPreferencesState('error');
      setError('ذخیره تنظیمات اعلان انجام نشد.');
    } finally {
      setPreferenceBusy('');
    }
  };

  return (
    <div className="page notificationCenterPage">
      <header className="notificationHeaderV9 surface">
        <button
          type="button"
          className="notificationBackV9"
          onClick={onBack}
          aria-label="بازگشت"
        >
          <ArrowRight />
        </button>

        <div className="notificationHeaderCopy">
          <span className="notificationTitleIcon"><Bell /></span>
          <div>
            <h1>اعلان‌ها</h1>
            <p>رویدادهای مهم حساب، کانال‌ها و پیشنهادهای کشف</p>
          </div>
        </div>

        <button
          type="button"
          className="notificationRefreshV9"
          onClick={onRefresh}
          disabled={state === 'loading'}
          aria-label="به‌روزرسانی اعلان‌ها"
        >
          <RefreshCw className={state === 'loading' ? 'spin' : ''} />
        </button>
      </header>

      <section className="notificationOverviewV9" aria-label="خلاصه اعلان‌ها">
        <article className="surface">
          <span>خوانده‌نشده</span>
          <strong>{fa.format(unreadCount)}</strong>
          <small>نیازمند توجه</small>
        </article>
        <article className="surface">
          <span>دارای اقدام</span>
          <strong>{fa.format(actionableCount)}</strong>
          <small>قابل باز کردن</small>
        </article>
        <article className="surface">
          <span>کل اخیر</span>
          <strong>{fa.format(items.length)}</strong>
          <small>آخرین اعلان‌ها</small>
        </article>
      </section>

      <section className="notificationToolbarV9">
        <div className="notificationFiltersV9" aria-label="فیلتر اعلان‌ها">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            همه
          </button>
          <button
            type="button"
            className={filter === 'unread' ? 'active' : ''}
            onClick={() => setFilter('unread')}
          >
            خوانده‌نشده
            {unreadCount > 0 && <b>{fa.format(unreadCount)}</b>}
          </button>
          <button
            type="button"
            className={filter === 'action' ? 'active' : ''}
            onClick={() => setFilter('action')}
          >
            دارای لینک
          </button>
        </div>

        <button
          type="button"
          className="notificationReadAllV9"
          onClick={() => void markAll()}
          disabled={!unreadCount || Boolean(readBusy)}
        >
          <CheckCheck />
          {readBusy === 'all' ? 'در حال ثبت…' : 'همه خوانده شد'}
        </button>
      </section>

      {error && <div className="notificationErrorV9" role="alert">{error}</div>}

      {state === 'loading' && !items.length ? (
        <div className="notificationSkeletonV9" aria-label="در حال دریافت اعلان‌ها">
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : visibleItems.length ? (
        <section className="notificationListV9" aria-live="polite">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className={`notificationCardV9 surface ${item.unread ? 'unread' : ''}`}
              onClick={() => void markOne(item, Boolean(item.actionUrl))}
            >
              <div className="notificationIconV9">
                {item.actionUrl ? <Sparkles /> : <Bell />}
                {item.unread && <i aria-label="خوانده‌نشده" />}
              </div>

              <div className="notificationContentV9">
                <div className="notificationCardTitleV9">
                  <b>{item.title}</b>
                  {item.unread && <span>جدید</span>}
                </div>
                {item.body && <p>{item.body}</p>}
                <small>{item.date || 'تازه'}</small>
              </div>

              <div className="notificationCardActionV9">
                {item.actionUrl ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void markOne(item, true);
                    }}
                    disabled={Boolean(readBusy)}
                    aria-label="باز کردن اعلان"
                  >
                    <ExternalLink />
                  </button>
                ) : item.unread ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void markOne(item, false);
                    }}
                    disabled={Boolean(readBusy)}
                    aria-label="علامت‌گذاری به عنوان خوانده‌شده"
                  >
                    <CheckCheck />
                  </button>
                ) : (
                  <span className="notificationReadStateV9"><CheckCheck /></span>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="emptyState notificationEmptyV9">
          <Bell />
          <h2>{filter === 'all' ? 'اعلان جدیدی نیست' : 'چیزی در این فیلتر نیست'}</h2>
          <p>
            {filter === 'all'
              ? 'وقتی رویداد مهمی برای حساب یا کانال‌ها داشته باشی، اینجا نمایش داده می‌شود.'
              : 'فیلتر دیگری را انتخاب کن تا بقیه اعلان‌ها را ببینی.'}
          </p>
        </div>
      )}

      <section className="notificationPreferencesV9 surface">
        <header>
          <div>
            <Settings2 />
            <span>
              <b>تنظیمات اعلان</b>
              <small>انتخاب کن چه چیزهایی داخل «کشف» به تو نشان داده شود</small>
            </span>
          </div>
          <em className={preferencesState}>{
            preferencesState === 'loading'
              ? 'در حال دریافت…'
              : preferencesState === 'ready'
                ? 'ذخیره خودکار'
                : 'نیاز به بررسی'
          }</em>
        </header>

        <button
          type="button"
          className="notificationPreferenceRowV9"
          onClick={() => void togglePreference('inAppEnabled')}
          disabled={preferencesState === 'loading' || Boolean(preferenceBusy)}
        >
          <span className="notificationPreferenceIconV9"><Bell /></span>
          <span className="notificationPreferenceCopyV9">
            <b>اعلان داخل برنامه</b>
            <small>رویدادهای مهم را در مرکز اعلان‌ها نگه دار</small>
          </span>
          <span className={`notificationSwitchV9 ${preferences.inAppEnabled ? 'on' : ''}`}><i /></span>
        </button>

        <button
          type="button"
          className="notificationPreferenceRowV9"
          onClick={() => void togglePreference('followedCreators')}
          disabled={preferencesState === 'loading' || Boolean(preferenceBusy)}
        >
          <span className="notificationPreferenceIconV9"><UserRoundCheck /></span>
          <span className="notificationPreferenceCopyV9">
            <b>کانال‌های دنبال‌شده</b>
            <small>برای فعالیت‌های مهم کانال‌هایی که دنبال می‌کنی اعلان بگیر</small>
          </span>
          <span className={`notificationSwitchV9 ${preferences.followedCreators ? 'on' : ''}`}><i /></span>
        </button>

        <button
          type="button"
          className="notificationPreferenceRowV9"
          onClick={() => void togglePreference('personalizedDigest')}
          disabled={preferencesState === 'loading' || Boolean(preferenceBusy)}
        >
          <span className="notificationPreferenceIconV9"><Sparkles /></span>
          <span className="notificationPreferenceCopyV9">
            <b>خلاصه شخصی‌سازی‌شده</b>
            <small>گزیده پیشنهادهای مرتبط با علایقت را دریافت کن</small>
          </span>
          <span className={`notificationSwitchV9 ${preferences.personalizedDigest ? 'on' : ''}`}><i /></span>
        </button>
      </section>
    </div>
  );
}
