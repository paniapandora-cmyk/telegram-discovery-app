export function publicVideo(html:string):string|null {
 const tags=html.match(/<(?:video|source)\b[^>]*>/gi)||[];
 for(const tag of tags){
  const raw=tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
  if(!raw)continue;
  const value=raw.replace(/&amp;/g,'&').replace(/&#38;/g,'&');
  try {const u=new URL(value);const h=u.hostname.toLowerCase();
   if(u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(h.endsWith('.telegram.org')||h==='telegram.org'||h.endsWith('.cdn-telegram.org')||h==='cdn-telegram.org'||h.endsWith('.telegram-cdn.org')||h==='telegram-cdn.org'||h==='telesco.pe'||h.endsWith('.telesco.pe')))return u.href;
  }catch{}
 }
 return null;
}
