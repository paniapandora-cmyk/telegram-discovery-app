import { UserRound, Flame, Sparkles } from 'lucide-react';

type Props = { value: string; onChange: (v: string) => void };

const items = [
  ['fresh', 'اکسپلور', Sparkles],
  ['hot', 'داغ امروز', Flame],
  ['for-you', 'برای تو', UserRound],
] as const;

export default function FeedTabs({ value, onChange }: Props) {
  return (
    <div className="feedTabs referenceFeedTabs" role="tablist" aria-label="نوع فید">
      {items.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={value === id ? 'active' : ''}
          onClick={() => onChange(id)}
        >
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
