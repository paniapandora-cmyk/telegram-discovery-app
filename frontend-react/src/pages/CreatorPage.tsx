import {
  ArrowRight,
  BarChart3,
  Eye,
  Users,
  ExternalLink,
  MousePointerClick,
  UserPlus,
  UserMinus,
  Bookmark,
  PlayCircle,
  ShieldCheck,
  Bot,
  Activity,
  TrendingUp,
  Link2,
  AtSign,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  claimCreatorOwnership,
  type CreatorChannel,
  type CreatorContent,
  type CreatorMetrics,
} from '../data/account';
import '../styles/creator-center-v5.css';
import '../styles/creator-tracking-v7.css';

type LoadState = 'idle' | 'loading' | 'live' | 'fallback';

type Props = {
  channels: CreatorChannel[];
  selectedId: string;
  metrics: CreatorMetrics | null;
  content: CreatorContent[];
  state: LoadState;
  needsTelegram: boolean;
  days: number;
  onDays: (days: number) => void;
  onSelect: (id: string) => void;
  onClaimed: () => void;
  onBack: () => void;
};

const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

const pct = (value: number) => {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${fa.format(normalized)}٪`;
};

export default function CreatorPage({
  channels,
  selectedId,
  metrics,
  content,
  state,
  needsTelegram,
  days,
  onDays,
  onSelect,
  onClaimed,
  onBack,
}: Props) {
  const [claimUsername, setClaimUsername] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimNotice, setClaimNotice] = useState<{
    kind: 'success' | 'pending' | 'error';
    text: string;
  } | null>(null);
  const selected = channels.find((channel) => channel.id === selectedId);
  const channelCount = fa.format(channels.length);

  const submitClaim = async () => {
    if (claimBusy) return;

    if (!claimUsername.trim()) {
      setClaimNotice({
        kind: 'error',
        text: 'نام کاربری یا لینک عمومی کانال را وارد کن.',
      });
      return;
    }

    setClaimBusy(true);
    setClaimNotice(null);

    try {
      const result = await claimCreatorOwnership(claimUsername);

      if (result.status === 'approved') {
        setClaimUsername('');
        setClaimNotice({
          kind: 'success',
          text: result.botAdmin
            ? 'مالکیت تأیید شد و کانال به Creator Center اضافه شد.'
            : 'مالکیت تأیید شد؛ برای ردیابی عضویت، ربات را ادمین کانال کن.',
        });
      } else {
        setClaimNotice({
          kind: 'pending',
          text: 'درخواست مالکیت ثبت شد و در انتظار تأیید است.',
        });
      }

      onClaimed();
    } catch (cause) {
      setClaimNotice({
        kind: 'error',
        text:
          cause instanceof Error
            ? cause.message
            : 'ثبت مالکیت انجام نشد. دوباره تلاش کن.',
      });
    } finally {
      setClaimBusy(false);
    }
  };

  return (
    <div className="page creatorPageV5">
      <header className="pageHeader subPageHeader creatorHeaderV5">
        <div>
          <h1>Creator Center</h1>
          <p>رشد، عضویت و عملکرد کانال‌ها</p>

          <div className="creatorHeaderStatusV5">
            <span className={`liveBadge ${state}`}>
              {state === 'live'
                ? 'داده زنده'
                : state === 'loading'
                  ? 'در حال دریافت…'
                  : needsTelegram
                    ? 'نیاز به تلگرام'
                    : 'در دسترس نیست'}
            </span>

            <span className="creatorCountV5">{channelCount} کانال</span>
          </div>
        </div>

        <button onClick={onBack} aria-label="بازگشت">
          <ArrowRight />
        </button>
      </header>

      <section className="creatorClaimV13 surface">
        <div className="creatorClaimHeadV13">
          <div className="creatorClaimIconV13">
            <ShieldCheck />
          </div>

          <div>
            <h2>ثبت مالکیت کانال</h2>
            <p>
              اگر مالک یا ادمین کانال هستی، نام کاربری آن را وارد کن تا به
              Creator Center اضافه شود.
            </p>
          </div>
        </div>

        <div className="creatorClaimFormV13">
          <label>
            <AtSign />
            <input
              dir="ltr"
              value={claimUsername}
              onChange={(event) => setClaimUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitClaim();
              }}
              placeholder="username یا t.me/username"
              aria-label="نام کاربری کانال"
              disabled={claimBusy || needsTelegram}
            />
          </label>

          <button
            type="button"
            onClick={() => void submitClaim()}
            disabled={claimBusy || needsTelegram}
          >
            {claimBusy ? <LoaderCircle className="spin" /> : <ShieldCheck />}
            {claimBusy ? 'در حال بررسی…' : 'ثبت مالکیت'}
          </button>
        </div>

        {needsTelegram ? (
          <div className="creatorClaimNoticeV13 pending">
            <AlertCircle />
            ثبت مالکیت فقط داخل مینی‌اپ تلگرام انجام می‌شود.
          </div>
        ) : claimNotice ? (
          <div className={`creatorClaimNoticeV13 ${claimNotice.kind}`}>
            {claimNotice.kind === 'success' ? (
              <CheckCircle2 />
            ) : (
              <AlertCircle />
            )}
            {claimNotice.text}
          </div>
        ) : (
          <p className="creatorClaimHintV13">
            برای تأیید فوری، ربات باید ادمین کانال باشد؛ در غیر این صورت
            درخواست مالکیت برای بررسی ثبت می‌شود.
          </p>
        )}
      </section>

      {channels.length ? (
        <>
          <section className="creatorChannelPickerV5 surface">
            <div className="creatorPickerTitleV5">
              <div>
                <h2>کانال‌های من</h2>
                <p>برای دیدن آمار، یک کانال را انتخاب کن</p>
              </div>
              <Activity />
            </div>

            <div className="creatorChannelRailV5">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  className={channel.id === selectedId ? 'active' : ''}
                  onClick={() => onSelect(channel.id)}
                >
                  <span className="creatorChannelInitialV5">
                    {(channel.title || channel.username || 'T')
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>

                  <span className="creatorChannelCopyV5">
                    <strong>{channel.title}</strong>
                    <small>
                      {channel.username
                        ? `@${channel.username.replace(/^@/, '')}`
                        : 'Telegram channel'}
                    </small>
                  </span>

                  <span className="creatorChannelBadgesV5">
                    {channel.verified && <ShieldCheck aria-label="تأیید مالکیت" />}
                    {channel.botAdmin && <Bot aria-label="Bot Admin" />}
                  </span>
                </button>
              ))}
            </div>

            <div className="creatorToolbarBottom creatorToolbarBottomV5">
              <div className="creatorFlags">
                {selected?.verified && <span>تأیید مالکیت</span>}
                {selected?.botAdmin && <span>Bot Admin</span>}
                {selected && !selected.verified && !selected.botAdmin && (
                  <span className="neutralFlagV5">متصل به Creator API</span>
                )}
              </div>

              <div className="periodSwitch">
                {[7, 30].map((value) => (
                  <button
                    key={value}
                    className={days === value ? 'active' : ''}
                    onClick={() => onDays(value)}
                  >
                    {fa.format(value)} روز
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="creatorTrackingV7 surface">
            <div className="creatorTrackingCopyV7">
              <div className="creatorTrackingIconV7">
                <Link2 />
              </div>

              <div>
                <h2>ردیابی عضویت</h2>
                <p>
                  {selected?.botAdmin
                    ? 'فعال است؛ دکمه‌های ورود کانال در کشف به‌صورت خودکار لینک دعوت قابل ردیابی می‌سازند.'
                    : 'برای ثبت Join واقعی، ربات باید در این کانال Bot Admin باشد.'}
                </p>
              </div>
            </div>

            {selected?.botAdmin ? (
              <div className="creatorTrackingMessageV7">
                ردیابی خودکار فعال است — نیازی به ساخت Tracking Link دستی نیست.
              </div>
            ) : selected ? (
              <div className="creatorTrackingWarningV7">
                مالکیت تأیید شده است، اما Bot Admin فعال نیست؛ بنابراین
                Telegram Join / Active Join / Leave قابل انتساب نیست.
              </div>
            ) : null}
          </section>

          {state === 'loading' && !metrics ? (
            <div className="creatorSkeleton">
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : metrics ? (
            <>
              <section className="creatorSummaryV5">
                <article>
                  <div>
                    <Eye />
                    <small>بازدید</small>
                  </div>
                  <strong>{fa.format(metrics.views)}</strong>
                  <span>{fa.format(days)} روز اخیر</span>
                </article>

                <article>
                  <div>
                    <UserPlus />
                    <small>عضویت تلگرام</small>
                  </div>
                  <strong>{fa.format(metrics.telegramJoins)}</strong>
                  <span>{fa.format(metrics.activeJoins)} فعال</span>
                </article>

                <article className="creatorSummaryAccentV5">
                  <div>
                    <TrendingUp />
                    <small>نرخ تبدیل</small>
                  </div>
                  <strong>{pct(metrics.joinConversion)}</strong>
                  <span>از کلیک تا عضویت</span>
                </article>
              </section>

              <div className="creatorMetricSectionLabelV5">
                <span>قیف رشد</span>
                <BarChart3 />
              </div>

              <section className="creatorMetrics creatorMetricsV5">
                <article>
                  <Eye />
                  <small>بازدید</small>
                  <strong>{fa.format(metrics.views)}</strong>
                </article>
                <article>
                  <Users />
                  <small>کاربر یکتا</small>
                  <strong>{fa.format(metrics.uniqueViewers)}</strong>
                </article>
                <article>
                  <ExternalLink />
                  <small>باز شدن تلگرام</small>
                  <strong>{fa.format(metrics.telegramOpens)}</strong>
                </article>
                <article>
                  <MousePointerClick />
                  <small>کلیک عضویت</small>
                  <strong>{fa.format(metrics.joinClicks)}</strong>
                </article>
                <article>
                  <UserPlus />
                  <small>عضویت تلگرام</small>
                  <strong>{fa.format(metrics.telegramJoins)}</strong>
                </article>
                <article>
                  <Users />
                  <small>عضویت فعال</small>
                  <strong>{fa.format(metrics.activeJoins)}</strong>
                </article>
                <article>
                  <UserMinus />
                  <small>خروج</small>
                  <strong>{fa.format(metrics.leaves)}</strong>
                </article>
                <article>
                  <Bookmark />
                  <small>ذخیره</small>
                  <strong>{fa.format(metrics.saves)}</strong>
                </article>
                <article>
                  <PlayCircle />
                  <small>شروع ربات</small>
                  <strong>{fa.format(metrics.botStarts)}</strong>
                </article>
                <article>
                  <BarChart3 />
                  <small>CTR</small>
                  <strong>{pct(metrics.ctr)}</strong>
                </article>
              </section>

              <section className="creatorContent surface creatorContentV5">
                <div className="creatorContentHead">
                  <div>
                    <h2>عملکرد محتوا</h2>
                    <span>
                      {fa.format(content.length)} پست · {fa.format(days)} روز
                    </span>
                  </div>
                  <Activity />
                </div>

                {content.length ? (
                  <div className="creatorContentList creatorContentListV5">
                    {content.map((item, index) => (
                      <article key={item.id}>
                        <div className="creatorContentRankV5">
                          {fa.format(index + 1)}
                        </div>

                        <div className="creatorContentMainV5">
                          <div className="creatorContentTitle">
                            <b>{item.title}</b>
                            <span>تبدیل {pct(item.conversion)}</span>
                          </div>

                          <div className="creatorContentStats">
                            <span>
                              ویو <b>{fa.format(item.views)}</b>
                            </span>
                            <span>
                              بازشدن <b>{fa.format(item.opens)}</b>
                            </span>
                            <span>
                              کلیک <b>{fa.format(item.clicks)}</b>
                            </span>
                            <span>
                              عضویت <b>{fa.format(item.joins)}</b>
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="inlineEmpty">
                    برای این بازه، داده عملکرد محتوا برنگشت.
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="emptyState">
              <BarChart3 />
              <h2>آمار این کانال دریافت نشد</h2>
              <p>
                کانال در فهرست مالک نمایش داده می‌شود، اما برای این بازه هنوز
                داده تحلیلی قابل نمایش برنگشته است.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="emptyState">
          <BarChart3 />
          <h2>
            {needsTelegram
              ? 'Creator Center داخل تلگرام فعال می‌شود'
              : 'کانال مالکیتی پیدا نشد'}
          </h2>
          <p>
            {needsTelegram
              ? 'این بخش به Telegram initData نیاز دارد تا فقط کانال‌های متعلق به همان مالک نمایش داده شوند.'
              : 'بعد از اتصال کانال به Creator API، آمار رشد و عضویت اینجا نمایش داده می‌شود.'}
          </p>
        </div>
      )}
    </div>
  );
}
