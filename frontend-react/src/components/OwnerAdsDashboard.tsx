import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleDollarSign,
  Eye,
  LoaderCircle,
  MousePointerClick,
  Pause,
  Play,
  RefreshCw,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  loadOwnerAds,
  setOwnerAdStatus,
  type AdCampaign,
} from '../data/ads';
import '../styles/ads-v1.css';

const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

const statusLabel: Record<string, string> = {
  SUBMITTED: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  ACTIVE: 'فعال',
  PAUSED: 'متوقف',
  REJECTED: 'ردشده',
  COMPLETED: 'تمام‌شده',
};

export default function OwnerAdsDashboard() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [totals, setTotals] = useState({ campaigns: 0, active: 0, impressions: 0, clicks: 0, joins: 0, active_joins: 0, estimated_revenue: 0 });
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadOwnerAds();
      setCampaigns(data.campaigns || []);
      if (data.totals) setTotals(data.totals);
      setRates((current) => {
        const next = { ...current };
        for (const item of data.campaigns || []) {
          if (next[item.id] === undefined) next[item.id] = String(item.unit_price || '');
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'دریافت داشبورد تبلیغات انجام نشد.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const pending = useMemo(
    () => campaigns.filter((item) => ['SUBMITTED', 'APPROVED'].includes(item.status)).length,
    [campaigns],
  );

  const changeStatus = async (
    campaign: AdCampaign,
    status: 'APPROVED' | 'ACTIVE' | 'PAUSED' | 'REJECTED',
  ) => {
    if (busyId) return;
    setBusyId(campaign.id);
    setError('');
    try {
      const rawRate = rates[campaign.id]?.trim();
      const unitPrice = rawRate ? Math.max(0, Number(rawRate)) : campaign.unit_price;
      await setOwnerAdStatus({
        promotionId: campaign.id,
        status,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        currency: campaign.currency || 'USD',
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تغییر وضعیت کمپین انجام نشد.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="ownerAdsDashboard surface">
      <div className="adsHead ownerAdsHead">
        <span><CircleDollarSign /></span>
        <div>
          <h2>Ads & Revenue</h2>
          <p>کنترل کمپین‌های Sponsored و درآمد برآوردی مالک کشف</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="به‌روزرسانی">
          <RefreshCw className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="ownerAdsTotals">
        <article><Eye /><small>نمایش</small><strong>{fa.format(totals.impressions)}</strong></article>
        <article><MousePointerClick /><small>کلیک</small><strong>{fa.format(totals.clicks)}</strong></article>
        <article><UserPlus /><small>عضو واقعی</small><strong>{fa.format(totals.joins)}</strong></article>
        <article><CircleDollarSign /><small>درآمد برآوردی</small><strong>{fa.format(totals.estimated_revenue)}</strong></article>
      </div>

      <div className="ownerAdsStatusLine">
        <span>{fa.format(totals.active)} کمپین فعال</span>
        <span>{fa.format(pending)} منتظر تصمیم</span>
        <span>Billing: آزمایشی</span>
      </div>

      {error && <div className="adsNotice error">{error}</div>}
      {loading && !campaigns.length ? (
        <div className="adsEmpty"><LoaderCircle className="spin" /> در حال دریافت کمپین‌ها…</div>
      ) : campaigns.length ? (
        <div className="ownerCampaignList">
          {campaigns.map((item) => (
            <article key={item.id}>
              <div className="ownerCampaignTop">
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.channel?.title || item.creator?.name || 'Creator'} · {statusLabel[item.status] || item.status}</small>
                </div>
                <span className={`adStatus ${item.status.toLowerCase()}`}>{item.pricing_model}</span>
              </div>

              <div className="adsMiniMetrics owner">
                <span>{fa.format(item.metrics.impressions)} نمایش</span>
                <span>{fa.format(item.metrics.clicks)} کلیک</span>
                <span>{fa.format(item.metrics.joins)} Join</span>
                <span>{fa.format(item.metrics.active_joins)} فعال</span>
                <span>{fa.format(item.metrics.leaves)} خروج</span>
              </div>

              <div className="ownerRateRow">
                <label>
                  <span>نرخ هر واحد</span>
                  <input
                    inputMode="decimal"
                    value={rates[item.id] ?? ''}
                    onChange={(event) => setRates((current) => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="0"
                    disabled={busyId === item.id}
                  />
                </label>
                <small>{item.currency || 'USD'} · پرداخت واقعی هنوز متصل نیست</small>
              </div>

              <div className="ownerAdActions">
                {['SUBMITTED', 'APPROVED', 'PAUSED'].includes(item.status) && (
                  <button type="button" className="activate" onClick={() => void changeStatus(item, 'ACTIVE')} disabled={Boolean(busyId)}>
                    {busyId === item.id ? <LoaderCircle className="spin" /> : <Play />}
                    فعال‌سازی
                  </button>
                )}
                {item.status === 'ACTIVE' && (
                  <button type="button" onClick={() => void changeStatus(item, 'PAUSED')} disabled={Boolean(busyId)}><Pause /> توقف</button>
                )}
                {item.status === 'SUBMITTED' && (
                  <button type="button" onClick={() => void changeStatus(item, 'APPROVED')} disabled={Boolean(busyId)}><CheckCircle2 /> تأیید</button>
                )}
                {!['REJECTED', 'COMPLETED'].includes(item.status) && item.status !== 'ACTIVE' && (
                  <button type="button" className="reject" onClick={() => void changeStatus(item, 'REJECTED')} disabled={Boolean(busyId)}><XCircle /> رد</button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="adsEmpty">هنوز درخواست تبلیغی ثبت نشده است.</div>
      )}

      <p className="ownerAdsFoot">درآمد این بخش فعلاً محاسباتی است. تا قبل از اتصال درگاه، هیچ مبلغی از Creator دریافت یا تسویه نمی‌شود.</p>
    </section>
  );
}
