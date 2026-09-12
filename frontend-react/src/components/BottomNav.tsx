import { Home, Sparkles, Search, Heart, UserRound } from 'lucide-react';
import type { Page } from '../types';

type Props = { page: Page; onChange: (page: Page) => void };

const items: [[Page, string, typeof Home], ...Array<[Page, string, typeof Home]>] = [
  ['home', 'خانه', Home],
  ['explore', 'کشف', Sparkles],
  ['search', 'جستجو', Search],
  ['saved', 'علاقه‌مندی‌ها', Heart],
  ['profile', 'پروفایل', UserRound],
];

function selectionHaptic() {
  const telegram = (window as any)?.Telegram?.WebApp;
  telegram?.HapticFeedback?.selectionChanged?.();
}

export default function BottomNav({ page, onChange }: Props) {
  const select = (next: Page) => {
    if (next === page) return;
    selectionHaptic();
    onChange(next);
  };

  return (
    <nav className="bottomNav" aria-label="ناوبری اصلی">
      {items.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          className={page === id ? 'active' : ''}
          onClick={() => select(id)}
          aria-current={page === id ? 'page' : undefined}
          aria-label={label}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
