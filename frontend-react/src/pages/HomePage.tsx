import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import FeedTabs from '../components/FeedTabs';
import ChannelRail from '../components/ChannelRail';
import PostCard from '../components/PostCard';
import InviteNudge from '../components/InviteNudge';
import { posts as seedPosts } from '../data/demo';
import { loadLivePosts } from '../data/live';
import { loadExplorePage } from '../data/explore';
import type { Channel, Post } from '../types';

type FeedState = 'loading' | 'live' | 'fallback';

type Props = {
  channels: Channel[];
  posts: Post[];
  tab: string;
  state: FeedState;
  onTab: (tab: string) => void;
  onSearch: () => void;
  onAdd: () => void;
  onOpen: (post: Post) => void;
  onOpenChannel: (channel: Channel) => void;
  onToggleSave: (id: string) => void;
  onImpression: (post: Post, position: number) => void;
};

const seedIds = new Set(seedPosts.map((post) => post.id));

const mergeUnique = (base: Post[], extra: Post[]) => {
  const seen = new Set<string>();
  return [...base, ...extra].filter((post) => {
    const key = post.contentId || post.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function HomePage({ channels, posts, tab, state, onTab, onSearch, onAdd, onOpen, onOpenChannel, onToggleSave, onImpression }: Props) {
  const [recoveryPosts, setRecoveryPosts] = useState<Post[]>([]);
  const [extraPosts, setExtraPosts] = useState<Post[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const hasPreloaded = useRef(false);

  const hasLivePosts = useMemo(() => posts.some((post) => !seedIds.has(post.id)), [posts]);

  useEffect(() => {
    if (hasLivePosts) { setRecoveryPosts([]); return; }
    if (state === 'loading') return;
    const controller = new AbortController();
    let active = true;
    const recover = async () => {
      const modes = tab === 'hot' ? (['fresh'] as const) : (['fresh', 'hot'] as const);
      for (const mode of modes) {
        try {
          const next = await loadLivePosts(mode, controller.signal);
          if (!active || controller.signal.aborted) return;
          if (next.length) { setRecoveryPosts(next); return; }
        } catch { if (controller.signal.aborted) return; }
      }
    };
    void recover();
    return () => { active = false; controller.abort(); };
  }, [hasLivePosts, state, tab]);

  const basePosts = useMemo(() => {
    if (hasLivePosts) return posts;
    if (recoveryPosts.length) return recoveryPosts;
    if (posts.length) return posts;
    return seedPosts;
  }, [hasLivePosts, posts, recoveryPosts]);

  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    setExtraPosts([]);
    setHasMore(true);
    setLoadError('');
    setLoadingMore(false);
    hasPreloaded.current = false;
  }, [tab]);

  const displayPosts = useMemo(() => mergeUnique(basePosts, extraPosts), [basePosts, extraPosts]);

  const loadMore = useCallback(async () => {
    if (pending.current || !hasMore || state === 'loading') return;

    const controller = new AbortController();
    pending.current = controller;
    setLoadingMore(true);
    setLoadError('');

    try {
      const ids = displayPosts
        .map((post) => post.contentId)
        .filter((id): id is string => Boolean(id));

      const next = await loadExplorePage(ids, controller.signal);
      if (controller.signal.aborted) return;

      const seen = new Set(displayPosts.map((post) => post.contentId || post.id));
      const added = next.posts.filter((post) => !seen.has(post.contentId || post.id));

      if (!added.length && next.hasMore) {
        throw new Error('پست تازه‌ای دریافت نشد. دوباره تلاش کن.');
      }

      setExtraPosts((current) => mergeUnique(current, added));
      setHasMore(next.hasMore);
    } catch (error) {
      if (!controller.signal.aborted) {
        setLoadError(error instanceof Error ? error.message : 'دریافت پست‌های بیشتر انجام نشد.');
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoadingMore(false);
      }
    }
  }, [displayPosts, hasMore, state]);

  useEffect(() => {
    if (state === 'loading' || !basePosts.length || hasPreloaded.current) return;
    hasPreloaded.current = true;
    void loadMore();
  }, [state, basePosts.length, loadMore]);

  useEffect(() => {
    if (!hasMore || loadingMore || loadError || !sentinel.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '500px 0px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadError, loadMore]);

  useEffect(() => () => {
    pending.current?.abort();
    pending.current = null;
  }, []);

  const effectiveState: FeedState = recoveryPosts.length || extraPosts.length
    ? 'live'
    : hasLivePosts
      ? state
      : state === 'loading'
        ? 'loading'
        : 'fallback';

  const [leadPost, ...morePosts] = displayPosts;

  return (
    <div className="referenceHomePage">
      <Header onSearch={onSearch} onAdd={onAdd} />
      <FeedTabs value={tab} onChange={onTab} />

      {leadPost ? (
        <section className="premiumLeadStory referenceLeadStory" aria-label="پیشنهاد ویژه برای تو">
          <PostCard post={leadPost} onOpen={onOpen} onToggleSave={onToggleSave} onImpression={() => onImpression(leadPost, 1)} />
        </section>
      ) : effectiveState === 'loading' ? (
        <div className="premiumLeadSkeleton" aria-label="در حال دریافت محتوا" />
      ) : null}

      <ChannelRail channels={channels} onOpenChannel={onOpenChannel} />
      <InviteNudge />

      <section className="feedSection surface referenceFeedSection">
        <div className="feedHeading">
          <div>
            <h2>{leadPost ? 'پیشنهادهای بیشتر' : 'منتخب برای تو'}</h2>
            <div className="liveMeta">
              <small>{displayPosts.length.toLocaleString('fa-IR')} محتوا</small>
              <span className={`liveBadge ${effectiveState}`}>
                {effectiveState === 'live' ? 'داده زنده' : effectiveState === 'loading' ? 'در حال دریافت…' : 'پیشنهاد جایگزین'}
              </span>
            </div>
          </div>
        </div>

        {morePosts.length ? (
          <div className={`feedGrid ${effectiveState === 'loading' ? 'isRefreshing' : ''}`}>
            {morePosts.map((post, index) => (
              <PostCard key={post.id} post={post} onOpen={onOpen} onToggleSave={onToggleSave} onImpression={() => onImpression(post, index + 2)} />
            ))}
          </div>
        ) : leadPost ? null : <div className="inlineEmpty">محتوایی برای نمایش پیدا نشد.</div>}

        <div ref={sentinel} className="homeFeedLoadMore" aria-live="polite">
          {loadError && <p role="alert" className="homeFeedLoadError">{loadError}</p>}
          {hasMore && (
            <button type="button" className="sheetPrimary" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'در حال دریافت…' : loadError ? 'تلاش دوباره' : 'پست‌های بیشتر'}
            </button>
          )}
          {!hasMore && displayPosts.length > 18 && <p className="homeFeedEnd">فعلاً همه پیشنهادهای موجود را دیدی.</p>}
        </div>
      </section>
    </div>
  );
}
