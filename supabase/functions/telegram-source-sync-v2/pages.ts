export type State = { cursor: number; before: number; complete: boolean };
export type Options = { limit: number; minId?: number; offsetId?: number; reverse?: boolean };

// Return checkpoints only after both bounded pages have been persisted.
// A failure leaves the database checkpoints untouched; retry is idempotent.
export async function syncPages(
  state: State,
  freshLimit: number,
  historyLimit: number,
  iterate: (options: Options) => AsyncIterable<any>,
  save: (message: any, lane: 'incremental' | 'backfill') => Promise<void>,
): Promise<State> {
  const next = { ...state };
  const fresh: Options = state.cursor > 0
    ? { limit: freshLimit, minId: state.cursor, reverse: true }
    : { limit: freshLimit };
  for await (const message of iterate(fresh)) {
    const id = Number(message.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw Error('Invalid Telegram message ID');
    await save(message, 'incremental');
    next.cursor = Math.max(next.cursor, id);
  }
  if (!state.complete) {
    let count = 0;
    for await (const message of iterate({ limit: historyLimit, offsetId: state.before })) {
      const id = Number(message.id);
      if (!Number.isSafeInteger(id) || id <= 0 || (state.before > 0 && id >= state.before)) {
        throw Error('Invalid history page boundary');
      }
      await save(message, 'backfill');
      next.before = next.before > 0 ? Math.min(next.before, id) : id;
      count++;
    }
    next.complete = count < historyLimit;
  }
  return next;
}
