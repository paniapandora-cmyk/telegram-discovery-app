import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Heart, Bookmark, Share2, ExternalLink, MoreHorizontal, Play, EyeOff } from 'lucide-react';
import { ORIGIN, openTelegramPost } from '../data/live';
import { shareDiscoveryPost } from '../data/growth';
import { recordPromotionEvent } from '../data/ads';
import { openTrackedChannel } from '../data/tracking';
import type { Post } from '../types';

type Props = { post: Post; onClose: () => void; onToggleSave: (id: string) => void; onFeedback: (post: Post, type: string) => Promise<void> };
const uniqueStrings = (values: Array<string | undefined>) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));

export default function Viewer({ post, onClose, onToggleSave, onFeedback }: Props) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const previewOrigin = typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev') ? window.location.origin : ORIGIN;
  const mediaCandidates = useMemo(() => {
    const localizedDirect = post.mediaUrl?.startsWith(`${ORIGIN}/api/`) ? `${previewOrigin}${post.mediaUrl.slice(ORIGIN.length)}` : post.mediaUrl;
    const telegramPreview = post.telegramUrl ? `${previewOrigin}/api/telegram/preview-image?url=${encodeURIComponent(post.telegramUrl)}` : undefined;
    return uniqueStrings([localizedDirect, telegramPreview]);
  }, [post.mediaUrl, post.telegramUrl, previewOrigin]);

  useEffect(() => { setMediaIndex(0); setMediaReady(false); setShowFeedback(false); setShareBusy(false); }, [post.id, post.mediaUrl, post.telegramUrl]);
  const activeMedia = mediaCandidates[mediaIndex];
  const mediaExhausted = mediaIndex >= mediaCandidates.length;
  const failCurrentMedia = () => { setMediaReady(false); if (mediaIndex + 1 < mediaCandidates.length) setMediaIndex((value) => value + 1); else setMediaIndex(mediaCandidates.length); };
  const kindLabel = post.kind === 'video' ? 'ویدیو' : post.kind === 'text' ? 'متنی' : 'تصویری';
  const hasTelegram = Boolean(post.telegramUrl);

  const notInterested = async () => { if (feedbackBusy) return; setFeedbackBusy(true); try { await onFeedback(post, 'not_interested'); } finally { setFeedbackBusy(false); } };
  const share = async () => { if (shareBusy) return; setShareBusy(true); try { await shareDiscoveryPost(post); } finally { setShareBusy(false); } };
  const toggleSave = () => { if (post.sponsored && post.promotionId) void recordPromotionEvent(post, 'save').catch(() => {}); onToggleSave(post.id); };

  return (
    <section className={`viewer viewer-${post.kind}`}>
      <header className="viewerTop">
        <button onClick={onClose} aria-label="بازگشت"><ArrowRight /></button>
        <strong>جزئیات پست</strong>
        <button onClick={() => setShowFeedback((value) => !value)} aria-label="بازخورد"><MoreHorizontal /></button>
      </header>

      <div className={['viewerMedia', `tone-${post.tone}`, mediaReady ? 'viewerHasMedia' : 'viewerNoMedia', activeMedia && !mediaReady && !mediaExhausted ? 'viewerMediaLoading' : ''].filter(Boolean).join(' ')}>
        {activeMedia && !mediaExhausted && <img key={activeMedia} src={activeMedia} alt="" decoding="async" onLoad={() => setMediaReady(true)} onError={failCurrentMedia} />}
        {!mediaReady && activeMedia && !mediaExhausted && <span className="viewerMediaShimmer" aria-hidden="true" />}
        <span className="categoryChip">{post.sponsored ? 'تبلیغ' : post.category}</span>
        {post.kind === 'video' && <span className="playBadge viewerPlay"><Play fill="currentColor" /></span>}
        {!mediaReady && <span className="textQuoteMark viewerQuote">“</span>}
        <h2>{post.title}</h2>
      </div>

      <div className="viewerMeta">
        {post.sponsored && <span className="viewerSponsoredBadge">Sponsored · حمایت‌شده</span>}
        <span>{kindLabel}</span><span>{post.date}</span><span>{post.category}</span>
      </div>

      <div className="viewerChannel">
        <div className={`viewerAvatar ${post.channel.accent}`}>
          <span>{post.channel.initials}</span>
          {post.channel.avatarUrl && <img src={post.channel.avatarUrl} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
        </div>
        <div><strong>{post.channel.title}</strong><small>{post.channel.username}</small></div>
        <button onClick={() => void openTrackedChannel(post.channel, post.contentId, post.creatorId, post.promotionId)} disabled={!post.channel.username}>مشاهده کانال</button>
      </div>

      <article className="viewerText">
        <p>{post.excerpt}</p>
        <div className="viewerActions">
          <span className="viewerStat"><Heart /><span>{post.likes}</span></span>
          <button className={post.saved ? 'saved' : ''} onClick={toggleSave} aria-pressed={post.saved}><Bookmark fill={post.saved ? 'currentColor' : 'none'} /><span>{post.saved ? 'ذخیره شد' : 'ذخیره'}</span></button>
          <button onClick={() => void share()} disabled={shareBusy}><Share2 /><span>{shareBusy ? 'آماده‌سازی…' : 'اشتراک'}</span></button>
        </div>
        {showFeedback && <div className="viewerFeedback"><button onClick={notInterested} disabled={feedbackBusy}><EyeOff />{feedbackBusy ? 'در حال ثبت…' : 'به من نشان نده'}</button><span>این بازخورد برای بهتر شدن پیشنهادهای بعدی استفاده می‌شود.</span></div>}
      </article>

      <button className="telegramCta" onClick={() => openTelegramPost(post)} disabled={!hasTelegram}><ExternalLink />{hasTelegram ? 'دیدن پست در تلگرام' : 'لینک تلگرام در دسترس نیست'}</button>
    </section>
  );
}
