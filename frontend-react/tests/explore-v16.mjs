import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/data/explore.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
globalThis.window = { setTimeout, clearTimeout };
const api = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const catalog = Array.from({length: 131}, (_, i) => ({content_id: `00000000-0000-4000-8000-${String(i).padStart(12,'0')}`, content_type: i === 0 ? 'VIDEO' : 'TEXT', text_content: `Text ${i}`, title: `Title ${i}`, source_url: `https://t.me/example_channel/${i+1}`}));
let calls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(options.method, 'POST');
  assert.ok(url.endsWith('/api/discovery/explore'));
  const body = JSON.parse(options.body);
  // Scores can reorder results after impressions. Exclusion must still advance.
  const ranked = calls++ % 2 ? [...catalog].reverse() : catalog;
  const unseen = ranked.filter(post => !body.exclude_ids.includes(post.content_id));
  return new Response(JSON.stringify({items: unseen.slice(0, body.limit), has_more: unseen.length > body.limit}));
};
let all = [], more = true;
while (more) {
  assert.ok(calls < 10, 'Pagination must terminate');
  const result = await api.loadExplorePage(all.map(post => post.contentId));
  all.push(...result.posts); more = result.hasMore;
}
assert.equal(all.length, 131);
assert.equal(new Set(all.map(post => post.id)).size, 131);
assert.equal(all[0].kind, 'video');
assert.equal(all[1].kind, 'text');
assert.equal(all[1].excerpt, 'Text 1');
globalThis.fetch = async () => new Response(JSON.stringify({items: []}));
await assert.rejects(api.loadExplorePage([]), /پاسخ/);
globalThis.fetch = async () => new Response(JSON.stringify({ok: false, error: 'Temporary failure'}), {status: 503});
await assert.rejects(api.loadExplorePage([]), /Temporary failure/);
console.log('PASS: 131 posts across reordered pages, unique IDs, end state, text/video mapping, invalid response and retryable error');
