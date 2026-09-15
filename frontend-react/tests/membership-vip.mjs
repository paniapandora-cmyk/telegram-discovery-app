import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { createHmac } from 'node:crypto';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create table users(telegram_user_id bigint primary key, created_at timestamptz default now());`);
await db.exec(await readFile('../supabase/migrations/20260911_growth_referrals_v1.sql', 'utf8'));
const startSql = await readFile('../supabase/migrations/20260911000100_bot_start_tracking.sql', 'utf8');
await db.exec(startSql.split('CREATE OR REPLACE FUNCTION')[0]);
await db.exec(await readFile('../supabase/migrations/20260915093000_hoviat_vip_v1.sql', 'utf8'));
const rpc = async (id, verify = false, consume = false) => (await db.query(
  'select discovery_access_v1($1, $2, $3) as access', [id, verify, consume])).rows[0].access;
const start = async (id, token, age = '0 seconds') => db.query(`insert into bot_start_events
  (chat_id,message_id,telegram_update_id,telegram_user_id,start_payload,occurred_at)
  values($1,1,$1,$1,$2,now()-$3::interval)`, [id, token, age]);
await db.exec(`insert into growth_links(token, owner_telegram_user_id, kind, created_at)
  values('g_inviter100',100,'invite',now()-interval '10 days'),('g_inviter200',200,'invite',now()-interval '10 days');`);
assert.equal((await rpc(100)).ai_daily_limit, 5);
for (const [id, count, limit] of [[101,1,10],[102,2,15],[103,3,30]]) {
  await start(id, 'g_inviter100');
  await rpc(id, true);
  await rpc(id, true);
  const state = await rpc(100);
  assert.equal(state.verified_invites, count);
  assert.equal(state.ai_daily_limit, limit);
  assert.equal(state.vip, count === 3);
}
// Self-referral, old user, old start, and second-link attribution do not count.
await start(100, 'g_inviter100'); await rpc(100, true);
await db.exec(`insert into users values(104, now()-interval '1 day');`);
await start(104, 'g_inviter100'); await rpc(104, true);
assert.equal((await rpc(104)).legacy, true);
assert.equal((await rpc(104)).ai_daily_limit, 30);
await start(105, 'g_inviter100', '8 days'); await rpc(105, true);
await start(106, null);
await db.exec(`insert into bot_start_events values(106,2,1060,106,'g_inviter100',now(),now());`);
await rpc(106, true);
assert.equal((await rpc(100)).verified_invites, 3);
assert.equal((await rpc(200)).verified_invites, 0);
// Quota increments are database-side and cannot exceed the cap.
const outcomes = await Promise.all(Array.from({length: 35}, () => rpc(100, true, true)));
assert.equal(outcomes.filter(x => x.allowed).length, 30);
assert.equal((await rpc(100)).ai_remaining, 0);
await rpc(500, true);
await db.exec(`insert into discovery_ai_daily_v1 values(500, (now() at time zone 'Asia/Tehran')::date - 1, 5);`);
assert.equal((await rpc(500, true, true)).ai_remaining, 4, 'Yesterday usage must not count today');
await assert.rejects(rpc(999, false, true), /membership_verification_required/);
await db.exec('set role anon;');
await assert.rejects(rpc(100), /permission denied/);
await db.exec('reset role;');
await db.close();

async function load(path) {
  const { outputFiles } = await build({ entryPoints:[path], bundle:true, write:false, platform:'node', format:'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
}
const { isChannelMember, checkHoviatMembership } = await load('../supabase/functions/_shared/hoviat.ts');
for (const status of ['member','administrator','creator']) assert.equal(isChannelMember({status}), true);
for (const status of ['left','kicked','unknown','restricted']) assert.equal(isChannelMember({status}), false);
assert.equal(isChannelMember({status:'restricted',is_member:true}), true);
globalThis.fetch = async () => Response.json({ok:false,description:'bot not admin'}, {status:400});
await assert.rejects(checkHoviatMembership('test-token',100), /membership_check_unavailable/);
globalThis.fetch = async () => Response.json({ok:true,result:{status:'left'}});
assert.equal(await checkHoviatMembership('test-token',100), false);
const worker = (await load('../worker.ts')).default;
const url = 'https://example.test/api/discovery/feed';
assert.equal((await worker.fetch(new Request(url), {})).status, 401);
globalThis.fetch = async () => Response.json({ok:false,error:'membership_required'}, {status:403});
assert.equal((await worker.fetch(new Request(url,{headers:{'x-telegram-init-data':'test'}}),{})).status,403);
globalThis.fetch = async () => { throw new Error('offline'); };
assert.equal((await worker.fetch(new Request(url,{headers:{'x-telegram-init-data':'test'}}),{})).status,503);
console.log('Membership, unique referral, VIP, quota and API gate checks passed');

// Exercise the AI gateway with valid signed test-only Telegram data.
let gateway;
globalThis.Deno = { env: { get: key => ({ TELEGRAM_BOT_TOKEN:'test-token',OPENAI_API_KEY:'test-key',SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test-service' }[key]) }, serve: fn => { gateway = fn; } };
const bundled = await build({entryPoints:['../supabase/functions/ai-gateway-v1/index.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{
  name:'edge-types', setup(build) {
    build.onResolve({filter:/^jsr:/}, args => ({path:args.path,namespace:'empty'}));
    build.onLoad({filter:/.*/,namespace:'empty'}, () => ({contents:'',loader:'js'}));
  },
}]});
await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const params = new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:100})});
const checkString = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
const secret = createHmac('sha256','WebAppData').update('test-token').digest();
params.set('hash',createHmac('sha256',secret).update(checkString).digest('hex'));
const request = () => new Request('https://gateway.test', {method:'POST',headers:{'x-telegram-init-data':params.toString()},body:JSON.stringify({message:'سلام'})});
let providerCalls=0, member=false, allowed=false;
globalThis.fetch = async url => {
  if (String(url).includes('api.telegram.org')) return Response.json({ok:true,result:{status:member?'member':'left'}});
  if (String(url).includes('db.test')) return Response.json({allowed});
  providerCalls++;
  return Response.json({output_text:'سلام'});
};
assert.equal((await gateway(request())).status,403);
member=true;
assert.equal((await gateway(request())).status,429);
assert.equal(providerCalls,0,'No paid provider call before membership and quota checks');
allowed=true;
assert.equal((await gateway(request())).status,200);
assert.equal(providerCalls,1);
console.log('AI gateway membership and quota enforcement checks passed');
