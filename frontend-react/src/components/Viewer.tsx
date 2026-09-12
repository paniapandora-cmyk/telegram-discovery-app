import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  ExternalLink,
  EyeOff,
  Heart,
  Layers3,
  MoreHorizontal,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  UserX,
} from 'lucide-react';
import { openTelegramPost } from '../data/live';
import { shareDiscoveryPost } from '../data/growth';
import { recordPromotionEvent } from '../data/ads';
import { openTrackedChannel } from '../data/tracking';
import { loadRelatedPosts } from '../data/library';
import { postMediaCandidates } from '../lib/postMedia';
import LibraryThumb from './LibraryThumb';
import type { Post } from '../types';

type Props = {
  post: Post;
  onClose: () => void;
  onToggleSave: (id: string) => void;
  onFeedback: (post: Post, type: string) => Promise<void>;
  onOpenRelated: (post: Post) => void;
};

export default function Viewer({
  post,
  onClose,
  onToggleSave,
  onFeedback,
  onOpenRelated,
}: Props) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState('');
  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [related, setRelated] = useState<Post[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState('');

  const mediaCandidates = useMemo(
    () => postMediaCandidates(post),
    [post.id, post.mediaUrl, post.telegramUrl],
  );

  const loadRelated = (signal?: AbortSignal) => {
    if (!post.contentId) {
      setRelated([]);
      setRelatedError('');
      setRelatedLoading(false);
      return Promise.resolve();
    }

    setRelatedLoading(true);
    setRelatedError('');
    return loadRelatedPosts(post, signal)
      .then((items) => setRelated(items))
      .catch((error) => {
        if (!signal?.aborted) {
          setRelated([]);
          setRelatedError(error instanceof Error ? error.message : 'پست‌های مرتبط دریافت نشد.');
        }
      })
      .finally(() => {
        if (!signal?.aborted) setRelatedLoading(false);
      });
  };

  useEffect(() => {
    setMediaIndex(0);
    setMediaReady(false);
    setShowFeedback(false);
    setShareBusy(false);
    setFeedbackBusy('');
    setRelated([]);
    const controller = new AbortController();
    void loadRelated(controller.signal);
    return () => controller.abort();
  }, [post.id, post.mediaUrl, post.telegramUrl, post.contentId]);

  const activeMedia = mediaCandidates[mediaIndex];
  const mediaExhausted = mediaIndex >= mediaCandidates.length;
  const failCurrentMedia = () => {
    setMediaReady(false);
    if (mediaIndex + 1 < mediaCandidates.length) setMediaIndex((value) => value + 1);
    else setMediaIndex(mediaCandidates.length);
  };
  const kindLabel = post.kind === 'video' ? 'ویدیو' : post.kind === 'text' ? 'متنی' : 'تصویری';
  const hasTelegram = Boolean(post.telegramUrl);

  const feedback = async (type: string) => {
    if (feedbackBusy) return;
    setFeedbackBusy(type);
    try {
      await onFeedback(post, type);
    } finally {
      setFeedbackBusy('');
    }
  };

  const share = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      await shareDiscoveryPost(post);
    } finally {
      setShareBusy(false);
    }
  };

  const toggleSave = () => {
    if (post.sponsored && post.promotionId) {
      void recordPromotionEvent(post, 'save').catch(() => {});
    }
    onToggleSave(post.id);
  };

  return (
    <section className={`viewer viewer-${post.kind} viewerV12`}>
      <header className="viewerTop viewerTopV12">
        <button type="button" onClick={onClose} aria-label="بازگشت"><ArrowRight /></button>
        <div>
          <strong>جزئیات پست</strong>
          <small>{post.channel.title}</small>
        </div>
        <button type="button" onClick={() => setShowFeedback((value) => !value)} aria-label="گزینه‌های بازخورد"><MoreHorizontal /></button>
      </header>

      {showFeedback && (
        <div className="viewerFeedbackMenuV12" role="menu">
          <button type="button" onClick={() => void feedback('not_interested')} disabled={Boolean(feedbackBusy)}>
            <EyeOff />
            <span><b>علاقه ندارم</b><small>پیشنهادهای مشابه کمتر شوند</small></span>
          </button>
          <button type="button" onClick={() => void feedback('not_relevant')} disabled={Boolean(feedbackBusy)}>
            <Layers3 />
            <span><b>مرتبط نیست</b><small>کیفیت پیشنهادها را بهتر می‌کند</small></span>
          </button>
          <button type="button" onClick={() => void feedback('hide_creator')} disabled={Boolean(feedbackBusy)}>
            <UserX />
            <span><b>این کانال را پنهان کن</b><small>محتوای این منبع دیگر پیشنهاد نشود</small></span>
          </button>
        </div>
      )}

      <div className={['viewerMedia', `tone-${post.tone}`, mediaReady ? 'viewerHasMedia' : 'viewerNoMedia', activeMedia && !mediaReady && !mediaExhausted ? 'viewerMediaLoading' : ''].filter(Boolean).join(' ')}>
        {activeMedia && !mediaExhausted && (
          <img key={activeMedia} src={activeMedia} alt="" decoding="async" onLoad={() => setMediaReady(true)} onError={failCurrentMedia} />
        )}
        {!mediaReady && activeMedia && !mediaExhausted && <span className="viewerMediaShimmer" aria-hidden="true" />}
        <span className="categoryChip">{post.sponsored ? 'تبلیغ' : post.category}</span>
        {post.kind === 'video' && <span className="playBadge viewerPlay"><Play fill="currentColor" /></span>}
        {!mediaReady && <span className="textQuoteMark viewerQuote">“</span>}
        <h2>{post.title}</h2>
      </div>

      <div className="viewerMeta viewerMetaV12">
        {post.sponsored && <span className="viewerSponsoredBadge">Sponsored · حمایت‌شده</span>}
        <span>{kindLabel}</span><span>{post.date}</span><span>{post.category}</span>
        {post.relatedReason && <span className="viewerRelatedOriginV12"><Sparkles /> {post.relatedReason}</span>}
      </div>

      <div className="viewerChannel viewerChannelV12">
        <div className={`viewerAvatar ${post.channel.accent}`}>
          <span>{post.channel.initials}</span>
          {post.channel.avatarUrl && <img src={post.channel.avatarUrl} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
        </div>
        <div><strong>{post.channel.title}</strong><small>{post.channel.username}</small></div>
        <button type="button" onClick={() => void openTrackedChannel(post.channel, post.contentId, post.creatorId, post.promotionId)} disabled={!post.channel.username}>مشاهده کانال</button>
      </div>

      <article className="viewerText viewerTextV12">
        <p>{post.excerpt}</p>
        <div className="viewerActions viewerActionsV12">
          <span className="viewerStat"><Heart /><span>{post.likes}</span></span>
          <button type="button" className={post.saved ? 'saved' : ''} onClick={toggleSave} aria-pressed={post.saved}>
            <Bookmark fill={post.saved ? 'currentColor' : 'none'} /><span>{post.saved ? 'ذخیره شد' : 'ذخیره'}</span>
          </button>
          <button type="button" onClick={() => void share()} disabled={shareBusy}>
            <Share2 /><span>{shareBusy ? 'آماده‌سازی…' : 'اشتراک'}</span>
          </button>
        </div>
      </article>

      <button className="telegramCta" type="button" onClick={() => openTelegramPost(post)} disabled={!hasTelegram}>
        <ExternalLink />{hasTelegram ? 'دیدن پست در تلگرام' : 'لینک تلگرام در دسترس نیست'}
      </button>

      <section className="relatedSectionV12" aria-label="پست‌های مرتبط">
        <div className="relatedHeadV12">
          <div>
            <span><Sparkles /></span>
            <div><h3>ادامه کشف</h3><p>پست‌های نزدیک به این محتوا، با توجه به موضوع و علایق تو</p></div>
          </div>
          {!relatedLoading && post.contentId && (
            <button type="button" onClick={() => void loadRelated()} aria-label="به‌روزرسانی پست‌های مرتبط"><RefreshCw /></button>
          )}
        </div>

        {relatedLoading ? (
          <div className="relatedSkeletonV12"><span /><span /><span /></div>
        ) : related.length ? (
          <div className="relatedRailV12">
            {related.map((item) => (
              <article
                key={item.id}
                className="relatedCardV12"
                onClick={() => onOpenRelated(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenRelated(item);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <LibraryThumb post={item} className="relatedThumbV12" showKind={false} />
                <div>
                  <span className="relatedReasonV12"><Sparkles /> {item.relatedReason || 'مرتبط با این پست'}</span>
                  <strong>{item.title}</strong>
                  <small>{item.channel.title}</small>
                </div>
              </article>
            ))}
          </div>
        ) : relatedError ? (
          <div className="relatedEmptyV12">
            <p>فعلاً پیشنهاد مرتبط دریافت نشد.</p>
            <button type="button" onClick={() => void loadRelated()}>تلاش دوباره</button>
          </div>
        ) : post.contentId ? (
          <div className="relatedEmptyV12"><p>برای این پست هنوز محتوای مرتبط کافی نداریم.</p></div>
        ) : null}
      </section>
    </section>
  );
}
