import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Heart, MessageCircle, Play } from 'lucide-react';
import { ORIGIN } from '../data/live';
import type { Post } from '../types';

type Props = {
  post: Post;
  onOpen: (post: Post) => void;
  onToggleSave: (id: string) => void;
  onImpression?: () => void;
};

const uniqueStrings = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

export default function PostCard({
  post,
  onOpen,
  onToggleSave,
  onImpression,
}: Props) {
  const root = useRef<HTMLElement | null>(null);
  const impressed = useRef(false);

  const previewOrigin =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.pages.dev')
      ? window.location.origin
      : ORIGIN;

  const mediaCandidates = useMemo(() => {
    const telegramPreview = post.telegramUrl
      ? `${previewOrigin}/api/telegram/preview-image?url=${encodeURIComponent(
          post.telegramUrl,
        )}`
      : undefined;

    return uniqueStrings([post.mediaUrl, telegramPreview]);
  }, [post.mediaUrl, post.telegramUrl, previewOrigin]);

  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);

  useEffect(() => {
    setMediaIndex(0);
    setMediaReady(false);
  }, [post.id, post.mediaUrl, post.telegramUrl]);

  useEffect(() => {
    impressed.current = false;
  }, [post.id]);

  useEffect(() => {
    if (!onImpression || impressed.current || !root.current) return;

    const node = root.current;

    if (!('IntersectionObserver' in window)) {
      impressed.current = true;
      onImpression();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) =>
              entry.isIntersecting && entry.intersectionRatio >= 0.55,
          )
        ) {
          impressed.current = true;
          observer.disconnect();
          onImpression();
        }
      },
      { threshold: [0.55] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [post.id, onImpression]);

  const activeMedia = mediaCandidates[mediaIndex];
  const mediaExhausted = mediaIndex >= mediaCandidates.length;

  const failCurrentMedia = () => {
    setMediaReady(false);

    if (mediaIndex + 1 < mediaCandidates.length) {
      setMediaIndex((value) => value + 1);
    } else {
      setMediaIndex(mediaCandidates.length);
    }
  };

  const open = () => onOpen(post);

  return (
    <article
      ref={root}
      className={[
        'postCard',
        `postCard-${post.kind}`,
        mediaReady ? 'has-live-media' : 'no-live-media',
        activeMedia && !mediaReady && !mediaExhausted ? 'is-media-loading' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`باز کردن ${post.title}`}
    >
      <div className={`postMedia tone-${post.tone}`}>
        {activeMedia && !mediaExhausted && (
          <img
            key={activeMedia}
            src={activeMedia}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setMediaReady(true)}
            onError={failCurrentMedia}
          />
        )}

        {!mediaReady && activeMedia && !mediaExhausted && (
          <span className="mediaLoadingShimmer" aria-hidden="true" />
        )}

        <span className="categoryChip">{post.category}</span>

        {post.kind === 'video' && (
          <span className="playBadge" aria-label="ویدیو">
            <Play size={15} fill="currentColor" aria-hidden="true" />
          </span>
        )}

        {!mediaReady && <span className="textQuoteMark" aria-hidden="true">“</span>}

        <h3>{post.title}</h3>
      </div>

      <div className="postBody">
        <div className="channelLine">
          <div className={`miniAvatar ${post.channel.accent}`}>
            <span>{post.channel.initials}</span>
            {post.channel.avatarUrl && (
              <img
                src={post.channel.avatarUrl}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(event) => event.currentTarget.remove()}
              />
            )}
          </div>

          <div>
            <strong>{post.channel.title}</strong>
            <small>تلگرام · {post.date}</small>
          </div>
        </div>

        <p>{post.excerpt}</p>

        <footer>
          <span className="statPill" aria-label={`${post.likes} پسند`}>
            <Heart aria-hidden="true" />
            <span>{post.likes}</span>
          </span>

          <span className="statPill" aria-label={`${post.comments} نظر`}>
            <MessageCircle aria-hidden="true" />
            <span>{post.comments}</span>
          </span>

          <button
            type="button"
            className={post.saved ? 'saved' : ''}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSave(post.id);
            }}
            aria-label={post.saved ? 'حذف از ذخیره‌ها' : 'ذخیره'}
            aria-pressed={post.saved}
          >
            <Bookmark fill={post.saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </article>
  );
}
