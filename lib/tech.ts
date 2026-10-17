/* The technology dictionary, loaded from the API (GET /api/tech-terms). The API keeps the only copy (backend src/dictionary.ts)
   plus the names it learns each day, so the pages never carry a stale list of their own.
   Loaded once per page; if the API cannot be reached the checks that need it are skipped and loading is tried again next time. */
import { useEffect, useState } from 'react';

/** [display name, first-release year, regex pattern, case-sensitive (1), hint] */
export type TimelineRow = [name: string, year: number, pattern: string, caseSensitive?: number, hint?: string];
export type TechData = { names: string[]; timeline: TimelineRow[] };

const EMPTY: TechData = { names: [], timeline: [] };
let loaded: TechData | null = null, loading: Promise<TechData> | null = null;

const isRow = (r: unknown): r is TimelineRow =>
  Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'number' && typeof r[2] === 'string'
  && (r[3] === undefined || typeof r[3] === 'number') && (r[4] === undefined || typeof r[4] === 'string');

function parse(j: unknown): TechData {
  if (typeof j !== 'object' || j === null) return EMPTY;
  const names = 'names' in j && Array.isArray(j.names) ? j.names.filter((n): n is string => typeof n === 'string') : [];
  const timeline = 'timeline' in j && Array.isArray(j.timeline) ? j.timeline.filter(isRow) : [];
  return { names, timeline };
}

/** The dictionary (empty lists when the API is unreachable). */
export function loadTech(): Promise<TechData> {
  if (loaded) return Promise.resolve(loaded);
  loading ||= fetch('/api/tech-terms').then(r => (r.ok ? r.json() : null)).then((j: unknown) => {
    const d = parse(j); if (d.names.length) loaded = d; else loading = null; // an empty answer is retried next time
    return d;
  }).catch(() => { loading = null; return EMPTY; });
  return loading;
}

/** The dictionary for a component: empty at first, then the loaded lists (the component re-renders once). */
export function useTech(): TechData {
  const [d, setD] = useState<TechData>(loaded || EMPTY);
  useEffect(() => { let on = true; loadTech().then(x => { if (on) setD(x); }); return () => { on = false; }; }, []);
  return d;
}
