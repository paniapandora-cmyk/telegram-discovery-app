import { useEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { ORIGIN } from '../data/live';
import type { Post } from '../types';

type Props = { post: Post; onOpen: (post: Post) => void; onImpression?: () => void; tall?: boolean; compact?: boolean };
const uniqueStrings = (values: Array<string | undefined>) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));

export default function ExploreTile({ post, onOpen, onImpression, tall = false, compact = false }: Props) {
  const root = useRef<HTMLElement | null>(null);
  const impressed = useRef(false);
  const previewOrigin = typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev') ? window.location.origin : ORIGIN;
  const candidates = useMemo(() => {
    const localizedDirect = post.mediaUrl?.startsWith(`${ORIGIN}/api/`) ? `${previewOrigin}${post.mediaUrl.slice(ORIGIN.length)}` : post.mediaUrl;
    const telegramPreview = post.telegramUrl ? `${previewOrigin}/api/telegram/preview-image?url=${encodeURIComponent(post.telegramUrl)}` : undefined;
    return uniqueStrings([localizedDirect, telegramPreview]);
  }, [post.mediaUrl, post.telegramUrl, previewOrigin]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);

  useEffect(() => { setMediaIndex(0); setMediaReady(false); impressed.current = false; }, [post.id, post.mediaUrl, post.telegramUrl]);
  useEffect(() => {
    if (!onImpression || impressed.current || !root.current) return;
    const node = root.current;
    if (!('IntersectionObserver' in window)) { impressed.current = true; onImpression(); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.52)) {
        impressed.current = true; observer.disconnect(); onImpression();
      }
    }, { threshold: [0.52] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [post.id, onImpression]);

  const activeMedia = candidates[mediaIndex];
  const exhausted = mediaIndex >= candidates.length;
  const failMedia = () => {
    setMediaReady(false);
    if (mediaIndex + 1 < candidates.length) setMediaIndex((value) => value + 1);
    else setMediaIndex(candidates.length);
  };

  return (
    <article
      ref={root}
      className={['exploreTileV4', `tone-${post.tone}`, post.sponsored ? 'isSponsored' : '', tall ? 'tall' : '', compact ? 'compact' : '', mediaReady ? 'hasMedia' : 'noMedia', activeMedia && !mediaReady && !exhausted ? 'loadingMedia' : ''].filter(Boolean).join(' ')}
      onClick={() => onOpen(post)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(post); } }}
      tabIndex={0}
      role="button"
      aria-label={`باز کردن ${post.title}`}
    >
      {activeMedia && !exhausted && <img key={activeMedia} src={activeMedia} alt="" loading="lazy" decoding="async" onLoad={() => setMediaReady(true)} onError={failMedia} />}
      {!mediaReady && activeMedia && !exhausted && <span className="exploreMediaShimmer" aria-hidden="true" />}
      <div className="exploreTileOverlay" />
      {post.sponsored && <span className="sponsoredBadge">تبلیغ · Sponsored</span>}
      {!post.sponsored && <span className="exploreCategory">{post.category}</span>}
      {post.kind === 'video' && <span className="explorePlay"><Play size={14} fill="currentColor" /></span>}
      <div className="exploreTileCopy">
        <strong>{post.title}</strong>
        <small>{post.channel.title}{post.date ? ` · ${post.date}` : ''}</small>
      </div>
    </article>
  );
}
