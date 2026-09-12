import { useEffect, useMemo, useRef, useState } from 'react';
import { channels, posts as seedPosts } from '../data/demo';
import {
  decorateChannels,
  loadLivePosts,
  persistSaved,
  sendPostFeedback,
  trackImpression,
  trackPostOpen,
} from '../data/live';
import {
  clearViewingHistory,
  loadLibraryHistory,
  loadLibrarySaved,
  recordViewerExit,
} from '../data/library';
import {
  loadBotOwnerStats,
  loadCreatorContent,
  loadCreatorMetrics,
  loadNotifications,
  loadProfileHub,
  type BotOwnerStats,
  type CreatorContent,
  type CreatorMetrics,
  type HubData,
  type NotificationItem,
} from '../data/account';
import type { Page, Post } from '../types';
import BottomNav from '../components/BottomNav';
import AddChannelSheet from '../components/AddChannelSheet';
import Viewer from '../components/Viewer';
import HomePage from '../pages/HomePage';
import ExplorePage from '../pages/ExplorePage';
import SearchPage from '../pages/SearchPage';
import SavedPage from '../pages/SavedPage';
import ProfilePage from '../pages/ProfilePage';
import HistoryPage from '../pages/HistoryPage';
import CreatorPage from '../pages/CreatorPage';
import NotificationsPage from '../pages/NotificationsPage';
import InvitePage from '../pages/InvitePage';
import SupportPage from '../pages/SupportPage';
import AdsPage from '../pages/AdsPage';
import PersonalizationPage from '../pages/PersonalizationPage';
import '../styles/app.css';
import '../styles/live.css';
import '../styles/functional.css';

type FeedState = 'loading' | 'live' | 'fallback';
type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

const mergeSaved = (next: Post[], current: Post[]) => {
  const saved = new Set(current.filter((post) => post.saved).map((post) => post.id));
  return next.map((post) => ({ ...post, saved: post.saved || saved.has(post.id) }));
};

export default function DiscoveryApp() {
  const [page, setPage] = useState<Page>('home');
  const [tab, setTab] = useState('for-you');
  const [posts, setPosts] = useState<Post[]>(seedPosts);
  const [explorePosts, setExplorePosts] = useState<Post[]>(seedPosts);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [historyPosts, setHistoryPosts] = useState<Post[]>([]);
  const [viewer, setViewer] = useState<Post | null>(null);
  const viewerStarted = useRef(0);
  const [addOpen, setAddOpen] = useState(false);
  const [feedState, setFeedState] = useState<FeedState>('loading');
  const [exploreState, setExploreState] = useState<FeedState>('loading');
  const [savedState, setSavedState] = useState<LoadState>('idle');
  const [historyState, setHistoryState] = useState<LoadState>('idle');
  const [hub, setHub] = useState<HubData | null>(null);
  const [hubState, setHubState] = useState<LoadState>('idle');
  const [botStats, setBotStats] = useState<BotOwnerStats | null>(null);
  const [hubNonce, setHubNonce] = useState(0);
  const [feedNonce, setFeedNonce] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsState, setNotificationsState] = useState<LoadState>('idle');
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [creatorMetrics, setCreatorMetrics] = useState<CreatorMetrics | null>(null);
  const [creatorContent, setCreatorContent] = useState<CreatorContent[]>([]);
  const [creatorDays, setCreatorDays] = useState(30);
  const [creatorState, setCreatorState] = useState<LoadState>('idle');

  const liveChannels = useMemo(() => decorateChannels(channels), []);

  const findPost = (id: string) =>
    (viewer?.id === id ? viewer : undefined)
    || [...posts, ...explorePosts, ...savedPosts, ...historyPosts].find((post) => post.id === id);

  const finalizeViewer = () => {
    if (!viewer) return;
    const elapsed = viewerStarted.current ? Date.now() - viewerStarted.current : 0;
    void recordViewerExit(viewer, elapsed).catch(() => {});
    viewerStarted.current = 0;
  };

  const closeViewer = () => {
    finalizeViewer();
    setViewer(null);
  };

  const changePage = (next: Page) => {
    if (viewer) finalizeViewer();
    setViewer(null);
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const personalizationChanged = () => {
    setFeedNonce((value) => value + 1);
    setHubNonce((value) => value + 1);
  };

  useEffect(() => {
    const holder = window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } };
    holder.Telegram?.WebApp?.ready?.();
    holder.Telegram?.WebApp?.expand?.();
  }, []);

  useEffect(() => {
    const holder = window as unknown as {
      Telegram?: {
        WebApp?: {
          BackButton?: {
            show?: () => void;
            hide?: () => void;
            onClick?: (fn: () => void) => void;
            offClick?: (fn: () => void) => void;
          };
        };
      };
    };
    const back = holder.Telegram?.WebApp?.BackButton;
    if (!back) return;

    const subpage = ['creator', 'history', 'notifications', 'invite', 'support', 'ads', 'personalization'].includes(page);
    const handler = () => {
      if (viewer) closeViewer();
      else if (subpage) changePage('profile');
    };

    if (viewer || subpage) {
      back.show?.();
      back.onClick?.(handler);
    } else {
      back.hide?.();
    }

    return () => back.offClick?.(handler);
  }, [viewer, page]);

  useEffect(() => {
    const controller = new AbortController();
    setFeedState('loading');
    loadLivePosts(tab === 'hot' ? 'hot' : tab === 'fresh' ? 'fresh' : 'for-you', controller.signal)
      .then((next) => {
        setPosts((current) => mergeSaved(next, current));
        setFeedState('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) setFeedState('fallback');
      });
    return () => controller.abort();
  }, [tab, feedNonce]);

  useEffect(() => {
    if (page !== 'explore') return;
    const controller = new AbortController();
    setExploreState('loading');
    loadLivePosts('fresh', controller.signal)
      .then((next) => {
        setExplorePosts((current) => mergeSaved(next, current));
        setExploreState('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) setExploreState('fallback');
      });
    return () => controller.abort();
  }, [page]);

  useEffect(() => {
    if (page !== 'saved') return;
    const controller = new AbortController();
    setSavedState('loading');
    loadLibrarySaved(controller.signal)
      .then((next) => {
        setSavedPosts(next);
        setSavedState('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) setSavedState('fallback');
      });
    return () => controller.abort();
  }, [page]);

  useEffect(() => {
    if (page !== 'history') return;
    const controller = new AbortController();
    setHistoryState('loading');
    loadLibraryHistory(controller.signal)
      .then((next) => {
        setHistoryPosts(next);
        setHistoryState('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistoryState('fallback');
      });
    return () => controller.abort();
  }, [page]);

  useEffect(() => {
    if (!['notifications', 'profile'].includes(page)) return;
    const controller = new AbortController();
    setNotificationsState('loading');
    loadNotifications(controller.signal)
      .then((items) => {
        setNotifications(items);
        setNotificationsState('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) setNotificationsState('fallback');
      });
    return () => controller.abort();
  }, [page, hubNonce]);

  useEffect(() => {
    const needsHub = ['profile', 'creator', 'ads'].includes(page);
    if (!needsHub) return;

    const controller = new AbortController();
    setHubState('loading');
    Promise.all([
      loadProfileHub(controller.signal),
      loadBotOwnerStats(controller.signal).catch(() => null),
    ])
      .then(([nextHub, nextBot]) => {
        setHub(nextHub);
        setBotStats(nextBot);
        setHubState(nextHub.sourceLive ? 'live' : 'fallback');
        setSelectedCreatorId((current) =>
          current && nextHub.creators.some((item) => item.id === current)
            ? current
            : nextHub.creators[0]?.id || '',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setHubState('fallback');
      });
    return () => controller.abort();
  }, [page, hubNonce]);

  useEffect(() => {
    if (page !== 'creator' || !selectedCreatorId) return;
    const controller = new AbortController();
    setCreatorState('loading');
    Promise.all([
      loadCreatorMetrics(selectedCreatorId, creatorDays, controller.signal),
      loadCreatorContent(selectedCreatorId, creatorDays, controller.signal),
    ])
      .then(([metrics, content]) => {
        setCreatorMetrics(metrics);
        setCreatorContent(content);
        setCreatorState('live');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCreatorMetrics(null);
          setCreatorContent([]);
          setCreatorState('fallback');
        }
      });
    return () => controller.abort();
  }, [page, selectedCreatorId, creatorDays]);

  const applySaved = (id: string, value: boolean, target?: Post) => {
    const update = (current: Post[]) => current.map((post) => post.id === id ? { ...post, saved: value } : post);
    setPosts(update);
    setExplorePosts(update);
    setHistoryPosts(update);
    setSavedPosts((current) => {
      const mapped = current.map((post) => post.id === id ? { ...post, saved: value } : post);
      if (value && target && !mapped.some((post) => post.id === id)) {
        return [{ ...target, saved: true, savedAt: new Date().toISOString() }, ...mapped];
      }
      return value ? mapped : mapped.filter((post) => post.id !== id);
    });
    setViewer((current) => current?.id === id ? { ...current, saved: value } : current);
  };

  const toggleSave = (id: string) => {
    const target = findPost(id);
    if (!target) return;
    const before = Boolean(target.saved);
    const next = !before;
    applySaved(id, next, target);
    void persistSaved(target, next).catch(() => applySaved(id, before, target));
  };

  const openViewer = (post: Post) => {
    if (viewer && viewer.id !== post.id) finalizeViewer();
    const openedAt = new Date().toISOString();
    setViewer(post);
    viewerStarted.current = Date.now();
    setHistoryPosts((current) => {
      const without = current.filter((item) => item.id !== post.id);
      return [{ ...post, viewedAt: openedAt, historyEvent: 'open' }, ...without].slice(0, 100);
    });
    void trackPostOpen(post).catch(() => {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearHistory = async () => {
    await clearViewingHistory();
    setHistoryPosts([]);
    setHistoryState('live');
  };

  const feedbackPost = async (post: Post, type: string) => {
    await sendPostFeedback(post, type).catch(() => {});
    const remove = (current: Post[]) => current.filter((item) => item.id !== post.id);
    setPosts(remove);
    setExplorePosts(remove);
    setSavedPosts(remove);
    setHistoryPosts(remove);
    closeViewer();
  };

  const recordImpression = (post: Post, position: number, reason: string) => {
    void trackImpression(post, position, reason).catch(() => {});
  };

  const resolvedViewer = viewer
    ? posts.find((post) => post.id === viewer.id)
      || explorePosts.find((post) => post.id === viewer.id)
      || savedPosts.find((post) => post.id === viewer.id)
      || historyPosts.find((post) => post.id === viewer.id)
      || viewer
    : null;

  const localSaved = posts.filter((post) => post.saved);
  const savedDisplay = savedState === 'live' ? savedPosts : savedPosts.length ? savedPosts : localSaved;
  const notificationUnreadCount = notifications.filter((item) => item.unread).length;

  return (
    <main className="appShell">
      {resolvedViewer ? (
        <Viewer
          post={resolvedViewer}
          onClose={closeViewer}
          onToggleSave={toggleSave}
          onFeedback={feedbackPost}
          onOpenRelated={openViewer}
        />
      ) : (
        <>
          <div className="pageViewport">
            {page === 'home' && (
              <HomePage
                channels={liveChannels}
                posts={posts}
                tab={tab}
                state={feedState}
                onTab={setTab}
                onSearch={() => changePage('search')}
                onAdd={() => setAddOpen(true)}
                onOpen={openViewer}
                onToggleSave={toggleSave}
                onImpression={(post, position) => recordImpression(post, position, tab)}
              />
            )}
            {page === 'explore' && (
              <ExplorePage
                posts={explorePosts}
                state={exploreState}
                onOpen={openViewer}
                onImpression={(post, position) => recordImpression(post, position, 'explore')}
              />
            )}
            {page === 'search' && <SearchPage channels={liveChannels} onOpen={openViewer} />}
            {page === 'saved' && <SavedPage posts={savedDisplay} state={savedState} onOpen={openViewer} onToggleSave={toggleSave} />}
            {page === 'profile' && (
              <ProfilePage
                hub={hub}
                botStats={botStats}
                state={hubState}
                notificationUnreadCount={notificationsState === 'live' ? notificationUnreadCount : undefined}
                onCreator={() => changePage('creator')}
                onSaved={() => changePage('saved')}
                onHistory={() => changePage('history')}
                onNotifications={() => changePage('notifications')}
                onInvite={() => changePage('invite')}
                onSupport={() => changePage('support')}
                onAds={() => changePage('ads')}
                onPersonalization={() => changePage('personalization')}
                onRefresh={() => setHubNonce((value) => value + 1)}
              />
            )}
            {page === 'history' && (
              <HistoryPage
                posts={historyPosts}
                state={historyState}
                onBack={() => changePage('profile')}
                onOpen={openViewer}
                onToggleSave={toggleSave}
                onClear={clearHistory}
              />
            )}
            {page === 'notifications' && (
              <NotificationsPage
                items={notifications}
                state={notificationsState}
                onBack={() => changePage('profile')}
                onChange={setNotifications}
                onRefresh={() => setHubNonce((value) => value + 1)}
              />
            )}
            {page === 'creator' && (
              <CreatorPage
                channels={hub?.creators || []}
                selectedId={selectedCreatorId}
                metrics={creatorMetrics}
                content={creatorContent}
                state={creatorState}
                needsTelegram={hub?.needsTelegram ?? true}
                days={creatorDays}
                onDays={setCreatorDays}
                onSelect={setSelectedCreatorId}
                onClaimed={() => setHubNonce((value) => value + 1)}
                onBack={() => changePage('profile')}
              />
            )}
            {page === 'invite' && <InvitePage onBack={() => changePage('profile')} />}
            {page === 'support' && <SupportPage onBack={() => changePage('profile')} />}
            {page === 'ads' && (
              <AdsPage
                channels={hub?.creators || []}
                needsTelegram={hub?.needsTelegram ?? true}
                owner={Boolean(botStats)}
                onBack={() => changePage('profile')}
              />
            )}
            {page === 'personalization' && (
              <PersonalizationPage
                onBack={() => changePage('profile')}
                onChanged={personalizationChanged}
              />
            )}
          </div>
          <BottomNav page={page} onChange={changePage} />
        </>
      )}
      <AddChannelSheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => setHubNonce((value) => value + 1)} />
    </main>
  );
}
