import { Bell, Plus, Sparkles } from 'lucide-react';

type Props = {
  onAdd?: () => void;
};

export default function Header({ onAdd }: Props) {
  return (
    <header className="referenceHomeHeader">
      <button type="button" className="referenceHeaderUtility" aria-label="اعلان‌ها">
        <Bell />
      </button>

      <div className="referenceHomeBrand">
        <span><Sparkles /></span>
        <div><h1>کشف</h1><small>بهترین‌های تلگرام برای تو</small></div>
      </div>

      <button type="button" className="referenceHeaderAvatar" onClick={onAdd} aria-label="افزودن کانال">
        <Plus />
      </button>
    </header>
  );
}
