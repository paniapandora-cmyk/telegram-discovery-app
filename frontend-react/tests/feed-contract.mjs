import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/data/live.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm',
});
globalThis.window = { setTimeout, clearTimeout };
let rows = [];
globalThis.fetch = async () => new Response(JSON.stringify({ items: rows }));
const api = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

rows = [{ content_id: 'video-1', creator_id: 'creator-1',
  channel_username: 'example_channel', channel_name: 'Example',
  title: 'Original video title', description: 'A different description',
  content_type: 'VIDEO', source_url: 'https://t.me/example_channel/12' }];
let posts = await api.loadLivePosts('fresh');
assert.equal(posts[0].kind, 'video', 'Backend VIDEO must retain its video badge');
assert.equal(posts[0].title, 'Original video title', 'Preserve API title');
assert.equal(posts[0].excerpt, 'A different description');
assert.equal(posts[0].telegramUrl, 'https://t.me/example_channel/12');
assert.equal(posts[0].creatorId, 'creator-1');

rows = [{ id: 'text-1', text_content: 'Full post text', content_type: 'TEXT' }];
posts = await api.loadLivePosts('fresh');
assert.equal(posts[0].excerpt, 'Full post text');
assert.equal(posts[0].kind, 'text');

rows = [{ id: 'legacy-1', caption: 'Legacy caption', media_type: 'video',
  source_url: 'https://t.me/example_channel/13' }];
posts = await api.loadLivePosts('fresh');
assert.equal(posts[0].kind, 'video');
assert.equal(posts[0].title, 'Legacy caption');
console.log('Feed API contract checks passed');
