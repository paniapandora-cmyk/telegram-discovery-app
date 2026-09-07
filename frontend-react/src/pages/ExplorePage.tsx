import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import ExploreTile from '../components/ExploreTile';
import { loadExpandedExplore } from '../data/explore';
import type { Post } from '../types';
import '../styles/explore-masonry-v7.css';

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
  const [expandedPosts, setExpandedPosts] = useState<Post[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    setExpandedLoading(true);

    loadExpandedExplore(controller.signal, 100)
      .then((next) => {
        if (next.length) setExpandedPosts(next);
      })
      .catch(() => {
        // Keep the already loaded live 18-post set if the expanded request fails.
      })
      .finally(() => {
        if (!controller.signal.aborted) setExpandedLoading(false);
      });

    return () => controller.abort();
  }, []);

  const sourcePosts = expandedPosts.length ? expandedPosts : posts;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const post of sourcePosts) {
      const value = post.category?.trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    return [
      'همه',
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([value]) => value),
    ];
  }, [sourcePosts]);

  const visiblePosts = useMemo(
    () =>
      category === 'همه'
        ? sourcePosts
        : sourcePosts.filter((post) => post.category === category),
    [sourcePosts, category],
  );

  const positioned = useMemo(
    () => visiblePosts.map((post, index) => ({ post, index })),
    [visiblePosts],
  );

  const rightColumn = positioned.filter((item) => item.index % 2 === 0);
  const leftColumn = positioned.filter((item) => item.index % 2 === 1);

  const count = new Intl.NumberFormat('fa-IR').format(visiblePosts.length);

  return (
    <div className="page explorePageV7">
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

            {expandedLoading && (
              <span className="exploreExpandStatusV7">در حال تکمیل…</span>
            )}
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

      {state === 'loading' && !sourcePosts.length ? (
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
          className={`exploreMasonryV7 ${
            state === 'loading' ? 'isRefreshing' : ''
          }`}
        >
          <div className="exploreColumnV7">
            {rightColumn.map(({ post, index }) => (
              <ExploreTile
                key={post.id}
                post={post}
                tall={index % 6 === 0 || index % 9 === 4}
                onOpen={onOpen}
                onImpression={() => onImpression(post, index + 1)}
              />
            ))}
          </div>

          <div className="exploreColumnV7">
            {leftColumn.map(({ post, index }) => (
              <ExploreTile
                key={post.id}
                post={post}
                tall={index % 7 === 1 || index % 10 === 5}
                onOpen={onOpen}
                onImpression={() => onImpression(post, index + 1)}
              />
            ))}
          </div>
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
