import { useEffect, useState } from 'react';
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

type Props = {
  channel: CreatorChannel | undefined;
  needsTelegram: boolean;
};

export default function CreatorPromoKit({ channel, needsTelegram }: Props) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'link' | 'text' | ''>('');
  const [error, setError] = useState('');

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

  if (!channel) return null;

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

      <div className="creatorPromoIdentity">
        <b>{channel.title}</b>
        <span>{channel.username ? `@${channel.username.replace(/^@/, '')}` : 'Telegram channel'}</span>
      </div>

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
        این ابزار پیام خودکار به افراد ناشناس نمی‌فرستد؛ لینک را در کانال‌ها، گروه‌ها
        یا همکاری‌هایی که خودت مجاز به انتشار در آن‌ها هستی استفاده کن.
      </div>

      {needsTelegram && (
        <div className="creatorPromoError">ساخت لینک فقط داخل Telegram Mini App فعال است.</div>
      )}
      {error && <div className="creatorPromoError">{error}</div>}
    </section>
  );
}
