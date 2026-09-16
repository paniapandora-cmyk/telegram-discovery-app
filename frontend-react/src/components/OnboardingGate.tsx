import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  Compass,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';
import {
  completeOnboarding,
  loadOnboarding,
  type OnboardingTopic,
} from '../data/onboarding';
import { getTelegramInitData } from '../data/live';
import '../styles/onboarding.css';

type Props = {
  onComplete?: () => void;
};

const fa = new Intl.NumberFormat('fa-IR');

const topicMeta: Record<string, { label: string; emoji: string }> = {
  'artificial-intelligence': { label: 'هوش مصنوعی', emoji: '🤖' },
  business: { label: 'کسب‌وکار', emoji: '💼' },
  design: { label: 'طراحی', emoji: '🎨' },
  education: { label: 'آموزش', emoji: '📚' },
  entertainment: { label: 'سرگرمی', emoji: '🎬' },
  finance: { label: 'مالی', emoji: '💰' },
  gaming: { label: 'بازی', emoji: '🎮' },
  lifestyle: { label: 'سبک زندگی', emoji: '✨' },
  news: { label: 'خبر', emoji: '📰' },
  programming: { label: 'برنامه‌نویسی', emoji: '💻' },
  science: { label: 'علم', emoji: '🔬' },
  sports: { label: 'ورزش', emoji: '⚽' },
  startups: { label: 'استارتاپ', emoji: '🚀' },
  technology: { label: 'تکنولوژی', emoji: '⚡' },
  travel: { label: 'سفر', emoji: '✈️' },
};

const labelFor = (topic: OnboardingTopic) =>
  topicMeta[topic.slug]?.label || topic.name;

const emojiFor = (topic: OnboardingTopic) =>
  topicMeta[topic.slug]?.emoji || '✦';

export default function OnboardingGate({ onComplete }: Props) {
  const [topics, setTopics] = useState<OnboardingTopic[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getTelegramInitData()) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    loadOnboarding(controller.signal)
      .then((state) => {
        if (state.onboarding_done) return;
        setTopics(state.topics);
        setSelected(
          new Set(state.topics.filter((topic) => topic.selected).map((topic) => topic.id)),
        );
        setVisible(true);
      })
      .catch(() => {
        // Onboarding must never block a working feed if its service is unavailable.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const selectedCount = selected.size;
  const canContinue = selectedCount >= 3 && selectedCount <= 6;
  const helper = useMemo(() => {
    if (selectedCount < 3) return `${fa.format(3 - selectedCount)} موضوع دیگه انتخاب کن`;
    if (selectedCount === 6) return 'عالیه؛ حالا فیدت رو بساز';
    return `می‌تونی تا ${fa.format(6 - selectedCount)} موضوع دیگه هم انتخاب کنی`;
  }, [selectedCount]);

  const toggle = (id: string) => {
    if (saving) return;
    setError('');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  };

  const finish = async (skip = false) => {
    if (saving || (!skip && !canContinue)) return;
    setSaving(true);
    setError('');
    try {
      await completeOnboarding([...selected], skip);
      setVisible(false);
      onComplete?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره انتخاب‌ها انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !visible) return null;

  return (
    <div className="onboardingBackdrop" role="dialog" aria-modal="true">
      <section className="onboardingCard">
        <div className="onboardingBrand">
          <span><Compass /></span>
          <div>
            <small>شروع سریع</small>
            <strong>کشف رو برای خودت بساز</strong>
          </div>
          <Sparkles />
        </div>

        <div className="onboardingCopy">
          <h1>چه چیزهایی دوست داری ببینی؟</h1>
          <p>
            فقط چند موضوع انتخاب کن تا از همان ورود اول، پست‌ها و کانال‌های نزدیک‌تر
            به سلیقه‌ات بالاتر نمایش داده شوند.
          </p>
        </div>

        <div className="onboardingTopics">
          {topics.map((topic) => {
            const active = selected.has(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                className={active ? 'active' : ''}
                onClick={() => toggle(topic.id)}
                aria-pressed={active}
              >
                <span>{emojiFor(topic)}</span>
                <b>{labelFor(topic)}</b>
                {active && <Check />}
              </button>
            );
          })}
        </div>

        <div className="onboardingStatus">
          <span>{fa.format(selectedCount)} از ۳ تا ۶ انتخاب</span>
          <b>{helper}</b>
        </div>

        {error && <div className="onboardingError">{error}</div>}

        <button
          className="onboardingPrimary"
          type="button"
          onClick={() => void finish(false)}
          disabled={!canContinue || saving}
        >
          {saving ? <LoaderCircle className="spin" /> : <ChevronLeft />}
          {saving ? 'در حال ساخت فید…' : 'فید من رو بساز'}
        </button>

        <button
          className="onboardingSkip"
          type="button"
          onClick={() => void finish(true)}
          disabled={saving}
        >
          فعلاً رد می‌کنم
        </button>
      </section>
    </div>
  );
}
