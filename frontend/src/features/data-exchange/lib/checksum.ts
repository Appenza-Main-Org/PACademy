/**
 * Frontend mirror of the backend `PACademy.Shared.Persistence.ChangeTracking.RowChecksum`.
 *
 * Reproduced VERBATIM so the mock service classifies imported rows exactly as
 * the backend would. Algorithm (the integration contract):
 *   1. data columns only — exclude the 6 tracking columns;
 *   2. order by column name, ordinal ascending;
 *   3. canonicalize: null → ""; columns ending `_json` → canonical JSON
 *      (object keys sorted recursively, no whitespace); else string as-is;
 *   4. concatenate `column‹US›value` pairs joined by `‹RS›`;
 *   5. SHA-256 over UTF-8 bytes → lowercase hex.
 */

const UNIT_SEPARATOR = '';
const RECORD_SEPARATOR = '';

/** The 6 tracking columns excluded from every checksum. */
export const TRACKING_COLUMNS: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'row_version',
  'last_modified_by',
  'source_system',
  'checksum',
]);

/** Canonicalize a JSON string: keys sorted recursively, no insignificant whitespace. */
export function canonicalizeJson(json: string): string {
  if (!json || !json.trim()) return '';
  try {
    return JSON.stringify(sortValue(JSON.parse(json)));
  } catch {
    return json;
  }
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function canonicalizeCell(column: string, value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (column.toLowerCase().endsWith('_json')) return canonicalizeJson(value);
  return value;
}

/**
 * Compute the SHA-256 (lowercase hex) checksum over a set of (column, value)
 * pairs. Tracking columns are dropped. Async — uses Web Crypto.
 */
export async function computeRowChecksum(
  columns: ReadonlyArray<readonly [string, string | null | undefined]>,
): Promise<string> {
  const ordered = columns
    .filter(([name]) => !TRACKING_COLUMNS.has(name))
    .slice()
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const joined = ordered
    .map(([name, value]) => `${name}${UNIT_SEPARATOR}${canonicalizeCell(name, value)}`)
    .join(RECORD_SEPARATOR);

  const bytes = new TextEncoder().encode(joined);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
