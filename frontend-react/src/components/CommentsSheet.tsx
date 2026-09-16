import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,Send,RefreshCw} from 'lucide-react';
import {publishSocial,socialRequest,type Comment} from '../data/social';
export default function CommentsSheet({contentId,title,onClose}:{contentId:string;title:string;onClose:()=>void}) {
 const [items,setItems]=useState<Comment[]>([]),[loading,setLoading]=useState(true),[more,setMore]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [text,setText]=useState(''),[reply,setReply]=useState<Comment|null>(null),[busy,setBusy]=useState(false),[deleteId,setDeleteId]=useState('');
 const panel=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),lock=useRef(false),requestId=useRef(crypto.randomUUID());
 const alive=useRef(true);
 const load=async(append=false)=>{
  setLoading(true);setError('');
  const last=append?items[items.length-1]:null;
  try {
   const data=await socialRequest(`/comments?content_id=${contentId}${last?`&before=${encodeURIComponent(last.created_at)}&before_id=${last.id}`:''}`);
   if(!alive.current)return;
   setItems(old=>append?[...old,...data.items.filter((c:Comment)=>!old.some(x=>x.id===c.id))]:data.items);setMore(data.has_more);publishSocial(contentId,data);
  }catch{if(alive.current)setError('نظرات دریافت نشد. دوباره تلاش کن.');}finally{if(alive.current)setLoading(false);}
 };
 useEffect(()=>{
  alive.current=true;void load();const previous=document.activeElement as HTMLElement;panel.current?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose();}
   if(e.key==='Tab'){
    const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]);const first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',key,true);return()=>{alive.current=false;document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);previous?.focus();};
 },[contentId]);
 const send=async()=>{
  if(lock.current||!text.trim())return;lock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await socialRequest('/comments',{method:'POST',body:{content_id:contentId,text,request_id:requestId.current,parent_id:reply?.id}});
   if(!alive.current)return;setText('');setReply(null);requestId.current=crypto.randomUUID();setNotice('نظر ثبت شد.');await load();
  }catch(e){if(alive.current)setError(String(e).includes('comment_rate_limit')?'کمی صبر کن؛ بین نظرها حداقل ۱۰ ثانیه فاصله بگذار.':'نظر ارسال نشد؛ متن حفظ شده، دوباره تلاش کن.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 const action=async(comment:Comment,report=false)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   await socialRequest(report?'/comments/report':'/comments',{method:report?'POST':'DELETE',body:{content_id:contentId,comment_id:comment.id}});
   if(!alive.current)return;setDeleteId('');
   if(report){setItems(old=>old.map(c=>c.id===comment.id?{...c,reported:true}:c));setNotice('گزارش ثبت شد.');}else{setNotice('نظر حذف شد.');await load();}
  }catch{if(alive.current)setError('انجام نشد؛ دوباره امتحان کن.');}finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 return createPortal(<div className="commentsBackdrop" onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)onClose();}} onKeyDown={e=>e.stopPropagation()}>
  <div className="commentsSheet" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="نظرات دیسکاوری" dir="rtl">
   <header><div><h2>گفت‌وگوی این پست</h2><p>نظرها در دیسکاوری منتشر می‌شوند؛ جدا از تلگرام.</p></div><button type="button" aria-label="بستن نظرات" onClick={onClose}><X/></button></header>
   <p className="commentPostTitle">{title}</p>
   <div className="commentsList" aria-busy={loading}>
    {loading&&!items.length?<p role="status">در حال دریافت نظرات…</p>:!items.length&&!error?<div className="commentsEmpty">اولین نفر باش که دربارهٔ این پست نظر می‌دهد.</div>:null}
    {items.map(c=><article className="commentItem" key={c.id}>
     <div className="commentBy"><strong>{c.author}{c.mine?' · شما':''}</strong><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString('fa-IR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div>
     {c.parent&&<blockquote>در پاسخ به {c.parent.author}<p>{c.parent.body}</p></blockquote>}
     <p className="commentBody">{c.body}</p>
     <div className="commentTools"><button disabled={busy} onClick={()=>{setReply(c);requestId.current=crypto.randomUUID();input.current?.focus();}}>پاسخ</button>{c.mine?<button disabled={busy} onClick={()=>setDeleteId(c.id)}>حذف نظر من</button>:<button disabled={busy||c.reported} onClick={()=>void action(c,true)}>{c.reported?'گزارش شد':'گزارش'}</button>}</div>
     {deleteId===c.id&&<div className="commentConfirm">نظر خودت حذف شود؟ <button disabled={busy} onClick={()=>void action(c)}>بله، حذف کن</button><button onClick={()=>setDeleteId('')}>انصراف</button></div>}
    </article>)}
    {more&&<button disabled={loading||busy} onClick={()=>void load(true)}>نظرات قدیمی‌تر</button>}
   </div>
   <div className="commentComposer">
    {notice&&<p role="status">{notice}</p>}{error&&<div role="alert">{error}<button disabled={loading||busy} aria-label="دریافت دوباره نظرات" onClick={()=>void load()}><RefreshCw size={16}/></button></div>}
    {reply&&<div className="commentReply">پاسخ به {reply.author}<button aria-label="لغو پاسخ" disabled={busy} onClick={()=>{setReply(null);requestId.current=crypto.randomUUID();}}><X size={16}/></button></div>}
    <label htmlFor="comment-text">نظر تو با نام نمایشت برای دیگران دیده می‌شود.</label>
    <textarea id="comment-text" ref={input} value={text} maxLength={1500} disabled={busy} placeholder="محترمانه نظرت را بنویس…" onChange={e=>{setText(e.target.value);requestId.current=crypto.randomUUID();}}/>
    <div><small>{text.length.toLocaleString('fa-IR')} / ۱۵۰۰</small><button className="commentSend" disabled={busy||!text.trim()} onClick={()=>void send()}><Send size={18}/>{busy?'در حال ثبت…':'ارسال نظر'}</button></div>
   </div>
  </div>
 </div>,document.body);
}
