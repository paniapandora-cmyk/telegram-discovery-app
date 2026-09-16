import {useEffect,useRef,useState} from 'react';
import {Play,ExternalLink} from 'lucide-react';
import {openTelegramPost} from '../data/live';
import type {Post} from '../types';
export default function PostVideo({post,active}:{post:Post;active:boolean}){
 const [url,setUrl]=useState(''),[state,setState]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
 const video=useRef<HTMLVideoElement>(null),request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();video.current?.pause();},[]);
 useEffect(()=>{if(!active)video.current?.pause();},[active]);
 useEffect(()=>{const stop=()=>{if(document.hidden||document.querySelector('[role="dialog"]'))video.current?.pause();};document.addEventListener('visibilitychange',stop);const observer=new MutationObserver(stop);observer.observe(document.body,{childList:true,subtree:true});return()=>{document.removeEventListener('visibilitychange',stop);observer.disconnect();};},[]);
 const load=async()=>{
  if(state==='loading')return;setState('loading');request.current?.abort();const controller=new AbortController();request.current=controller;
  const timeout=setTimeout(()=>controller.abort(),16000);
  try{
   const response=await fetch(`https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/telegram-media-v1?mode=video&url=${encodeURIComponent(post.telegramUrl||'')}`,{signal:controller.signal});
   const data=await response.json();const parsed=new URL(data.video_url);
   if(!response.ok||parsed.protocol!=='https:')throw Error('unavailable');
   if(controller.signal.aborted)return;setUrl(parsed.href);setState('ready');
  }catch{setState('unavailable');}finally{clearTimeout(timeout);}
 };
 return <div className="postVideo" aria-label="پخش ویدئو">
  {state==='ready'?<video ref={video} src={url} controls playsInline preload="none" onError={()=>setState('unavailable')} onPlay={()=>{if(!active)video.current?.pause();document.querySelectorAll('video').forEach(v=>{if(v!==video.current)v.pause();});}}/>:<button type="button" className="videoLoad" disabled={state==='loading'||!post.telegramUrl} onClick={()=>void load()}><Play/>{state==='loading'?'در حال آماده‌سازی ویدئو…':state==='unavailable'?'تلاش دوباره برای پخش':'پخش ویدئو داخل دیسکاوری'}</button>}
  {state==='ready'&&<p>برای شروع، دکمهٔ پخش را بزن.</p>}
  {state==='unavailable'&&<p role="status">این ویدئو فعلاً داخل برنامه قابل پخش نیست. نسخهٔ کامل را در تلگرام ببین.</p>}
  <button type="button" disabled={!post.telegramUrl} onClick={()=>openTelegramPost(post)}><ExternalLink/>دیدن ویدئو در کانال</button>
 </div>;
}
