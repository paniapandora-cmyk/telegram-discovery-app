import Header from '../components/Header';
import FeedTabs from '../components/FeedTabs';
import ChannelRail from '../components/ChannelRail';
import PostCard from '../components/PostCard';
import InviteNudge from '../components/InviteNudge';
import { posts as seedPosts } from '../data/demo';
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
  onToggleSave: (id: string) => void;
  onImpression: (post: Post, position: number) => void;
};

export default function HomePage({
  channels,
  posts,
  tab,
  state,
  onTab,
  onSearch,
  onAdd,
  onOpen,
  onToggleSave,
  onImpression,
}: Props) {
  // A personalized endpoint can legitimately return an empty array while a user
  // is new or has very narrow interests. Never collapse the whole home screen in
  // that case: keep the existing seed/fallback feed visible until live content is available.
  const displayPosts = posts.length ? posts : seedPosts;
  const effectiveState: FeedState = posts.length ? state : state === 'loading' ? 'loading' : 'fallback';
  const [leadPost, ...morePosts] = displayPosts;

  return (
    <div className="referenceHomePage">
      <Header onSearch={onSearch} onAdd={onAdd} />
      <FeedTabs value={tab} onChange={onTab} />

      {leadPost ? (
        <section className="premiumLeadStory referenceLeadStory" aria-label="پیشنهاد ویژه برای تو">
          <PostCard
            post={leadPost}
            onOpen={onOpen}
            onToggleSave={onToggleSave}
            onImpression={() => onImpression(leadPost, 1)}
          />
        </section>
      ) : effectiveState === 'loading' ? (
        <div className="premiumLeadSkeleton" aria-label="در حال دریافت محتوا" />
      ) : null}

      <ChannelRail channels={channels} />
      <InviteNudge />

      <section className="feedSection surface referenceFeedSection">
        <div className="feedHeading">
          <div>
            <h2>{leadPost ? 'پیشنهادهای بیشتر' : 'منتخب برای تو'}</h2>
            <div className="liveMeta">
              <small>{displayPosts.length.toLocaleString('fa-IR')} محتوا</small>
              <span className={`liveBadge ${effectiveState}`}>
                {effectiveState === 'live'
                  ? 'داده زنده'
                  : effectiveState === 'loading'
                    ? 'در حال دریافت…'
                    : 'پیشنهاد جایگزین'}
              </span>
            </div>
          </div>
        </div>

        {morePosts.length ? (
          <div className={`feedGrid ${effectiveState === 'loading' ? 'isRefreshing' : ''}`}>
            {morePosts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={onOpen}
                onToggleSave={onToggleSave}
                onImpression={() => onImpression(post, index + 2)}
              />
            ))}
          </div>
        ) : leadPost ? null : (
          <div className="inlineEmpty">محتوایی برای نمایش پیدا نشد.</div>
        )}
      </section>
    </div>
  );
}
