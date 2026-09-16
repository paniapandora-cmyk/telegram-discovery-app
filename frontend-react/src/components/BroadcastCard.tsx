import { useEffect, useState } from 'react';
import { Megaphone, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import {
  loadBroadcastStatus,
  previewBroadcast,
  sendBroadcast,
  type BroadcastPreview,
  type BroadcastResult,
} from '../data/broadcast';

const fa = new Intl.NumberFormat('fa-IR');

export default function BroadcastCard() {
  const [eligible, setEligible] = useState(0);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const status = await loadBroadcastStatus();
      setEligible(status.eligible_recipients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت وضعیت کمپین');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const makePreview = async () => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const next = await previewBroadcast(text);
      setPreview(next);
      setEligible(next.eligible_recipients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در پیش‌نمایش کمپین');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = message.trim();
    if (!preview || !text || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await sendBroadcast(text);
      setResult(next);
      setPreview(null);
      setEligible(next.eligible_recipients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال کمپین ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="broadcastCard surface">
      <div className="broadcastHead">
        <div>
          <span className="broadcastIcon">
            <Megaphone />
          </span>
          <div>
            <h3>کمپین پیام ربات</h3>
            <p>فقط برای کسانی که «دریافت پیشنهادها» را خودشان فعال کرده‌اند.</p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy}>
          <RefreshCw className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="broadcastPolicy">
        <ShieldCheck />
        <span>
          مخاطب مجاز فعلی: <b>{fa.format(eligible)}</b> نفر · سقف هر کمپین ۵۰۰ نفر
        </span>
      </div>

      <textarea
        value={message}
        onChange={(event) => {
          setMessage(event.target.value.slice(0, 2000));
          setPreview(null);
          setResult(null);
        }}
        maxLength={2000}
        placeholder="متن پیام کمپین…"
      />
      <div className="broadcastCounter">{fa.format(message.length)} / ۲۰۰۰</div>

      {error && <div className="growthError">{error}</div>}

      {preview && (
        <div className="broadcastPreview">
          <b>پیش‌نمایش نهایی</b>
          <p>{preview.preview}</p>
          <small>
            این پیام فقط برای {fa.format(preview.eligible_recipients)} مخاطب رضایت‌داده ارسال می‌شود.
          </small>
        </div>
      )}

      {result && (
        <div className="broadcastResult">
          کمپین ثبت شد: {fa.format(result.sent)} ارسال موفق · {fa.format(result.failed)} ناموفق
        </div>
      )}

      {!preview ? (
        <button
          className="broadcastPrimary"
          type="button"
          onClick={() => void makePreview()}
          disabled={!message.trim() || busy || loading}
        >
          <Megaphone />
          {busy ? 'در حال بررسی…' : 'پیش‌نمایش کمپین'}
        </button>
      ) : (
        <div className="broadcastConfirmRow">
          <button
            type="button"
            onClick={() => setPreview(null)}
            disabled={busy}
          >
            ویرایش
          </button>
          <button
            className="broadcastSend"
            type="button"
            onClick={() => void send()}
            disabled={busy || preview.eligible_recipients === 0}
          >
            <Send />
            {busy
              ? 'در حال ارسال…'
              : `ارسال به ${fa.format(preview.eligible_recipients)} نفر`}
          </button>
        </div>
      )}
    </section>
  );
}
