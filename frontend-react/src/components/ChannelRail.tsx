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
    <section className="surface channelSection">
      <div className="sectionTitle">
        <h2>کانال‌های پیشنهادی</h2>
      </div>

      <div className="channelRail">
        {visibleChannels.map((channel) => (
          <article className="channelCard" key={channel.id}>
            <div className={`channelAvatar ${channel.accent}`}>
              <span>{channel.initials}</span>
              {channel.avatarUrl && (
                <img
                  src={channel.avatarUrl}
                  alt=""
                  loading="lazy"
                  onError={(event) => event.currentTarget.remove()}
                />
              )}
            </div>

            <strong>{channel.title}</strong>
            <small>{channel.username}</small>

            <button
              className="followBtn"
              onClick={() => void openTrackedChannel(channel)}
              disabled={!channel.username}
            >
              باز کردن
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
