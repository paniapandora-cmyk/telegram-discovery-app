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
  return (
    <>
      <Header />
      <SearchControls onSearch={onSearch} onAdd={onAdd} />
      <FeedTabs value={tab} onChange={onTab} />
      <ChannelRail channels={channels} />
      <InviteNudge />
      <section className="feedSection surface">
        <div className="feedHeading">
          <div>
            <h2>منتخب برای تو</h2>
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
        {posts.length ? (
          <div className={`feedGrid ${state === 'loading' ? 'isRefreshing' : ''}`}>
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={onOpen}
                onToggleSave={onToggleSave}
                onImpression={() => onImpression(post, index + 1)}
              />
            ))}
          </div>
        ) : (
          <div className="inlineEmpty">محتوایی برای نمایش پیدا نشد.</div>
        )}
      </section>
    </>
  );
}
