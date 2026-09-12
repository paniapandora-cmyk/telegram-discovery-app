import { useEffect, useMemo, useState } from 'react';
import { Bookmark, FileText, Image as ImageIcon, PlayCircle, Search, X } from 'lucide-react';
import { postMediaCandidates } from '../lib/postMedia';
import type { Post, PostKind } from '../types';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

type Props = {
  posts: Post[];
  state: LoadState;
  onOpen: (post: Post) => void;
  onToggleSave: (id: string) => void;
};

type Filter = 'all' | PostKind;

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'text', label: 'مقاله‌ها' },
  { id: 'video', label: 'ویدیوها' },
  { id: 'image', label: 'تصاویر' },
];

function SavedThumb({ post }: { post: Post }) {
  const KindIcon = post.kind === 'video' ? PlayCircle : post.kind === 'image' ? ImageIcon : FileText;
  const candidates = useMemo(
    () => postMediaCandidates(post),
    [post.id, post.mediaUrl, post.telegramUrl],
  );
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIndex(0);
    setReady(false);
  }, [post.id, post.mediaUrl, post.telegramUrl]);

  const active = candidates[index];
  const exhausted = index >= candidates.length;

  return (
    <div className={`referenceSavedThumb ${ready ? 'hasMedia' : 'noMedia'}`}>
      {active && !exhausted ? (
        <img
          key={active}
          src={active}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setReady(true)}
          onError={() => {
            setReady(false);
            if (index + 1 < candidates.length) setIndex((value) => value + 1);
            else setIndex(candidates.length);
          }}
        />
      ) : (
        <KindIcon />
      )}
      <span><KindIcon /> {post.kind === 'video' ? 'ویدیو' : post.kind === 'image' ? 'تصویر' : 'مقاله'}</span>
    </div>
  );
}

export default function SavedPage({ posts, state, onOpen, onToggleSave }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const saved = useMemo(() => posts.filter((post) => post.saved !== false), [posts]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa-IR');
    return saved.filter((post) => {
      if (filter !== 'all' && post.kind !== filter) return false;
      if (!normalized) return true;
      return [post.title, post.excerpt, post.channel.title, post.channel.username, post.category]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('fa-IR').includes(normalized));
    });
  }, [saved, query, filter]);

  const count = new Intl.NumberFormat('fa-IR').format(filtered.length);

  return (
    <div className="page referenceSavedPage">
      <header className="referenceListHeader">
        <div>
          <span className="referenceListHeaderIcon"><Bookmark /></span>
          <div><h1>ذخیره‌ها</h1><p>محتواهایی که دوست داری، همیشه با تو</p></div>
        </div>
        <span className={`liveBadge ${state}`}>{state === 'live' ? 'همگام' : state === 'loading' ? 'در حال دریافت…' : 'آماده'}</span>
      </header>

      <label className="referenceSavedSearch" aria-label="جست‌وجو در ذخیره‌ها">
        <Search aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جست‌وجو در ذخیره‌ها..."
          inputMode="search"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="referenceSavedClear" onClick={() => setQuery('')} aria-label="پاک کردن جست‌وجو">
            <X />
          </button>
        )}
      </label>

      <div className="referenceSavedFilters" aria-label="فیلتر ذخیره‌ها">
        {filters.map((item) => (
          <button
            type="button"
            key={item.id}
            className={filter === item.id ? 'active' : ''}
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
          >
            {item.label}
          </button>
        ))}
        <span>{count} مورد</span>
      </div>

      {state === 'loading' && !saved.length ? (
        <div className="searchLoading" aria-label="در حال دریافت ذخیره‌ها"><span /><span /><span /></div>
      ) : filtered.length ? (
        <div className="referenceSavedList">
          {filtered.map((post) => (
            <article
              key={post.id}
              className="referenceSavedCard"
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
              <SavedThumb post={post} />
              <div className="referenceSavedCopy">
                <strong>{post.title}</strong>
                <p>{post.excerpt}</p>
                <small>{post.channel.title} · {post.date}</small>
              </div>
              <button
                type="button"
                className="referenceSavedRemove"
                onClick={(event) => { event.stopPropagation(); onToggleSave(post.id); }}
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
          <h2>نتیجه‌ای پیدا نشد</h2>
          <p>عبارت جست‌وجو یا فیلتر را تغییر بده.</p>
          {(query || filter !== 'all') && (
            <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>نمایش همه ذخیره‌ها</button>
          )}
        </div>
      ) : (
        <div className="emptyState referenceSavedEmpty">
          <Bookmark />
          <h2>هنوز چیزی ذخیره نکردی</h2>
          <p>روی آیکن ذخیره هر پست بزن تا اینجا جمع شود.</p>
        </div>
      )}
    </div>
  );
}
