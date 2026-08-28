import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions";

interface Env {
  ASSETS: Fetcher;

  TELEGRAM_API_ID: string;
  TELEGRAM_API_HASH: string;
  TELEGRAM_STRING_SESSION: string;
}

const DISCOVERY_API_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/discovery-api-live";

function corsHeaders(request?: Request): Headers {
  const headers = new Headers();

  headers.set(
    "Access-Control-Allow-Origin",
    request?.headers.get("Origin") || "*",
  );

  headers.set(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-request-id",
  );

  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS,PUT,PATCH,DELETE",
  );

  headers.set("Cache-Control", "no-store");

  return headers;
}

function json(
  data: unknown,
  status = 200,
  request?: Request,
): Response {
  const headers = corsHeaders(request);

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8",
  );

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

async function telegramHealth(env: Env, request: Request) {
  const missing: string[] = [];

  if (!env.TELEGRAM_API_ID?.trim()) {
    missing.push("TELEGRAM_API_ID");
  }

  if (!env.TELEGRAM_API_HASH?.trim()) {
    missing.push("TELEGRAM_API_HASH");
  }

  if (!env.TELEGRAM_STRING_SESSION?.trim()) {
    missing.push("TELEGRAM_STRING_SESSION");
  }

  if (missing.length > 0) {
    return json(
      {
        ok: false,
        error: "Telegram Cloudflare secrets are not configured",
        missing,
      },
      500,
      request,
    );
  }

  const apiId = Number(env.TELEGRAM_API_ID);

  if (!Number.isInteger(apiId) || apiId <= 0) {
    return json(
      {
        ok: false,
        error: "TELEGRAM_API_ID is invalid",
      },
      500,
      request,
    );
  }

  const apiHash = env.TELEGRAM_API_HASH.trim();
  const session = env.TELEGRAM_STRING_SESSION.trim();

  const client = new TelegramClient(
    new StringSession(session),
    apiId,
    apiHash,
    {
      connectionRetries: 2,
      autoReconnect: false,
    },
  );

  try {
    await client.connect();

    const authorized = await client.checkAuthorization();

    if (!authorized) {
      return json(
        {
          ok: false,
          authorized: false,
          error: "Telegram session is not authorized",
        },
        401,
        request,
      );
    }

    const me = await client.getMe();

    return json(
      {
        ok: true,
        authorized: true,
        telegram_user_id:
          me?.id?.toString() ?? null,
        telegram_username:
          me?.username ?? null,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Telegram health error", error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Telegram connection failed",
      },
      500,
      request,
    );
  } finally {
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors.
    }
  }
}

function discoveryPath(url: URL): string | null {
  const prefix = "/api/discovery";

  if (!url.pathname.startsWith(prefix)) {
    return null;
  }

  const remainder =
    url.pathname.slice(prefix.length) || "/";

  return remainder.startsWith("/")
    ? remainder
    : `/${remainder}`;
}

async function proxyDiscovery(
  request: Request,
  path: string,
): Promise<Response> {
  const incomingUrl = new URL(request.url);

  const targetUrl =
    new URL(DISCOVERY_API_URL);

  targetUrl.pathname =
    `${targetUrl.pathname}${path}`;

  targetUrl.search =
    incomingUrl.search;

  const headers = new Headers();

  const forwardHeaders = [
    "authorization",
    "content-type",
    "x-client-info",
    "apikey",
    "x-telegram-init-data",
    "x-request-id",
  ];

  for (const name of forwardHeaders) {
    const value = request.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  const requestId =
    request.headers.get("x-request-id") ||
    crypto.randomUUID();

  headers.set("x-request-id", requestId);

  let body: BodyInit | undefined;

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    body = await request.arrayBuffer();
  }

  let response: Response;

  try {
    response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
      redirect: "follow",
    });
  } catch (error) {
    console.error("Discovery proxy fetch error", error);

    return json(
      {
        ok: false,
        error: "Discovery API is unreachable",
        request_id: requestId,
      },
      502,
      request,
    );
  }

  const responseHeaders =
    new Headers(response.headers);

  responseHeaders.set(
    "Access-Control-Allow-Origin",
    request.headers.get("Origin") || "*",
  );

  responseHeaders.set(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-request-id",
  );

  responseHeaders.set(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS,PUT,PATCH,DELETE",
  );

  responseHeaders.set(
    "X-Request-Id",
    response.headers.get("X-Request-Id") ||
      requestId,
  );

  responseHeaders.set(
    "Cache-Control",
    "no-store",
  );

  return new Response(
    response.body,
    {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    },
  );
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url = new URL(request.url);

    /*
     * CORS preflight
     */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    /*
     * Local Telegram MTProto health endpoint
     */
    if (
      url.pathname ===
      "/api/telegram/health"
    ) {
      try {
        return await telegramHealth(
          env,
          request,
        );
      } catch (error) {
        console.error(
          "Telegram health fatal error",
          error,
        );

        return json(
          {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Telegram health check failed",
          },
          500,
          request,
        );
      }
    }

    /*
     * Discovery API proxy
     *
     * Examples:
     * /api/discovery/health
     * /api/discovery/search?q=آگاهی
     * /api/discovery/feed
     * /api/discovery/trending
     * /api/discovery/explore
     * /api/discovery/auth/telegram
     * /api/discovery/save
     * /api/discovery/feedback
     */
    const path = discoveryPath(url);

    if (path) {
      return proxyDiscovery(
        request,
        path,
      );
    }

    /*
     * Static frontend
     */
    return env.ASSETS.fetch(request);
  },
};
