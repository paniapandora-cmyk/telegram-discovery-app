import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  Megaphone,
  Share2,
} from 'lucide-react';
import type { CreatorChannel } from '../data/account';
import {
  createCreatorPromoLink,
  creatorPromoText,
  shareCreatorPromo,
} from '../data/creator-promo';
import '../styles/creator-promo.css';
import '../styles/creator-promo-select.css';

type Props = {
  channels: CreatorChannel[];
  needsTelegram: boolean;
};

export default function CreatorPromoKit({ channels, needsTelegram }: Props) {
  const [channelId, setChannelId] = useState(channels[0]?.id || '');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'link' | 'text' | ''>('');
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
    setUrl('');
    setCopied('');
    setError('');
  }, [channel?.id]);

  const build = async () => {
    if (!channel || busy || needsTelegram) return;
    setBusy(true);
    setError('');
    try {
      const result = await createCreatorPromoLink(channel);
      setUrl(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ساخت لینک انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (kind: 'link' | 'text') => {
    if (!channel || (kind === 'link' && !url)) return;
    const value = kind === 'link' ? url : `${creatorPromoText(channel)}${url ? `\n${url}` : ''}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('کپی خودکار ممکن نشد؛ از دکمه ارسال تلگرام استفاده کن.');
    }
  };

  if (!channels.length || !channel) return null;

  return (
    <section className="creatorPromoKit surface">
      <div className="creatorPromoHead">
        <span><Megaphone /></span>
        <div>
          <h2>کیت رشد کانال</h2>
          <p>
            یک لینک تبلیغاتی اختصاصی بساز؛ Startهای ورودی از این لینک جداگانه
            قابل ردیابی می‌شوند.
          </p>
        </div>
      </div>

      {channels.length > 1 ? (
        <label className="creatorPromoSelect">
          <span>کانال</span>
          <select
            value={channel.id}
            onChange={(event) => setChannelId(event.target.value)}
            disabled={busy}
          >
            {channels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || item.username}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="creatorPromoIdentity">
          <b>{channel.title}</b>
          <span>{channel.username ? `@${channel.username.replace(/^@/, '')}` : 'Telegram channel'}</span>
        </div>
      )}

      {!url ? (
        <button
          className="creatorPromoPrimary"
          type="button"
          onClick={() => void build()}
          disabled={busy || needsTelegram}
        >
          {busy ? <LoaderCircle className="spin" /> : <Link2 />}
          {busy ? 'در حال ساخت…' : 'ساخت لینک تبلیغاتی'}
        </button>
      ) : (
        <>
          <div className="creatorPromoLink" dir="ltr">
            <span>{url}</span>
            <button type="button" onClick={() => void copy('link')} aria-label="کپی لینک">
              {copied === 'link' ? <Check /> : <Copy />}
            </button>
          </div>

          <div className="creatorPromoActions">
            <button type="button" onClick={() => shareCreatorPromo(channel, url)}>
              <Share2 />
              ارسال در تلگرام
            </button>
            <button type="button" onClick={() => void copy('text')}>
              {copied === 'text' ? <Check /> : <Copy />}
              کپی متن تبلیغ
            </button>
          </div>
        </>
      )}

      <div className="creatorPromoNote">
        لینک را در کانال‌ها، گروه‌ها یا همکاری‌هایی که مجاز به انتشار در آن‌ها هستی
        استفاده کن؛ ورودی‌های همان لینک جداگانه قابل سنجش می‌مانند.
      </div>

      {needsTelegram && (
        <div className="creatorPromoError">ساخت لینک فقط داخل Telegram Mini App فعال است.</div>
      )}
      {error && <div className="creatorPromoError">{error}</div>}
    </section>
  );
}
