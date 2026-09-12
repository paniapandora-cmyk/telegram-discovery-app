import { useEffect, useMemo, useState } from 'react';
import { loadRecommendedChannels } from '../data/channels';
import { openTrackedChannel } from '../data/tracking';
import type { Channel } from '../types';

type Props = {
  channels: Channel[];
};

export default function ChannelRail({ channels }: Props) {
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    loadRecommendedChannels(controller.signal)
      .then((next) => {
        if (next.length) setLiveChannels(next);
      })
      .catch(() => {
        // Keep the existing fallback list if the live channel endpoint is unavailable.
      });

    return () => controller.abort();
  }, []);

  const visibleChannels = useMemo(
    () => (liveChannels.length ? liveChannels : channels),
    [liveChannels, channels],
  );

  return (
    <section className="surface channelSection" aria-labelledby="recommended-channels-title">
      <div className="sectionTitle">
        <h2 id="recommended-channels-title">کانال‌های پیشنهادی</h2>
        <small>{new Intl.NumberFormat('fa-IR').format(visibleChannels.length)} کانال</small>
      </div>

      <div className="channelRail" role="list" aria-label="کانال‌های پیشنهادی">
        {visibleChannels.map((channel) => (
          <article className="channelCard" key={channel.id} role="listitem">
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

            <strong title={channel.title}>{channel.title}</strong>
            <small title={channel.username}>{channel.username}</small>

            <button
              type="button"
              className="followBtn"
              onClick={() => void openTrackedChannel(channel)}
              disabled={!channel.username}
              aria-label={`باز کردن ${channel.title} در تلگرام`}
            >
              باز کردن
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
