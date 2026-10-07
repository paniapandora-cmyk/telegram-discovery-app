import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import type { Post } from '../types';
import { cachedSocial, loadSocial, toggleSocial, socialAccount, validContentId, type Social } from '../data/social';
import CommentsSheet from './CommentsSheet';
import '../styles/social.css';
export default function PostActions({post}:{post:Post}) {
 return <PostActionsSession key={`${socialAccount()}:${post.contentId}`} post={post}/>;
}
function PostActionsSession({post}:{post:Post}) {
 const [value,setValue]=useState<Social|null>(cachedSocial(post.contentId)||post.social||null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const lock=useRef(false),alive=useRef(true); const id=post.contentId;
 useEffect(()=>{
  alive.current=true;
  const controller=new AbortController();
  if(validContentId(id)&&!post.social) loadSocial(id!,controller.signal).then(value=>{if(!controller.signal.aborted)setValue(value);}).catch(()=>{if(!controller.signal.aborted)setError('آمار دریافت نشد؛ برای تلاش دوباره روی لایک بزن.');});
  const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.id===id&&d.account===socialAccount())setValue(d.value);};
  window.addEventListener('td-social',sync);return()=>{alive.current=false;controller.abort();window.removeEventListener('td-social',sync);};
 },[id]);
 const like=async()=>{
  if(lock.current||!id)return;lock.current=true;setBusy(true);setError('');
  try {
   const updated=await toggleSocial(id,value);
   if(alive.current)setValue(updated);
  } catch {if(alive.current)setError('لایک ثبت نشد؛ دوباره امتحان کن.');} finally {lock.current=false;if(alive.current)setBusy(false);}
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
