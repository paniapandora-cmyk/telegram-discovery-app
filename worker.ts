/**
 * Telegram Discovery — Cloudflare Worker
 *
 * Proxies Discovery, Search and Creator APIs to Supabase.
 * It also extracts public Telegram post preview images.
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
  "Access-Control-Allow-Methods":
    "GET,POST,OPTIONS,PUT,PATCH,DELETE",
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

function isAllowedOrigin(
  origin: string,
  requestUrl: string
): boolean {
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
   TELEGRAM SEARCH
   Primary v6 with v5 fallback
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
      ? data.results
      : [];

  return json(
    {
      ...data,
      ok: data?.ok !== false && response.ok,
      query,
      count: items.length,
      items,
      results: items,
      request_id: data?.request_id || id
    },
    response.status,
    request
  );
}

async function telegramHealth(
  request: Request
): Promise<Response> {
  return json(
    {
      ok: true,
      service: "telegram-search-proxy",
      backend: "discovery-search-v6",
      preview_image_proxy: true,
      build: "telegram-preview-v3-embed-first",
      request_id: requestId(request)
    },
    200,
    request
  );
}

/* =========================================================
   TELEGRAM POST PREVIEW IMAGE

   Gets the exact public Telegram embed page, extracts its image
   and safely returns the image to the frontend.
========================================================= */

function publicTelegramPost(
  value: string
): URL | null {
  try {
    const input = new URL(value);

    const allowedHosts = [
      "t.me",
      "www.t.me",
      "telegram.me",
      "www.telegram.me"
    ];

    if (!allowedHosts.includes(input.hostname)) {
      return null;
    }

    const match = input.pathname.match(
      /^\/(?:s\/)?([A-Za-z0-9_]{4,})\/(\d+)/
    );

    if (!match) {
      return null;
    }

    const channel = match[1];
    const messageId = match[2];

    const post = new URL(
      `https://t.me/${channel}/${messageId}`
    );

    post.searchParams.set("embed", "1");
    post.searchParams.set("mode", "tme");

    return post;
  } catch {
    return null;
  }
}

function decodeHtmlAttribute(
  value: string
): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function telegramOgImage(
  html: string
): string | null {
  const tags =
    html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const key = tag.match(
      /(?:property|name)=["'](?:og:image|twitter:image)(?::secure_url)?["']/i
    );

    if (!key) {
      continue;
    }

    const content = tag.match(
      /content=["']([^"']+)["']/i
    )?.[1];

    if (content) {
      return decodeHtmlAttribute(content);
    }
  }

  return null;
}

function htmlTagAttribute(
  tag: string,
  name: string
): string | null {
  const match = tag.match(
    new RegExp(
      `${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
      "i"
    )
  );

  return match?.[2]
    ? decodeHtmlAttribute(match[2])
    : null;
}

function cssBackgroundImage(
  style: string
): string | null {
  const value = style.match(
    /background-image\s*:\s*url\(\s*([^)]+?)\s*\)/i
  )?.[1];

  if (!value) {
    return null;
  }

  return decodeHtmlAttribute(value)
    .replace(/^(?:&quot;|&#39;|["'])/i, "")
    .replace(/(?:&quot;|&#39;|["'])$/i, "")
    .trim();
}

function telegramMediaImage(
  html: string
): string | null {
  const tags = html.match(/<[^>]+>/g) || [];
  const mediaClass =
    /tgme_widget_message_(?:video_thumb|photo_wrap|document_thumb)/i;

  for (const tag of tags) {
    if (!mediaClass.test(tag)) {
      continue;
    }

    const style = htmlTagAttribute(tag, "style");
    const background = style
      ? cssBackgroundImage(style)
      : null;

    if (background) {
      return background;
    }

    const poster = htmlTagAttribute(tag, "poster");
    const source = htmlTagAttribute(tag, "src");

    if (poster || source) {
      return poster || source;
    }
  }

  for (const tag of tags) {
    if (!/^<video\b/i.test(tag)) {
      continue;
    }

    const poster = htmlTagAttribute(tag, "poster");

    if (poster) {
      return poster;
    }
  }

  return null;
}

async function telegramPreviewImage(
  request: Request
): Promise<Response> {
  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    return json(
      {
        ok: false,
        error: "Method not allowed"
      },
      405,
      request
    );
  }

  const incoming = new URL(request.url);

  const post = publicTelegramPost(
    incoming.searchParams.get("url") || ""
  );

  if (!post) {
    return json(
      {
        ok: false,
        error: "Invalid public Telegram post URL"
      },
      400,
      request
    );
  }

  try {
    const page = await fetch(post.toString(), {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; TelegramDiscoveryPreview/1.0)"
      },
      redirect: "follow"
    });

    if (!page.ok) {
      return json(
        {
          ok: false,
          error: "Telegram preview unavailable"
        },
        404,
        request
      );
    }

    const html = await page.text();
    const imageValue =
      telegramMediaImage(html) ||
      telegramOgImage(html);

    if (!imageValue) {
      return json(
        {
          ok: false,
          error: "Telegram post has no preview image"
        },
        404,
        request
      );
    }

    const imageUrl = new URL(
      imageValue,
      post.toString()
    );

    if (imageUrl.protocol !== "https:") {
      return json(
        {
          ok: false,
          error: "Unsupported preview image URL"
        },
        400,
        request
      );
    }

    const image = await fetch(imageUrl.toString(), {
      headers: {
        Accept:
          "image/avif,image/webp,image/*,*/*;q=0.8",
        Referer: "https://t.me/",
        "User-Agent":
          "Mozilla/5.0 (compatible; TelegramDiscoveryPreview/2.0)"
      },
      redirect: "follow"
    });

    const contentType =
      image.headers.get("content-type") || "";

    if (
      !image.ok ||
      !contentType.startsWith("image/")
    ) {
      return json(
        {
          ok: false,
          error:
            "Telegram preview image unavailable"
        },
        404,
        request
      );
    }

    const headers = corsHeaders(request);

    headers.set("Content-Type", contentType);
    headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    );
    headers.set(
      "X-Content-Type-Options",
      "nosniff"
    );

    return new Response(
      request.method === "HEAD"
        ? null
        : image.body,
      {
        status: 200,
        headers
      }
    );
  } catch (error) {
    console.error(
      "Telegram preview error",
      post.toString(),
      error
    );

    return json(
      {
        ok: false,
        error:
          "Telegram preview service is unreachable"
      },
      502,
      request
    );
  }
}

/* =========================================================
   GENERIC API PROXY
   Used for /api/discovery and /api/creator
========================================================= */

function getSubPath(
  url: URL,
  prefix: string
): string | null {
  if (!url.pathname.startsWith(prefix)) {
    return null;
  }

  const remainder =
    url.pathname.slice(prefix.length) || "/";

  return remainder.startsWith("/")
    ? remainder
    : `/${remainder}`;
}

async function proxyJsonApi(
  request: Request,
  baseUrl: string,
  path: string
): Promise<Response> {
  const id = requestId(request);
  const incoming = new URL(request.url);
  const target = new URL(baseUrl);

  target.pathname = `${target.pathname}${path}`;
  target.search = incoming.search;

  const headers = new Headers();

  for (const name of [
    "authorization",
    "apikey",
    "content-type",
    "x-client-info",
    "x-telegram-init-data",
    "x-request-id"
  ]) {
    const value = request.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("x-request-id", id);

  let body: BodyInit | undefined;

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(
      target.toString(),
      {
        method: request.method,
        headers,
        body,
        redirect: "follow"
      }
    );

    const responseHeaders =
      new Headers(response.headers);

    const origin =
      request.headers.get("Origin");

    if (
      origin &&
      isAllowedOrigin(origin, request.url)
    ) {
      responseHeaders.set(
        "Access-Control-Allow-Origin",
        origin
      );

      responseHeaders.set(
        "Vary",
        "Origin"
      );
    } else {
      responseHeaders.delete(
        "Access-Control-Allow-Origin"
      );
    }

    responseHeaders.set(
      "Access-Control-Allow-Headers",
      CORS_HEADERS[
        "Access-Control-Allow-Headers"
      ]
    );

    responseHeaders.set(
      "Access-Control-Allow-Methods",
      CORS_HEADERS[
        "Access-Control-Allow-Methods"
      ]
    );

    responseHeaders.set(
      "Cache-Control",
      "no-store"
    );

    responseHeaders.set(
      "X-Request-Id",
      response.headers.get("X-Request-Id") ||
        id
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    console.error(
      "Proxy error",
      baseUrl,
      id,
      error
    );

    return json(
      {
        ok: false,
        error:
          "Backend service is unreachable",
        request_id: id
      },
      502,
      request
    );
  }
}

/* =========================================================
   CLOUDFLARE WORKER ENTRYPOINT
========================================================= */

interface WorkerEnvironment {
  ASSETS: {
    fetch: typeof fetch;
  };
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnvironment
  ): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    if (
      url.pathname ===
      "/api/telegram/search"
    ) {
      return telegramSearch(request);
    }

    if (
      url.pathname ===
      "/api/telegram/health"
    ) {
      return telegramHealth(request);
    }

    if (
      url.pathname ===
      "/api/telegram/preview-image"
    ) {
      return telegramPreviewImage(request);
    }

    const discoveryPath = getSubPath(
      url,
      "/api/discovery"
    );

    if (discoveryPath) {
      return proxyJsonApi(
        request,
        DISCOVERY_API_URL,
        discoveryPath
      );
    }

    const creatorPath = getSubPath(
      url,
      "/api/creator"
    );

    if (creatorPath) {
      return proxyJsonApi(
        request,
        CREATOR_API_URL,
        creatorPath
      );
    }

    return env.ASSETS.fetch(request);
  }
};
