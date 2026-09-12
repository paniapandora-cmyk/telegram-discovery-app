import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parse } from "npm:node-html-parser@6.1.13";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

type PublicPost = {
  id: number;
  text: string;
  publishedAt: string | null;
  contentType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "MIXED";
  mediaPreviewUrl: string | null;
};

const cleanUsername = (value: unknown) => String(value ?? "").trim().replace(/^@/, "");

function detectMedia(node: any): Pick<PublicPost, "contentType" | "mediaPreviewUrl"> {
  const photo = node.querySelector(".tgme_widget_message_photo_wrap");
  const video = node.querySelector(".tgme_widget_message_video_player, video");
  const audio = node.querySelector(".tgme_widget_message_voice_player, audio");
  const document = node.querySelector(".tgme_widget_message_document");
  const media = node.querySelector(".tgme_widget_message_media_wrap");

  let mediaPreviewUrl: string | null = null;
  const style = photo?.getAttribute?.("style") || media?.getAttribute?.("style") || "";
  const styleMatch = String(style).match(/url\(['\"]?([^'\")]+)['\"]?\)/i);
  if (styleMatch?.[1]) mediaPreviewUrl = styleMatch[1].replace(/&amp;/g, "&");
  if (!mediaPreviewUrl) {
    const img = node.querySelector("img");
    mediaPreviewUrl = img?.getAttribute?.("src") || null;
  }
  if (photo && video) return { contentType: "MIXED", mediaPreviewUrl };
  if (video) return { contentType: "VIDEO", mediaPreviewUrl };
  if (audio) return { contentType: "AUDIO", mediaPreviewUrl };
  if (document) return { contentType: "DOCUMENT", mediaPreviewUrl };
  if (photo || media) return { contentType: "IMAGE", mediaPreviewUrl };
  return { contentType: "TEXT", mediaPreviewUrl: null };
}

async function fetchPublicPosts(username: string, before = 0): Promise<PublicPost[]> {
  const url = new URL(`https://t.me/s/${encodeURIComponent(username)}`);
  if (before > 0) url.searchParams.set("before", String(before));

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TelegramDiscovery/1.0; +https://t.me)",
      "accept-language": "fa,en;q=0.8",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Telegram public preview returned HTTP ${response.status}`);

  const html = await response.text();
  const root = parse(html);
  const posts: PublicPost[] = [];

  for (const node of root.querySelectorAll(".tgme_widget_message")) {
    const dataPost = node.getAttribute("data-post") || "";
    const match = dataPost.match(/\/(\d+)$/);
    if (!match) continue;
    const id = Number(match[1]);
    if (!Number.isSafeInteger(id) || id <= 0) continue;

    const textNode = node.querySelector(".tgme_widget_message_text");
    const text = String(textNode?.innerText || "").replace(/\u00a0/g, " ").trim();
    const timeNode = node.querySelector("time");
    const publishedAt = timeNode?.getAttribute("datetime") || null;
    const mediaInfo = detectMedia(node);
    if (!text && mediaInfo.contentType === "TEXT") continue;

    posts.push({ id, text, publishedAt, ...mediaInfo });
  }

  const unique = new Map<number, PublicPost>();
  for (const post of posts) unique.set(post.id, post);
  return [...unique.values()].sort((a, b) => b.id - a.id);
}

Deno.serve(async (req) => {
  let db: ReturnType<typeof createClient> | null = null;
  let runId: string | null = null;
  let leaseSource = "";
  const leaseToken = crypto.randomUUID();

  try {
    if (req.method === "OPTIONS") return json({ ok: true });
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sourceId = String(url.searchParams.get("source_id") || body?.source_id || "").trim();
    if (!sourceId) return json({ ok: false, error: "source_id required" }, 400);

    db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    const lease = await db.rpc("acquire_telegram_sync_lease", { p_source_id: sourceId, p_token: leaseToken });
    if (lease.error) throw lease.error;
    if (!lease.data) return json({ ok: true, status: "busy", source_id: sourceId });
    leaseSource = sourceId;

    const sourceQuery = await db.from("telegram_sources").select("*").eq("id", sourceId).single();
    if (sourceQuery.error) throw sourceQuery.error;
    const source = sourceQuery.data;
    if (!source || source.enabled === false) throw new Error("Telegram source is disabled or missing");

    const username = cleanUsername(source.username);
    if (!username) throw new Error("Public Telegram sync requires a channel username");

    let creatorId: string | null = null;
    const creatorQuery = await db.from("creators").select("id").ilike("username", username.replaceAll("_", "\\_")).limit(1);
    if (creatorQuery.error) throw creatorQuery.error;
    creatorId = creatorQuery.data?.[0]?.id ?? null;
    if (!creatorId) {
      const created = await db.from("creators").insert({
        name: source.title || username,
        username,
        source_url: `https://t.me/${username}`,
        is_active: true,
      }).select("id").single();
      if (created.error) throw created.error;
      creatorId = created.data.id;
    }

    const run = await db.from("telegram_sync_runs").insert({
      source_id: sourceId,
      mode: Number(source.sync_cursor || 0) > 0 ? "incremental" : "backfill",
      status: "running",
      metadata: { sync_provider: "telegram_public_preview", sync_version: 1 },
    }).select("id").single();
    if (!run.error) runId = run.data.id;

    const latest = await fetchPublicPosts(username, 0);
    const historyBefore = Number(source.history_before_id || 0);
    const history = historyBefore > 0 && source.history_complete !== true
      ? await fetchPublicPosts(username, historyBefore).catch(() => [] as PublicPost[])
      : [];
    const combined = new Map<number, PublicPost>();
    for (const post of [...latest, ...history]) combined.set(post.id, post);
    const posts = [...combined.values()].sort((a, b) => a.id - b.id);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let newestId = Number(source.sync_cursor || 0);
    let oldestId = historyBefore > 0 ? historyBefore : 0;
    const peerKey = String(source.telegram_peer_id ?? username);

    for (const post of posts) {
      try {
        newestId = Math.max(newestId, post.id);
        oldestId = oldestId > 0 ? Math.min(oldestId, post.id) : post.id;
        const key = `${peerKey}:${post.id}`;
        const existing = await db.from("contents")
          .select("id,metadata,moderation_status")
          .eq("source_type", "TELEGRAM")
          .eq("source_id", key)
          .limit(1);
        if (existing.error) throw existing.error;

        const content = {
          creator_id: creatorId,
          source_type: "TELEGRAM",
          source_id: key,
          source_url: `https://t.me/${username}/${post.id}`,
          content_type: post.contentType,
          title: post.text ? post.text.slice(0, 160) : null,
          description: post.text || null,
          rights_status: "REFERENCE_ONLY",
          moderation_status: existing.data?.[0]?.moderation_status || "PENDING",
          published_at: post.publishedAt,
          text_content: post.text || null,
          metadata: {
            ...(existing.data?.[0]?.metadata || {}),
            telegram_source_id: sourceId,
            telegram_peer_id: String(source.telegram_peer_id ?? ""),
            telegram_message_id: post.id,
            public_preview_sync: true,
            sync_provider: "telegram_public_preview",
            media_preview_url: post.mediaPreviewUrl,
            deleted_on_telegram: false,
          },
        };

        const saved = existing.data?.[0]?.id
          ? await db.from("contents").update(content).eq("id", existing.data[0].id).select("id").single()
          : await db.from("contents").insert(content).select("id").single();
        if (saved.error) throw saved.error;

        if (existing.data?.[0]?.id) updated++; else inserted++;
        if (!existing.data?.[0]?.id && post.text) {
          await db.from("discovery_embedding_jobs").upsert({
            content_id: saved.data.id,
            status: "PENDING",
            requested_at: new Date().toISOString(),
            attempts: 0,
          }, { onConflict: "content_id", ignoreDuplicates: true });
        }
      } catch (error) {
        errors++;
        console.error("public post sync failed", post.id, error);
      }
    }

    if (!posts.length) skipped++;
    const now = new Date().toISOString();
    const historyComplete = source.history_complete === true || (historyBefore > 0 && history.length === 0);
    const status = errors > 0 ? "partial" : "success";

    const checkpoint = await db.from("telegram_sources").update({
      sync_cursor: newestId,
      history_before_id: oldestId,
      history_complete: historyComplete,
      last_synced_at: now,
      last_success_at: status === "success" ? now : source.last_success_at,
      last_error: errors ? `${errors} public-preview item(s) failed` : null,
      updated_at: now,
    }).eq("id", sourceId).eq("sync_lease_token", leaseToken).select("id");
    if (checkpoint.error) throw checkpoint.error;
    if (!checkpoint.data?.length) throw new Error("Sync lease expired; checkpoints not saved");

    if (runId) {
      await db.from("telegram_sync_runs").update({
        status,
        completed_at: now,
        fetched_count: posts.length,
        inserted_count: inserted,
        updated_count: updated,
        skipped_count: skipped,
        error_count: errors,
        last_message_id: newestId || null,
        error_message: errors ? `${errors} public-preview item(s) failed` : null,
        metadata: {
          sync_provider: "telegram_public_preview",
          sync_version: 1,
          latest_count: latest.length,
          history_count: history.length,
          history_before_id: oldestId,
          history_complete: historyComplete,
        },
      }).eq("id", runId);
    }

    return json({
      ok: true,
      provider: "telegram_public_preview",
      source_id: sourceId,
      username,
      status,
      fetched: posts.length,
      inserted,
      updated,
      skipped,
      errors,
      sync_cursor: newestId,
      history_before_id: oldestId,
      history_complete: historyComplete,
      run_id: runId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("telegram-public-sync-v1 fatal", error);
    if (db && runId) {
      await db.from("telegram_sync_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      }).eq("id", runId).then(() => {}, () => {});
    }
    return json({ ok: false, error: message }, 500);
  } finally {
    if (db && leaseSource) {
      await db.from("telegram_sources").update({ sync_lease_token: null, sync_lease_until: null })
        .eq("id", leaseSource).eq("sync_lease_token", leaseToken);
    }
  }
});
