import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import ExploreTile from '../components/ExploreTile';
import { loadExplorePage } from '../data/explore';
import { loadSponsoredPosts, recordPromotionEvent } from '../data/ads';
import type { Post } from '../types';
import '../styles/explore-masonry-v7.css';
import '../styles/ads-v1.css';

type FeedState = 'loading' | 'live' | 'fallback';

type Props = {
  posts: Post[];
  state: FeedState;
  onOpen: (post: Post) => void;
  onImpression: (post: Post, position: number) => void;
};

export default function ExplorePage({ posts, state, onOpen, onImpression }: Props) {
  const [category, setCategory] = useState('همه');
  const [expandedPosts, setExpandedPosts] = useState<Post[]>([]);
  const [sponsoredPosts, setSponsoredPosts] = useState<Post[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState('');
  const loaded = useRef<Post[]>([]);
  const pending = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setExpandedLoading(true);
    setLoadError('');
    try {
      const ids = loaded.current.map(post => post.contentId).filter((id): id is string => Boolean(id));
      if (ids.length > 5000) throw new Error('برای دریافت تازه‌ترین پست‌ها صفحه را دوباره باز کن.');
      const next = await loadExplorePage(ids, controller.signal);
      if (controller.signal.aborted) return;
      const seen = new Set(loaded.current.map(post => post.id));
      const added = next.posts.filter(post => !seen.has(post.id));
      if (next.hasMore && !added.length) throw new Error('پست تازه‌ای دریافت نشد. دوباره تلاش کن.');
      loaded.current = [...loaded.current, ...added];
      setExpandedPosts(loaded.current);
      setHasMore(next.hasMore);
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'دریافت پست‌ها انجام نشد.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setExpandedLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadMore();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [loadMore]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSponsoredPosts(controller.signal)
      .then(setSponsoredPosts)
      .catch(() => setSponsoredPosts([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!hasMore || expandedLoading || loadError || !sentinel.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '300px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, expandedLoading, loadError, loadMore]);

  const sourcePosts = expandedPosts.length ? expandedPosts : posts;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of sourcePosts) {
      const value = post.category?.trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return ['همه', ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([value]) => value)];
  }, [sourcePosts]);

  const visiblePosts = useMemo(() => {
    if (category !== 'همه') return sourcePosts.filter((post) => post.category === category);
    if (!sponsoredPosts.length) return sourcePosts;
    const mixed = [...sourcePosts];
    sponsoredPosts.slice(0, 2).forEach((post, index) => {
      mixed.splice(Math.min(mixed.length, 2 + index * 8), 0, post);
    });
    return mixed;
  }, [sourcePosts, category, sponsoredPosts]);

  const positioned = useMemo(() => visiblePosts.map((post, index) => ({ post, index })), [visiblePosts]);
  const rightColumn = positioned.filter((item) => item.index % 2 === 0);
  const leftColumn = positioned.filter((item) => item.index % 2 === 1);
  const count = new Intl.NumberFormat('fa-IR').format(visiblePosts.length);

  const open = (post: Post) => {
    if (post.sponsored && post.promotionId) void recordPromotionEvent(post, 'open').catch(() => {});
    onOpen(post);
  };

  const impression = (post: Post, position: number) => {
    if (post.sponsored && post.promotionId) {
      void recordPromotionEvent(post, 'impression', position).catch(() => {});
      return;
    }
    onImpression(post, position);
  };

  return (
    <div className="page explorePageV7">
      <header className="pageHeader exploreHeaderV4">
        <div>
          <h1>اکسپلور</h1>
          <p>محتوای تازه و واقعی برای کشف</p>
          <div className="pageStatusRow">
            <span className={`liveBadge ${state}`}>{state === 'live' ? 'داده زنده' : state === 'loading' ? 'در حال دریافت…' : 'نسخه پشتیبان'}</span>
            <span className="pageCountChip">{count} محتوا</span>
            {expandedLoading && <span className="exploreExpandStatusV7">در حال تکمیل…</span>}
          </div>
        </div>
        <Sparkles />
      </header>

      {categories.length > 1 && (
        <div className="exploreCategoryRail" aria-label="فیلتر موضوع">
          {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      )}

      {state === 'loading' && !sourcePosts.length ? (
        <div className="exploreSkeletonV4"><span /><span /><span /><span /><span /><span /></div>
      ) : visiblePosts.length ? (
        <div className={`exploreMasonryV7 ${state === 'loading' ? 'isRefreshing' : ''}`}>
          <div className="exploreColumnV7">
            {rightColumn.map(({ post, index }) => (
              <ExploreTile key={post.id} post={post} tall={index % 6 === 0 || index % 9 === 4} onOpen={open} onImpression={() => impression(post, index + 1)} />
            ))}
          </div>
          <div className="exploreColumnV7">
            {leftColumn.map(({ post, index }) => (
              <ExploreTile key={post.id} post={post} tall={index % 7 === 1 || index % 10 === 5} onOpen={open} onImpression={() => impression(post, index + 1)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="emptyState"><Sparkles /><h2>محتوایی در این موضوع پیدا نشد</h2><p>موضوع دیگری را انتخاب کن یا دوباره کمی بعد برگرد.</p></div>
      )}

      <div ref={sentinel} style={{ padding: '24px 0 110px', textAlign: 'center' }} aria-live="polite">
        {loadError && <p role="alert">{loadError}</p>}
        {hasMore && <button className="sheetPrimary" onClick={() => void loadMore()} disabled={expandedLoading}>{expandedLoading ? 'در حال دریافت…' : loadError ? 'تلاش دوباره' : 'پست‌های بیشتر'}</button>}
        {!hasMore && <p>همه پست‌های پیشنهادی را دیدی.</p>}
      </div>
    </div>
  );
}
