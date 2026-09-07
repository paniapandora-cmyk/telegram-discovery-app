const WORKER_ORIGIN =
  'https://telegram-discovery-app.paniapandora.workers.dev';

export async function onRequest(context: { request: Request }) {
  const incoming = new URL(context.request.url);
  const target = new URL(
    incoming.pathname + incoming.search,
    WORKER_ORIGIN,
  );

  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: 'follow',
  };

  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = context.request.body;
  }

  try {
    const upstream = await fetch(target.toString(), init);
    const responseHeaders = new Headers(upstream.headers);

    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set(
      'X-TD-Proxy',
      'pages-worker-bridge-v1',
    );

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
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
          'content-type':
            'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-td-proxy': 'pages-worker-bridge-v1',
        },
      },
    );
  }
}
