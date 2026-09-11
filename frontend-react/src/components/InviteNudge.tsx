import { useState } from 'react';
import { Share2, Users } from 'lucide-react';
import { loadGrowthSummary, shareInvite } from '../data/growth';

export default function InviteNudge() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const summary = await loadGrowthSummary();
      await shareInvite(summary);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="inviteNudge surface">
      <span className="inviteNudgeIcon"><Users /></span>
      <div>
        <b>یه دوست خوب برای «کشف» داری؟</b>
        <small>{error ? 'مینی‌اپ را داخل تلگرام باز کن.' : 'لینک دعوت اختصاصی خودت را بفرست.'}</small>
      </div>
      <button type="button" onClick={() => void share()} disabled={busy}>
        <Share2 />
        {busy ? '…' : 'دعوت'}
      </button>
    </section>
  );
}
