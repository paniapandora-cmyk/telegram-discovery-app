import Header from '../components/Header';
import SearchControls from '../components/SearchControls';
import FeedTabs from '../components/FeedTabs';
import ChannelRail from '../components/ChannelRail';
import PostCard from '../components/PostCard';
import InviteNudge from '../components/InviteNudge';
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
  const [leadPost, ...morePosts] = posts;

  return (
    <>
      <Header />
      <SearchControls onSearch={onSearch} onAdd={onAdd} />
      <FeedTabs value={tab} onChange={onTab} />

      {leadPost ? (
        <section className="premiumLeadStory" aria-label="پیشنهاد ویژه برای تو">
          <PostCard
            post={leadPost}
            onOpen={onOpen}
            onToggleSave={onToggleSave}
            onImpression={() => onImpression(leadPost, 1)}
          />
        </section>
      ) : state === 'loading' ? (
        <div className="premiumLeadSkeleton" aria-label="در حال دریافت محتوا" />
      ) : null}

      <ChannelRail channels={channels} />
      <InviteNudge />

      <section className="feedSection surface">
        <div className="feedHeading">
          <div>
            <h2>{leadPost ? 'بیشتر برای تو' : 'منتخب برای تو'}</h2>
            <div className="liveMeta">
              <small>{posts.length.toLocaleString('fa-IR')} محتوا</small>
              <span className={`liveBadge ${state}`}>
                {state === 'live'
                  ? 'داده زنده'
                  : state === 'loading'
                    ? 'در حال دریافت…'
                    : 'نسخه پشتیبان'}
              </span>
            </div>
          </div>
        </div>

        {morePosts.length ? (
          <div className={`feedGrid ${state === 'loading' ? 'isRefreshing' : ''}`}>
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
    </>
  );
}
