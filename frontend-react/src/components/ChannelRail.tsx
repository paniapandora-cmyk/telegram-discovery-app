import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { loadRecommendedChannels } from '../data/channels';
import { openTrackedChannel } from '../data/tracking';
import type { Channel } from '../types';

type Props = {
  channels: Channel[];
  onOpenChannel?: (channel: Channel) => void;
};

const CHANNEL_REFRESH_MS = 90_000;

export default function ChannelRail({ channels, onOpenChannel }: Props) {
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let inFlight = false;

    const refresh = async () => {
      if (!active || inFlight) return;
      inFlight = true;

      try {
        const next = await loadRecommendedChannels(controller.signal);
        if (active && next.length) setLiveChannels(next);
      } catch {
        // Keep the last known healthy rail instead of flashing demo channels.
      } finally {
        inFlight = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), CHANNEL_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const visibleChannels = useMemo(
    () => (liveChannels.length ? liveChannels : channels),
    [liveChannels, channels],
  );

  const openProfile = (channel: Channel) => {
    if (onOpenChannel && channel.creatorId) onOpenChannel(channel);
    else void openTrackedChannel(channel);
  };

  return (
    <section className="surface channelSection" aria-labelledby="recommended-channels-title">
      <div className="sectionTitle">
        <h2 id="recommended-channels-title">کانال‌های پیشنهادی</h2>
        <small>{new Intl.NumberFormat('fa-IR').format(visibleChannels.length)} کانال</small>
      </div>

      <div className="channelRail" role="list" aria-label="کانال‌های پیشنهادی">
        {visibleChannels.map((channel) => (
          <article className="channelCard" key={channel.id} role="listitem">
            <button type="button" className="channelCardProfileV14" onClick={() => openProfile(channel)} aria-label={`صفحه ${channel.title}`}>
              <div className={`channelAvatar ${channel.accent}`}>
                <span>{channel.initials}</span>
                {channel.avatarUrl && (
                  <img src={channel.avatarUrl} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />
                )}
              </div>
              <strong title={channel.title}>{channel.title}</strong>
              <small title={channel.username}>{channel.username}</small>
            </button>

            <div className="channelCardActionsV14">
              <button type="button" className="followBtn" onClick={() => openProfile(channel)}>
                {channel.creatorId ? 'مشاهده' : 'باز کردن'}
              </button>
              {channel.creatorId && channel.username && (
                <button type="button" className="channelTelegramMiniV14" onClick={() => void openTrackedChannel(channel)} aria-label={`باز کردن ${channel.title} در تلگرام`}>
                  <ExternalLink />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
