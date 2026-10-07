import { useEffect, useState, type SetStateAction } from 'react';
import { getTelegramUser } from '../data/live';

const views = new Map<string, unknown>();
export function useViewState<T>(name: string, initial: T) {
  const key = `${getTelegramUser()?.id ?? 'guest'}:${name}`;
  const read = () => views.has(key) ? views.get(key) as T : initial;
  const [state, setState] = useState(() => ({key, value:read()}));
  // Reset during render so no previous account value is exposed or persisted.
  const value = state.key === key ? state.value : read();
  if (state.key !== key) setState({key, value});
  useEffect(() => { if (state.key === key) views.set(key, state.value); }, [key, state]);
  const setValue = (next: SetStateAction<T>) => setState(previous => {
    if (`${getTelegramUser()?.id ?? 'guest'}:${name}` !== key) return previous;
    const current = previous.key === key ? previous.value : read();
    return {key, value: typeof next === 'function' ? (next as (value:T)=>T)(current) : next};
  });
  return [value, setValue] as const;
}
