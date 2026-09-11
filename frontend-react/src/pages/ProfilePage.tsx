import {
  ArrowUpRight,
  BarChart3,
  History,
  Heart,
  RefreshCw,
  Bell,
  ShieldCheck,
} from 'lucide-react';
import type { BotOwnerStats, HubData } from '../data/account';
import GrowthCard from '../components/GrowthCard';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

type Props = {
  hub: HubData | null;
  botStats: BotOwnerStats | null;
  state: LoadState;
  onCreator: () => void;
  onSaved: () => void;
  onHistory: () => void;
  onNotifications: () => void;
  onRefresh: () => void;
};

const fa = new Intl.NumberFormat('fa-IR');

export default function ProfilePage({
  hub,
  botStats,
  state,
  onCreator,
  onSaved,
  onHistory,
  onNotifications,
  onRefresh,
}: Props) {
  const displayName = hub?.displayName || 'کاربر تلگرام';
  const initials = hub?.initials || 'T';

  return (
    <div className="page">
      <header className="pageHeader">
        <div>
          <h1>فضای شخصی تو</h1>
          <p>تنظیمات، سازندگان و آمار</p>
          <span className={`liveBadge ${state}`}>
            {state === 'live'
              ? 'داده زنده'
              : state === 'loading'
                ? 'در حال دریافت…'
                : hub?.needsTelegram
                  ? 'نیاز به اجرای تلگرام'
                  : 'نسخه پشتیبان'}
          </span>
        </div>
        <Bell />
      </header>

      <section className="profileHero surface">
        <div className="profileAvatar">{initials}</div>
        <div>
          <h2>{displayName}</h2>
          <p>{hub?.username || 'Telegram Mini App'}</p>
        </div>
        <strong>
          {fa.format(hub?.followsCount || 0)}
          <span>دنبال‌شده</span>
        </strong>
      </section>

      <GrowthCard />

      <section className="creatorEntry surface">
        <div>
          <span className="entryIcon">
            <ArrowUpRight />
          </span>
          <div>
            <h3>Creator Center</h3>
            <p>
              {hub?.creators.length
                ? `${fa.format(hub.creators.length)} کانال مالکیتی`
                : 'رشد، عضویت و عملکرد محتوا'}
            </p>
          </div>
        </div>
        <button onClick={onCreator}>باز کردن</button>
      </section>

      <section className="analytics surface">
        <div className="analyticsTitle">
          <div>
            <BarChart3 />
            <h2>Bot Analytics</h2>
          </div>
          <span>{botStats ? 'Owner' : 'Protected'}</span>
        </div>

        {botStats ? (
          <>
            <div className="metricHero">
              <article>
                <small>کل دفعات استارت</small>
                <strong>{fa.format(botStats.botStartsTotal)}</strong>
              </article>
              <article>
                <small>استارت‌کنندگان یکتا</small>
                <strong>{fa.format(botStats.botStartUsersTotal)}</strong>
              </article>
            </div>
            <div className="metricRow">
              <article>
                <small>استارت امروز · تهران</small>
                <strong>{fa.format(botStats.botStartsToday)}</strong>
              </article>
              <article>
                <small>یکتا بدون مدیر</small>
                <strong>{fa.format(botStats.botStartUsersNonOwner)}</strong>
              </article>
            </div>
            <p>شمارش استارت از زمان فعال‌سازی؛ دفعات قبلی در این آمار نیست.</p>
            <div className="metricHero">
              <article>
                <small>کل کاربران یکتا</small>
                <strong>{fa.format(botStats.uniqueUsers)}</strong>
              </article>
              <article>
                <small>فعال ۳۰ روز</small>
                <strong>{fa.format(botStats.active30d)}</strong>
              </article>
            </div>
            <div className="metricRow">
              <article>
                <small>جدید امروز</small>
                <strong>{fa.format(botStats.newToday)}</strong>
              </article>
              <article>
                <small>جدید ۷ روز</small>
                <strong>{fa.format(botStats.new7d)}</strong>
              </article>
              <article>
                <small>تعامل ۳۰ روز</small>
                <strong>{fa.format(botStats.eventUsers30d)}</strong>
              </article>
            </div>
          </>
        ) : (
          <div className="ownerLocked">
            <ShieldCheck />
            <div>
              <b>آمار مالک محافظت‌شده است</b>
              <span>
                {hub?.needsTelegram
                  ? 'برای دیدن این آمار، همین نسخه را داخل Telegram Mini App باز کن.'
                  : 'برای این حساب آمار مالک در دسترس نیست.'}
              </span>
            </div>
          </div>
        )}
      </section>

      <div className="quickGrid">
        <button onClick={onSaved}>
          <Heart />
          ذخیره‌ها
        </button>
        <button onClick={onHistory}>
          <History />
          تاریخچه
        </button>
        <button onClick={onNotifications}>
          <Bell />
          اعلان‌ها <b>{fa.format(hub?.notificationsCount || 0)}</b>
        </button>
        <button onClick={onRefresh}>
          <RefreshCw />
          به‌روزرسانی
        </button>
      </div>
    </div>
  );
}
