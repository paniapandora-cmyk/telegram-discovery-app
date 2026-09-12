import {
  ArrowRight,
  Bookmark,
  Check,
  ExternalLink,
  Eye,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import PostCard from '../components/PostCard';
import {
  loadChannelProfile,
  setChannelFollow,
  type ChannelProfileData,
  type SimilarChannel,
} from '../data/channel-profile';
import { openTrackedChannel } from '../data/tracking';
import type { Channel, Post } from '../types';
import '../styles/channel-profile-v14.css';

type Props = {
  channel: Channel;
  onBack: () => void;
  onOpenPost: (post: Post) => void;
  onToggleSavePost: (post: Post) => void;
  onOpenChannel: (channel: Channel) => void;
  onChanged: () => void;
};

type LoadState = 'loading' | 'live' | 'error';
const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const pct = (value: number) => `${fa.format(Math.max(0, Math.min(1, value)) * 100)}٪`;

const asCreatorId = (channel: Channel) => channel.creatorId || (/^[0-9a-f-]{36}$/i.test(channel.id) ? channel.id : '');

function SimilarCard({ item, onOpen }: { item: SimilarChannel; onOpen: () => void }) {
  return (
    <button type="button" className="channelSimilarCardV14" onClick={onOpen}>
      <span className={`channelSimilarAvatarV14 ${item.accent}`}>
        <b>{item.initials}</b>
        {item.avatarUrl && <img src={item.avatarUrl} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
      </span>
      <span className="channelSimilarCopyV14">
        <span><strong>{item.title}</strong>{item.verified && <Check />}</span>
        <small>{item.username || 'Telegram channel'}</small>
        <em>{pct(item.topicOverlap)} شباهت موضوعی · {fa.format(item.postsCount)} پست</em>
      </span>
      <ArrowRight />
    </button>
  );
}

export default function ChannelPage({
  channel,
  onBack,
  onOpenPost,
  onToggleSavePost,
  onOpenChannel,
  onChanged,
}: Props) {
  const creatorId = asCreatorId(channel);
  const [data, setData] = useState<ChannelProfileData | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [followBusy, setFollowBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => {
    if (!creatorId) {
      setState('error');
      setNotice('این کانال هنوز شناسه Creator قابل استفاده در کشف ندارد.');
      return null;
    }
    const controller = new AbortController();
    setState('loading');
    setNotice('');
    loadChannelProfile(creatorId, controller.signal)
      .then((next) => { setData(next); setState('live'); })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState('error');
          setNotice(error instanceof Error ? error.message : 'اطلاعات کانال دریافت نشد.');
        }
      });
    return controller;
  };

  useEffect(() => {
    setData(null);
    const controller = load();
    return () => controller?.abort();
  }, [creatorId]);

  const currentChannel = data?.channel || channel;
  const currentPosts = data?.posts || [];
  const topicMax = useMemo(() => Math.max(1, ...(data?.topics.map((topic) => topic.weight) || [1])), [data]);

  const toggleFollow = async () => {
    if (!creatorId || !data || followBusy) return;
    const before = data.following;
    setFollowBusy(true);
    setData({ ...data, following: !before, stats: { ...data.stats, followers: Math.max(0, data.stats.followers + (before ? -1 : 1)) } });
    try {
      const next = await setChannelFollow(creatorId, !before);
      setData(next);
      setNotice(before ? 'این کانال از اولویت فید خارج شد.' : 'کانال دنبال شد؛ پست‌هایش در «برای تو» وزن بیشتری می‌گیرند.');
      onChanged();
    } catch (error) {
      setData(data);
      setNotice(error instanceof Error ? error.message : 'تغییر دنبال‌کردن انجام نشد.');
    } finally {
      setFollowBusy(false);
    }
  };

  const toggleSave = (id: string) => {
    if (!data) return;
    const target = data.posts.find((post) => post.id === id);
    if (!target) return;
    const nextSaved = !target.saved;
    setData({ ...data, posts: data.posts.map((post) => post.id === id ? { ...post, saved: nextSaved } : post) });
    onToggleSavePost(target);
  };

  const openTelegram = () => void openTrackedChannel(currentChannel);

  return (
    <div className="page channelProfilePageV14">
      <header className="channelProfileTopbarV14">
        <button type="button" onClick={onBack} aria-label="بازگشت"><ArrowRight /></button>
        <strong>صفحه کانال</strong>
        <button type="button" onClick={() => load()} aria-label="تازه‌سازی"><RefreshCw /></button>
      </header>

      {state === 'loading' && !data ? (
        <div className="channelProfileSkeletonV14"><span /><span /><span /><span /></div>
      ) : data ? (
        <>
          <section className="channelHeroV14 surface">
            <div className={`channelHeroAvatarV14 ${currentChannel.accent}`}>
              <span>{currentChannel.initials}</span>
              {currentChannel.avatarUrl && <img src={currentChannel.avatarUrl} alt="" loading="eager" decoding="async" onError={(event) => event.currentTarget.remove()} />}
            </div>
            <div className="channelHeroCopyV14">
              <div className="channelHeroTitleV14">
                <h1>{currentChannel.title}</h1>
                {data.verified && <span className="channelVerifiedV14"><Check /></span>}
              </div>
              <p className="channelHandleV14">{currentChannel.username || 'Telegram channel'}</p>
              {data.bio && <p className="channelBioV14">{data.bio}</p>}
              <div className="channelHeroActionsV14">
                <button type="button" className={data.following ? 'isFollowing' : ''} onClick={() => void toggleFollow()} disabled={followBusy}>
                  {followBusy ? <LoaderCircle className="spin" /> : data.following ? <Check /> : <UserPlus />}
                  {data.following ? 'دنبال می‌کنی' : 'دنبال کن'}
                </button>
                <button type="button" className="telegram" onClick={openTelegram} disabled={!currentChannel.username}>
                  <ExternalLink /> تلگرام
                </button>
              </div>
            </div>
          </section>

          {notice && <div className="channelNoticeV14">{notice}</div>}

          <section className="channelStatsV14">
            <article><Users /><strong>{fa.format(data.stats.followers)}</strong><small>دنبال‌کننده در کشف</small></article>
            <article><Eye /><strong>{fa.format(data.stats.views30d)}</strong><small>مشاهده ۳۰ روز</small></article>
            <article><Bookmark /><strong>{fa.format(data.stats.saves)}</strong><small>ذخیره محتوا</small></article>
            <article><Sparkles /><strong>{pct(data.stats.quality)}</strong><small>کیفیت میانگین</small></article>
          </section>

          {data.topics.length > 0 && (
            <section className="channelTopicsV14 surface">
              <div className="channelSectionHeadV14"><div><h2>موضوعات کانال</h2><p>بر اساس محتوای واقعی ایندکس‌شده</p></div><Sparkles /></div>
              <div className="channelTopicGridV14">
                {data.topics.map((topic) => (
                  <span key={topic.id} style={{ '--strength': `${Math.max(.18, topic.weight / topicMax)}` } as CSSProperties}>
                    <b>{topic.name}</b><small>{fa.format(topic.weight)}</small>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="channelPostsV14 surface">
            <div className="channelSectionHeadV14">
              <div><h2>آخرین پست‌ها</h2><p>{fa.format(data.stats.posts)} پست ایندکس‌شده · {fa.format(data.stats.recentPosts)} پست در ۳۰ روز</p></div>
              <span>{fa.format(currentPosts.length)}</span>
            </div>
            {currentPosts.length ? (
              <div className="channelPostGridV14">
                {currentPosts.map((post) => (
                  <PostCard key={post.id} post={post} onOpen={onOpenPost} onToggleSave={toggleSave} />
                ))}
              </div>
            ) : (
              <div className="inlineEmpty">فعلاً پست قابل نمایش برای این کانال نداریم.</div>
            )}
          </section>

          {data.similar.length > 0 && (
            <section className="channelSimilarV14 surface">
              <div className="channelSectionHeadV14"><div><h2>کانال‌های مشابه</h2><p>بر اساس موضوع، کیفیت و تازگی</p></div><Sparkles /></div>
              <div className="channelSimilarListV14">
                {data.similar.map((item) => <SimilarCard key={item.id} item={item} onOpen={() => onOpenChannel(item)} />)}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="emptyState channelProfileErrorV14">
          <Users />
          <h2>صفحه کانال آماده نشد</h2>
          <p>{notice || 'این کانال هنوز اطلاعات کافی در کشف ندارد.'}</p>
          <div><button type="button" onClick={() => load()}><RefreshCw /> تلاش دوباره</button><button type="button" onClick={openTelegram} disabled={!channel.username}><ExternalLink /> باز کردن تلگرام</button></div>
        </div>
      )}
    </div>
  );
}
