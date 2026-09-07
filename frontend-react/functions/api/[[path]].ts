const WORKER_ORIGIN =
  'https://telegram-discovery-app.paniapandora.workers.dev';

const jsonRows = (value: unknown, depth = 0): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || depth > 5) return [];

  const source = value as Record<string, unknown>;

  for (const key of [
    'items',
    'results',
    'posts',
    'feed',
    'channels',
    'saved',
    'history',
    'data',
  ]) {
    const child = source[key];

    if (Array.isArray(child)) return child;

    if (child && typeof child === 'object') {
      const nested = jsonRows(child, depth + 1);
      if (nested.length) return nested;
    }
  }

  return [];
};

const proxyHeaders = (request: Request) => {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  return headers;
};

const buildInit = (request: Request, headers: Headers): RequestInit => {
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'follow',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
  }

  return init;
};

const decorateResponse = (
  upstream: Response,
  extraHeaders: Record<string, string> = {},
) => {
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('Cache-Control', 'no-store');
  responseHeaders.set('X-TD-Proxy', 'pages-worker-bridge-v2');

  for (const [name, value] of Object.entries(extraHeaders)) {
    responseHeaders.set(name, value);
  }

  return responseHeaders;
};

export async function onRequest(context: { request: Request }) {
  const incoming = new URL(context.request.url);
  const headers = proxyHeaders(context.request);

  // Creator Center:
  // no channel_id means "load the channel catalog", which belongs to /channels.
  // Dashboard metrics with channel_id remain unchanged.
  const requestedPath =
    incoming.pathname === '/api/creator/dashboard' &&
    !incoming.searchParams.has('channel_id')
      ? '/api/creator/channels'
      : incoming.pathname;

  const target = new URL(requestedPath, WORKER_ORIGIN);
  target.search = incoming.search;

  try {
    const upstream = await fetch(
      target.toString(),
      buildInit(context.request, headers),
    );

    // Personalized Home can be a valid 200 with zero rows.
    // If that happens, keep Home LIVE by falling back to live Explore data.
    if (
      context.request.method === 'GET' &&
      incoming.pathname === '/api/discovery/feed' &&
      upstream.ok
    ) {
      const raw = await upstream.text();
      let parsed: unknown = {};

      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = {};
      }

      if (jsonRows(parsed).length === 0) {
        const fallback = new URL('/api/discovery/explore', WORKER_ORIGIN);
        fallback.searchParams.set(
          'limit',
          incoming.searchParams.get('limit') || '18',
        );

        const fallbackResponse = await fetch(fallback.toString(), {
          method: 'GET',
          headers,
          redirect: 'follow',
        });

        if (fallbackResponse.ok) {
          return new Response(fallbackResponse.body, {
            status: fallbackResponse.status,
            statusText: fallbackResponse.statusText,
            headers: decorateResponse(fallbackResponse, {
              'X-TD-Feed-Fallback': 'explore',
            }),
          });
        }
      }

      return new Response(raw, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: decorateResponse(upstream),
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: decorateResponse(upstream, {
        ...(requestedPath !== incoming.pathname
          ? { 'X-TD-Route-Rewrite': requestedPath }
          : {}),
      }),
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Upstream unavailable',
      }),
      {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-td-proxy': 'pages-worker-bridge-v2',
        },
      },
    );
  }
}
