import { ArrowRight, Gift, Link2, Send, Sparkles, Trophy, UserCheck, Users } from 'lucide-react';
import GrowthCard from '../components/GrowthCard';
import '../styles/invite-growth-v10.css';

type Props = { onBack: () => void };

export default function InvitePage({ onBack }: Props) {
  return (
    <div className="page referenceInvitePage invitePageV10">
      <header className="referenceSubHeader inviteTopbarV10">
        <button type="button" onClick={onBack} aria-label="بازگشت"><ArrowRight /></button>
        <div>
          <span className="referenceHeaderIcon gift"><Gift /></span>
          <h1>دعوت دوستان</h1>
          <p>رشد واقعی «کشف» با لینک اختصاصی تو</p>
        </div>
      </header>

      <section className="inviteHeroV10 surface">
        <div className="inviteHeroGlow" aria-hidden="true" />
        <span className="inviteHeroBadge"><Sparkles /> برنامه رشد کشف</span>
        <div className="inviteHeroIconV10"><Users /></div>
        <h2>دوستات رو دعوت کن، مسیر رشدت رو ببین</h2>
        <p>لینک اختصاصی تو از لحظه اشتراک تا Start ربات و دعوت موفق ردیابی می‌شود؛ بدون ممبر یا آمار ساختگی.</p>
        <div className="inviteHeroPills">
          <span><Link2 /> لینک شخصی</span>
          <span><UserCheck /> دعوت واقعی</span>
          <span><Trophy /> نشان‌های رشد</span>
        </div>
      </section>

      <section className="inviteHowV10 surface" aria-label="روش کار دعوت">
        <article><span>۱</span><div><Link2 /><b>لینک را بردار</b><small>لینک ثابت و اختصاصی حساب تو</small></div></article>
        <i />
        <article><span>۲</span><div><Send /><b>برای دوستت بفرست</b><small>تلگرام یا Share Sheet گوشی</small></div></article>
        <i />
        <article><span>۳</span><div><Sparkles /><b>دعوت ثبت می‌شود</b><small>Start یکتای کاربر دیگر ملاک موفقیت است</small></div></article>
      </section>

      <GrowthCard />
    </div>
  );
}
