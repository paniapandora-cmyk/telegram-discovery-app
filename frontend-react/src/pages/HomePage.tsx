import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import FeedTabs from '../components/FeedTabs';
import ChannelRail from '../components/ChannelRail';
import PostCard from '../components/PostCard';
import InviteNudge from '../components/InviteNudge';
import { posts as seedPosts } from '../data/demo';
import { loadLivePosts, type LiveMode } from '../data/live';
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
const MIN_HEALTHY_HOME = 16;
const PREFETCH_TARGET = 36;
const HOME_REFRESH_MS = 90_000;

const postKey = (post: Post) => post.contentId || post.id;

const mergeUnique = (...groups: Post[][]) => {
  const seen = new Set<string>();
  const result: Post[] = [];

  for (const post of groups.flat()) {
    const key = postKey(post);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(post);
  }

  return result;
};

const recoveryModes = (tab: string): LiveMode[] => {
  if (tab === 'hot') return ['fresh', 'for-you'];
  if (tab === 'fresh') return ['hot', 'for-you'];
  return ['fresh', 'hot'];
};

const modeForTab = (tab: string): LiveMode =>
  tab === 'hot' ? 'hot' : tab === 'fresh' ? 'fresh' : 'for-you';

export default function HomePage({ channels, posts, tab, state, onTab, onSearch, onAdd, onOpen, onOpenChannel, onToggleSave, onImpression }: Props) {
  const [recoveryPosts, setRecoveryPosts] = useState<Post[]>([]);
  const [refreshPosts, setRefreshPosts] = useState<Post[]>([]);
  const [extraPosts, setExtraPosts] = useState<Post[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const recoveryPending = useRef<AbortController | null>(null);
  const refreshPending = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const livePrimaryPosts = useMemo(
    () => posts.filter((post) => !seedIds.has(post.id)),
    [posts],
  );

  useEffect(() => {
    pending.current?.abort();
    recoveryPending.current?.abort();
    refreshPending.current?.abort();
    pending.current = null;
    recoveryPending.current = null;
    refreshPending.current = null;
    setRecoveryPosts([]);
    setRefreshPosts([]);
    setExtraPosts([]);
    setHasMore(true);
    setLoadError('');
    setLoadingMore(false);
  }, [tab]);

  useEffect(() => {
    if (state === 'loading' || livePrimaryPosts.length >= MIN_HEALTHY_HOME) {
      if (livePrimaryPosts.length >= MIN_HEALTHY_HOME) setRecoveryPosts([]);
      return;
    }

    const controller = new AbortController();
    recoveryPending.current?.abort();
    recoveryPending.current = controller;
    let active = true;

    const recover = async () => {
      let merged = [...livePrimaryPosts];
      const recovered: Post[] = [];

      for (const mode of recoveryModes(tab)) {
        if (merged.length >= MIN_HEALTHY_HOME) break;

        try {
          const next = await loadLivePosts(mode, controller.signal);
          if (!active || controller.signal.aborted) return;

          const before = new Set(merged.map(postKey));
          const additions = next.filter((post) => !before.has(postKey(post)));
          recovered.push(...additions);
          merged = mergeUnique(merged, additions);
        } catch {
          if (controller.signal.aborted) return;
        }
      }

      if (active && !controller.signal.aborted) {
        setRecoveryPosts(mergeUnique(recovered));
      }
    };

    void recover();

    return () => {
      active = false;
      controller.abort();
      if (recoveryPending.current === controller) recoveryPending.current = null;
    };
  }, [livePrimaryPosts, state, tab]);

  useEffect(() => {
    if (state === 'loading') return;
    let active = true;

    const refresh = async () => {
      if (!active || refreshPending.current) return;
      const controller = new AbortController();
      refreshPending.current = controller;

      try {
        const next = await loadLivePosts(modeForTab(tab), controller.signal);
        if (!active || controller.signal.aborted) return;

        const primaryIds = new Set(livePrimaryPosts.map(postKey));
        const freshAdditions = next.filter((post) => !primaryIds.has(postKey(post)));
        setRefreshPosts((current) => mergeUnique(freshAdditions, current).slice(0, 18));
      } catch {
        // Keep the last good feed visible. A transient sync/API failure should
        // never collapse Home back to demo data.
      } finally {
        if (refreshPending.current === controller) refreshPending.current = null;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), HOME_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      refreshPending.current?.abort();
      refreshPending.current = null;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [livePrimaryPosts, state, tab]);

  const basePosts = useMemo(() => {
    const real = mergeUnique(refreshPosts, livePrimaryPosts, recoveryPosts);
    if (real.length) return real;
    if (posts.length) return posts;
    return seedPosts;
  }, [livePrimaryPosts, posts, recoveryPosts, refreshPosts]);

  const displayPosts = useMemo(
    () => mergeUnique(basePosts, extraPosts),
    [basePosts, extraPosts],
  );

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

      let nextPosts: Post[] = [];
      let nextHasMore = true;

      try {
        const page = await loadExplorePage(ids, controller.signal);
        nextPosts = page.posts;
        nextHasMore = page.hasMore;
      } catch (primaryError) {
        if (controller.signal.aborted) return;

        // Home must never collapse to only a few cards because one paginated
        // endpoint had a transient failure. Reuse the live feed sources as a
        // second path and de-duplicate them locally.
        for (const mode of recoveryModes(tab)) {
          try {
            const fallback = await loadLivePosts(mode, controller.signal);
            nextPosts = mergeUnique(nextPosts, fallback);
            if (nextPosts.length >= 12) break;
          } catch {
            if (controller.signal.aborted) return;
          }
        }

        if (!nextPosts.length) throw primaryError;
      }

      const seen = new Set(displayPosts.map(postKey));
      const added = nextPosts.filter((post) => !seen.has(postKey(post)));

      if (!added.length) {
        if (!nextHasMore) {
          setHasMore(false);
          return;
        }
        throw new Error('پست تازه‌ای دریافت نشد. دوباره تلاش کن.');
      }

      setExtraPosts((current) => mergeUnique(current, added));
      setHasMore(nextHasMore || added.length > 0);
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
  }, [displayPosts, hasMore, state, tab]);

  useEffect(() => {
    if (state === 'loading' || displayPosts.length >= PREFETCH_TARGET || loadingMore || loadError) return;
    void loadMore();
  }, [displayPosts.length, loadError, loadMore, loadingMore, state]);

  useEffect(() => {
    if (!hasMore || loadingMore || !sentinel.current || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '700px 0px' });

    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  useEffect(() => () => {
    pending.current?.abort();
    recoveryPending.current?.abort();
    refreshPending.current?.abort();
    pending.current = null;
    recoveryPending.current = null;
    refreshPending.current = null;
  }, []);

  const effectiveState: FeedState = livePrimaryPosts.length || recoveryPosts.length || refreshPosts.length || extraPosts.length
    ? 'live'
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
