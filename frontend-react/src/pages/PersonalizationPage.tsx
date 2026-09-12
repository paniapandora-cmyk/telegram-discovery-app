import {
  ArrowRight,
  Check,
  CircleUserRound,
  Compass,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  loadPersonalization,
  saveInterests,
  setCreatorFollow,
  type PersonalizationCreator,
  type PersonalizationState,
} from '../data/personalization';
import '../styles/personalization-v13.css';

type Props = {
  onBack: () => void;
  onChanged: () => void;
};

type LoadState = 'loading' | 'live' | 'error';

const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

const topicEmoji: Record<string, string> = {
  'artificial-intelligence': '🤖',
  business: '💼',
  design: '🎨',
  education: '📚',
  entertainment: '🎬',
  finance: '💰',
  gaming: '🎮',
  lifestyle: '✨',
  news: '📰',
  programming: '💻',
  science: '🔬',
  sports: '⚽',
  startups: '🚀',
  technology: '⚡',
  travel: '✈️',
};

const pct = (value: number) => `${fa.format(Math.max(0, Math.min(1, value)) * 100)}٪`;

function reasonFor(creator: PersonalizationCreator) {
  if (creator.topic_affinity >= 0.55) return 'خیلی نزدیک به علایق تو';
  if (creator.topic_affinity >= 0.3) return 'بر اساس موضوعات انتخابی';
  if (creator.freshness >= 0.7) return 'محتوای تازه و فعال';
  if (creator.quality >= 0.75) return 'کیفیت محتوای بالا';
  return 'پیشنهاد برای تنوع فید';
}

function CreatorRow({
  creator,
  busy,
  onToggle,
}: {
  creator: PersonalizationCreator;
  busy: boolean;
  onToggle: () => void;
}) {
  const initials = (creator.title || creator.username || 'T').trim().slice(0, 1).toUpperCase();
  return (
    <article className="personalizationCreatorRow">
      <div className="personalizationCreatorAvatar">
        <span>{initials}</span>
        {creator.avatar_url && (
          <img
            src={creator.avatar_url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(event) => event.currentTarget.remove()}
          />
        )}
      </div>

      <div className="personalizationCreatorCopy">
        <div>
          <strong>{creator.title}</strong>
          {creator.verified && <Check aria-label="تأییدشده" />}
        </div>
        <small>{creator.username ? `@${creator.username.replace(/^@/, '')}` : 'Telegram channel'}</small>
        <p>{creator.following ? 'در فید تو اولویت دارد' : reasonFor(creator)}</p>
        <div className="personalizationCreatorMeta">
          <span>تطابق {pct(creator.topic_affinity)}</span>
          <span>{fa.format(creator.recent_posts)} پست تازه</span>
        </div>
      </div>

      <button
        type="button"
        className={creator.following ? 'isFollowing' : ''}
        onClick={onToggle}
        disabled={busy}
      >
        {busy ? (
          <LoaderCircle className="spin" />
        ) : creator.following ? (
          <UserMinus />
        ) : (
          <UserPlus />
        )}
        <span>{creator.following ? 'دنبال می‌کنی' : 'دنبال کن'}</span>
      </button>
    </article>
  );
}

export default function PersonalizationPage({ onBack, onChanged }: Props) {
  const [data, setData] = useState<PersonalizationState | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingInterests, setSavingInterests] = useState(false);
  const [followBusy, setFollowBusy] = useState('');
  const [notice, setNotice] = useState('');

  const hydrate = (next: PersonalizationState) => {
    setData(next);
    setSelected(new Set(next.topics.filter((topic) => topic.selected).map((topic) => topic.id)));
    setState('live');
  };

  const reload = () => {
    const controller = new AbortController();
    setState('loading');
    setNotice('');
    loadPersonalization(controller.signal)
      .then(hydrate)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState('error');
          setNotice(error instanceof Error ? error.message : 'دریافت تنظیمات شخصی‌سازی انجام نشد.');
        }
      });
    return controller;
  };

  useEffect(() => {
    const controller = reload();
    return () => controller.abort();
  }, []);

  const initialSelected = useMemo(
    () => new Set(data?.topics.filter((topic) => topic.selected).map((topic) => topic.id) || []),
    [data],
  );

  const interestsDirty = useMemo(() => {
    if (selected.size !== initialSelected.size) return true;
    for (const id of selected) if (!initialSelected.has(id)) return true;
    return false;
  }, [selected, initialSelected]);

  const toggleTopic = (id: string) => {
    setNotice('');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 12) next.add(id);
      else setNotice('حداکثر ۱۲ موضوع می‌توانی فعال کنی.');
      return next;
    });
  };

  const saveTopics = async () => {
    if (!interestsDirty || savingInterests) return;
    setSavingInterests(true);
    setNotice('');
    try {
      const next = await saveInterests([...selected]);
      hydrate(next);
      setNotice('علایق ذخیره شد؛ فید «برای تو» با انتخاب‌های جدید بازتنظیم می‌شود.');
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ذخیره علایق انجام نشد.');
    } finally {
      setSavingInterests(false);
    }
  };

  const toggleFollow = async (creator: PersonalizationCreator) => {
    if (followBusy) return;
    setFollowBusy(creator.creator_id);
    setNotice('');
    try {
      const next = await setCreatorFollow(creator.creator_id, !creator.following);
      hydrate(next);
      setNotice(
        creator.following
          ? 'کانال از اولویت فید خارج شد.'
          : 'کانال دنبال شد و از این به بعد در «برای تو» وزن بیشتری می‌گیرد.',
      );
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تغییر دنبال‌کردن انجام نشد.');
    } finally {
      setFollowBusy('');
    }
  };

  const selectedCount = selected.size;
  const followingCount = data?.following.length || 0;

  return (
    <div className="page personalizationPageV13">
      <header className="pageHeader subPageHeader personalizationHeaderV13">
        <div>
          <h1>شخصی‌سازی کشف</h1>
          <p>علایق، کانال‌های دنبال‌شده و اولویت فیدت را کنترل کن</p>
          <div className="pageStatusRow">
            <span className={`liveBadge ${state === 'live' ? 'live' : state === 'loading' ? 'loading' : 'fallback'}`}>
              {state === 'live' ? 'همگام با فید' : state === 'loading' ? 'در حال دریافت…' : 'خطا در دریافت'}
            </span>
            <span className="pageCountChip">{fa.format(selectedCount)} موضوع · {fa.format(followingCount)} کانال</span>
          </div>
        </div>
        <button onClick={onBack} aria-label="بازگشت"><ArrowRight /></button>
      </header>

      <section className="personalizationHeroV13 surface">
        <div className="personalizationHeroIcon"><Compass /></div>
        <div>
          <small>Personalization Engine</small>
          <h2>فید «برای تو» واقعاً از انتخاب‌هایت یاد می‌گیرد</h2>
          <p>
            موضوعات انتخابی روی تطابق معنایی اثر می‌گذارند و کانال‌های دنبال‌شده
            در رتبه‌بندی فید Boost جداگانه می‌گیرند. تازگی و کیفیت همچنان حفظ می‌شود
            تا فید فقط از یک کانال پر نشود.
          </p>
        </div>
        <Sparkles />
      </section>

      {state === 'loading' && !data ? (
        <div className="personalizationSkeletonV13"><span /><span /><span /><span /></div>
      ) : state === 'error' && !data ? (
        <div className="emptyState personalizationErrorV13">
          <SlidersHorizontal />
          <h2>تنظیمات دریافت نشد</h2>
          <p>{notice || 'اتصال را بررسی کن و دوباره تلاش کن.'}</p>
          <button type="button" onClick={() => reload()}><RefreshCw /> تلاش دوباره</button>
        </div>
      ) : data ? (
        <>
          <section className="personalizationTopicsV13 surface">
            <div className="personalizationSectionHeadV13">
              <div>
                <h2>موضوعات مورد علاقه</h2>
                <p>موضوعات قوی‌تر، Semantic Affinity بالاتری در فید می‌سازند.</p>
              </div>
              <span>{fa.format(selectedCount)} / ۱۲</span>
            </div>

            <div className="personalizationTopicGridV13">
              {data.topics.map((topic) => {
                const active = selected.has(topic.id);
                return (
                  <button
                    type="button"
                    key={topic.id}
                    className={active ? 'active' : ''}
                    onClick={() => toggleTopic(topic.id)}
                    aria-pressed={active}
                  >
                    <span>{topicEmoji[topic.slug] || '✦'}</span>
                    <b>{topic.name}</b>
                    {active && <Check />}
                  </button>
                );
              })}
            </div>

            <div className="personalizationTopicActionsV13">
              <span>{selectedCount ? 'حداقل یک موضوع برای فید دقیق‌تر نگه دار.' : 'بدون موضوع هم فید بر اساس رفتار و تازگی کار می‌کند.'}</span>
              <button type="button" onClick={() => void saveTopics()} disabled={!interestsDirty || savingInterests}>
                {savingInterests ? <LoaderCircle className="spin" /> : <Check />}
                {savingInterests ? 'در حال ذخیره…' : interestsDirty ? 'ذخیره علایق' : 'ذخیره شده'}
              </button>
            </div>
          </section>

          <section className="personalizationFollowingV13 surface">
            <div className="personalizationSectionHeadV13">
              <div>
                <h2>کانال‌های دنبال‌شده</h2>
                <p>محتوای این کانال‌ها در «برای تو» اولویت اضافه می‌گیرد.</p>
              </div>
              <Users />
            </div>

            {data.following.length ? (
              <div className="personalizationCreatorListV13">
                {data.following.map((creator) => (
                  <CreatorRow
                    key={creator.creator_id}
                    creator={creator}
                    busy={followBusy === creator.creator_id}
                    onToggle={() => void toggleFollow(creator)}
                  />
                ))}
              </div>
            ) : (
              <div className="personalizationInlineEmptyV13">
                <CircleUserRound />
                <div><b>هنوز کانالی را دنبال نمی‌کنی</b><span>از پیشنهادهای پایین چند کانال مناسب انتخاب کن.</span></div>
              </div>
            )}
          </section>

          <section className="personalizationSuggestionsV13 surface">
            <div className="personalizationSectionHeadV13">
              <div>
                <h2>پیشنهاد برای دنبال‌کردن</h2>
                <p>ترکیب علایق تو، کیفیت، تازگی و فعالیت کانال</p>
              </div>
              <Sparkles />
            </div>

            {data.suggestions.length ? (
              <div className="personalizationCreatorListV13">
                {data.suggestions.map((creator) => (
                  <CreatorRow
                    key={creator.creator_id}
                    creator={creator}
                    busy={followBusy === creator.creator_id}
                    onToggle={() => void toggleFollow(creator)}
                  />
                ))}
              </div>
            ) : (
              <div className="personalizationInlineEmptyV13">
                <Check />
                <div><b>همه پیشنهادهای فعلی را دنبال کرده‌ای</b><span>با اضافه‌شدن کانال‌های جدید، این بخش دوباره پر می‌شود.</span></div>
              </div>
            )}
          </section>

          <section className="personalizationSignalsV13 surface">
            <div className="personalizationSectionHeadV13">
              <div><h2>فید چطور تصمیم می‌گیرد؟</h2><p>سه سیگنال مهمی که الان قابل کنترل هستند</p></div>
              <SlidersHorizontal />
            </div>
            <div className="personalizationSignalGridV13">
              <article><strong>موضوعات</strong><span>تطابق محتوای هر پست با علایق انتخابی</span></article>
              <article><strong>دنبال‌کردن</strong><span>Boost مستقیم برای سازنده‌هایی که انتخاب کرده‌ای</span></article>
              <article><strong>رفتار</strong><span>بازدید، ذخیره، رد کردن و زمان مشاهده برای یادگیری بعدی</span></article>
            </div>
          </section>

          {notice && <div className="personalizationNoticeV13" role="status">{notice}</div>}
        </>
      ) : null}
    </div>
  );
}
