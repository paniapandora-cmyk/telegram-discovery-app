import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Clock3,
  Eye,
  Flame,
  History,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import LibraryThumb from '../components/LibraryThumb';
import type { Post } from '../types';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';
type Filter = 'all' | 'long' | 'saved';

type Props = {
  posts: Post[];
  state: LoadState;
  onBack: () => void;
  onOpen: (post: Post) => void;
  onToggleSave: (id: string) => void;
  onClear: () => Promise<void>;
};

const fold = (value: string) =>
  value
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const viewedLabel = (post: Post) => {
  if (!post.viewedAt) return post.date;
  const date = new Date(post.viewedAt);
  if (Number.isNaN(date.getTime())) return post.date;
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const watchLabel = (seconds?: number) => {
  if (!seconds) return 'باز شده';
  if (seconds < 60) return `${new Intl.NumberFormat('fa-IR').format(seconds)} ثانیه`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${new Intl.NumberFormat('fa-IR').format(minutes)} دقیقه`;
};

export default function HistoryPage({
  posts,
  state,
  onBack,
  onOpen,
  onToggleSave,
  onClear,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  const filtered = useMemo(() => {
    const term = fold(query);
    return posts.filter((post) => {
      if (filter === 'long' && post.historyEvent?.toLowerCase() !== 'long_view' && (post.watchSeconds || 0) < 12) return false;
      if (filter === 'saved' && !post.saved) return false;
      if (!term) return true;
      return [post.title, post.excerpt, post.channel.title, post.channel.username]
        .filter(Boolean)
        .some((value) => fold(String(value)).includes(term));
    });
  }, [posts, query, filter]);

  const longCount = posts.filter(
    (post) => post.historyEvent?.toLowerCase() === 'long_view' || (post.watchSeconds || 0) >= 12,
  ).length;
  const savedCount = posts.filter((post) => post.saved).length;
  const fa = new Intl.NumberFormat('fa-IR');

  const clear = async () => {
    if (clearing) return;
    setClearing(true);
    setClearError('');
    try {
      await onClear();
      setConfirmClear(false);
      setQuery('');
      setFilter('all');
    } catch (error) {
      setClearError(error instanceof Error ? error.message : 'پاک کردن تاریخچه انجام نشد.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="page historyPageV12 libraryPageV12">
      <header className="pageHeader subPageHeader historyPageHeader libraryHeroV12">
        <div>
          <h1>تاریخچه مشاهده</h1>
          <p>چیزهایی که دیده‌ای را سریع پیدا کن و از همان‌جا ادامه بده</p>
          <div className="pageStatusRow">
            <span className={`liveBadge ${state}`}>
              {state === 'live'
                ? 'همگام'
                : state === 'loading'
                  ? 'در حال دریافت…'
                  : state === 'fallback'
                    ? 'سرور در دسترس نیست'
                    : 'آماده'}
            </span>
            <span className="pageCountChip">{fa.format(posts.length)} پست</span>
          </div>
        </div>
        <button type="button" onClick={onBack} aria-label="بازگشت"><ArrowRight /></button>
      </header>

      <section className="libraryStatsV12 historyStatsV12" aria-label="خلاصه تاریخچه">
        <article><Eye /><strong>{fa.format(posts.length)}</strong><small>دیده‌شده</small></article>
        <article><Flame /><strong>{fa.format(longCount)}</strong><small>مشاهده عمیق</small></article>
        <article><Bookmark /><strong>{fa.format(savedCount)}</strong><small>ذخیره‌شده</small></article>
      </section>

      <label className="referenceSavedSearch librarySearchV12" aria-label="جست‌وجو در تاریخچه">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="در تاریخچه جست‌وجو کن..."
          inputMode="search"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="referenceSavedClear" onClick={() => setQuery('')} aria-label="پاک کردن جست‌وجو"><X /></button>
        )}
      </label>

      <div className="historyToolbarV12">
        <div className="historyFiltersV12" aria-label="فیلتر تاریخچه">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>همه</button>
          <button type="button" className={filter === 'long' ? 'active' : ''} onClick={() => setFilter('long')}><Flame /> عمیق</button>
          <button type="button" className={filter === 'saved' ? 'active' : ''} onClick={() => setFilter('saved')}><Bookmark /> ذخیره‌شده</button>
        </div>
        {posts.length > 0 && (
          <button type="button" className="historyClearTriggerV12" onClick={() => setConfirmClear(true)}>
            <Trash2 /> پاک کردن
          </button>
        )}
      </div>

      {confirmClear && (
        <section className="historyClearConfirmV12" role="alertdialog" aria-label="تأیید پاک کردن تاریخچه">
          <div>
            <Trash2 />
            <div><strong>کل تاریخچه پاک شود؟</strong><p>بازدیدها و سیگنال‌های مشاهده این حساب حذف می‌شوند. ذخیره‌ها دست‌نخورده می‌مانند.</p></div>
          </div>
          {clearError && <span role="alert">{clearError}</span>}
          <div>
            <button type="button" onClick={() => setConfirmClear(false)} disabled={clearing}>انصراف</button>
            <button type="button" onClick={() => void clear()} disabled={clearing}>{clearing ? 'در حال پاک کردن…' : 'بله، پاک کن'}</button>
          </div>
        </section>
      )}

      {state === 'loading' && !posts.length ? (
        <div className="searchLoading"><span /><span /><span /></div>
      ) : filtered.length ? (
        <div className="historyListV12">
          {filtered.map((post) => (
            <article
              key={post.id}
              className="historyCardV12"
              onClick={() => onOpen(post)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(post);
                }
              }}
            >
              <LibraryThumb post={post} className="historyThumbV12" />
              <div className="historyCopyV12">
                <div className="historyMetaV12">
                  <span><Clock3 /> {viewedLabel(post)}</span>
                  <span className={post.historyEvent?.toLowerCase() === 'long_view' ? 'deep' : ''}><Eye /> {watchLabel(post.watchSeconds)}</span>
                </div>
                <strong>{post.title}</strong>
                <p>{post.excerpt}</p>
                <small>{post.channel.title}</small>
              </div>
              <button
                type="button"
                className={`historySaveV12 ${post.saved ? 'saved' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSave(post.id);
                }}
                aria-label={post.saved ? 'حذف از ذخیره‌ها' : 'ذخیره پست'}
              >
                <Bookmark fill={post.saved ? 'currentColor' : 'none'} />
              </button>
            </article>
          ))}
        </div>
      ) : posts.length ? (
        <div className="emptyState">
          <Search />
          <h2>نتیجه‌ای با این فیلتر نیست</h2>
          <p>جست‌وجو یا فیلتر را تغییر بده.</p>
          <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>نمایش همه تاریخچه</button>
        </div>
      ) : (
        <div className="emptyState">
          <History />
          <h2>تاریخچه‌ای پیدا نشد</h2>
          <p>{state === 'fallback' ? 'تاریخچه سرور فعلاً در دسترس نیست.' : 'با باز کردن پست‌ها، این بخش به‌مرور پر می‌شود.'}</p>
        </div>
      )}
    </div>
  );
}
