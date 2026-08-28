interface Env {
  ASSETS: Fetcher;
}

const DISCOVERY_API_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/discovery-api-live";

const SEARCH_API_URL =
  "https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/discovery-search-v4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-telegram-init-data",
    "x-request-id",
  ].join(", "),
  "Access-Control-Allow-Methods":
    "GET,POST,OPTIONS,PUT,PATCH,DELETE",
  "Cache-Control": "no-store",
};

function corsHeaders(request: Request): Headers {
  const headers = new Headers(CORS_HEADERS);

  const origin =
    request.headers.get("Origin");

  if (origin) {
    headers.set(
      "Access-Control-Allow-Origin",
      origin,
    );
  }

  return headers;
}

function json(
  data: unknown,
  status = 200,
  request?: Request,
): Response {
  const headers =
    corsHeaders(
      request ||
        new Request(
          "https://localhost/",
        ),
    );

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
   REQUEST ID
========================================================= */

function requestId(
  request: Request,
): string {
  return (
    request.headers.get(
      "x-request-id",
    ) ||
    crypto.randomUUID()
  );
}

/* =========================================================
   TELEGRAM SEARCH
========================================================= */

/*
 * این endpoint عمداً دیگر teleproto را اجرا نمی‌کند.
 *
 * تمام Search به Supabase Search Gateway می‌رود.
 *
 * آن Gateway:
 *
 * 1. Search داخلی Discovery
 * 2. Telegram Global Search
 * 3. Merge
 * 4. Deduplicate
 * 5. Ranking
 *
 * را انجام می‌دهد.
 */

async function telegramSearch(
  request: Request,
): Promise<Response> {
  const id =
    requestId(request);

  const incoming =
    new URL(
      request.url,
    );

  const query =
    (
      incoming.searchParams.get(
        "q",
      ) ||
      ""
    ).trim();

  const limit =
    incoming.searchParams.get(
      "limit",
    ) ||
    "20";

  if (!query) {
    return json(
      {
        ok: false,
        error:
          "Search query is required",
        results: [],
        items: [],
        request_id: id,
      },
      400,
      request,
    );
  }

  const target =
    new URL(
      SEARCH_API_URL,
    );

  target.searchParams.set(
    "q",
    query,
  );

  target.searchParams.set(
    "limit",
    limit,
  );

  const headers =
    new Headers();

  /*
   * Telegram Mini App identity
   *
   * این header برای Search داخلی
   * استفاده می‌شود.
   */

  const initData =
    request.headers.get(
      "x-telegram-init-data",
    );

  if (initData) {
    headers.set(
      "x-telegram-init-data",
      initData,
    );
  }

  headers.set(
    "x-request-id",
    id,
  );

  /*
   * در صورت وجود، request metadata
   * را عبور می‌دهیم.
   */

  for (
    const name of [
      "authorization",
      "apikey",
      "x-client-info",
    ]
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

  try {
    const response =
      await fetch(
        target.toString(),
        {
          method: "GET",
          headers,
          redirect: "follow",
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
        ok: false,
        error: raw,
      };
    }

    /*
     * API جدید از items استفاده می‌کند.
     *
     * برای سازگاری با frontend قدیمی،
     * results هم برمی‌گردانیم.
     */

    const items =
      Array.isArray(
        data?.items,
      )
        ? data.items
        : Array.isArray(
            data?.results,
          )
          ? data.results
          : [];

    const normalized = {
      ...data,

      ok:
        data?.ok !== false &&
        response.ok,

      query,

      count:
        items.length,

      items,

      results:
        items,

      request_id:
        data?.request_id ||
        id,
    };

    return json(
      normalized,
      response.status,
      request,
    );
  } catch (error) {
    console.error(
      "Unified search proxy error",
      id,
      error,
    );

    return json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Search service unreachable",

        query,

        count: 0,

        items: [],

        results: [],

        request_id: id,
      },
      502,
      request,
    );
  }
}

/* =========================================================
   TELEGRAM HEALTH
========================================================= */

async function telegramHealth(
  request: Request,
): Promise<Response> {
  const id =
    requestId(request);

  /*
   * Cloudflare دیگر Telegram Client
   * را اجرا نمی‌کند.
   *
   * Telegram Search Gateway در
   * Supabase مسئول اتصال MTProto است.
   *
   * بنابراین این endpoint فقط
   * وضعیت proxy را اعلام می‌کند.
   */

  return json(
    {
      ok: true,
      service:
        "telegram-search-proxy",
      backend:
        "telegram-mtproto-v2",
      request_id: id,
    },
    200,
    request,
  );
}

/* =========================================================
   DISCOVERY API PROXY
========================================================= */

function getDiscoveryPath(
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
    ) ||
    "/";

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
  const id =
    requestId(request);

  const incoming =
    new URL(
      request.url,
    );

  const target =
    new URL(
      DISCOVERY_API_URL,
    );

  target.pathname =
    `${target.pathname}${path}`;

  target.search =
    incoming.search;

  const headers =
    new Headers();

  for (
    const name of [
      "authorization",
      "apikey",
      "content-type",
      "x-client-info",
      "x-telegram-init-data",
      "x-request-id",
    ]
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

  headers.set(
    "x-request-id",
    id,
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

  try {
    const response =
      await fetch(
        target.toString(),
        {
          method:
            request.method,

          headers,

          body,

          redirect:
            "follow",
        },
      );

    const responseHeaders =
      new Headers(
        response.headers,
      );

    const origin =
      request.headers.get(
        "Origin",
      );

    responseHeaders.set(
      "Access-Control-Allow-Origin",
      origin || "*",
    );

    responseHeaders.set(
      "Access-Control-Allow-Headers",
      CORS_HEADERS[
        "Access-Control-Allow-Headers"
      ],
    );

    responseHeaders.set(
      "Access-Control-Allow-Methods",
      CORS_HEADERS[
        "Access-Control-Allow-Methods"
      ],
    );

    responseHeaders.set(
      "Cache-Control",
      "no-store",
    );

    responseHeaders.set(
      "X-Request-Id",
      response.headers.get(
        "X-Request-Id",
      ) ||
        id,
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
  } catch (error) {
    console.error(
      "Discovery proxy error",
      id,
      error,
    );

    return json(
      {
        ok: false,

        error:
          "Discovery API is unreachable",

        request_id: id,
      },
      502,
      request,
    );
  }
}

/* =========================================================
   MAIN
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
     * Telegram Search
     */

    if (
      url.pathname ===
      "/api/telegram/search"
    ) {
      return telegramSearch(
        request,
      );
    }

    /*
     * Telegram health
     */

    if (
      url.pathname ===
      "/api/telegram/health"
    ) {
      return telegramHealth(
        request,
      );
    }

    /*
     * Discovery API
     */

    const path =
      getDiscoveryPath(
        url,
      );

    if (path) {
      return proxyDiscovery(
        request,
        path,
      );
    }

    /*
     * Frontend
     */

    return env.ASSETS.fetch(
      request,
    );
  },
};
