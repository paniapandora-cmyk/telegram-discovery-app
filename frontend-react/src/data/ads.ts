import type { Post } from '../types';
import { getSessionId, requestJson } from './live';

const ADS_API =
  'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/creator-ads-v1';

export type AdPricingModel = 'TEST' | 'CPM' | 'CPC' | 'CPA_JOIN';
export type AdStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REJECTED'
  | 'COMPLETED';

export type AdMetrics = {
  impressions: number;
  unique_users: number;
  opens: number;
  clicks: number;
  joins: number;
  active_joins: number;
  leaves: number;
  conversion: number;
  estimated_revenue: number;
};

export type AdCampaign = {
  id: string;
  creator_id?: string;
  creator_channel_id?: string;
  content_id?: string;
  title: string;
  description?: string | null;
  status: AdStatus;
  placement: string;
  pricing_model: AdPricingModel;
  unit_price: number;
  budget?: number | null;
  currency?: string | null;
  target_quantity: number;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  channel?: { id?: string; title?: string; username?: string } | null;
  creator?: { id?: string; name?: string; username?: string } | null;
  content?: { id?: string; title?: string } | null;
  metrics: AdMetrics;
  billing_live: false;
};

type FeedResponse = { ok: true; items: Post[]; count: number };
type CampaignsResponse = {
  ok: true;
  campaigns: AdCampaign[];
  billing_live: false;
  totals?: {
    campaigns: number;
    active: number;
    impressions: number;
    clicks: number;
    joins: number;
    active_joins: number;
    estimated_revenue: number;
  };
  billing_note?: string;
};

export async function loadSponsoredPosts(signal?: AbortSignal) {
  const data = (await requestJson(`${ADS_API}?view=feed`, {
    signal,
    timeout: 9000,
  })) as FeedResponse;
  return Array.isArray(data.items) ? data.items : [];
}

export async function recordPromotionEvent(
  post: Pick<Post, 'promotionId' | 'contentId'>,
  eventType: 'impression' | 'open' | 'click_telegram' | 'save',
  position?: number,
) {
  if (!post.promotionId) return;
  const session = getSessionId();
  const stableEvent = eventType === 'impression' || eventType === 'open';
  const idempotencyKey = stableEvent
    ? `${eventType}:${session}:${post.promotionId}`
    : undefined;

  await requestJson(ADS_API, {
    method: 'POST',
    body: {
      action: 'event',
      promotion_id: post.promotionId,
      event_type: eventType,
      session_id: session,
      idempotency_key: idempotencyKey,
      metadata: position ? { position } : {},
    },
    timeout: 7000,
  });
}

export async function loadCreatorAds(signal?: AbortSignal) {
  return (await requestJson(`${ADS_API}?view=creator`, {
    signal,
    timeout: 9000,
  })) as CampaignsResponse;
}

export async function createCreatorAd(input: {
  creatorChannelId: string;
  contentId: string;
  pricingModel: AdPricingModel;
  budget?: number;
  targetQuantity?: number;
}) {
  return requestJson(ADS_API, {
    method: 'POST',
    body: {
      action: 'create',
      creator_channel_id: input.creatorChannelId,
      content_id: input.contentId,
      pricing_model: input.pricingModel,
      budget: input.budget || 0,
      target_quantity: input.targetQuantity || 0,
    },
    timeout: 9000,
  });
}

export async function loadOwnerAds(signal?: AbortSignal) {
  return (await requestJson(`${ADS_API}?view=owner`, {
    signal,
    timeout: 11000,
  })) as CampaignsResponse;
}

export async function setOwnerAdStatus(input: {
  promotionId: string;
  status: 'APPROVED' | 'ACTIVE' | 'PAUSED' | 'REJECTED';
  unitPrice?: number;
  currency?: string;
}) {
  return requestJson(ADS_API, {
    method: 'POST',
    body: {
      action: 'owner_status',
      promotion_id: input.promotionId,
      status: input.status,
      unit_price: input.unitPrice,
      currency: input.currency,
    },
    timeout: 9000,
  });
}
