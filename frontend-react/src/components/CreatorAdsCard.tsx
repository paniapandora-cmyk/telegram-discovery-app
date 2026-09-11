import { useEffect, useMemo, useState } from 'react';
import { BarChart3, LoaderCircle, Megaphone, RefreshCw, Send } from 'lucide-react';
import type { CreatorChannel, CreatorContent } from '../data/account';
import {
  createCreatorAd,
  loadCreatorAds,
  type AdCampaign,
  type AdPricingModel,
} from '../data/ads';
import '../styles/ads-v1.css';

type Props = {
  channel: CreatorChannel | undefined;
  content: CreatorContent[];
  needsTelegram: boolean;
};

const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

const statusLabel: Record<string, string> = {
  SUBMITTED: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  ACTIVE: 'فعال',
  PAUSED: 'متوقف',
  REJECTED: 'ردشده',
  COMPLETED: 'تمام‌شده',
};

export default function CreatorAdsCard({ channel, content, needsTelegram }: Props) {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [contentId, setContentId] = useState(content[0]?.id || '');
  const [pricing, setPricing] = useState<AdPricingModel>('CPA_JOIN');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!content.some((item) => item.id === contentId)) setContentId(content[0]?.id || '');
  }, [content, contentId]);

  const mine = useMemo(
    () => campaigns.filter((item) => !channel || item.creator_channel_id === channel.id),
    [campaigns, channel],
  );

  const load = async () => {
    if (needsTelegram) return;
    setLoading(true);
    try {
      const data = await loadCreatorAds();
      setCampaigns(data.campaigns || []);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'دریافت کمپین‌ها انجام نشد.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [needsTelegram]);

  const submit = async () => {
    if (!channel || !contentId || busy || needsTelegram) return;
    setBusy(true);
    setNotice('');
    try {
      await createCreatorAd({
        creatorChannelId: channel.id,
        contentId,
        pricingModel: pricing,
      });
      setNotice('درخواست تبلیغ ثبت شد؛ بعد از تأیید مالک «کشف» وارد اکسپلور می‌شود.');
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'ثبت درخواست تبلیغ انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  if (!channel) return null;

  return (
    <section className="creatorAdsCard surface">
      <div className="adsHead">
        <span><Megaphone /></span>
        <div>
          <h2>تبلیغ در کشف</h2>
          <p>یک پست را برای نمایش Sponsored در اکسپلور بفرست؛ نمایش، کلیک و Join واقعی جداگانه اندازه‌گیری می‌شود.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="به‌روزرسانی">
          <RefreshCw className={loading ? 'spin' : ''} />
        </button>
      </div>

      {content.length ? (
        <div className="adsForm">
          <label>
            <span>پست تبلیغاتی</span>
            <select value={contentId} onChange={(event) => setContentId(event.target.value)} disabled={busy}>
              {content.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>

          <label>
            <span>مدل پیشنهادی</span>
            <select value={pricing} onChange={(event) => setPricing(event.target.value as AdPricingModel)} disabled={busy}>
              <option value="CPA_JOIN">به‌ازای عضو واقعی</option>
              <option value="CPC">به‌ازای کلیک</option>
              <option value="CPM">به‌ازای ۱۰۰۰ نمایش</option>
              <option value="TEST">تست داخلی</option>
            </select>
          </label>

          <button className="adsPrimary" type="button" onClick={() => void submit()} disabled={busy || needsTelegram || !contentId}>
            {busy ? <LoaderCircle className="spin" /> : <Send />}
            {busy ? 'در حال ثبت…' : 'ارسال درخواست تبلیغ'}
          </button>
        </div>
      ) : (
        <div className="adsEmpty">برای این کانال هنوز پستی برای تبلیغ قابل انتخاب نیست.</div>
      )}

      <div className="adsPolicy">پرداخت واقعی هنوز فعال نیست؛ این مرحله برای ساخت قیف تبلیغ، Attribution و محاسبه درآمد آزمایشی است.</div>
      {notice && <div className="adsNotice">{notice}</div>}

      {mine.length > 0 && (
        <div className="adsCampaignList">
          <b><BarChart3 /> کمپین‌های این کانال</b>
          {mine.slice(0, 5).map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>{statusLabel[item.status] || item.status} · {item.pricing_model}</small>
              </div>
              <div className="adsMiniMetrics">
                <span>{fa.format(item.metrics.impressions)} نمایش</span>
                <span>{fa.format(item.metrics.clicks)} کلیک</span>
                <span>{fa.format(item.metrics.joins)} عضو</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
