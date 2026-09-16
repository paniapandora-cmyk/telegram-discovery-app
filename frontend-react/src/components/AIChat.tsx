import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { sendAIMessage, safeSourceUrl, normalizeSources, type AIMode, type AISource, type AISelection, type AIOpenDetail } from '../data/ai';
import { requestJson } from '../data/live';
import '../styles/assistant.css';

type ChatMessage = { id:string; role:'user'|'assistant'|'error'; text:string; sources?:AISource[]; pages?:string[] };
type TelegramWindow = Window & { Telegram?: { WebApp?: { initData?:string; HapticFeedback?:{impactOccurred?:(style:'light')=>void} } } };
const welcome:ChatMessage={id:'welcome',role:'assistant',text:'سلام! چه چیزی دوست داری کشف کنی؟ می‌توانم پست پیدا کنم، ذخیره‌هایت را مرور کنم یا برای کانالت ایده و متن بنویسم. برای خلاصهٔ یک پست، از دکمهٔ دستیار در صفحهٔ همان پست استفاده کن.'};
const modes:{id:AIMode;label:string}[]=[{id:'auto',label:'همراه کشف'},{id:'discover',label:'پیدا کردن پست'},{id:'trending',label:'داغ‌ها'},{id:'saved',label:'ذخیره‌های من'},{id:'creator',label:'تحلیل کانال'},{id:'draft',label:'استودیوی محتوا'}];
const starters:{text:string;mode:AIMode}[]=[{text:'پست‌های داغ را با یک توضیح کوتاه معرفی کن',mode:'trending'},{text:'ذخیره‌هایم را خلاصه و دسته‌بندی کن',mode:'saved'},{text:'آمار کانال من را تحلیل کن و سه پیشنهاد بده',mode:'creator'},{text:'برای یک برنامهٔ محتوای هفت‌روزه کمکم کن',mode:'draft'}];
const pageLabels:Record<string,string>={search:'رفتن به جست‌وجو',explore:'اکسپلور',saved:'ذخیره‌ها',creator:'داشبورد کریتور',invite:'دعوت دوستان',personalization:'تنظیم علایق'};
const nextId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
function storageKey(initData:string) {
  try { const user=JSON.parse(new URLSearchParams(initData).get('user')||'null'); return user?.id ? `td-assistant-v3-${String(user.id)}`:null; } catch {return null;}
}
function loadMessages(key:string|null):ChatMessage[] {
  if(!key)return [welcome];
  try {const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)&&data.length?data.filter(x=>x&&typeof x.text==='string'&&typeof x.id==='string'&&['assistant','user','error'].includes(x.role)).slice(-30).map(x=>({...x,sources:normalizeSources(x.sources),pages:Array.isArray(x.pages)?x.pages.filter((v:unknown)=>typeof v==='string'):[]})):[welcome];}catch{return [welcome];}
}
// Render a small Markdown subset as React text nodes; never inject model HTML.
function RichText({text}:{text:string}) {
  return <>{text.split('\n').map((line,i)=>{
    const list=/^\s*(?:[-*]|\d+[.)])\s+/.test(line);
    const clean=line.replace(/^\s*#{1,4}\s+/,'').replace(/^\s*(?:[-*]|\d+[.)])\s+/,'');
    const parts=clean.split(/(\*\*[^*]+\*\*)/g);
    return <div className={`tdai-line ${list?'tdai-list-line':''}`} key={i}>{list&&<span aria-hidden="true">•</span>}<span>{parts.map((part,j)=>part.startsWith('**')&&part.endsWith('**')?<strong key={j}>{part.slice(2,-2)}</strong>:part)}</span></div>;
  })}</>;
}
function SourceCard({source}:{source:AISource}) {
  const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
  const url=safeSourceUrl(source.url);
  const save=async()=>{setBusy(true);try{const result=await requestJson('/api/discovery/save',{method:'POST',body:{content_id:source.id}}) as {saved?:boolean};if(!result.saved)throw Error();setStatus('ذخیره شد');window.dispatchEvent(new CustomEvent('td-ai-saved'));}catch{setStatus('ذخیره نشد؛ دوباره تلاش کن');}finally{setBusy(false);}};
  return <div className="tdai-source">{url?<a href={url} target="_blank" rel="noopener noreferrer">[{source.number}] {source.title}</a>:<span>[{source.number}] {source.title}</span>}<small>{source.kind==='selected'?'متن انتخاب‌شده':source.channel}</small>{/^[0-9a-f-]{36}$/i.test(source.id)&&<button type="button" onClick={()=>void save()} disabled={busy||status==='ذخیره شد'}>{busy?'در حال ذخیره…':'ذخیرهٔ پست'}</button>}{status&&<span className="tdai-status" role="status">{status}</span>}</div>;
}
export default function AIChat(){
  const tg=useMemo(()=>(window as TelegramWindow).Telegram?.WebApp,[]);
  const key=useMemo(()=>storageKey(tg?.initData||''),[tg]);
  const [open,setOpen]=useState(false),[input,setInput]=useState(''),[sending,setSending]=useState(false);
  const [messages,setMessages]=useState<ChatMessage[]>(()=>loadMessages(key));
  const [mode,setMode]=useState<AIMode>('auto');const [selected,setSelected]=useState<AISelection>();
  const [remaining,setRemaining]=useState<number>();const [copyStatus,setCopyStatus]=useState('');
  const panelRef=useRef<HTMLElement>(null);const logRef=useRef<HTMLDivElement>(null);const busyRef=useRef(false);const controllerRef=useRef<AbortController | undefined>(undefined);
  useEffect(()=>{try{if(key)localStorage.setItem(key,JSON.stringify(messages.slice(-30)));}catch{/* Optional storage. */}logRef.current?.scrollTo({top:logRef.current.scrollHeight,behavior:'smooth'});},[messages,open,key]);
  useEffect(()=>{const handler=(event:Event)=>{const detail=(event as CustomEvent<AIOpenDetail>).detail;if(busyRef.current)return;setSelected(detail?.selected);setMode(detail?.mode||'summarize');setInput(detail?.prompt||'این متن را خلاصه کن و نکات مهمش را بگو.');setOpen(true);};window.addEventListener('td-ai-open',handler);return()=>{window.removeEventListener('td-ai-open',handler);controllerRef.current?.abort();};},[]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null;
    panelRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    const onKey=(event:globalThis.KeyboardEvent)=>{
      if(event.key==='Escape'){setOpen(false);return;}
      if(event.key!=='Tab')return;
      const controls=Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), a[href]')||[]);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
  },[open]);
  const submit=async(raw:string,requestedMode=mode)=>{
    const message=raw.trim();if(!message||busyRef.current)return;
    busyRef.current=true;setSending(true);setInput('');
    const history=messages.filter(x=>x.id!=='welcome'&&x.role!=='error').slice(-6).map(x=>({role:x.role as 'user'|'assistant',text:x.text}));
    setMessages(current=>[...current,{id:nextId(),role:'user' as const,text:message}].slice(-30));
    const controller=new AbortController();controllerRef.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),60000);
    try{const result=await sendAIMessage(message,tg,controller.signal,{mode:requestedMode,history,selected});
      setMessages(current=>[...current,{id:nextId(),role:'assistant' as const,text:result.reply||'',sources:result.sources,pages:result.pages}].slice(-30));
      if(typeof result.access?.ai_remaining==='number')setRemaining(result.access.ai_remaining);
      tg?.HapticFeedback?.impactOccurred?.('light');
    }catch(error){setMessages(current=>[...current,{id:nextId(),role:'error' as const,text:error instanceof DOMException&&error.name==='AbortError'?'زمان پاسخ‌گویی تمام شد؛ دوباره تلاش کن.':error instanceof Error?error.message:String(error)}].slice(-30));}
    finally{window.clearTimeout(timeout);busyRef.current=false;setSending(false);}
  };
  const send=(event:FormEvent)=>{event.preventDefault();void submit(input);};
  const keyDown=(event:KeyboardEvent<HTMLTextAreaElement>)=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void submit(input);}};
  const navigate=(page:string)=>{if(!pageLabels[page])return;window.dispatchEvent(new CustomEvent('td-ai-navigate',{detail:{page}}));setOpen(false);};
  const copy=async(message:ChatMessage)=>{try{await navigator.clipboard.writeText(message.text);setCopyStatus(message.id);}catch{setCopyStatus('failed');}};
  return <>
    {!open&&<button className="tdai-launch" type="button" onClick={()=>setOpen(true)}><Sparkles/> دستیار کشف</button>}
    {open&&<section ref={panelRef} className="tdai-panel" role="dialog" aria-modal="true" aria-label="دستیار کشف">
      <header className="tdai-head"><div className="tdai-brand"><div className="tdai-avatar"><Bot/></div><div className="tdai-title"><b>دستیار کشف</b><span>کشف پست · ایده و محتوا · همراه کریتور</span></div></div><div className="tdai-actions"><button className="tdai-icon" type="button" aria-label="پاک کردن گفتگو" disabled={sending} onClick={()=>{setMessages([welcome]);setSelected(undefined);setCopyStatus('');}}><RotateCcw/></button><button className="tdai-icon" type="button" aria-label="بستن" onClick={()=>setOpen(false)}><X/></button></div></header>
      <div className="tdai-tools" aria-label="ابزارهای دستیار">{modes.map(item=><button key={item.id} type="button" disabled={sending} aria-pressed={mode===item.id} onClick={()=>{setMode(item.id);setSelected(undefined);}}>{item.label}</button>)}</div>
      <div className="tdai-log" ref={logRef} aria-live="polite">{messages.map(message=><div key={message.id} className={`tdai-msg ${message.role}`}>
        {message.role==='assistant'?<RichText text={message.text}/>:message.text}
        {Array.isArray(message.sources)&&<div className="tdai-sources">{message.sources.slice(0,7).map((source,i)=><SourceCard key={`${source.id}-${i}`} source={source}/>)}</div>}
        {message.role==='assistant'&&message.id!=='welcome'&&<><button className="tdai-copy" type="button" onClick={()=>void copy(message)}>{copyStatus===message.id?'کپی شد':'کپی پاسخ'}</button>{Array.isArray(message.pages)&&message.pages.filter(page=>pageLabels[page]).map(page=><button className="tdai-page" key={page} type="button" onClick={()=>navigate(page)}>{pageLabels[page]}</button>)}</>}
      </div>)}
      {messages.length===1&&<div className="tdai-starters">{starters.map(item=><button className="tdai-starter" key={item.text} type="button" disabled={sending} onClick={()=>{setMode(item.mode);void submit(item.text,item.mode);}}>{item.text}</button>)}</div>}
      {messages[messages.length-1]?.role==='error'&&!sending&&<button className="tdai-starter tdai-error-retry" type="button" onClick={()=>void submit([...messages].reverse().find(x=>x.role==='user')?.text||'')}>تلاش دوباره</button>}
      {sending&&<div className="tdai-thinking" role="status">در حال بررسی و آماده‌کردن پاسخ…</div>}
      {copyStatus==='failed'&&<div role="status" className="tdai-note">کپی خودکار ممکن نشد؛ متن را انتخاب و کپی کن.</div>}</div>
      <div className="tdai-bottom">{selected&&<div className="tdai-selected"><span>متن انتخابی: {selected.title}</span><button type="button" disabled={sending} onClick={()=>setSelected(undefined)}>حذف</button></div>}
      <form className="tdai-form" onSubmit={send}><textarea className="tdai-input" rows={1} maxLength={8000} placeholder={mode==='draft'?'موضوع، مخاطب و لحن دلخواهت را بنویس…':mode==='discover'?'دنبال چه موضوعی هستی؟':'پیامت را بنویس…'} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={keyDown} disabled={sending} aria-label="پیام به دستیار"/><button className="tdai-send" type="submit" aria-label="ارسال" disabled={sending||!input.trim()}><Send/></button></form>
      <p className="tdai-note">{remaining!==undefined?`${remaining.toLocaleString('fa-IR')} درخواست باقی‌مانده · `:''}متن انتخابی، داده‌های لازم و چند پیام اخیر برای پاسخ به جمینای ارسال می‌شوند. انتشار محتوا با خود توست.</p></div>
    </section>}
  </>;
}
