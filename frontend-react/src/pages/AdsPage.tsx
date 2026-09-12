import { ArrowRight, Megaphone, Sparkles, TrendingUp } from 'lucide-react';
import CreatorAdsLauncher from '../components/CreatorAdsLauncher';
import OwnerAdsDashboard from '../components/OwnerAdsDashboard';
import type { CreatorChannel } from '../data/account';

type Props = {
  channels: CreatorChannel[];
  needsTelegram: boolean;
  owner: boolean;
  onBack: () => void;
};

export default function AdsPage({ channels, needsTelegram, owner, onBack }: Props) {
  return (
    <div className="page referenceAdsPage">
      <header className="referenceSubHeader">
        <button type="button" onClick={onBack} aria-label="بازگشت"><ArrowRight /></button>
        <div>
          <span className="referenceHeaderIcon ads"><Megaphone /></span>
          <h1>تبلیغ کانال</h1>
          <p>دیده‌شدن بیشتر، عضوهای واقعی‌تر</p>
        </div>
      </header>

      <section className="referenceAdsIntro surface">
        <div><Sparkles /><span><b>کمپین جدید</b><small>یک پست یا کانال را برای نمایش Sponsored آماده کن</small></span></div>
        <TrendingUp />
      </section>

      {channels.length ? (
        <CreatorAdsLauncher channels={channels} needsTelegram={needsTelegram} />
      ) : (
        <section className="emptyState referenceAdsEmpty">
          <Megaphone />
          <h2>هنوز کانالی ثبت نشده</h2>
          <p>اول کانالت را در Creator Center ثبت کن؛ بعد می‌توانی کمپین بسازی.</p>
        </section>
      )}

      {owner && <OwnerAdsDashboard />}
    </div>
  );
}
