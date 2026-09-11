import { getSessionId, getTelegramInitData } from './live';

const ONBOARDING_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/onboarding-v1';

export type OnboardingTopic = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  selected: boolean;
};

export type OnboardingState = {
  ok: true;
  onboarding_done: boolean;
  selected_count: number;
  topics: OnboardingTopic[];
};

async function onboardingRequest<T>(
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('telegram_required');

  const response = await fetch(ONBOARDING_API, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      'x-request-id': crypto.randomUUID?.() || String(Date.now()),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data as T;
}

export const loadOnboarding = (signal?: AbortSignal) =>
  onboardingRequest<OnboardingState>('GET', undefined, signal);

export const completeOnboarding = (topicIds: string[], skip = false) =>
  onboardingRequest<{
    ok: true;
    onboarding_done: true;
    skipped?: boolean;
    selected_count?: number;
  }>('POST', {
    topic_ids: topicIds,
    skip,
    session_id: getSessionId(),
  });
