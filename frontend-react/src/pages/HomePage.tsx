import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FeedTabs from '../components/FeedTabs';
import ChannelRail from '../components/ChannelRail';
import PostCard from '../components/PostCard';
import InviteNudge from '../components/InviteNudge';
import { posts as seedPosts } from '../data/demo';
import { loadLivePosts } from '../data/live';
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

export default function HomePage({ channels, posts, tab, state, onTab, onSearch, onAdd, onOpen, onOpenChannel, onToggleSave, onImpression }: Props) {
  const [recoveryPosts, setRecoveryPosts] = useState<Post[]>([]);
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

  const displayPosts = useMemo(() => {
    if (hasLivePosts) return posts;
    if (recoveryPosts.length) return recoveryPosts;
    if (posts.length) return posts;
    return seedPosts;
  }, [hasLivePosts, posts, recoveryPosts]);

  const effectiveState: FeedState = recoveryPosts.length ? 'live' : hasLivePosts ? state : state === 'loading' ? 'loading' : 'fallback';
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
      </section>
    </div>
  );
}
