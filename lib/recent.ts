// Recently viewed listings — kept in localStorage (works for guests too,
// no account or DB table needed). Most recent first, capped at 10.

const KEY = 'bn-recently-viewed';
const MAX = 10;

export function readRecentIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentView(id: string): void {
  try {
    const ids = readRecentIds().filter((x) => x !== id);
    ids.unshift(id);
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // Private mode etc. — recently-viewed is a nicety, never an error.
  }
}
