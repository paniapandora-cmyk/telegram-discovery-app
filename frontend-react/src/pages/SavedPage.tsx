import { Heart } from 'lucide-react';
import PostCard from '../components/PostCard';
import type { Post } from '../types';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

type Props = {
  posts: Post[];
  state: LoadState;
  onOpen: (post: Post) => void;
  onToggleSave: (id: string) => void;
};

export default function SavedPage({
  posts,
  state,
  onOpen,
  onToggleSave,
}: Props) {
  const saved = posts.filter((post) => post.saved !== false);
  const count = new Intl.NumberFormat('fa-IR').format(saved.length);

  return (
    <div className="page">
      <header className="pageHeader savedPageHeader">
        <div>
          <h1>ذخیره‌های تو</h1>
          <p>محتواهایی که برای بعد نگه داشته‌ای</p>

          <div className="pageStatusRow">
            <span className={`liveBadge ${state}`}>
              {state === 'live'
                ? 'همگام با سرور'
                : state === 'loading'
                  ? 'در حال دریافت…'
                  : state === 'fallback'
                    ? 'حالت محلی'
                    : 'آماده'}
            </span>

            <span className="pageCountChip">{count} محتوا</span>
          </div>
        </div>

        <Heart />
      </header>

      {state === 'loading' && !saved.length ? (
        <div className="searchLoading">
          <span />
          <span />
          <span />
        </div>
      ) : saved.length ? (
        <div className="savedGrid liveSavedGrid">
          {saved.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onOpen={onOpen}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <Heart />
          <h2>هنوز چیزی ذخیره نکردی</h2>
          <p>
            {state === 'fallback'
              ? 'ذخیره‌های سرور در دسترس نبودند؛ ذخیره‌های همین نشست اینجا نمایش داده می‌شوند.'
              : 'روی آیکن ذخیره هر پست بزن تا اینجا جمع شود.'}
          </p>
        </div>
      )}
    </div>
  );
}
