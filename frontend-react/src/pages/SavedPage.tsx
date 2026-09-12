import { Bookmark, FileText, Image as ImageIcon, PlayCircle, Search } from 'lucide-react';
import type { Post } from '../types';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

type Props = {
  posts: Post[];
  state: LoadState;
  onOpen: (post: Post) => void;
  onToggleSave: (id: string) => void;
};

const filters = [
  { id: 'all', label: 'همه' },
  { id: 'channels', label: 'کانال‌ها' },
  { id: 'posts', label: 'پست‌ها' },
] as const;

export default function SavedPage({ posts, state, onOpen, onToggleSave }: Props) {
  const saved = posts.filter((post) => post.saved !== false);
  const count = new Intl.NumberFormat('fa-IR').format(saved.length);

  return (
    <div className="page referenceSavedPage">
      <header className="referenceListHeader">
        <div>
          <span className="referenceListHeaderIcon"><Bookmark /></span>
          <div><h1>ذخیره‌ها</h1><p>محتواهایی که دوست داری، همیشه با تو</p></div>
        </div>
        <span className={`liveBadge ${state}`}>{state === 'live' ? 'همگام' : state === 'loading' ? 'در حال دریافت…' : 'آماده'}</span>
      </header>

      <button type="button" className="referenceSavedSearch" aria-label="جست‌وجو در ذخیره‌ها">
        <Search />
        <span>جست‌وجو در ذخیره‌ها...</span>
      </button>

      <div className="referenceSavedFilters" aria-label="فیلتر ذخیره‌ها">
        {filters.map((item, index) => <button key={item.id} className={index === 0 ? 'active' : ''}>{item.label}</button>)}
        <span>{count} مورد</span>
      </div>

      {state === 'loading' && !saved.length ? (
        <div className="searchLoading"><span /><span /><span /></div>
      ) : saved.length ? (
        <div className="referenceSavedList">
          {saved.map((post) => {
            const KindIcon = post.kind === 'video' ? PlayCircle : post.kind === 'image' ? ImageIcon : FileText;
            return (
              <article key={post.id} className="referenceSavedCard" onClick={() => onOpen(post)}>
                <div className="referenceSavedThumb">
                  {post.mediaUrl ? <img src={post.mediaUrl} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} /> : <KindIcon />}
                  <span><KindIcon /> {post.kind === 'video' ? 'ویدیو' : post.kind === 'image' ? 'تصویر' : 'مقاله'}</span>
                </div>
                <div className="referenceSavedCopy">
                  <strong>{post.title}</strong>
                  <p>{post.excerpt}</p>
                  <small>{post.channel.title} · {post.date}</small>
                </div>
                <button
                  type="button"
                  className="referenceSavedRemove"
                  onClick={(event) => { event.stopPropagation(); onToggleSave(post.id); }}
                  aria-label="حذف از ذخیره‌ها"
                >
                  <Bookmark fill="currentColor" />
                </button>
              </article>
            );
          })}
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
