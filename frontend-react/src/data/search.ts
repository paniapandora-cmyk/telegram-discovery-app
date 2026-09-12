import { requestJson } from './live';

type Row = Record<string, unknown>;

export type SearchHistoryItem = {
  query: string;
  normalizedQuery: string;
  resultCount: number;
  createdAt: string;
};

const LOCAL_HISTORY_KEY = 'td-search-history-v2';

const isRow = (value: unknown): value is Row =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const rowsFrom = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value.filter(isRow);
  if (!isRow(value)) return [];

  for (const key of ['items', 'results', 'data', 'topics']) {
    const child = value[key];
    if (Array.isArray(child)) return child.filter(isRow);
  }

  return [];
};

const text = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const number = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

const fold = (value: string) =>
  value
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHistory = (rows: Row[]): SearchHistoryItem[] => {
  const seen = new Set<string>();
  const result: SearchHistoryItem[] = [];

  for (const row of rows) {
    const query = text(row, ['query', 'q']);
    const normalizedQuery = text(row, ['normalized_query']) || fold(query);
    const key = fold(normalizedQuery || query);
    if (!query || query.length < 2 || !key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      query,
      normalizedQuery,
      resultCount: number(row, ['result_count', 'count']),
      createdAt: text(row, ['created_at', 'date']),
    });
    if (result.length >= 10) break;
  }

  return result;
};

const readLocalHistory = (): SearchHistoryItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeHistory(parsed.filter(isRow)) : [];
  } catch {
    return [];
  }
};

const writeLocalHistory = (items: SearchHistoryItem[]) => {
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
  } catch {
    // Search still works when storage is unavailable.
  }
};

const mergeHistory = (
  primary: SearchHistoryItem[],
  secondary: SearchHistoryItem[],
): SearchHistoryItem[] => {
  const seen = new Set<string>();
  const merged: SearchHistoryItem[] = [];

  for (const item of [...primary, ...secondary]) {
    const key = fold(item.normalizedQuery || item.query);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= 10) break;
  }

  return merged;
};

export async function loadSearchHistory(signal?: AbortSignal) {
  const local = readLocalHistory();

  try {
    const raw = await requestJson('/api/discovery/search-history', { signal });
    const remote = normalizeHistory(rowsFrom(raw));
    const merged = mergeHistory(remote, local);
    writeLocalHistory(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function recordSearchHistory(query: string, resultCount: number) {
  const cleaned = query.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (cleaned.length < 2) return false;

  const localItem: SearchHistoryItem = {
    query: cleaned,
    normalizedQuery: fold(cleaned),
    resultCount: Math.max(0, Math.floor(resultCount || 0)),
    createdAt: new Date().toISOString(),
  };

  writeLocalHistory(mergeHistory([localItem], readLocalHistory()));

  await requestJson('/api/discovery/search-history', {
    method: 'POST',
    body: { query: cleaned, result_count: localItem.resultCount },
  }).catch(() => {});

  return true;
}

export async function clearSearchHistory() {
  try {
    localStorage.removeItem(LOCAL_HISTORY_KEY);
  } catch {
    // Ignore local storage failures.
  }

  await requestJson('/api/discovery/search-history', {
    method: 'DELETE',
    body: {},
  }).catch(() => {});
}

export async function loadSearchTopics(signal?: AbortSignal): Promise<string[]> {
  try {
    const raw = await requestJson('/api/discovery/topics', { signal });
    const rows = rowsFrom(raw);

    return rows
      .map((row) => ({
        name: text(row, ['name', 'title', 'label']),
        selected: Boolean(row.selected),
        weight: number(row, ['weight']),
      }))
      .filter((item) => item.name)
      .sort((a, b) => {
        if (a.selected !== b.selected) return a.selected ? -1 : 1;
        return b.weight - a.weight || a.name.localeCompare(b.name, 'fa');
      })
      .map((item) => item.name)
      .filter((name, index, list) => list.indexOf(name) === index)
      .slice(0, 10);
  } catch {
    return [];
  }
}
