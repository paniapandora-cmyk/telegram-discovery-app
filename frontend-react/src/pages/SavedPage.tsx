import { useMemo } from 'react';
import { useViewState } from '../hooks/useViewState';
import { matchesSearch } from '../lib/searchText';
import {
  ArrowDownUp,
  Bookmark,
  Clock3,
  FileText,
  Image as ImageIcon,
  Layers3,
  PlayCircle,
  Search,
  X,
} from 'lucide-react';
import LibraryThumb from '../components/LibraryThumb';
import type { Post, PostKind } from '../types';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

type Props = {
  posts: Post[];
  state: LoadState;
  onOpen: (post: Post, source?: Post[]) => void;
  onRefresh: () => void;
  onToggleSave: (id: string) => void;
};

type Filter = 'all' | PostKind;
type Sort = 'newest' | 'oldest' | 'channel';

const filters: Array<{ id: Filter; label: string; icon: typeof Bookmark }> = [
  { id: 'all', label: 'همه', icon: Layers3 },
  { id: 'text', label: 'متن', icon: FileText },
  { id: 'video', label: 'ویدیو', icon: PlayCircle },
  { id: 'image', label: 'تصویر', icon: ImageIcon },
];

const savedTime = (post: Post) => {
  const time = post.savedAt ? new Date(post.savedAt).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const savedDateLabel = (post: Post) => {
  if (!post.savedAt) return 'ذخیره‌شده';
  const date = new Date(post.savedAt);
  if (Number.isNaN(date.getTime())) return 'ذخیره‌شده';
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export default function SavedPage({ posts, state, onOpen, onToggleSave, onRefresh }: Props) {
  const [query, setQuery] = useViewState('saved-query', '');
  const [filter, setFilter] = useViewState<Filter>('saved-filter', 'all');
  const [sort, setSort] = useViewState<Sort>('saved-sort', 'newest');
  const [channel, setChannel] = useViewState('saved-channel', '');
  const resetFilters = () => { setQuery(''); setFilter('all'); setChannel(''); };
  const saved = useMemo(() => posts.filter((post) => post.saved !== false), [posts]);

  const filtered = useMemo(() => {

    const next = saved.filter((post) => {
      if (filter !== 'all' && post.kind !== filter) return false;
      if (channel && post.channel.username !== channel) return false;
      return matchesSearch(query, [post.title, post.excerpt, post.channel.title, post.channel.username, post.category]);
    });

    return [...next].sort((a, b) => {
      if (sort === 'oldest') return savedTime(a) - savedTime(b);
      if (sort === 'channel') return a.channel.title.localeCompare(b.channel.title, 'fa');
      return savedTime(b) - savedTime(a);
    });
  }, [saved, query, filter, sort, channel]);

  const metrics = useMemo(() => {
    const channels = new Set(saved.map((post) => post.channel.username || post.channel.title));
    return {
      total: saved.length,
      media: saved.filter((post) => post.kind !== 'text').length,
      channels: channels.size,
    };
  }, [saved]);

  const count = new Intl.NumberFormat('fa-IR').format(filtered.length);
  const fa = new Intl.NumberFormat('fa-IR');

  return (
    <div className="page referenceSavedPage libraryPageV12">
      <header className="referenceListHeader libraryHeroV12">
        <div>
          <span className="referenceListHeaderIcon"><Bookmark /></span>
          <div>
            <h1>ذخیره‌ها</h1>
            <p>کتابخانه شخصی محتوایی که می‌خواهی دوباره به آن برگردی</p>
          </div>
        </div>
        <span className={`liveBadge ${state}`}>
          {state === 'live' ? 'همگام' : state === 'loading' ? 'در حال دریافت…' : state === 'fallback' ? 'نسخه محلی' : 'آماده'}
        </span>
      </header>

      <div className="creatorRefreshV19">
        <button type="button" onClick={onRefresh} disabled={state === 'loading'}>تازه‌سازی ذخیره‌ها</button>
        {state === 'fallback' && <p role="alert">دریافت ذخیره‌ها انجام نشد؛ ممکن است فهرست کامل نباشد. دوباره تلاش کن.</p>}
      </div>
      <section className="libraryStatsV12" aria-label="خلاصه ذخیره‌ها">
        <article><Bookmark /><strong>{fa.format(metrics.total)}</strong><small>کل ذخیره‌ها</small></article>
        <article><ImageIcon /><strong>{fa.format(metrics.media)}</strong><small>محتوای تصویری</small></article>
        <article><Layers3 /><strong>{fa.format(metrics.channels)}</strong><small>کانال مختلف</small></article>
      </section>

      <label className="referenceSavedSearch librarySearchV12" aria-label="جست‌وجو در ذخیره‌ها">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="عنوان، کانال یا موضوع را جست‌وجو کن..."
          inputMode="search"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="referenceSavedClear" onClick={() => setQuery('')} aria-label="پاک کردن جست‌وجو">
            <X />
          </button>
        )}
      </label>

      <div className="libraryToolbarV12">
        <div className="referenceSavedFilters" aria-label="فیلتر ذخیره‌ها">
          {filters.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={filter === id ? 'active' : ''}
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>

        <label className="librarySortV12">
          <ArrowDownUp />
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="مرتب‌سازی ذخیره‌ها">
            <option value="newest">جدیدترین ذخیره</option>
            <option value="oldest">قدیمی‌ترین ذخیره</option>
            <option value="channel">نام کانال</option>
          </select>
        </label>
      </div>

      <label className="librarySortV12">کانال
        <select aria-label="فیلتر کانال ذخیره‌ها" value={channel} onChange={event => setChannel(event.target.value)}>
          <option value="">همه کانال‌ها</option>
          {[...new Map(saved.map(post => [post.channel.username, post.channel.title])).entries()].filter(([id]) => id).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          {channel && !saved.some(post => post.channel.username === channel) && <option value={channel}>{channel}</option>}
        </select>
      </label>
      <div className="libraryResultMetaV12" role="status">
        <span>{count} مورد</span>
        {(query || filter !== 'all' || channel) && <button type="button" onClick={resetFilters}>پاک کردن فیلترها</button>}
      </div>

      {state === 'loading' && !saved.length ? (
        <div className="searchLoading" aria-label="در حال دریافت ذخیره‌ها"><span /><span /><span /></div>
      ) : filtered.length ? (
        <div className="referenceSavedList libraryListV12">
          {filtered.map((post) => (
            <article
              key={post.id}
              className="referenceSavedCard libraryCardV12"
              onClick={() => onOpen(post, filtered)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(post, filtered);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <LibraryThumb post={post} />
              <div className="referenceSavedCopy libraryCopyV12">
                <div className="libraryCardToplineV12">
                  <span>{post.category}</span>
                  <small><Clock3 /> {savedDateLabel(post)}</small>
                </div>
                <strong>{post.title}</strong>
                <p>{post.excerpt}</p>
                <small>{post.channel.title} · {post.date}</small>
              </div>
              <button
                type="button"
                className="referenceSavedRemove libraryRemoveV12"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSave(post.id);
                }}
                aria-label={`حذف ${post.title} از ذخیره‌ها`}
              >
                <Bookmark fill="currentColor" />
              </button>
            </article>
          ))}
        </div>
      ) : saved.length ? (
        <div className="emptyState referenceSavedEmpty">
          <Search />
          <h2>چیزی با این فیلتر پیدا نشد</h2>
          <p>عبارت جست‌وجو یا نوع محتوا را تغییر بده.</p>
          <button type="button" onClick={resetFilters}>نمایش همه ذخیره‌ها</button>
        </div>
      ) : state === 'fallback' ? null : (
        <div className="emptyState referenceSavedEmpty">
          <Bookmark />
          <h2>هنوز چیزی ذخیره نکردی</h2>
          <p>روی آیکن ذخیره هر پست بزن؛ اینجا تبدیل به کتابخانه شخصی تو می‌شود.</p>
        </div>
      )}
    </div>
  );
}
