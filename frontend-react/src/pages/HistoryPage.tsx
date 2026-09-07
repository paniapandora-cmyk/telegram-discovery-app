import { ArrowRight, History } from 'lucide-react';
import PostCard from '../components/PostCard';
import type { Post } from '../types';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

type Props = {
  posts: Post[];
  state: LoadState;
  onBack: () => void;
  onOpen: (post: Post) => void;
  onToggleSave: (id: string) => void;
};

export default function HistoryPage({
  posts,
  state,
  onBack,
  onOpen,
  onToggleSave,
}: Props) {
  const count = new Intl.NumberFormat('fa-IR').format(posts.length);

  return (
    <div className="page">
      <header className="pageHeader subPageHeader historyPageHeader">
        <div>
          <h1>تاریخچه</h1>
          <p>پست‌هایی که قبلاً باز کرده‌ای</p>

          <div className="pageStatusRow">
            <span className={`liveBadge ${state}`}>
              {state === 'live'
                ? 'داده زنده'
                : state === 'loading'
                  ? 'در حال دریافت…'
                  : state === 'fallback'
                    ? 'سرور در دسترس نیست'
                    : 'آماده'}
            </span>

            <span className="pageCountChip">{count} پست</span>
          </div>
        </div>

        <button onClick={onBack} aria-label="بازگشت">
          <ArrowRight />
        </button>
      </header>

      {state === 'loading' && !posts.length ? (
        <div className="searchLoading">
          <span />
          <span />
          <span />
        </div>
      ) : posts.length ? (
        <div className="historyGrid liveHistoryGrid">
          {posts.map((post) => (
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
          <History />
          <h2>تاریخچه‌ای پیدا نشد</h2>
          <p>
            {state === 'fallback'
              ? 'تاریخچه سرور فعلاً در دسترس نیست.'
              : 'با باز کردن پست‌ها، این بخش به‌مرور پر می‌شود.'}
          </p>
        </div>
      )}
    </div>
  );
}
