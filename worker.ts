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

const UNIFIED_SEARCH_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/discovery-search-v2";

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
   TELEGRAM CONFIG
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
   SEARCH HELPERS
========================================================= */

function normalizeSearchQuery(
  input: string,
): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, " ");
}

function normalizedKey(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/* =========================================================
   INTERNAL DISCOVERY SEARCH
========================================================= */

async function indexedSearch(
  request: Request,
  query: string,
  limit: number,
  requestId: string,
) {
  const initData =
    request.headers.get(
      "x-telegram-init-data",
    ) || "";

  /*
   * Search داخلی به Telegram identity
   * نیاز دارد تا discovery API بتواند
   * user را شناسایی کند.
   *
   * اگر initData موجود نباشد:
   * فقط internal search را skip می‌کنیم
   * و Global Telegram Search همچنان کار می‌کند.
   */

  if (!initData) {
    console.warn(
      "Indexed search skipped: Telegram initData missing",
    );

    return [];
  }

  const url =
    new URL(
      UNIFIED_SEARCH_URL,
    );

  url.searchParams.set(
    "q",
    query,
  );

  url.searchParams.set(
    "limit",
    String(limit),
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          "x-telegram-init-data":
            initData,

          "x-request-id":
            requestId,
        },
      },
    );

  const raw =
    await response.text();

  let data: any = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    data = {
      error: raw,
    };
  }

  if (
    !response.ok ||
    data?.ok === false
  ) {
    throw new Error(
      data?.error ||
        `Unified search ${response.status}`,
    );
  }

  return Array.isArray(
    data?.items,
  )
    ? data.items
    : [];
}

/* =========================================================
   TELEGRAM GLOBAL SEARCH
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

async function telegramGlobalSearch(
  env: Env,
  request: Request,
  query: string,
  limit: number,
) {
  let client:
    | TelegramClient<any>
    | null = null;

  const results: any[] = [];

  try {
    client =
      createTelegramClient(env);

    console.log(
      "Telegram global search starting",
      {
        query,
        limit,
      },
    );

    await client.connect();

    const authorized =
      await client.checkAuthorization();

    if (!authorized) {
      throw new Error(
        "Telegram session is not authorized",
      );
    }

    /*
     * entity = undefined
     *
     * یعنی جستجوی Global واقعی Telegram
     * نه فقط یک کانال خاص.
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
          message.text || "";

        const messageId =
          Number(message.id);

        let chat: any =
          null;

        try {
          chat =
            await message.getChat();
        } catch {
          chat = null;
        }

        let sender: any =
          null;

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
            Number.isFinite(
              messageId,
            )
              ? messageId
              : null,
          );

        results.push({
          result_type:
            "telegram_message",

          id:
            Number.isFinite(
              messageId,
            )
              ? String(messageId)
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

          source:
            "telegram",
        });
      } catch (itemError) {
        /*
         * خراب بودن یک نتیجه نباید
         * کل Global Search را خراب کند.
         */

        console.error(
          "Telegram search item error",
          itemError,
        );
      }
    }

    console.log(
      "Telegram global search completed",
      {
        query,
        count:
          results.length,
      },
    );

    return results;
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
   MERGE + DEDUPLICATION
========================================================= */

function searchResultKey(
  item: any,
): string {
  const type =
    String(
      item?.result_type ||
        item?.source ||
        "",
    );

  /*
   * Channel:
   * با creator_id / peer id / username
   *
   * Content:
   * با content_id
   *
   * Telegram:
   * با chat_id + message id
   */

  if (
    type ===
    "channel"
  ) {
    return [
      "channel",
      normalizedKey(
        item?.channel_peer_id ??
          item?.peer_id ??
          item?.result_id ??
          item?.channel_username,
      ),
    ].join(":");
  }

  if (
    item?.content_id
  ) {
    return [
      "content",
      normalizedKey(
        item.content_id,
      ),
    ].join(":");
  }

  if (
    item?.source ===
      "telegram" ||
    type ===
      "telegram_message"
  ) {
    return [
      "telegram",
      normalizedKey(
        item?.chat_id,
      ),
      normalizedKey(
        item?.telegram_message_id ??
          item?.id,
      ),
    ].join(":");
  }

  return [
    type,
    normalizedKey(
      item?.id ??
        item?.result_id ??
        item?.source_url,
    ),
  ].join(":");
}

function scoreSearchResult(
  item: any,
  query: string,
): number {
  const q =
    normalizedKey(
      normalizeSearchQuery(
        query,
      ),
    );

  const title =
    normalizedKey(
      item?.title ??
        item?.channel_title,
    );

  const username =
    normalizedKey(
      item?.channel_username ??
        item?.username,
    );

  const peerId =
    normalizedKey(
      item?.channel_peer_id ??
        item?.chat_id,
    );

  const sourceId =
    normalizedKey(
      item?.source_id,
    );

  const text =
    normalizedKey(
      item?.description ??
        item?.text ??
        item?.message,
    );

  let score =
    Number(
      item?.score ?? 0,
    );

  /*
   * Exact Channel username
   */

  if (
    username &&
    username === q
  ) {
    score += 5;
  }

  /*
   * Exact peer id
   */

  if (
    peerId &&
    peerId ===
      normalizedKey(q)
  ) {
    score += 5;
  }

  /*
   * Exact source id
   */

  if (
    sourceId &&
    sourceId ===
      normalizedKey(q)
  ) {
    score += 4;
  }

  /*
   * Exact channel title
   */

  if (
    title &&
    title === q
  ) {
    score += 4;
  }

  /*
   * Prefix match
   */

  if (
    username &&
    username.startsWith(q)
  ) {
    score += 3;
  }

  if (
    title &&
    title.startsWith(q)
  ) {
    score += 2.5;
  }

  /*
   * Partial match
   */

  if (
    username &&
    username.includes(q)
  ) {
    score += 2;
  }

  if (
    title &&
    title.includes(q)
  ) {
    score += 1.5;
  }

  if (
    text &&
    text.includes(q)
  ) {
    score += 1;
  }

  /*
   * Channel results should be
   * preferred for exact channel queries.
   */

  if (
    item?.result_type ===
    "channel"
  ) {
    score += 1;
  }

  return score;
}

function mergeSearchResults(
  indexed: any[],
  telegram: any[],
  query: string,
  limit: number,
) {
  const map =
    new Map<
      string,
      any
    >();

  /*
   * Internal Discovery results
   * همیشه ابتدا اضافه می‌شوند.
   */

  for (
    const item of indexed
  ) {
    if (!item) {
      continue;
    }

    const copy = {
      ...item,
    };

    copy.search_source =
      "discovery";

    copy._score =
      scoreSearchResult(
        copy,
        query,
      );

    const key =
      searchResultKey(copy);

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        copy,
      );
    }
  }

  /*
   * Global Telegram results
   */

  for (
    const item of telegram
  ) {
    if (!item) {
      continue;
    }

    const copy = {
      ...item,
    };

    copy.search_source =
      "telegram_global";

    copy._score =
      scoreSearchResult(
        copy,
        query,
      );

    const key =
      searchResultKey(copy);

    if (
      map.has(key)
    ) {
      /*
       * اگر همان نتیجه قبلاً
       * از DB آمده باشد، نسخه DB
       * را ترجیح می‌دهیم.
       */

      const existing =
        map.get(key);

      if (
        existing?.search_source !==
          "discovery"
      ) {
        map.set(
          key,
          copy,
        );
      }

      continue;
    }

    map.set(
      key,
      copy,
    );
  }

  const merged =
    Array.from(
      map.values(),
    );

  /*
   * امتیاز بالاتر ابتدا
   */

  merged.sort(
    (
      a,
      b,
    ) => {
      const scoreDiff =
        Number(
          b._score ??
            0,
        ) -
        Number(
          a._score ??
            0,
        );

      if (
        scoreDiff !== 0
      ) {
        return scoreDiff;
      }

      const ad =
        String(
          a.date ??
            a.published_at ??
            "",
        );

      const bd =
        String(
          b.date ??
            b.published_at ??
            "",
        );

      return bd.localeCompare(
        ad,
      );
    },
  );

  /*
   * فیلد داخلی امتیاز
   * را به کاربر نمی‌دهیم.
   */

  return merged
    .slice(
      0,
      limit,
    )
    .map(
      (item) => {
        const {
          _score,
          ...clean
        } = item;

        return {
          ...clean,

          search_score:
            Number(
              _score ??
                0,
            ),
        };
      },
    );
}

/* =========================================================
   UNIFIED TELEGRAM SEARCH
========================================================= */

async function telegramSearch(
  env: Env,
  request: Request,
) {
  const url =
    new URL(
      request.url,
    );

  const rawQuery =
    (
      url.searchParams.get(
        "q",
      ) || ""
    ).trim();

  const query =
    normalizeSearchQuery(
      rawQuery,
    );

  const requestedLimit =
    Number(
      url.searchParams.get(
        "limit",
      ) ||
        "20",
    );

  const limit =
    Math.min(
      Math.max(
        Number.isFinite(
          requestedLimit,
        )
          ? Math.floor(
              requestedLimit,
            )
          : 20,
        1,
      ),
      50,
    );

  const requestId =
    request.headers.get(
      "x-request-id",
    ) ||
    crypto.randomUUID();

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

  if (
    query.length > 200
  ) {
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

  let indexedResults: any[] =
    [];

  let globalResults: any[] =
    [];

  let indexedError:
    | string
    | null =
    null;

  let globalError:
    | string
    | null =
    null;

  /*
   * مرحله اول:
   * Search دیتابیس/Discovery
   */

  try {
    indexedResults =
      await indexedSearch(
        request,
        query,
        Math.min(
          limit,
          50,
        ),
        requestId,
      );

    console.log(
      "Indexed search result",
      {
        query,
        count:
          indexedResults.length,
      },
    );
  } catch (error) {
    indexedError =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "Indexed search failed",
      error,
    );
  }

  /*
   * مرحله دوم:
   * Global Telegram Search
   *
   * خیلی مهم:
   * حتی اگر Search داخلی
   * نتیجه بدهد هم اجرا می‌شود.
   */

  try {
    globalResults =
      await telegramGlobalSearch(
        env,
        request,
        query,
        limit,
      );

    console.log(
      "Global search result",
      {
        query,
        count:
          globalResults.length,
      },
    );
  } catch (error) {
    globalError =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "Global Telegram search failed",
      error,
    );
  }

  /*
   * ادغام
   */

  const results =
    mergeSearchResults(
      indexedResults,
      globalResults,
      query,
      limit,
    );

  /*
   * اگر هیچ نتیجه‌ای نداریم
   * ولی یکی از سرویس‌ها خطا داده،
   * خطای واقعی را هم برگردان.
   */

  if (
    !results.length
  ) {
    const error =
      indexedError ||
      globalError;

    if (error) {
      return json(
        {
          ok: false,

          error,

          results: [],

          query,

          sources: {
            discovery:
              Boolean(
                !indexedError,
              ),
            telegram:
              Boolean(
                !globalError,
              ),
          },

          request_id:
            requestId,
        },
        500,
        request,
      );
    }
  }

  return json(
    {
      ok: true,

      query,

      count:
        results.length,

      results,

      sources: {
        discovery_count:
          indexedResults.length,

        telegram_global_count:
          globalResults.length,
      },

      request_id:
        requestId,
    },
    200,
    request,
  );
}

/* =========================================================
   DISCOVERY API PROXY
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

  return remainder.startsWith(
    "/",
  )
    ? remainder
    : `/${remainder}`;
}

async function proxyDiscovery(
  request: Request,
  path: string,
): Promise<Response> {
  const incomingUrl =
    new URL(
      request.url,
    );

  const targetUrl =
    new URL(
      DISCOVERY_API_URL,
    );

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
      request.headers.get(
        name,
      );

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
    request.method !==
      "GET" &&
    request.method !==
      "HEAD"
  ) {
    body =
      await request.arrayBuffer();
  }

  let response:
    Response;

  try {
    response =
      await fetch(
        targetUrl.toString(),
        {
          method:
            request.method,

          headers,

          body,

          redirect:
            "follow",
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
    ) ||
      requestId,
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
      new URL(
        request.url,
      );

    /*
     * CORS
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
     * Unified Telegram Search
     *
     * This endpoint now does BOTH:
     *
     * 1. Discovery database search
     * 2. Telegram Global Search
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
          "Telegram unified search fatal error",
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
     */

    const path =
      discoveryPath(
        url,
      );

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
