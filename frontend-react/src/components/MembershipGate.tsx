import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { getTelegramInitData, openTelegramUrl } from '../data/live';
import '../styles/membership.css';

export default function MembershipGate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const check = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError('');
    try {
      const initData = getTelegramInitData();
      if (!initData) throw new Error('برای تأیید عضویت، برنامه را از داخل ربات تلگرام باز کن.');
      const response = await fetch('https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/growth-referral-v1', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
        body: JSON.stringify({ action: 'access' }), cache: 'no-store',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (response.ok && data.ok === true && data.member === true) setAllowed(true);
      else {
        setAllowed(false);
        setError(data.error === 'membership_required' ? 'هنوز عضویتت تأیید نشده؛ عضو کانال شو و دوباره بررسی کن.' :
          response.status === 401 ? 'نشست تلگرام معتبر نیست؛ برنامه را ببند و از ربات دوباره باز کن.' : 'بررسی عضویت فعلاً ممکن نیست. دوباره تلاش کن.');
      }
    } catch (e) {
      if (!signal?.aborted) {
        setAllowed(false);
        setError(e instanceof Error && !getTelegramInitData() ? e.message : 'ارتباط با سرویس عضویت برقرار نشد. دوباره تلاش کن.');
      }
    } finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);
  if (allowed) return <>{children}</>;
  return <main className="membershipScreen" dir="rtl">
    <section className="membershipCard" aria-labelledby="membership-title">
      <span className="membershipBadge"><ShieldCheck size={34} /></span>
      <small>یک قدم تا شروع کشف</small>
      <h1 id="membership-title">به جمع هویت خوش آمدی</h1>
      <p>برای ورود به کشف، عضو کانال هویت شو. بعد از تأیید عضویت، پست‌ها، جست‌وجو و ذخیره‌ها بدون محدودیت دعوت در دسترس‌اند.</p>
      <button className="membershipJoin" onClick={() => openTelegramUrl('https://t.me/hoviateman')}><ExternalLink size={18} /> عضویت در هویت <b dir="ltr">@hoviateman</b></button>
      <button className="membershipVerify" disabled={busy} onClick={() => void check()}><RefreshCw size={18} />{busy ? 'در حال بررسی عضویت…' : 'عضو شدم؛ بررسی و ورود'}</button>
      {error && <p role="alert" className="membershipError">{error}</p>}
      <footer>با ۳ دعوت معتبر VIP شو ✨<br/>تأیید عضویت خودکار است؛ نیازی به ارسال اسکرین‌شات نیست.</footer>
    </section>
  </main>;
}
