import { requestJson } from './live';

const PERSONALIZATION_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/personalization-v1';

export type PersonalizationTopic = {
  id: string;
  name: string;
  slug: string;
  description: string;
  selected: boolean;
  weight: number;
};

export type PersonalizationCreator = {
  creator_id: string;
  title: string;
  username: string;
  bio: string;
  avatar_url?: string | null;
  source_url?: string | null;
  verified: boolean;
  following: boolean;
  followed_at?: string | null;
  follower_count: number;
  recent_posts: number;
  topic_affinity: number;
  quality: number;
  freshness: number;
  recommendation_score: number;
};

export type PersonalizationState = {
  topics: PersonalizationTopic[];
  selectedCount: number;
  following: PersonalizationCreator[];
  suggestions: PersonalizationCreator[];
  followingCount: number;
  algorithm: string;
};

type RawState = {
  topics?: PersonalizationTopic[];
  selected_count?: number;
  following?: PersonalizationCreator[];
  suggestions?: PersonalizationCreator[];
  following_count?: number;
  algorithm?: string;
};

const normalize = (raw: RawState): PersonalizationState => ({
  topics: Array.isArray(raw.topics) ? raw.topics : [],
  selectedCount: Number(raw.selected_count || 0),
  following: Array.isArray(raw.following) ? raw.following : [],
  suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
  followingCount: Number(raw.following_count || 0),
  algorithm: String(raw.algorithm || 'topics-follow-quality-freshness-v1'),
});

export async function loadPersonalization(signal?: AbortSignal) {
  return normalize(
    (await requestJson(PERSONALIZATION_API, {
      signal,
      timeout: 12000,
    })) as RawState,
  );
}

export async function saveInterests(topicIds: string[]) {
  return normalize(
    (await requestJson(PERSONALIZATION_API, {
      method: 'POST',
      body: { action: 'interests', topic_ids: topicIds },
      timeout: 12000,
    })) as RawState,
  );
}

export async function setCreatorFollow(creatorId: string, following: boolean) {
  return normalize(
    (await requestJson(PERSONALIZATION_API, {
      method: 'POST',
      body: { action: 'follow', creator_id: creatorId, following },
      timeout: 12000,
    })) as RawState,
  );
}
