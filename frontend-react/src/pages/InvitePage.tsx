import { ArrowRight, Gift, Link2, Send, Sparkles, Users } from 'lucide-react';
import GrowthCard from '../components/GrowthCard';

type Props = { onBack: () => void };

export default function InvitePage({ onBack }: Props) {
  return (
    <div className="page referenceInvitePage">
      <header className="referenceSubHeader">
        <button type="button" onClick={onBack} aria-label="بازگشت"><ArrowRight /></button>
        <div>
          <span className="referenceHeaderIcon gift"><Gift /></span>
          <h1>دعوت دوستان</h1>
          <p>با دعوت دوستات، کشف رو بزرگ‌تر کنیم</p>
        </div>
      </header>

      <section className="referenceInviteHero surface">
        <span className="referenceInviteHeroIcon"><Users /></span>
        <h2>هر دوست، یک کشف تازه</h2>
        <p>لینک اختصاصی تو ورودی‌های واقعی را ثبت می‌کند و برای نشان‌های رشد حساب می‌شود.</p>
        <div className="referenceInviteSteps">
          <span><Link2 /> لینک اختصاصی</span>
          <i />
          <span><Send /> اشتراک در تلگرام</span>
          <i />
          <span><Sparkles /> دعوت موفق</span>
        </div>
      </section>

      <GrowthCard />
    </div>
  );
}
