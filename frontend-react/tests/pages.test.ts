import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncPages, type Options } from '../supabase/functions/telegram-source-sync-v2/pages.ts';

function source(ids: number[]) {
  return async function* (o: Options) {
    const rows = ids.filter(id => id > (o.minId ?? 0) && (!o.offsetId || id < o.offsetId));
    rows.sort((a,b) => o.reverse ? a-b : b-a);
    for (const id of rows.slice(0,o.limit)) yield {id};
  };
}
test('history crosses 100 messages while fresh posts continue', async () => {
  const ids = Array.from({length:343},(_,i)=>i+1);
  const saved = new Set(ids.filter(id=>id>=239));
  let state={cursor:343,before:0,complete:false};
  let rounds=0;
  while(!state.complete) {
    ids.push(344+rounds);
    state=await syncPages(state,1,50,source(ids),async m=>{saved.add(m.id);});
    assert.equal(state.cursor,344+rounds);
    assert.ok(++rounds<20);
  }
  assert.equal(saved.size,ids.length);
  for(const id of ids)assert.ok(saved.has(id));
});
test('fresh burst processes oldest unseen first, without gaps',async()=>{
  let state={cursor:100,before:1,complete:true};
  const saved:number[]=[];
  for(let i=0;i<3;i++)state=await syncPages(state,2,50,source([101,102,103,104,105]),async m=>{saved.push(m.id);});
  assert.deepEqual(saved,[101,102,103,104,105]);
  assert.equal(state.cursor,105);
});
test('failed save retains checkpoints and retry fills the missing item',async()=>{
  const state={cursor:5,before:4,complete:false};
  const saved=new Set<number>();
  await assert.rejects(syncPages(state,1,2,source([1,2,3,4,5,6]),async m=>{
    if(m.id===2)throw Error('database unavailable'); saved.add(m.id);
  }));
  assert.deepEqual(state,{cursor:5,before:4,complete:false});
  const next=await syncPages(state,1,2,source([1,2,3,4,5,6]),async m=>{saved.add(m.id);});
  assert.equal(next.before,2);assert.equal(next.cursor,6);assert.equal(saved.size,3);
});
test('empty history marks completion; completed history is not scanned again',async()=>{
  let calls=0;
  const iterate=async function*(o:Options){calls++;yield* source([])(o);};
  const done=await syncPages({cursor:9,before:1,complete:false},1,50,iterate,async()=>{});
  assert.ok(done.complete);assert.equal(calls,2);
  calls=0;await syncPages(done,1,50,iterate,async()=>{});assert.equal(calls,1);
});
test('service messages advance history cursor after successful handling',async()=>{
  const next=await syncPages({cursor:10,before:4,complete:false},1,2,source([1,2,3]),async()=>{});
  assert.equal(next.before,2);assert.equal(next.complete,false);assert.equal(next.cursor,10);
});
