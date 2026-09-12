import {
  Clock3,
  FileText,
  Radio,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ExploreTile from '../components/ExploreTile';
import { loadRecommendedChannels } from '../data/channels';
import { searchLive } from '../data/live';
import {
  clearSearchHistory,
  loadSearchHistory,
  loadSearchTopics,
  recordSearchHistory,
  type SearchHistoryItem,
} from '../data/search';
import { openTrackedChannel } from '../data/tracking';
import type { Channel, Post } from '../types';
import '../styles/search-discovery-v11.css';

type Props = {
  channels: Channel[];
  onOpen: (post: Post) => void;
};

type SearchState = 'idle' | 'loading' | 'live' | 'fallback';
type SearchFilter = 'all' | 'channels' | 'posts';

const fa = new Intl.NumberFormat('fa-IR');

const fold = (value: string) =>
  value
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function SearchPage({ channels, onOpen }: Props) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [recommended, setRecommended] = useState<Channel[]>([]);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [livePosts, setLivePosts] = useState<Post[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [clearingHistory, setClearingHistory] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      loadRecommendedChannels(controller.signal)
        .then((next) => {
          if (next.length) setRecommended(next);
        })
        .catch(() => {}),
      loadSearchHistory(controller.signal).then(setHistory).catch(() => {}),
      loadSearchTopics(controller.signal).then(setTopics).catch(() => {}),
    ]);

    return () => controller.abort();
  }, []);

  const realFallbackChannels = recommended.length ? recommended : channels;

  const trackingByUsername = useMemo(() => {
    const map = new Map<string, Channel>();
    for (const channel of realFallbackChannels) {
      const key = fold(channel.username.replace(/^@/, ''));
      if (key) map.set(key, channel);
    }
    return map;
  }, [realFallbackChannels]);

  const withTrackingMetadata = (channel: Channel): Channel => {
    if (channel.creatorId) return channel;
    const known = trackingByUsername.get(fold(channel.username.replace(/^@/, '')));
    return known?.creatorId
      ? { ...channel, creatorId: known.creatorId, trackingAvailable: true }
      : channel;
  };

  const localMatches = useMemo(() => {
    const term = fold(q.replace(/^@/, ''));
    if (!term) return realFallbackChannels;

    return realFallbackChannels.filter((channel) =>
      fold(`${channel.title} ${channel.username}`).includes(term),
    );
  }, [q, realFallbackChannels]);

  useEffect(() => {
    const term = q.replace(/\s+/g, ' ').trim();

    if (term.length < 2) {
      setLiveChannels([]);
      setLivePosts([]);
      setState('idle');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState('loading');

      searchLive(term, controller.signal)
        .then((result) => {
          setLiveChannels(result.channels);
          setLivePosts(result.posts);
          setState('live');
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setLiveChannels(localMatches);
            setLivePosts([]);
            setState('fallback');
          }
        });
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, localMatches]);

  const channelsToShow = (
    state === 'idle'
      ? realFallbackChannels.slice(0, 8)
      : state === 'fallback'
        ? localMatches
        : liveChannels
  ).map(withTrackingMetadata);

  const postsToShow = state === 'live' ? livePosts : [];
  const hasQuery = q.trim().length > 0;
  const showChannels = filter === 'all' || filter === 'channels';
  const showPosts = filter === 'all' || filter === 'posts';
  const resultCount = channelsToShow.length + postsToShow.length;
  const visibleResultCount =
    (showChannels ? channelsToShow.length : 0) +
    (showPosts ? postsToShow.length : 0);
  const hasResults = visibleResultCount > 0;

  const pushRecent = (query: string, count = resultCount) => {
    const cleaned = query.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) return;

    const normalized = fold(cleaned);
    setHistory((current) => [
      {
        query: cleaned,
        normalizedQuery: normalized,
        resultCount: count,
        createdAt: new Date().toISOString(),
      },
      ...current.filter((item) => fold(item.query) !== normalized),
    ].slice(0, 10));

    void recordSearchHistory(cleaned, count);
  };

  const chooseQuery = (value: string) => {
    setFilter('all');
    setQ(value);
  };

  const clearRecent = async () => {
    if (clearingHistory) return;
    setClearingHistory(true);
    setHistory([]);
    try {
      await clearSearchHistory();
    } finally {
      setClearingHistory(false);
    }
  };

  const openChannel = (channel: Channel) => {
    if (q.trim().length >= 2) pushRecent(q);
    void openTrackedChannel(channel);
  };

  const openPost = (post: Post) => {
    if (q.trim().length >= 2) pushRecent(q);
    onOpen(post);
  };

  const filterItems: Array<{
    id: SearchFilter;
    label: string;
    count: number;
    icon: typeof Radio;
  }> = [
    { id: 'all', label: 'همه', count: resultCount, icon: Radio },
    { id: 'channels', label: 'کانال‌ها', count: channelsToShow.length, icon: Users },
    { id: 'posts', label: 'پست‌ها', count: postsToShow.length, icon: FileText },
  ];

  return (
    <div className="page searchPageV11">
      <header className="pageHeader searchHeaderV11">
        <div>
          <span className="searchEyebrowV11"><Sparkles /> کشف هوشمند</span>
          <h1>جست‌وجو</h1>
          <p>کانال و پست عمومی تلگرام، مرتب‌شده بر اساس ارتباط</p>

          {hasQuery && (
            <div className="pageStatusRow">
              <span className={`liveBadge ${state}`}>
                {state === 'live'
                  ? 'نتیجه زنده'
                  : state === 'loading'
                    ? 'در حال رتبه‌بندی…'
                    : state === 'fallback'
                      ? 'نتیجه جایگزین'
                      : 'آماده'}
              </span>
              <span className="pageCountChip">{fa.format(visibleResultCount)} نتیجه</span>
            </div>
          )}
        </div>
        <Search />
      </header>

      <section className="searchPanel surface searchPanelV11">
        <label className="globalSearch searchInputV11">
          <Search />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && q.trim().length >= 2) {
                pushRecent(q);
                event.currentTarget.blur();
              }
            }}
            placeholder="نام کانال، موضوع یا متن پست..."
            autoComplete="off"
            enterKeyHint="search"
          />
          {q ? (
            <button
              type="button"
              className="searchClearV11"
              onClick={() => setQ('')}
              aria-label="پاک کردن جست‌وجو"
            >
              <X />
            </button>
          ) : (
            <Sparkles className="searchInputSparkV11" />
          )}
        </label>

        {hasQuery && (
          <div className="filterChips searchFiltersV11" aria-label="فیلتر نتایج">
            {filterItems.map(({ id, label, count, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={filter === id ? 'active' : ''}
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
              >
                <Icon />
                <span>{label}</span>
                <small>{fa.format(count)}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {!hasQuery && (
        <div className="searchStartV11">
          {history.length > 0 && (
            <section className="searchQuickSectionV11 surface">
              <div className="searchQuickHeadV11">
                <div><Clock3 /><span><b>جست‌وجوهای اخیر</b><small>برای ادامه سریع</small></span></div>
                <button type="button" onClick={() => void clearRecent()} disabled={clearingHistory}>
                  <Trash2 /> پاک کردن
                </button>
              </div>
              <div className="searchRecentRailV11">
                {history.map((item) => (
                  <button type="button" key={item.normalizedQuery || item.query} onClick={() => chooseQuery(item.query)}>
                    <Clock3 />
                    <span>{item.query}</span>
                    {item.resultCount > 0 && <small>{fa.format(item.resultCount)}</small>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {topics.length > 0 && (
            <section className="searchQuickSectionV11 surface">
              <div className="searchQuickHeadV11">
                <div><Sparkles /><span><b>موضوعات پیشنهادی</b><small>از موضوعات واقعی کشف</small></span></div>
              </div>
              <div className="searchTopicGridV11">
                {topics.map((topic) => (
                  <button type="button" key={topic} onClick={() => chooseQuery(topic)}>{topic}</button>
                ))}
              </div>
            </section>
          )}

          <section className="searchDiscoveryV11">
            <div className="searchSectionHeadV11">
              <div><h2>کانال‌های پیشنهادی</h2><p>برای شروع کشف</p></div>
              <Users />
            </div>
            {channelsToShow.length > 0 ? (
              <div className="searchChannelGridV11">
                {channelsToShow.map((channel) => (
                  <article
                    key={`idle-${channel.id}`}
                    className="searchChannelCardV11"
                    role="button"
                    tabIndex={0}
                    onClick={() => openChannel(channel)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') openChannel(channel);
                    }}
                  >
                    <div className={`channelAvatar ${channel.accent}`}>
                      <span>{channel.initials}</span>
                      {channel.avatarUrl && <img src={channel.avatarUrl} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
                    </div>
                    <div><strong>{channel.title}</strong><small>{channel.username}</small></div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openChannel(channel); }} disabled={!channel.username}>مشاهده</button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyState"><Search /><h2>برای کشف آماده‌ای</h2><p>حداقل دو حرف بنویس تا جست‌وجوی زنده شروع شود.</p></div>
            )}
          </section>
        </div>
      )}

      {hasQuery && state === 'loading' && (
        <div className="searchLoading searchLoadingV11"><span /><span /><span /></div>
      )}

      {hasQuery && state !== 'loading' && hasResults && (
        <>
          <div className="searchRankingNoteV11"><Sparkles /><span>نتایج دقیق‌تر، تازه‌تر و مرتبط‌تر بالاتر نمایش داده می‌شوند.</span></div>

          {showChannels && channelsToShow.length > 0 && (
            <section className="searchDiscoveryV11">
              <div className="searchSectionHeadV11">
                <div><h2>کانال‌ها</h2><p>{fa.format(channelsToShow.length)} نتیجه مرتبط</p></div>
                <Users />
              </div>
              <div className="searchChannelGridV11">
                {channelsToShow.map((channel) => (
                  <article
                    key={`c-${channel.id}`}
                    className="searchChannelCardV11"
                    role="button"
                    tabIndex={0}
                    onClick={() => openChannel(channel)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') openChannel(channel);
                    }}
                  >
                    <div className={`channelAvatar ${channel.accent}`}>
                      <span>{channel.initials}</span>
                      {channel.avatarUrl && <img src={channel.avatarUrl} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
                    </div>
                    <div><strong>{channel.title}</strong><small>{channel.username}</small></div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openChannel(channel); }} disabled={!channel.username}>مشاهده</button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showPosts && postsToShow.length > 0 && (
            <section className="searchPostsSectionV11">
              <div className="searchSectionHeadV11">
                <div><h2>پست‌ها</h2><p>{fa.format(postsToShow.length)} نتیجه زنده</p></div>
                <FileText />
              </div>
              <div className="searchPostGridV11">
                {postsToShow.map((post, index) => (
                  <ExploreTile
                    key={`p-${post.id}`}
                    post={post}
                    compact
                    tall={index % 5 === 0}
                    onOpen={openPost}
                  />
                ))}
              </div>
            </section>
          )}

          {state === 'fallback' && (
            <div className="searchFallbackV11">
              جست‌وجوی عمومی تلگرام موقتاً در دسترس نبود؛ نتایج داخلی Discovery نمایش داده شده‌اند.
            </div>
          )}
        </>
      )}

      {hasQuery && state !== 'loading' && !hasResults && (
        <div className="emptyState searchEmptyV11">
          <Search />
          <h2>نتیجه‌ای پیدا نشد</h2>
          <p>املای عبارت را بررسی کن یا یکی از موضوعات پیشنهادی را امتحان کن.</p>
          {topics.length > 0 && (
            <div className="searchEmptyTopicsV11">
              {topics.slice(0, 5).map((topic) => <button type="button" key={topic} onClick={() => chooseQuery(topic)}>{topic}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
