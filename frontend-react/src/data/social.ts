import { getTelegramUser, requestJson } from './live';
export type Social = {likes:number;comments:number;liked:boolean};
export type Comment = {id:string;body:string;author:string;created_at:string;mine:boolean;reported:boolean;parent?:{author:string;body:string}|null};
export const validContentId=(id?:string)=>Boolean(id&&/^[0-9a-f-]{36}$/i.test(id));
export const socialAccount=()=>String(getTelegramUser()?.id ?? 'guest');
export async function socialRequest(path:string, options:any={}) {
 const account=socialAccount();
 const value=await requestJson('/api/discovery'+path,{timeout:25000,...options});
 if(account!==socialAccount())throw new DOMException('Account changed','AbortError');
 return value as any;
}
const cache=new Map<string,Social>();
const revisions=new Map<string,number>();
const pending=new Map<string,Promise<Social>>();
const key=(id:string,account=socialAccount())=>`${account}:${id}`;
export const cachedSocial=(id?:string)=>id?cache.get(key(id)):undefined;
export const socialSnapshot=(id:string)=>({account:socialAccount(),revision:revisions.get(key(id))||0});
export function publishSocial(id:string,value:Social,snapshot=socialSnapshot(id)) {
 const k=key(id,snapshot.account);
 if(snapshot.account!==socialAccount()||snapshot.revision!==(revisions.get(k)||0))return;
 const clean={likes:value.likes,comments:value.comments,liked:value.liked};
 cache.set(k,clean);
 window.dispatchEvent(new CustomEvent('td-social',{detail:{id,value:clean,account:snapshot.account}}));
}
export async function loadSocial(id:string,signal?:AbortSignal) {
 const snapshot=socialSnapshot(id);
 const value=await socialRequest(`/social?content_id=${id}`,{signal});
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 publishSocial(id,value,snapshot);
 return cachedSocial(id)||value;
}
// A post can appear in the feed and viewer simultaneously. Share one mutation.
export function toggleSocial(id:string,fallback?:Social|null):Promise<Social> {
 const k=key(id),existing=pending.get(k);
 if(existing)return existing;
 const account=socialAccount();
 revisions.set(k,(revisions.get(k)||0)+1);
 const operation=(async()=>{
  const current=cachedSocial(id)||fallback||await socialRequest(`/social?content_id=${id}`);
  if(account!==socialAccount())throw new DOMException('Account changed','AbortError');
  const updated=await socialRequest('/like',{method:'POST',body:{content_id:id,liked:!current.liked}});
  revisions.set(k,(revisions.get(k)||0)+1);
  publishSocial(id,updated,{account,revision:revisions.get(k)!});
  return updated as Social;
 })().finally(()=>{revisions.set(k,(revisions.get(k)||0)+1);pending.delete(k);});
 pending.set(k,operation);
 return operation;
}
