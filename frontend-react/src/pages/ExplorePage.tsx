import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import ExploreTile from '../components/ExploreTile';
import type { Post } from '../types';

type FeedState = 'loading' | 'live' | 'fallback';

type Props = {
  posts: Post[];
  state: FeedState;
  onOpen: (post: Post) => void;
  onImpression: (post: Post, position: number) => void;
};

export default function ExplorePage({
  posts,
  state,
  onOpen,
  onImpression,
}: Props) {
  const [category, setCategory] = useState('همه');

  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const post of posts) {
      const value = post.category?.trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    return [
      'همه',
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([value]) => value),
    ];
  }, [posts]);

  const visiblePosts = useMemo(
    () =>
      category === 'همه'
        ? posts
        : posts.filter((post) => post.category === category),
    [posts, category],
  );

  const count = new Intl.NumberFormat('fa-IR').format(visiblePosts.length);

  return (
    <div className="page explorePageV4">
      <header className="pageHeader exploreHeaderV4">
        <div>
          <h1>اکسپلور</h1>
          <p>محتوای تازه و واقعی برای کشف</p>

          <div className="pageStatusRow">
            <span className={`liveBadge ${state}`}>
              {state === 'live'
                ? 'داده زنده'
                : state === 'loading'
                  ? 'در حال دریافت…'
                  : 'نسخه پشتیبان'}
            </span>

            <span className="pageCountChip">{count} محتوا</span>
          </div>
        </div>

        <Sparkles />
      </header>

      {categories.length > 1 && (
        <div className="exploreCategoryRail" aria-label="فیلتر موضوع">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {state === 'loading' && !posts.length ? (
        <div className="exploreSkeletonV4">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : visiblePosts.length ? (
        <div
          className={`exploreGridV4 ${state === 'loading' ? 'isRefreshing' : ''}`}
        >
          {visiblePosts.map((post, index) => (
            <ExploreTile
              key={post.id}
              post={post}
              tall={index % 5 === 0 || index % 7 === 3}
              onOpen={onOpen}
              onImpression={() => onImpression(post, index + 1)}
            />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <Sparkles />
          <h2>محتوایی در این موضوع پیدا نشد</h2>
          <p>موضوع دیگری را انتخاب کن یا دوباره کمی بعد برگرد.</p>
        </div>
      )}
    </div>
  );
}
