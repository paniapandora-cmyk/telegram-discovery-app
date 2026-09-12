import { Send, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="hero">
      <div className="brand">
        <div className="brandMark" aria-hidden="true">
          <Sparkles />
        </div>
        <div className="brandCopy">
          <h1>کشف</h1>
          <p>بهترین‌های تلگرام برای تو</p>
        </div>
      </div>

      <div className="heroAside" aria-label="کشف محتوای بهتر">
        <Send className="plane" aria-hidden="true" />
        <div>
          <small>محتوای بهتر<br />دنیای بزرگ‌تر</small>
          <span className="heroLiveDot">پیشنهاد زنده</span>
        </div>
      </div>
    </header>
  );
}
