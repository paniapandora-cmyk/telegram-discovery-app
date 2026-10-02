import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import type { Post } from '../types';
import { cachedSocial, publishSocial, socialRequest, validContentId, type Social } from '../data/social';
import CommentsSheet from './CommentsSheet';
import '../styles/social.css';
export default function PostActions({post}:{post:Post}) {
 const [value,setValue]=useState<Social|null>(cachedSocial(post.contentId)||post.social||null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const lock=useRef(false); const id=post.contentId;
 useEffect(()=>{
  setValue(cachedSocial(id)||post.social||null);setError('');setOpen(false);
  const controller=new AbortController();
  if(validContentId(id)&&!post.social) socialRequest(`/social?content_id=${id}`,{signal:controller.signal}).then(setValue).catch(()=>{if(!controller.signal.aborted)setError('آمار دریافت نشد؛ برای تلاش دوباره روی لایک بزن.');});
  const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.id===id)setValue(d.value);};
  window.addEventListener('td-social',sync);return()=>{controller.abort();window.removeEventListener('td-social',sync);};
 },[id,post.social]);
 const like=async()=>{
  if(lock.current||!id)return;lock.current=true;setBusy(true);setError('');
  try {
   const current=value||await socialRequest(`/social?content_id=${id}`);
   const updated=await socialRequest('/like',{method:'POST',body:{content_id:id,liked:!current.liked}});
   setValue(updated);publishSocial(id,updated);
  } catch {setError('لایک ثبت نشد؛ دوباره امتحان کن.');} finally {lock.current=false;setBusy(false);}
 };
 const enabled=validContentId(id);
 return <>
  <button type="button" className={`statPill socialLike ${value?.liked?'isLiked':''}`} disabled={!enabled||busy} aria-label={value?.liked?'برداشتن لایک':'لایک در دیسکاوری'} aria-pressed={Boolean(value?.liked)} onClick={e=>{e.stopPropagation();void like();}}><Heart fill={value?.liked?'currentColor':'none'}/><span>{value?value.likes.toLocaleString('fa-IR'):'—'}</span></button>
  <button type="button" className="statPill" disabled={!enabled} aria-label="نظرات دیسکاوری" onClick={e=>{e.stopPropagation();setOpen(true);}}><MessageCircle/><span>{value?value.comments.toLocaleString('fa-IR'):'—'}</span></button>
  {error&&<span className="socialError" role="status">{error}</span>}
  {!enabled&&<small className="socialError">تعامل برای این پیش‌نمایش در دسترس نیست.</small>}
  {open&&id&&<CommentsSheet contentId={id} title={post.title} onClose={()=>setOpen(false)}/>}
 </>;
}
