import { useEffect, useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, PlayCircle } from 'lucide-react';
import { postMediaCandidates } from '../lib/postMedia';
import type { Post } from '../types';

type Props = {
  post: Post;
  className?: string;
  showKind?: boolean;
};

export default function LibraryThumb({ post, className = '', showKind = true }: Props) {
  const KindIcon =
    post.kind === 'video' ? PlayCircle : post.kind === 'image' ? ImageIcon : FileText;
  const candidates = useMemo(
    () => postMediaCandidates(post),
    [post.id, post.mediaUrl, post.telegramUrl],
  );
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIndex(0);
    setReady(false);
  }, [post.id, post.mediaUrl, post.telegramUrl]);

  const active = candidates[index];

  return (
    <div className={`libraryThumb ${ready ? 'hasMedia' : 'noMedia'} ${className}`.trim()}>
      {active ? (
        <img
          key={active}
          src={active}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setReady(true)}
          onError={() => {
            setReady(false);
            if (index + 1 < candidates.length) setIndex((value) => value + 1);
            else setIndex(candidates.length);
          }}
        />
      ) : (
        <KindIcon aria-hidden="true" />
      )}
      {!ready && active && <span className="libraryThumbShimmer" aria-hidden="true" />}
      {showKind && (
        <span className="libraryKindBadge">
          <KindIcon />
          {post.kind === 'video' ? 'ویدیو' : post.kind === 'image' ? 'تصویر' : 'متن'}
        </span>
      )}
    </div>
  );
}
