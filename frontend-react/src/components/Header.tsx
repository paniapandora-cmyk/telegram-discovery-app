import { Plus, Search, Sparkles } from 'lucide-react';

type Props = {
  onSearch?: () => void;
  onAdd?: () => void;
};

export default function Header({ onSearch, onAdd }: Props) {
  return (
    <header className="referenceHomeHeader">
      <button type="button" className="referenceHeaderUtility" onClick={onSearch} aria-label="جست‌وجو">
        <Search />
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
