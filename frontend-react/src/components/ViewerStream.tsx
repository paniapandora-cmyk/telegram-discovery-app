import {useEffect,useRef,useState} from 'react';
import Viewer from './Viewer';
import type {Channel,Post} from '../types';
import '../styles/viewer-stream.css';
type Props={posts:Post[];activeId:string;onActive:(post:Post)=>void;onClose:()=>void;onToggleSave:(id:string)=>void;onFeedback:(post:Post,type:string)=>Promise<void>;onOpenRelated:(post:Post)=>void;onOpenChannel:(channel:Channel)=>void};
export default function ViewerStream({posts,activeId,onActive,...props}:Props){
 const root=useRef<HTMLDivElement>(null),callback=useRef(onActive),current=useRef(activeId);
 const [count,setCount]=useState(3);callback.current=onActive;current.current=activeId;
 const visible=posts.slice(0,count);
 useEffect(()=>{
  const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-viewer-post]')||[]);
  let frame=0;
  const check=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(document.querySelector('[role="dialog"]'))return;
   const line=window.innerHeight*.35;
   const node=nodes.find(n=>{const r=n.getBoundingClientRect();return r.top<=line&&r.bottom>line;});
   if(node&&node.dataset.viewerPost!==current.current){const post=posts.find(p=>p.id===node.dataset.viewerPost);if(post){current.current=post.id;callback.current(post);}}
  });};
  window.addEventListener('scroll',check,{passive:true});check();return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',check);};
 },[posts,count]);
 const more=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!more.current||count>=posts.length)return;const observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))setCount(n=>Math.min(n+2,posts.length));},{rootMargin:'400px'});observer.observe(more.current);return()=>observer.disconnect();},[count,posts.length]);
 return <div ref={root} className="viewerStream">
  <p className="viewerScrollHint">برای دیدن پست بعدی به پایین اسکرول کن</p>
  {visible.map((post,index)=><div key={post.id} data-viewer-post={post.id} className="viewerStreamItem">
   <div className="viewerSequence">پست {(index+1).toLocaleString('fa-IR')} از {posts.length.toLocaleString('fa-IR')}</div>
   <Viewer {...props} post={post} active={post.id===activeId}/>
  </div>)}
  <div ref={more}>{count<posts.length?<button onClick={()=>setCount(n=>n+3)}>نمایش پست‌های بعدی</button>:<p className="viewerScrollHint">به پایان این فهرست رسیدی.</p>}</div>
 </div>;
}
