import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  RefreshCw,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import {
  loadGrowthSummary,
  shareInvite,
  type GrowthSummary,
} from '../data/growth';
import '../styles/growth.css';
import '../styles/growth-rewards.css';

const fa = new Intl.NumberFormat('fa-IR');

const milestones = [
  { count: 1, label: 'کاشف' },
  { count: 3, label: 'کاشف فعال' },
  { count: 10, label: 'سفیر کشف' },
  { count: 25, label: 'پیشگام' },
];

export default function GrowthCard() {
  const [summary, setSummary] = useState<GrowthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
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

  const share = async () => {
    if (!summary || sharing) return;
    setSharing(true);
    try {
      await shareInvite(summary);
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
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="growthCard surface">
      <div className="growthCardHead">
        <div>
          <span className="growthIcon">
            <Sparkles />
          </span>
          <div>
            <h3>دوستات رو بیار «کشف»</h3>
            <p>هر دعوت واقعی از لینک اختصاصی خودت شمرده می‌شود.</p>
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
        <div className="growthError">{error}</div>
      ) : (
        <>
          <div className="growthMetrics">
            <article>
              <Users />
              <small>دعوت موفق</small>
              <strong>{fa.format(summary?.invite.successful_invites || 0)}</strong>
            </article>
            <article>
              <Share2 />
              <small>اشتراک لینک</small>
              <strong>{fa.format(summary?.invite.share_clicks || 0)}</strong>
            </article>
            <article>
              <Sparkles />
              <small>ورود از لینک</small>
              <strong>{fa.format(summary?.invite.bot_starts || 0)}</strong>
            </article>
          </div>

          <div className="growthReward">
            <div className="growthRewardTitle">
              <span><Award /></span>
              <div>
                <small>نشان فعلی تو</small>
                <strong>{reward.current}</strong>
              </div>
              <Trophy />
            </div>

            <div className="growthRewardProgress">
              <span>
                {reward.next
                  ? `${fa.format(reward.remaining)} دعوت واقعی تا نشان «${reward.next.label}»`
                  : 'همه نشان‌های فعلی را گرفتی ✦'}
              </span>
              <div><i style={{ width: `${reward.progress}%` }} /></div>
            </div>

            <div className="growthMilestones">
              {milestones.map((item) => (
                <span
                  key={item.count}
                  className={reward.success >= item.count ? 'unlocked' : ''}
                >
                  {fa.format(item.count)} · {item.label}
                </span>
              ))}
            </div>
          </div>

          <button
            className="growthShareButton"
            type="button"
            onClick={() => void share()}
            disabled={!summary || loading || sharing}
          >
            <Share2 />
            {sharing ? 'در حال آماده‌سازی…' : 'دعوت دوستان'}
          </button>

          {summary && (
            <div className="growthProof">
              <span>{fa.format(summary.social_proof.active_sources)} منبع فعال</span>
              <span>{fa.format(summary.social_proof.contents)} محتوای ثبت‌شده</span>
              <span>{fa.format(summary.social_proof.bot_starts)} استارت ربات</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
