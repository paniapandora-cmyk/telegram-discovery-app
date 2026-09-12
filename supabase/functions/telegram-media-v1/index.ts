const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,x-request-id',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

function parsePost(value: string) {
  try {
    const input = new URL(value);
    if (!['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me'].includes(input.hostname.toLowerCase())) return null;
    const match = input.pathname.match(/^\/(?:s\/)?([A-Za-z0-9_]{4,32})\/(\d+)/);
    if (!match) return null;
    return { channel: match[1], messageId: match[2], canonical: `https://t.me/${match[1]}/${match[2]}` };
  } catch {
    return null;
  }
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match?.[2] ? decode(match[2]) : null;
}

function fromSrcset(value: string | null) {
  if (!value) return null;
  const parts = value.split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
  return parts.at(-1) || null;
}

function background(style: string | null) {
  if (!style) return null;
  const value = style.match(/background(?:-image)?\s*:\s*(?:[^;]*?url\()?\s*(["']?)(https?:\/\/[^)'";\s]+)\1/i)?.[2]
    || style.match(/url\(\s*(["']?)(https?:\/\/[^)'"\s]+)\1\s*\)/i)?.[2];
  return value ? decode(value) : null;
}

function metaImage(html: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = (attr(tag, 'property') || attr(tag, 'name') || '').toLowerCase();
    if (!['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(key)) continue;
    const content = attr(tag, 'content');
    if (content) return content;
  }
  return null;
}

function mediaCandidates(html: string) {
  const urls: string[] = [];
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const clean = decode(value).trim().replace(/^['"]|['"]$/g, '');
    if (/^https?:\/\//i.test(clean) && !urls.includes(clean)) urls.push(clean);
  };

  const tags = html.match(/<[^>]+>/g) || [];
  const mediaClass = /tgme_widget_message_(?:photo|photo_wrap|video|video_thumb|document|document_thumb|link_preview|link_preview_image)|js-message_(?:photo|video)|media_wrap/i;

  for (const tag of tags) {
    if (!mediaClass.test(tag)) continue;
    add(background(attr(tag, 'style')));
    add(attr(tag, 'poster'));
    add(attr(tag, 'src'));
    add(attr(tag, 'data-src'));
    add(attr(tag, 'data-original'));
    add(fromSrcset(attr(tag, 'srcset')));
  }

  for (const tag of tags) {
    if (!/^<(?:video|img|source)\b/i.test(tag)) continue;
    if (!/tgme_widget_message|telegram|cdn-telegram|telesco\.pe/i.test(tag)) continue;
    add(attr(tag, 'poster'));
    add(attr(tag, 'src'));
    add(attr(tag, 'data-src'));
    add(fromSrcset(attr(tag, 'srcset')));
  }

  const cssUrls = html.match(/https:\/\/[^"'()\s<>]+(?:\.jpg|\.jpeg|\.png|\.webp)(?:\?[^"'()\s<>]*)?/gi) || [];
  cssUrls.forEach(add);
  add(metaImage(html));
  return urls;
}

function trusted(url: URL) {
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') return false;
  return host === 't.me'
    || host === 'telegram.org'
    || host.endsWith('.telegram.org')
    || host === 'telegram-cdn.org'
    || host.endsWith('.telegram-cdn.org')
    || host === 'cdn-telegram.org'
    || host.endsWith('.cdn-telegram.org')
    || host === 'telesco.pe'
    || host.endsWith('.telesco.pe');
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; TelegramDiscoveryMedia/3.0)',
    },
    redirect: 'follow',
  });
  if (!response.ok) return '';
  return response.text();
}

async function fetchImage(initial: string) {
  let current = new URL(initial);
  for (let i = 0; i < 5; i++) {
    if (!trusted(current)) throw new Error('Untrusted media host');
    const response = await fetch(current.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        Referer: 'https://t.me/',
        'User-Agent': 'Mozilla/5.0 (compatible; TelegramDiscoveryMedia/3.0)',
      },
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!['GET', 'HEAD'].includes(request.method)) return json({ ok: false, error: 'Method not allowed' }, 405);

  const incoming = new URL(request.url);
  const post = parsePost(incoming.searchParams.get('url') || '');
  if (!post) return json({ ok: false, error: 'Invalid Telegram post URL' }, 400);

  try {
    const pages = [
      `${post.canonical}?embed=1&mode=tme`,
      `${post.canonical}?single=1`,
      post.canonical,
      `https://t.me/s/${post.channel}/${post.messageId}`,
    ];

    const candidates: string[] = [];
    for (const page of pages) {
      const html = await fetchPage(page);
      if (!html) continue;
      for (const value of mediaCandidates(html)) {
        if (!candidates.includes(value)) candidates.push(value);
      }
    }

    for (const candidate of candidates) {
      let url: URL;
      try { url = new URL(candidate, post.canonical); } catch { continue; }
      if (!trusted(url)) continue;
      const image = await fetchImage(url.toString());
      const type = image.headers.get('content-type') || '';
      if (!image.ok || !type.startsWith('image/')) continue;

      const headers = new Headers(CORS);
      headers.set('Content-Type', type);
      headers.set('Cache-Control', 'public, max-age=1800, s-maxage=21600, stale-while-revalidate=604800');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Telegram-Media-Source', 'telegram-media-v1');
      return new Response(request.method === 'HEAD' ? null : image.body, { status: 200, headers });
    }

    return json({ ok: false, error: 'No public preview image found' }, 404);
  } catch (error) {
    console.error('telegram-media-v1', post.canonical, error);
    return json({ ok: false, error: 'Telegram media unavailable' }, 502);
  }
});
