import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Megaphone } from 'lucide-react';
import {
  loadCreatorContent,
  type CreatorChannel,
  type CreatorContent,
} from '../data/account';
import CreatorAdsCard from './CreatorAdsCard';
import '../styles/ads-v1.css';
import '../styles/creator-ads-launcher.css';

type Props = {
  channels: CreatorChannel[];
  needsTelegram: boolean;
};

export default function CreatorAdsLauncher({ channels, needsTelegram }: Props) {
  const [channelId, setChannelId] = useState(channels[0]?.id || '');
  const [content, setContent] = useState<CreatorContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setChannelId((current) =>
      current && channels.some((item) => item.id === current)
        ? current
        : channels[0]?.id || '',
    );
  }, [channels]);

  const channel = useMemo(
    () => channels.find((item) => item.id === channelId),
    [channels, channelId],
  );

  useEffect(() => {
    if (!channel || needsTelegram) {
      setContent([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    void loadCreatorContent(channel.id, 30, controller.signal)
      .then(setContent)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setContent([]);
          setError(
            cause instanceof Error
              ? cause.message
              : 'پست‌های کانال برای تبلیغ دریافت نشد.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [channel?.id, needsTelegram]);

  if (!channels.length) return null;

  return (
    <div className="creatorAdsLauncher">
      {channels.length > 1 && (
        <section className="creatorAdsChannelSelect surface">
          <div>
            <Megaphone />
            <span>کانال تبلیغ‌دهنده</span>
          </div>
          <select
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            disabled={loading}
          >
            {channels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || item.username}
              </option>
            ))}
          </select>
        </section>
      )}

      {loading ? (
        <div className="adsEmpty"><LoaderCircle className="spin" /> در حال دریافت پست‌های کانال…</div>
      ) : error ? (
        <div className="adsNotice error">{error}</div>
      ) : (
        <CreatorAdsCard
          channel={channel}
          content={content}
          needsTelegram={needsTelegram}
        />
      )}
    </div>
  );
}
