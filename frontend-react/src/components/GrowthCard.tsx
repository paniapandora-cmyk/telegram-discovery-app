import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  copyInviteLink,
  loadGrowthSummary,
  nativeShareInvite,
  shareInvite,
  type GrowthSummary,
} from '../data/growth';
import '../styles/growth.css';
import '../styles/growth-rewards.css';
import '../styles/invite-growth-v10.css';

const fa = new Intl.NumberFormat('fa-IR');
const percent = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

const milestones = [
  { count: 1, label: 'کاشف' },
  { count: 3, label: 'کاشف فعال' },
  { count: 10, label: 'سفیر کشف' },
  { count: 25, label: 'پیشگام' },
];

export default function GrowthCard() {
  const [summary, setSummary] = useState<GrowthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<'telegram' | 'native' | 'copy' | ''>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const next = await loadGrowthSummary(signal);
      setSummary(next);
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'خطا در دریافت آمار دعوت');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  const reward = useMemo(() => {
    const success = summary?.invite.successful_invites || 0;
    const unlocked = [...milestones].reverse().find((item) => success >= item.count);
    const next = milestones.find((item) => success < item.count);
    const previousCount = unlocked?.count || 0;
    const progress = next
      ? Math.max(
          0,
          Math.min(100, ((success - previousCount) / (next.count - previousCount)) * 100),
        )
      : 100;

    return {
      success,
      current: unlocked?.label || 'تازه‌وارد',
      next,
      progress,
      remaining: next ? Math.max(0, next.count - success) : 0,
    };
  }, [summary]);

  const funnel = useMemo(() => {
    const shares = summary?.invite.share_clicks || 0;
    const starts = summary?.invite.bot_starts || 0;
    const opens = summary?.invite.miniapp_opens || 0;
    const success = summary?.invite.successful_invites || 0;

    return {
      shares,
      starts,
      opens,
      success,
      startRate: shares ? (starts / shares) * 100 : 0,
      successRate: starts ? (success / starts) * 100 : 0,
    };
  }, [summary]);

  const afterAction = () => {
    setSummary((current) =>
      current
        ? {
            ...current,
            invite: {
              ...current.invite,
              share_clicks: current.invite.share_clicks + 1,
            },
          }
        : current,
    );
  };

  const shareTelegram = async () => {
    if (!summary || sharing) return;
    setSharing('telegram');
    try {
      await shareInvite(summary);
      afterAction();
    } finally {
      setSharing('');
    }
  };

  const shareNative = async () => {
    if (!summary || sharing) return;
    setSharing('native');
    try {
      const shared = await nativeShareInvite(summary);
      if (shared) afterAction();
    } finally {
      setSharing('');
    }
  };

  const copy = async () => {
    if (!summary || sharing) return;
    setSharing('copy');
    try {
      await copyInviteLink(summary);
      setCopied(true);
      afterAction();
      window.setTimeout(() => setCopied(false), 1800);
    } finally {
      setSharing('');
    }
  };

  return (
    <section className="growthCard inviteGrowthDashboard surface">
      <div className="growthCardHead inviteGrowthHead">
        <div>
          <span className="growthIcon"><Sparkles /></span>
          <div>
            <h3>مرکز رشد دعوت</h3>
            <p>فقط دعوت‌های واقعی و یکتای تلگرام برای نشان‌ها محاسبه می‌شوند.</p>
          </div>
        </div>
        <button
          className="growthRefresh"
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="به‌روزرسانی آمار دعوت"
        >
          <RefreshCw className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error ? (
        <div className="growthError">
          <b>آمار دعوت دریافت نشد</b>
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>تلاش دوباره</button>
        </div>
      ) : (
        <>
          <div className="inviteRankPanel">
            <div className="inviteRankBadge"><Award /></div>
            <div>
              <small>سطح فعلی</small>
              <strong>{reward.current}</strong>
              <span>
                {reward.next
                  ? `${fa.format(reward.remaining)} دعوت موفق تا «${reward.next.label}»`
                  : 'همه نشان‌های فعلی باز شده‌اند'}
              </span>
            </div>
            <div className="inviteRankCount"><b>{fa.format(reward.success)}</b><small>موفق</small></div>
          </div>

          <div className="growthRewardProgress invitePrimaryProgress">
            <div><i style={{ width: `${reward.progress}%` }} /></div>
          </div>

          <div className="inviteLinkPanel">
            <div className="inviteLinkLabel"><Link2 /><span>لینک اختصاصی دعوت</span></div>
            <div className="inviteLinkValue">
              <code>{summary?.invite.url || 'در حال دریافت لینک…'}</code>
              <button type="button" onClick={() => void copy()} disabled={!summary || Boolean(sharing)} aria-label="کپی لینک دعوت">
                {copied ? <Check /> : <Copy />}
              </button>
            </div>
            <div className="inviteShareActions">
              <button type="button" className="primary" onClick={() => void shareTelegram()} disabled={!summary || Boolean(sharing)}>
                <Send />
                {sharing === 'telegram' ? 'در حال باز کردن…' : 'ارسال در تلگرام'}
              </button>
              <button type="button" onClick={() => void shareNative()} disabled={!summary || Boolean(sharing)}>
                <Share2 />
                {sharing === 'native' ? 'در حال اشتراک…' : 'اشتراک بیشتر'}
              </button>
            </div>
            {copied && <p className="inviteCopiedState"><Check /> لینک دعوت کپی شد.</p>}
          </div>

          <div className="inviteFunnel">
            <div className="inviteSectionTitle">
              <div><UserPlus /><span><b>قیف دعوت</b><small>از اشتراک تا دعوت موفق</small></span></div>
              <span>{loading ? '...' : `${percent.format(funnel.successRate)}٪ تبدیل`}</span>
            </div>
            <div className="inviteFunnelGrid">
              <article><Share2 /><small>اشتراک</small><strong>{fa.format(funnel.shares)}</strong></article>
              <i />
              <article><Send /><small>استارت ربات</small><strong>{fa.format(funnel.starts)}</strong></article>
              <i />
              <article><ExternalLink /><small>ورود مینی‌اپ</small><strong>{fa.format(funnel.opens)}</strong></article>
              <i />
              <article className="success"><Users /><small>دعوت موفق</small><strong>{fa.format(funnel.success)}</strong></article>
            </div>
            <div className="inviteConversionRow">
              <span>اشتراک ← استارت: <b>{percent.format(funnel.startRate)}٪</b></span>
              <span>استارت ← موفق: <b>{percent.format(funnel.successRate)}٪</b></span>
            </div>
          </div>

          {summary?.invite.last_7d && (
            <div className="inviteWeekPanel">
              <div className="inviteSectionTitle">
                <div><Sparkles /><span><b>۷ روز اخیر</b><small>فعالیت تازه لینک دعوت</small></span></div>
              </div>
              <div className="inviteWeekGrid">
                <article><strong>{fa.format(summary.invite.last_7d.share_clicks)}</strong><small>اشتراک</small></article>
                <article><strong>{fa.format(summary.invite.last_7d.bot_starts)}</strong><small>استارت</small></article>
                <article><strong>{fa.format(summary.invite.last_7d.miniapp_opens)}</strong><small>ورود</small></article>
                <article><strong>{fa.format(summary.invite.last_7d.successful_invites)}</strong><small>موفق</small></article>
              </div>
            </div>
          )}

          <div className="growthReward inviteMilestonePanel">
            <div className="growthRewardTitle">
              <span><Award /></span>
              <div><small>مسیر نشان‌ها</small><strong>پیشرفت واقعی حساب</strong></div>
              <Trophy />
            </div>
            <div className="growthMilestones inviteMilestones">
              {milestones.map((item) => (
                <span key={item.count} className={reward.success >= item.count ? 'unlocked' : ''}>
                  {reward.success >= item.count && <Check />}
                  <b>{fa.format(item.count)}</b>
                  <small>{item.label}</small>
                </span>
              ))}
            </div>
          </div>

          <div className="inviteTrustNote">
            <Sparkles />
            <p><b>دعوت معتبر چیست؟</b> وقتی یک کاربر یکتای دیگر از لینک تو ربات را Start کند، دعوت موفق ثبت می‌شود. Startهای خودت یا تکراری به تعداد موفق‌ها اضافه نمی‌شوند.</p>
          </div>

          {summary && (
            <div className="growthProof inviteProof">
              <span>{fa.format(summary.social_proof.active_users)} کاربر فعال</span>
              <span>{fa.format(summary.social_proof.active_sources)} منبع فعال</span>
              <span>{fa.format(summary.social_proof.contents)} محتوا</span>
              <span>{fa.format(summary.social_proof.bot_starts)} استارت ربات</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
