/**
 * conflict-detector.test.ts — unit tests for classifyImportRows + reclassifyRow.
 *
 * Tests cover: pure valid, active_collision, archived_collision,
 * intra-file duplicate, FK-not-found, and the reclassify path.
 */

import { describe, it, expect } from 'vitest';
import { classifyImportRows, reclassifyRow } from './conflict-detector';
import type { ExistingRow } from './conflict-detector';
import type { ParsedRow } from './types';

/* ── helpers ─────────────────────────────────────────────────────────────── */

function makeValidRow(index: number, key: string): ParsedRow {
  return {
    index,
    arabicValues: { 'المفتاح': key, 'الاسم بالعربية': key },
    payload: { key, labelAr: key, isActive: true, sortOrder: 10 },
    classification: 'valid',
    conflict: null,
    resolution: null,
    outcome: null,
    error: null,
  };
}

function makeExistingRow(key: string, id: string, isArchived: boolean): ExistingRow {
  return {
    collisionKey: key,
    id,
    isArchived,
    snapshot: { key, labelAr: key },
  };
}

/* ── classifyImportRows ──────────────────────────────────────────────────── */

describe('classifyImportRows', () => {
  it('leaves valid rows with no collision unchanged', () => {
    const rows = [makeValidRow(0, 'new_key')];
    const result = classifyImportRows(rows, 'educationTypes', []);
    expect(result[0].classification).toBe('valid');
    expect(result[0].conflict).toBeNull();
  });

  it('detects active_collision', () => {
    const rows = [makeValidRow(0, 'existing_key')];
    const existing = [makeExistingRow('existing_key', 'uuid-1', false)];
    const result = classifyImportRows(rows, 'educationTypes', existing);
    expect(result[0].classification).toBe('active_collision');
    expect(result[0].conflict?.existingId).toBe('uuid-1');
    expect(result[0].resolution).toBeNull();
  });

  it('detects archived_collision and pre-selects skip', () => {
    const rows = [makeValidRow(0, 'archived_key')];
    const existing = [makeExistingRow('archived_key', 'uuid-2', true)];
    const result = classifyImportRows(rows, 'educationTypes', existing);
    expect(result[0].classification).toBe('archived_collision');
    expect(result[0].resolution).toBe('skip');
  });

  it('marks second+ occurrence of same key as errored (intra-file duplicate)', () => {
    const rows = [makeValidRow(0, 'dup_key'), makeValidRow(1, 'dup_key')];
    const result = classifyImportRows(rows, 'educationTypes', []);
    expect(result[0].classification).toBe('valid');
    expect(result[1].classification).toBe('errored');
    expect(result[1].error?.code).toBe('duplicate_in_file');
  });

  it('does not touch already-errored rows', () => {
    const erroredRow: ParsedRow = {
      ...makeValidRow(0, 'any'),
      classification: 'errored',
      payload: null,
      error: { code: 'missing_required', column: null, messageAr: 'خطأ' },
    };
    const result = classifyImportRows([erroredRow], 'educationTypes', [
      makeExistingRow('any', 'id', false),
    ]);
    expect(result[0].classification).toBe('errored');
  });

  it('handles multiple valid rows with no collisions', () => {
    const rows = [makeValidRow(0, 'key_a'), makeValidRow(1, 'key_b'), makeValidRow(2, 'key_c')];
    const result = classifyImportRows(rows, 'educationTypes', []);
    expect(result.every((r) => r.classification === 'valid')).toBe(true);
  });

  it('Sprint-1 lookups use nameAr as collision key', () => {
    const rows: ParsedRow[] = [
      {
        index: 0,
        arabicValues: { 'الاسم بالعربية': 'القاهرة', 'الإقليم': 'القاهرة الكبرى' },
        payload: { nameAr: 'القاهرة', region: 'Cairo', isActive: true, sortOrder: 10 },
        classification: 'valid',
        conflict: null,
        resolution: null,
        outcome: null,
        error: null,
      },
    ];
    const existing = [{ collisionKey: 'القاهرة', id: 'gov-1', isArchived: false, snapshot: {} }];
    const result = classifyImportRows(rows, 'governorates', existing);
    expect(result[0].classification).toBe('active_collision');
  });
});

/* ── reclassifyRow ───────────────────────────────────────────────────────── */

describe('reclassifyRow', () => {
  it('reclassifies to valid when new key has no collision', () => {
    const row = makeValidRow(0, 'old_key');
    row.classification = 'active_collision';
    row.conflict = { type: 'active_collision', existingId: 'id', existingValues: {} };

    const result = reclassifyRow(row, 'brand_new_key', 'educationTypes', [], [row]);
    expect(result.classification).toBe('valid');
    expect(result.conflict).toBeNull();
    expect(result.error).toBeNull();
  });

  it('reclassifies to active_collision when new key matches an active existing row', () => {
    const row = makeValidRow(0, 'old_key');
    row.classification = 'archived_collision';
    const existing = [makeExistingRow('taken_key', 'uuid-x', false)];

    const result = reclassifyRow(row, 'taken_key', 'educationTypes', existing, [row]);
    expect(result.classification).toBe('active_collision');
    expect(result.conflict?.existingId).toBe('uuid-x');
  });

  it('reclassifies to errored when new key matches another file row', () => {
    const row0 = makeValidRow(0, 'same_key');
    const row1 = { ...makeValidRow(1, 'old_key'), classification: 'active_collision' as const };

    const result = reclassifyRow(row1, 'same_key', 'educationTypes', [], [row0, row1]);
    expect(result.classification).toBe('errored');
    expect(result.error?.code).toBe('duplicate_in_file');
  });
});
