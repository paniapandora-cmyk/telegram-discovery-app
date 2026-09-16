import { UserRound, Flame, Sparkles } from 'lucide-react';

type Props = { value: string; onChange: (v: string) => void };

const items = [
  ['fresh', 'اکسپلور', Sparkles],
  ['hot', 'داغ امروز', Flame],
  ['for-you', 'برای تو', UserRound],
] as const;

function selectionHaptic() {
  (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
}

export default function FeedTabs({ value, onChange }: Props) {
  const select = (id: string) => {
    if (id === value) return;
    selectionHaptic();
    onChange(id);
  };

  return (
    <div className="feedTabs referenceFeedTabs" role="tablist" aria-label="نوع فید">
      {items.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={value === id ? 'active' : ''}
          onClick={() => select(id)}
        >
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
