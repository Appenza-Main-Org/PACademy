/**
 * conflict-detector.ts — two-pass row classifier.
 *
 * Pass 1 (shape) — already done by the parser (mapRow).
 * Pass 2 (collision) — done here by comparing against pre-fetched existing rows.
 *
 * This function is synchronous and pure: it receives the existing rows as a
 * parameter so it can be tested without React context or TanStack Query.
 * The calling component is responsible for fetching existing rows first.
 */

import { ARABIC_SCHEMAS } from './arabic-schema';
import type {
  ConflictDescriptor,
  ImportLookupKey,
  ParsedRow,
  ParentLookup,
  RowError,
} from './types';

/** Minimal shape of an existing row needed for collision detection. */
export interface ExistingRow {
  /** Collision key — `key` for Gap-I lookups, `nameAr` for Sprint-1 typed. */
  collisionKey: string;
  /** Backend UUID. */
  id: string;
  /** True when the row has been soft-deleted (archived). */
  isArchived: boolean;
  /** Full backend row snapshot for diff display. */
  snapshot: Record<string, unknown>;
}

/**
 * Run the collision pass on `rows` that have already passed shape validation.
 *
 * Modifies `classification`, `conflict`, `resolution`, and `error` fields
 * in place for rows that collide or fail FK checks.
 *
 * @param rows         Output of parseXLSX / parseCSV (shape-passed).
 * @param lookupKey    Destination lookup type.
 * @param existingRows All rows currently in the destination lookup (incl. archived).
 * @param parentRows   Pre-fetched parent lookup rows (for hierarchical lookups).
 *
 * @returns The same array (mutated in place) for convenience.
 */
export function classifyImportRows(
  rows: ParsedRow[],
  lookupKey: ImportLookupKey,
  existingRows: ExistingRow[],
  parentRows?: ExistingRow[],
): ParsedRow[] {
  const schema = ARABIC_SCHEMAS[lookupKey];

  // Build collision index from existing rows.
  const existingIndex = new Map<string, ExistingRow>();
  for (const r of existingRows) {
    existingIndex.set(r.collisionKey, r);
  }

  // Build parent index (for hierarchical lookups).
  const parents: ParentLookup = {
    active: new Map(),
    archived: new Map(),
  };
  if (parentRows) {
    for (const p of parentRows) {
      if (p.isArchived) {
        parents.archived.set(p.collisionKey, p.id);
      } else {
        parents.active.set(p.collisionKey, p.id);
      }
    }
  }

  // Detect intra-file duplicates (second+ occurrence → errored).
  const seenInFile = new Map<string, number>(); // collisionKey → first index
  for (const row of rows) {
    if (row.classification !== 'valid') continue;
    const collisionKey = schema.getCollisionKey(row.arabicValues);
    if (!collisionKey) continue;
    if (seenInFile.has(collisionKey)) {
      row.classification = 'errored';
      const firstIdx = seenInFile.get(collisionKey)!;
      row.error = {
        code: 'duplicate_in_file',
        column: null,
        messageAr: `المفتاح "${collisionKey}" مكرر في الملف — صف ${firstIdx + 2} يحتوي على نفس المفتاح`,
      } satisfies RowError;
    } else {
      seenInFile.set(collisionKey, row.index);
    }
  }

  // Collision pass: compare valid rows against existing rows.
  for (const row of rows) {
    if (row.classification !== 'valid') continue;

    const collisionKey = schema.getCollisionKey(row.arabicValues);
    const existing = existingIndex.get(collisionKey);
    if (!existing) continue; // no collision — stays 'valid'

    const descriptor: ConflictDescriptor = {
      type: existing.isArchived ? 'archived_collision' : 'active_collision',
      existingId: existing.id,
      existingValues: existing.snapshot,
    };

    row.classification = descriptor.type;
    row.conflict = descriptor;
    // Pre-select default resolution (Skip for archived; none for active).
    if (descriptor.type === 'archived_collision') {
      row.resolution = 'skip';
    }
  }

  return rows;
}

/**
 * Re-classify a single row after the admin edits its collision key
 * (the `rename_required` path). Returns the updated row.
 */
export function reclassifyRow(
  row: ParsedRow,
  newCollisionKey: string,
  lookupKey: ImportLookupKey,
  existingRows: ExistingRow[],
  allRows: ParsedRow[],
): ParsedRow {
  const schema = ARABIC_SCHEMAS[lookupKey];

  // Build updated collision key in arabicValues.
  const keyHeader = schema.requiredHeaders.includes('المفتاح') ? 'المفتاح' : 'الاسم بالعربية';
  row.arabicValues = { ...row.arabicValues, [keyHeader]: newCollisionKey };

  // Re-run mapRow with the new key (use a dummy sortBase; it'll be recalculated on commit).
  const emptyParents: ParentLookup = { active: new Map(), archived: new Map() };
  try {
    row.payload = schema.mapRow(row.arabicValues, emptyParents, row.index * 10);
  } catch {
    row.classification = 'errored';
    row.error = { code: 'invalid_key', column: keyHeader, messageAr: `المفتاح "${newCollisionKey}" غير صالح` };
    return row;
  }

  // Check intra-file duplicate.
  const inFileDupe = allRows.find(
    (r) => r !== row && schema.getCollisionKey(r.arabicValues) === newCollisionKey,
  );
  if (inFileDupe) {
    row.classification = 'errored';
    row.error = {
      code: 'duplicate_in_file',
      column: keyHeader,
      messageAr: `المفتاح "${newCollisionKey}" مكرر في الملف — صف ${inFileDupe.index + 2}`,
    };
    return row;
  }

  // Check against existing rows.
  const existing = existingRows.find((e) => e.collisionKey === newCollisionKey);
  if (existing) {
    row.classification = existing.isArchived ? 'archived_collision' : 'active_collision';
    row.conflict = { type: row.classification, existingId: existing.id, existingValues: existing.snapshot };
    row.resolution = existing.isArchived ? 'skip' : null;
  } else {
    row.classification = 'valid';
    row.conflict = null;
    row.resolution = null;
  }
  row.error = null;
  return row;
}
