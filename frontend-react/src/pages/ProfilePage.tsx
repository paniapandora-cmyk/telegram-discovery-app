import {
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronLeft,
  Gift,
  History,
  Heart,
  Info,
  LifeBuoy,
  Megaphone,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { BotOwnerStats, HubData } from '../data/account';
import BroadcastCard from '../components/BroadcastCard';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';
type Props = {
  hub: HubData | null;
  botStats: BotOwnerStats | null;
  state: LoadState;
  onCreator: () => void;
  onSaved: () => void;
  onHistory: () => void;
  onNotifications: () => void;
  onInvite: () => void;
  onSupport: () => void;
  onAds: () => void;
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
  onInvite,
  onSupport,
  onAds,
  onRefresh,
}: Props) {
  const displayName = hub?.displayName || 'کاربر کشف';
  const initials = hub?.initials || 'ک';
  const username = hub?.username || '@discoverer';
  const followsCount = hub?.followsCount || 0;
  const topicsCount = hub?.topicsCount || 0;
  const creatorCount = hub?.creators.length || 0;

  const menu = [
    { icon: Gift, title: 'دعوت دوستان', text: 'لینک اختصاصی و نشان‌های رشد', onClick: onInvite, accent: 'mint' },
    { icon: ArrowUpRight, title: 'Creator Center', text: creatorCount ? `${fa.format(creatorCount)} کانال مالکیتی` : 'مدیریت کانال‌ها و آمارها', onClick: onCreator, accent: 'blue' },
    { icon: Megaphone, title: 'تبلیغات و کمپین', text: 'ساخت کمپین Sponsored', onClick: onAds, accent: 'violet' },
    { icon: LifeBuoy, title: 'پشتیبانی و به‌روزرسانی', text: '@discovery_te', onClick: onSupport, accent: 'cyan' },
    { icon: Heart, title: 'ذخیره‌ها', text: 'محتواهایی که برای بعد نگه داشته‌ای', onClick: onSaved, accent: 'pink' },
    { icon: History, title: 'تاریخچه', text: 'محتواهایی که دیده‌ای', onClick: onHistory, accent: 'amber' },
    { icon: Bell, title: 'اعلان‌ها', text: `${fa.format(hub?.notificationsCount || 0)} اعلان`, onClick: onNotifications, accent: 'blue' },
  ];

  return (
    <div className="page referenceProfilePage">
      <header className="referenceProfileTopbar">
        <button type="button" onClick={onNotifications} aria-label="اعلان‌ها"><Bell /></button>
        <strong>پروفایل</strong>
        <button type="button" onClick={onRefresh} aria-label="به‌روزرسانی"><Settings /></button>
      </header>

      <section className="referenceProfileHero">
        <div className="referenceProfileAvatar">{initials}</div>
        <h1>{displayName}</h1>
        <p>{username}</p>
        <span className={`liveBadge ${state}`}>{state === 'live' ? 'همگام' : state === 'loading' ? 'در حال دریافت…' : hub?.needsTelegram ? 'داخل تلگرام باز کن' : 'حالت پشتیبان'}</span>
      </section>

      <section className="referenceProfileStats surface">
        <article><strong>{fa.format(followsCount)}</strong><small>دنبال‌شده</small></article>
        <article><strong>{fa.format(topicsCount)}</strong><small>موضوع فعال</small></article>
        <article className="referenceLevelStat"><ShieldCheck /><strong>{creatorCount ? 'سازنده' : 'کاشف'}</strong><small>سطح فعلی</small></article>
      </section>

      <section className="referenceProfileMenu surface">
        {menu.map(({ icon: Icon, title, text, onClick, accent }) => (
          <button type="button" key={title} onClick={onClick}>
            <span className={`referenceMenuIcon ${accent}`}><Icon /></span>
            <span className="referenceMenuCopy"><b>{title}</b><small>{text}</small></span>
            <ChevronLeft />
          </button>
        ))}
        <button type="button" onClick={onRefresh}>
          <span className="referenceMenuIcon slate"><RefreshCw /></span>
          <span className="referenceMenuCopy"><b>تنظیمات و تازه‌سازی</b><small>به‌روزرسانی داده‌ها و وضعیت حساب</small></span>
          <ChevronLeft />
        </button>
        <button type="button" onClick={onSupport}>
          <span className="referenceMenuIcon slate"><Info /></span>
          <span className="referenceMenuCopy"><b>درباره کشف</b><small>راهنما، نسخه و اطلاعات پروژه</small></span>
          <ChevronLeft />
        </button>
      </section>

      {botStats && (
        <section className="referenceOwnerAnalytics surface">
          <div className="referenceOwnerTitle"><div><BarChart3 /><span><b>Owner Analytics</b><small>آمار واقعی ربات</small></span></div><span>Owner</span></div>
          <div className="referenceOwnerGrid">
            <article><small>کل استارت</small><strong>{fa.format(botStats.botStartsTotal)}</strong></article>
            <article><small>کاربر یکتا</small><strong>{fa.format(botStats.uniqueUsers)}</strong></article>
            <article><small>فعال ۳۰ روز</small><strong>{fa.format(botStats.active30d)}</strong></article>
            <article><small>جدید ۷ روز</small><strong>{fa.format(botStats.new7d)}</strong></article>
          </div>
          <p><Sparkles /> این بخش فقط برای مالک پروژه نمایش داده می‌شود.</p>
        </section>
      )}

      {botStats && <BroadcastCard />}
    </div>
  );
}
