/**
 * Telegram Discovery — Cloudflare Worker
 *
 * NOTE: This file matches the architecture that is CURRENTLY LIVE in
 * production (proxy to Supabase Edge Functions). It intentionally does
 * NOT include the MTProto/teleproto-based rewrite that exists elsewhere
 * in this repo's history — that version was never deployed and uses a
 * different architecture (direct Telegram user-session calls from the
 * Worker instead of proxying to Supabase). Decide separately whether to
 * migrate to that approach; don't merge it blindly with this file.
 *
 * New in this version: /api/creator/* proxy route for the Creator
 * Dashboard feature (see supabase/functions/creator-dashboard).
 */

const DISCOVERY_API_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/discovery-api-live";

const SEARCH_API_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/discovery-search-v6";

const SEARCH_FALLBACK_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/discovery-search-v5";

const CREATOR_API_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/creator-dashboard";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-telegram-init-data",
    "x-request-id"
  ].join(", "),
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,PATCH,DELETE",
  "Cache-Control": "no-store"
};

function corsHeaders(request: Request): Headers {
  const headers = new Headers(CORS_HEADERS);
  const origin = request.headers.get("Origin");

  if (origin && isAllowedOrigin(origin, request.url)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return headers;
}

function isAllowedOrigin(origin: string, requestUrl: string): boolean {
  try {
    const source = new URL(origin);
    const target = new URL(requestUrl);

    return (
      source.origin === target.origin ||
      source.origin === "https://web.telegram.org" ||
      source.hostname === "telegram.org" ||
      source.hostname.endsWith(".telegram.org") ||
      source.hostname ===
        "telegram-discovery-app.paniapandora.workers.dev"
    );
  } catch {
    return false;
  }
}

function json(
  data: unknown,
  status = 200,
  request?: Request
): Response {
  const headers = corsHeaders(
    request || new Request("https://localhost/")
  );

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

function requestId(request: Request): string {
  return (
    request.headers.get("x-request-id") ||
    crypto.randomUUID()
  );
}

/* =========================================================
   TELEGRAM SEARCH (with v6 -> v5 fallback)
========================================================= */

async function callSearchBackend(
  baseUrl: string,
  request: Request,
  query: string,
  limit: string,
  id: string
): Promise<Response> {
  const target = new URL(baseUrl);

  target.searchParams.set("q", query);
  target.searchParams.set("limit", limit);

  const headers = new Headers();
  const initData = request.headers.get(
    "x-telegram-init-data"
  );

  if (initData) {
    headers.set("x-telegram-init-data", initData);
  }

  headers.set("x-request-id", id);

  for (const name of [
    "authorization",
    "apikey",
    "x-client-info"
  ]) {
    const value = request.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return fetch(target.toString(), {
    method: "GET",
    headers,
    redirect: "follow"
  });
}

async function telegramSearch(
  request: Request
): Promise<Response> {
  const id = requestId(request);
  const incoming = new URL(request.url);

  const query = (
    incoming.searchParams.get("q") || ""
  ).trim();

  const limit =
    incoming.searchParams.get("limit") || "20";

  if (!query) {
    return json(
      {
        ok: false,
        error: "Search query is required",
        items: [],
        results: [],
        request_id: id
      },
      400,
      request
    );
  }

  let response: Response | null = null;
  let firstError: string | null = null;

  try {
    response = await callSearchBackend(
      SEARCH_API_URL,
      request,
      query,
      limit,
      id
    );
  } catch (error) {
    firstError =
      error instanceof Error
        ? error.message
        : String(error);
  }

  if (!response || !response.ok) {
    try {
      response = await callSearchBackend(
        SEARCH_FALLBACK_URL,
        request,
        query,
        limit,
        id
      );
    } catch (error) {
      return json(
        {
          ok: false,
          error:
            firstError ||
            (error instanceof Error
              ? error.message
              : "Search service unreachable"),
          items: [],
          results: [],
          request_id: id
        },
        502,
        request
      );
    }
  }

  const raw = await response.text();
  let data: any = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {
      ok: false,
      error: raw
    };
  }

  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.results)
      ?