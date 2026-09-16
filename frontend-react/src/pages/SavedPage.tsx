import { useMemo, useState } from 'react';
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
  onOpen: (post: Post) => void;
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

const fold = (value: string) =>
  value
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

export default function SavedPage({ posts, state, onOpen, onToggleSave }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const saved = useMemo(() => posts.filter((post) => post.saved !== false), [posts]);

  const filtered = useMemo(() => {
    const normalized = fold(query);
    const next = saved.filter((post) => {
      if (filter !== 'all' && post.kind !== filter) return false;
      if (!normalized) return true;
      return [post.title, post.excerpt, post.channel.title, post.channel.username, post.category]
        .filter(Boolean)
        .some((value) => fold(String(value)).includes(normalized));
    });

    return [...next].sort((a, b) => {
      if (sort === 'oldest') return savedTime(a) - savedTime(b);
      if (sort === 'channel') return a.channel.title.localeCompare(b.channel.title, 'fa');
      return savedTime(b) - savedTime(a);
    });
  }, [saved, query, filter, sort]);

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

      <div className="libraryResultMetaV12">
        <span>{count} مورد</span>
        {(query || filter !== 'all') && <small>فیلتر فعال است</small>}
      </div>

      {state === 'loading' && !saved.length ? (
        <div className="searchLoading" aria-label="در حال دریافت ذخیره‌ها"><span /><span /><span /></div>
      ) : filtered.length ? (
        <div className="referenceSavedList libraryListV12">
          {filtered.map((post) => (
            <article
              key={post.id}
              className="referenceSavedCard libraryCardV12"
              onClick={() => onOpen(post)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(post);
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
          <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>نمایش همه ذخیره‌ها</button>
        </div>
      ) : (
        <div className="emptyState referenceSavedEmpty">
          <Bookmark />
          <h2>هنوز چیزی ذخیره نکردی</h2>
          <p>روی آیکن ذخیره هر پست بزن؛ اینجا تبدیل به کتابخانه شخصی تو می‌شود.</p>
        </div>
      )}
    </div>
  );
}
