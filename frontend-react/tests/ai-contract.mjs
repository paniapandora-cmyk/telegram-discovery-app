import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(path) {
  const { outputFiles } = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
}
const { sendAIMessage } = await load('src/data/ai.ts');
let calls = 0;
globalThis.fetch = async () => { calls++; return Response.json({ ok: true, reply: 'سلام' }); };
await assert.rejects(sendAIMessage('سلام', undefined));
assert.equal(calls, 0, 'Missing Telegram authentication must never call the server');
assert.equal((await sendAIMessage('سلام', { initData: 'test-only' })).reply, 'سلام');
globalThis.fetch = async () => Response.json({ ok: true, reply: {} });
await assert.rejects(sendAIMessage('سلام', { initData: 'test-only' }), /پاسخ خالی/);

const worker = (await load('../worker.ts')).default;
let target;
globalThis.fetch = async (url, init) => {
  target = String(url);
  assert.equal(new Headers(init.headers).get('x-telegram-init-data'), 'test-only');
  return Response.json({ ok: false, error: 'telegram_auth_invalid' }, { status: 401 });
};
const response = await worker.fetch(new Request('https://example.test/api/ai/chat', {
  method: 'POST', headers: { 'x-telegram-init-data': 'test-only' }, body: JSON.stringify({ message: 'سلام' }),
}), {});
assert.equal(response.status, 401, 'Worker must forward authentication failure, not return route 404');
assert.equal(target, 'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/ai-gateway-v1');
assert.equal((await worker.fetch(new Request('https://example.test/api/ai/chat'), {})).status, 405);
console.log('AI client and production Worker contract checks passed');
