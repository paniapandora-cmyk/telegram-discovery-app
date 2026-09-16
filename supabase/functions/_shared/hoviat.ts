export const REQUIRED_CHANNEL = '@hoviateman';
const positiveMembership = new Map<number, { token: string; until: number }>();

export function isChannelMember(member: { status?: string; is_member?: boolean } | null) {
  return Boolean(member && (['creator', 'administrator', 'member'].includes(member.status || '') ||
    (member.status === 'restricted' && member.is_member === true)));
}

// Only call with a user ID from validated Telegram initData or a verified webhook.
export async function checkHoviatMembership(botToken: string, userId: number): Promise<boolean> {
  if (!botToken || !Number.isSafeInteger(userId) || userId <= 0) throw new Error('membership_check_unavailable');
  const cached = positiveMembership.get(userId);
  if (cached?.token === botToken && cached.until > Date.now()) return true;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: REQUIRED_CHANNEL, user_id: userId }),
      signal: AbortSignal.timeout(8000),
    });
    const payload = await response.json();
    if (!response.ok || payload?.ok !== true) throw new Error('membership_check_unavailable');
    const member = isChannelMember(payload.result);
    if (member) {
      if (positiveMembership.size >= 5000) positiveMembership.clear();
      positiveMembership.set(userId, { token: botToken, until: Date.now() + 60000 });
    } else positiveMembership.delete(userId);
    return member;
  } catch {
    // Never log the Telegram URL: it contains the bot token.
    throw new Error('membership_check_unavailable');
  }
}
