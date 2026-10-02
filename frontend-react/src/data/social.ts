import { requestJson } from './live';
export type Social = {likes:number;comments:number;liked:boolean};
export type Comment = {id:string;body:string;author:string;created_at:string;mine:boolean;reported:boolean;parent?:{author:string;body:string}|null};
export const validContentId=(id?:string)=>Boolean(id&&/^[0-9a-f-]{36}$/i.test(id));
export const socialRequest=(path:string, options:any={})=>requestJson('/api/discovery'+path,{timeout:25000,...options}) as Promise<any>;
const cache=new Map<string,Social>();
export const cachedSocial=(id?:string)=>id?cache.get(id):undefined;
export function publishSocial(id:string,value:Social){cache.set(id,value);window.dispatchEvent(new CustomEvent('td-social',{detail:{id,value}}));}
