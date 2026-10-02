import { useEffect, useState } from 'react';
import { getTelegramUser } from '../data/live';

// Only retain view preferences for this app session, scoped to the Telegram user.
const views = new Map<string, unknown>();
export function useViewState<T>(name: string, initial: T) {
  const key = `${getTelegramUser()?.id ?? 'guest'}:${name}`;
  const [value, setValue] = useState<T>(() => views.has(key) ? views.get(key) as T : initial);
  useEffect(() => { views.set(key, value); }, [key, value]);
  return [value, setValue] as const;
}
