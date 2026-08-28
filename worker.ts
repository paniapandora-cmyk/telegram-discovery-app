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
    [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-telegram-init-data",
      "x-request-id",
    ].join(", "),
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

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers,
    },
  );
}

/* =========================================================
   TELEGRAM CLIENT
   ========================================================= */

function getTelegramConfig(env: Env) {
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
    throw new Error(
      `Telegram Cloudflare secrets are not configured: ${missing.join(", ")}`,
    );
  }

  const apiId = Number(
    env.TELEGRAM_API_ID.trim(),
  );

  if (
    !Number.isInteger(apiId) ||
    apiId <= 0
  ) {
    throw new Error(
      "TELEGRAM_API_ID is invalid",
    );
  }

  return {
    apiId,
    apiHash:
      env.TELEGRAM_API_HASH.trim(),
    session:
      env.TELEGRAM_STRING_SESSION.trim(),
  };
}

function createTelegramClient(env: Env) {
  const config =
    getTelegramConfig(env);

  return new TelegramClient(
    new StringSession(config.session),
    config.apiId,
    config.apiHash,
    {
      connectionRetries: 2,
      autoReconnect: false,
    },
  );
}

/* =========================================================
   TELEGRAM HEALTH
   ========================================================= */

async function telegramHealth(
  env: Env,
  request: Request,
) {
  let client:
    | TelegramClient<any>
    | null = null;

  try {
    client =
      createTelegramClient(env);

    await client.connect();

    const authorized =
      await client.checkAuthorization();

    if (!authorized) {
      return json(
        {
          ok: false,
          authorized: false,
          error:
            "Telegram session is not authorized",
        },
        401,
        request,
      );
    }

    const me =
      await client.getMe();

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
    console.error(
      "Telegram health error",
      error,
    );

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
    if (client) {
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors.
      }
    }
  }
}

/* =========================================================
   TELEGRAM SEARCH
   ========================================================= */

function buildTelegramLink(
  username: string | null,
  messageId: number | null,
): string | null {
  if (
    !username ||
    !messageId
  ) {
    return null;
  }

  return `https://t.me/${username}/${messageId}`;
}

async function telegramSearch(
  env: Env,
  request: Request,
) {
  const url =
    new URL(request.url);

  const query =
    (
      url.searchParams.get("q") ||
      ""
    ).trim();

  const requestedLimit =
    Number(
      url.searchParams.get("limit") ||
        "20",
    );

  const limit =
    Math.min(
      Math.max(
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : 20,
        1,
      ),
      50,
    );

  if (!query) {
    return json(
      {
        ok: false,
        error:
          "Search query is required",
        results: [],
      },
      400,
      request,
    );
  }

  if (query.length > 200) {
    return json(
      {
        ok: false,
        error:
          "Search query is too long",
        results: [],
      },
      400,
      request,
    );
  }

  let client:
    | TelegramClient<any>
    | null = null;

  try {
    client =
      createTelegramClient(env);

    console.log(
      "Telegram search starting",
      {
        query,
        limit,
      },
    );

    await client.connect();

    const authorized =
      await client.checkAuthorization();

    if (!authorized) {
      return json(
        {
          ok: false,
          authorized: false,
          error:
            "Telegram session is not authorized",
          results: [],
        },
        401,
        request,
      );
    }

    const results: unknown[] = [];

    /*
     * Global Telegram search.
     *
     * entity = undefined
     * باعث می‌شود teleproto از
     * messages.searchGlobal استفاده کند.
     */
    for await (
      const message of client.iterMessages(
        undefined,
        {
          search: query,
          limit,
        },
      )
    ) {
      try {
        if (!message) {
          continue;
        }

        const text =
          message.text ||
          "";

        const messageId =
          Number(message.id);

        let chat: any = null;

        try {
          chat =
            await message.getChat();
        } catch {
          chat = null;
        }

        let sender: any = null;

        try {
          sender =
            await message.getSender();
        } catch {
          sender = null;
        }

        const username =
          chat?.username ||
          sender?.username ||
          null;

        const title =
          chat?.title ||
          chat?.firstName ||
          chat?.lastName ||
          sender?.firstName ||
          sender?.lastName ||
          username ||
          "Telegram";

        const channelTitle =
          chat?.title ||
          title;

        const link =
          buildTelegramLink(
            username,
            Number.isFinite(messageId)
              ? messageId
              : null,
          );

        results.push({
          id:
            Number.isFinite(messageId)
              ? messageId
              : null,

          text,

          message: text,

          title,

          channel_title:
            channelTitle,

          username,

          channel_username:
            chat?.username ||
            null,

          chat_username:
            chat?.username ||
            null,

          date:
            message.date
              ? new Date(
                  message.date,
                ).toISOString()
              : null,

          link,

          message_url:
            link,

          url:
            link,

          chat_id:
            message.chatId
              ?.toString?.() ??
            null,

          sender_id:
            message.senderId
              ?.toString?.() ??
            null,

          has_media:
            Boolean(
              message.media,
            ),
        });
      } catch (itemError) {
        /*
         * اگر یک نتیجه خراب بود،
         * کل Search را متوقف نکن.
         */
        console.error(
          "Telegram search item error",
          itemError,
        );
      }
    }

    console.log(
      "Telegram search completed",
      {
        query,
        count: results.length,
      },
    );

    return json(
      {
        ok: true,

        query,

        count:
          results.length,

        results,
      },
      200,
      request,
    );
  } catch (error) {
    console.error(
      "Telegram search error",
      error,
    );

    let message =
      "Telegram search failed";

    if (error instanceof Error) {
      message =
        error.message;
    }

    return json(
      {
        ok: false,
        error: message,
        results: [],
      },
      500,
      request,
    );
  } finally {
    if (client) {
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors.
      }
    }
  }
}

/* =========================================================
   DISCOVERY API PATH
   ========================================================= */

function discoveryPath(
  url: URL,
): string | null {
  const prefix =
    "/api/discovery";

  if (
    !url.pathname.startsWith(
      prefix,
    )
  ) {
    return null;
  }

  const remainder =
    url.pathname.slice(
      prefix.length,
    ) || "/";

  return remainder.startsWith("/")
    ? remainder
    : `/${remainder}`;
}

/* =========================================================
   DISCOVERY API PROXY
   ========================================================= */

async function proxyDiscovery(
  request: Request,
  path: string,
): Promise<Response> {
  const incomingUrl =
    new URL(request.url);

  const targetUrl =
    new URL(DISCOVERY_API_URL);

  targetUrl.pathname =
    `${targetUrl.pathname}${path}`;

  targetUrl.search =
    incomingUrl.search;

  const headers =
    new Headers();

  const forwardHeaders = [
    "authorization",
    "content-type",
    "x-client-info",
    "apikey",
    "x-telegram-init-data",
    "x-request-id",
  ];

  for (
    const name of forwardHeaders
  ) {
    const value =
      request.headers.get(name);

    if (value) {
      headers.set(
        name,
        value,
      );
    }
  }

  const requestId =
    request.headers.get(
      "x-request-id",
    ) ||
    crypto.randomUUID();

  headers.set(
    "x-request-id",
    requestId,
  );

  let body:
    | BodyInit
    | undefined;

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    body =
      await request.arrayBuffer();
  }

  let response: Response;

  try {
    response =
      await fetch(
        targetUrl.toString(),
        {
          method:
            request.method,

          headers,

          body,

          redirect: "follow",
        },
      );
  } catch (error) {
    console.error(
      "Discovery proxy fetch error",
      error,
    );

    return json(
      {
        ok: false,
        error:
          "Discovery API is unreachable",
        request_id:
          requestId,
      },
      502,
      request,
    );
  }

  const responseHeaders =
    new Headers(
      response.headers,
    );

  responseHeaders.set(
    "Access-Control-Allow-Origin",
    request.headers.get(
      "Origin",
    ) || "*",
  );

  responseHeaders.set(
    "Access-Control-Allow-Headers",
    [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-telegram-init-data",
      "x-request-id",
    ].join(", "),
  );

  responseHeaders.set(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS,PUT,PATCH,DELETE",
  );

  responseHeaders.set(
    "X-Request-Id",
    response.headers.get(
      "X-Request-Id",
    ) || requestId,
  );

  responseHeaders.set(
    "Cache-Control",
    "no-store",
  );

  return new Response(
    response.body,
    {
      status:
        response.status,

      statusText:
        response.statusText,

      headers:
        responseHeaders,
    },
  );
}

/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url =
      new URL(request.url);

    /*
     * CORS preflight
     */
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers:
            corsHeaders(
              request,
            ),
        },
      );
    }

    /*
     * Telegram health
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
     * Telegram global search
     *
     * GET:
     * /api/telegram/search?q=...
     */
    if (
      url.pathname ===
      "/api/telegram/search"
    ) {
      try {
        return await telegramSearch(
          env,
          request,
        );
      } catch (error) {
        console.error(
          "Telegram search fatal error",
          error,
        );

        return json(
          {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Telegram search failed",
            results: [],
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
     *
     * /api/discovery/health
     * /api/discovery/search?q=...
     * /api/discovery/feed
     * /api/discovery/trending
     * /api/discovery/explore
     * /api/discovery/auth/telegram
     * /api/discovery/save
     * /api/discovery/feedback
     */
    const path =
      discoveryPath(url);

    if (path) {
      return proxyDiscovery(
        request,
        path,
      );
    }

    /*
     * Static frontend
     */
    return env.ASSETS.fetch(
      request,
    );
  },
};
