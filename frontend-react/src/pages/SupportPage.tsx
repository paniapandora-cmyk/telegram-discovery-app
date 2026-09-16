import { ArrowRight, BookOpen, CircleHelp, Info, LifeBuoy, MessageCircle, Send, TriangleAlert } from 'lucide-react';

type Props = { onBack: () => void };
const SUPPORT_URL = 'https://t.me/discovery_te';

function openTelegram(url: string) {
  const telegram = (window as any)?.Telegram?.WebApp;
  if (telegram?.openTelegramLink) telegram.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export default function SupportPage({ onBack }: Props) {
  const items = [
    { icon: Send, title: 'کانال پشتیبانی', text: '@discovery_te', action: () => openTelegram(SUPPORT_URL) },
    { icon: CircleHelp, title: 'سوالات متداول', text: 'پاسخ به سوال‌های رایج' },
    { icon: TriangleAlert, title: 'گزارش مشکل', text: 'ارسال گزارش و پیشنهاد', action: () => openTelegram(SUPPORT_URL) },
    { icon: BookOpen, title: 'آموزش استفاده از کشف', text: 'راهنمای قابلیت‌ها', action: () => openTelegram(SUPPORT_URL) },
    { icon: Info, title: 'درباره کشف', text: 'نسخه فعلی و معرفی پروژه' },
  ];

  return (
    <div className="page referenceSupportPage">
      <header className="referenceSubHeader">
        <button type="button" onClick={onBack} aria-label="بازگشت"><ArrowRight /></button>
        <div>
          <span className="referenceHeaderIcon support"><LifeBuoy /></span>
          <h1>پشتیبانی و راهنما</h1>
          <p>ما اینجاییم تا کمکت کنیم</p>
        </div>
      </header>

      <section className="referenceSupportList surface">
        {items.map(({ icon: Icon, title, text, action }) => (
          <button key={title} type="button" onClick={action} disabled={!action}>
            <span className="referenceSupportItemIcon"><Icon /></span>
            <span><b>{title}</b><small>{text}</small></span>
            <ArrowRight className="referenceSupportArrow" />
          </button>
        ))}
      </section>

      <section className="referenceSupportThanks surface">
        <MessageCircle />
        <div><b>از اینکه همراه ما هستید</b><span>سپاسگزاریم</span></div>
      </section>
    </div>
  );
}
