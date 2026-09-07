import {
  Search,
  SlidersHorizontal,
  Radio,
  Users,
  FileText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ExploreTile from '../components/ExploreTile';
import { loadRecommendedChannels } from '../data/channels';
import { openTelegramChannel, searchLive } from '../data/live';
import type { Channel, Post } from '../types';

type Props = {
  channels: Channel[];
  onOpen: (post: Post) => void;
};

type SearchState = 'idle' | 'loading' | 'live' | 'fallback';

export default function SearchPage({ channels, onOpen }: Props) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('همه');
  const [recommended, setRecommended] = useState<Channel[]>([]);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [livePosts, setLivePosts] = useState<Post[]>([]);
  const [state, setState] = useState<SearchState>('idle');

  useEffect(() => {
    const controller = new AbortController();

    loadRecommendedChannels(controller.signal)
      .then((next) => {
        if (next.length) setRecommended(next);
      })
      .catch(() => {
        // Search remains available even if discovery channel suggestions fail.
      });

    return () => controller.abort();
  }, []);

  const realFallbackChannels = recommended.length ? recommended : channels;

  const localMatches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return realFallbackChannels;

    return realFallbackChannels.filter((channel) =>
      `${channel.title} ${channel.username}`
        .toLowerCase()
        .includes(term),
    );
  }, [q, realFallbackChannels]);

  useEffect(() => {
    const term = q.trim();

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
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, localMatches]);

  const showChannels = filter === 'همه' || filter === 'کانال‌ها';
  const showPosts = filter === 'همه' || filter === 'پست‌ها';

  const channelsToShow =
    state === 'idle'
      ? realFallbackChannels.slice(0, 8)
      : state === 'fallback'
        ? localMatches
        : liveChannels;

  const postsToShow = state === 'live' ? livePosts : [];

  const hasQuery = q.trim().length > 0;
  const hasResults =
    (showChannels && channelsToShow.length > 0) ||
    (showPosts && postsToShow.length > 0);

  const resultCount =
    (showChannels ? channelsToShow.length : 0) +
    (showPosts ? postsToShow.length : 0);

  return (
    <div className="page searchPageV4">
      <header className="pageHeader searchHeaderV4">
        <div>
          <h1>جست‌وجو</h1>
          <p>کانال‌ها و پست‌های عمومی تلگرام</p>

          {hasQuery && (
            <div className="pageStatusRow">
              <span className={`liveBadge ${state}`}>
                {state === 'live'
                  ? 'نتیجه زنده'
                  : state === 'loading'
                    ? 'در حال جست‌وجو…'
                    : state === 'fallback'
                      ? 'نتیجه جایگزین'
                      : 'آماده'}
              </span>

              <span className="pageCountChip">
                {new Intl.NumberFormat('fa-IR').format(resultCount)} نتیجه
              </span>
            </div>
          )}
        </div>

        <Search />
      </header>

      <section className="searchPanel surface searchPanelV4">
        <label className="globalSearch searchInputV4">
          <Search />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="مثلاً موسیقی، زبان بدن، پایپینگ..."
            autoComplete="off"
            enterKeyHint="search"
          />
          <SlidersHorizontal />
        </label>

        <div className="filterChips searchFiltersV4">
          {[
            ['همه', Radio],
            ['کانال‌ها', Users],
            ['پست‌ها', FileText],
          ].map(([item, Icon]) => (
            <button
              key={String(item)}
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(String(item))}
            >
              <Icon size={14} />
              {String(item)}
            </button>
          ))}
        </div>
      </section>

      {state === 'loading' ? (
        <div className="searchLoading searchLoadingV4">
          <span />
          <span />
          <span />
        </div>
      ) : !hasQuery ? (
        <section className="searchDiscoveryV4">
          <div className="searchSectionHeadV4">
            <div>
              <h2>کانال‌های پیشنهادی</h2>
              <p>از منبع زنده Discovery</p>
            </div>
            <Users />
          </div>

          {channelsToShow.length ? (
            <div className="searchChannelGridV4">
              {channelsToShow.map((channel) => (
                <article
                  key={`c-${channel.id}`}
                  className="searchChannelCardV4"
                  onClick={() => openTelegramChannel(channel.username)}
                >
                  <div className={`channelAvatar ${channel.accent}`}>
                    <span>{channel.initials}</span>
                    {channel.avatarUrl && (
                      <img
                        src={channel.avatarUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(event) => event.currentTarget.remove()}
                      />
                    )}
                  </div>

                  <div>
                    <strong>{channel.title}</strong>
                    <small>{channel.username}</small>
                  </div>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openTelegramChannel(channel.username);
                    }}
                    disabled={!channel.username}
                  >
                    مشاهده
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="emptyState compactEmptyV4">
              <Search />
              <h2>عبارت جست‌وجو را بنویس</h2>
              <p>از دو حرف به بعد جست‌وجوی زنده شروع می‌شود.</p>
            </div>
          )}
        </section>
      ) : hasResults ? (
        <>
          {showChannels && channelsToShow.length > 0 && (
            <section className="searchDiscoveryV4">
              <div className="searchSectionHeadV4">
                <div>
                  <h2>کانال‌ها</h2>
                  <p>
                    {new Intl.NumberFormat('fa-IR').format(
                      channelsToShow.length,
                    )}{' '}
                    نتیجه
                  </p>
                </div>
                <Users />
              </div>

              <div className="searchChannelGridV4">
                {channelsToShow.map((channel) => (
                  <article
                    key={`c-${channel.id}`}
                    className="searchChannelCardV4"
                    onClick={() => openTelegramChannel(channel.username)}
                  >
                    <div className={`channelAvatar ${channel.accent}`}>
                      <span>{channel.initials}</span>
                      {channel.avatarUrl && (
                        <img
                          src={channel.avatarUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(event) => event.currentTarget.remove()}
                        />
                      )}
                    </div>

                    <div>
                      <strong>{channel.title}</strong>
                      <small>{channel.username}</small>
                    </div>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openTelegramChannel(channel.username);
                      }}
                      disabled={!channel.username}
                    >
                      مشاهده
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showPosts && postsToShow.length > 0 && (
            <section className="searchPostsSectionV4">
              <div className="searchSectionHeadV4">
                <div>
                  <h2>پست‌ها</h2>
                  <p>
                    {new Intl.NumberFormat('fa-IR').format(postsToShow.length)}{' '}
                    نتیجه زنده
                  </p>
                </div>
                <FileText />
              </div>

              <div className="searchPostGridV4">
                {postsToShow.map((post, index) => (
                  <ExploreTile
                    key={`p-${post.id}`}
                    post={post}
                    compact
                    tall={index % 4 === 0}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </section>
          )}

          {state === 'fallback' && (
            <div className="searchFallbackNote searchFallbackV4">
              جست‌وجوی عمومی تلگرام در دسترس نبود؛ کانال‌های زنده Discovery
              به‌عنوان نتیجه جایگزین نمایش داده شدند.
            </div>
          )}
        </>
      ) : (
        <div className="emptyState">
          <Search />
          <h2>نتیجه‌ای پیدا نشد</h2>
          <p>املای عبارت را بررسی کن یا کلمه کوتاه‌تری را امتحان کن.</p>
        </div>
      )}
    </div>
  );
}
