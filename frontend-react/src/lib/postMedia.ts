import { ORIGIN } from '../data/live';
import type { Post } from '../types';

const ROBUST_MEDIA_ENDPOINT =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/telegram-media-v1';

const unique = (values: Array<string | undefined>) =>
  Array.from(
    new Set(
      values.filter(
        (value): value is string => Boolean(value && value.trim()),
      ),
    ),
  );

const localizeWorkerUrl = (value?: string) => {
  if (!value) return undefined;

  if (
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.pages.dev') &&
    value.startsWith(`${ORIGIN}/api/`)
  ) {
    return `${window.location.origin}${value.slice(ORIGIN.length)}`;
  }

  return value;
};

export function postMediaCandidates(post: Post): string[] {
  const direct = localizeWorkerUrl(post.mediaUrl);
  const directIsLegacyPreview = Boolean(
    direct?.includes('/api/telegram/preview-image?'),
  );

  const robust = post.telegramUrl
    ? `${ROBUST_MEDIA_ENDPOINT}?url=${encodeURIComponent(post.telegramUrl)}`
    : undefined;

  const workerPreview = post.telegramUrl
    ? `${ORIGIN}/api/telegram/preview-image?url=${encodeURIComponent(post.telegramUrl)}`
    : undefined;

  return unique([
    directIsLegacyPreview ? undefined : direct,
    robust,
    directIsLegacyPreview ? direct : undefined,
    workerPreview,
  ]);
}

export const hasPostMediaCandidate = (post: Post) =>
  postMediaCandidates(post).length > 0;
