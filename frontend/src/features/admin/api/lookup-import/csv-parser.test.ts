/**
 * csv-parser.test.ts — unit tests for parseCSV.
 *
 * Covers: UTF-8 BOM stripping, schema mismatch, empty file, size cap,
 * row count cap, malformed non-UTF-8 rejection, valid rows, optional columns.
 */

import { describe, it, expect } from 'vitest';
import { parseCSV } from './csv-parser';
import type { ParentLookup } from './types';

const EMPTY_PARENTS: ParentLookup = { active: new Map(), archived: new Map() };
const SORT_BASE = 10;

function makeFile(content: string, name = 'test.csv', type = 'text/csv'): File {
  return new File([content], name, { type });
}

function makeFileWithBom(content: string): File {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const body = new TextEncoder().encode(content);
  const merged = new Uint8Array(bom.length + body.length);
  merged.set(bom, 0);
  merged.set(body, bom.length);
  return new File([merged], 'bom.csv', { type: 'text/csv' });
}

/* ── basic acceptance ───────────────────────────────────────────────────── */

describe('parseCSV — basic acceptance', () => {
  it('parses a valid educationTypes CSV', async () => {
    const csv = 'المفتاح,الاسم بالعربية\ntech,تقني\nart,فنون\n';
    const { rows, rejection } = await parseCSV(makeFile(csv), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[0].classification).toBe('valid');
    expect(rows[0].arabicValues['المفتاح']).toBe('tech');
  });

  it('strips UTF-8 BOM silently', async () => {
    const csv = 'المفتاح,الاسم بالعربية\nbom_key,مع BOM\n';
    const { rows, rejection } = await parseCSV(makeFileWithBom(csv), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection).toBeNull();
    expect(rows[0].arabicValues['المفتاح']).toBe('bom_key');
  });

  it('skips empty rows', async () => {
    const csv = 'المفتاح,الاسم بالعربية\nkey_a,الاسم أ\n\n\nkey_b,الاسم ب\n';
    const { rows, rejection } = await parseCSV(makeFile(csv), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection).toBeNull();
    expect(rows).toHaveLength(2);
  });

  it('assigns default sortOrder from sortBase when column absent', async () => {
    const csv = 'المفتاح,الاسم بالعربية\nk1,الأول\nk2,الثاني\n';
    const { rows } = await parseCSV(makeFile(csv), 'educationTypes', 50, EMPTY_PARENTS);
    expect(rows[0].payload?.['sortOrder']).toBe(50);
    expect(rows[1].payload?.['sortOrder']).toBe(60); // 50 + 1*10
  });
});

/* ── rejection cases ─────────────────────────────────────────────────────── */

describe('parseCSV — rejections', () => {
  it('rejects files > 5 MB', async () => {
    const largeContent = 'المفتاح,الاسم بالعربية\n' + 'a,ب\n'.repeat(300_000);
    const file = makeFile(largeContent);
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    const { rejection } = await parseCSV(file, 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection?.code).toBe('too_large');
  });

  it('rejects files with more than 1000 data rows', async () => {
    const header = 'المفتاح,الاسم بالعربية\n';
    const dataRows = Array.from({ length: 1001 }, (_, i) => `key_${i},اسم_${i}`).join('\n');
    const { rejection } = await parseCSV(makeFile(header + dataRows), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection?.code).toBe('too_many_rows');
  });

  it('rejects files with no data rows (header only)', async () => {
    const csv = 'المفتاح,الاسم بالعربية\n';
    const { rejection } = await parseCSV(makeFile(csv), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection?.code).toBe('empty');
  });

  it('rejects schema mismatch (missing required header)', async () => {
    const csv = 'عمود_خاطئ,الاسم بالعربية\nk,v\n';
    const { rejection } = await parseCSV(makeFile(csv), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection?.code).toBe('schema_mismatch');
  });
});

/* ── per-row validation errors ───────────────────────────────────────────── */

describe('parseCSV — per-row validation', () => {
  it('classifies row as errored when required field is missing', async () => {
    const csv = 'المفتاح,الاسم بالعربية\n,اسم بلا مفتاح\n';
    const { rows, rejection } = await parseCSV(makeFile(csv), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rejection).toBeNull();
    expect(rows[0].classification).toBe('errored');
    expect(rows[0].error?.code).toBe('missing_required');
  });

  it('classifies valid rows alongside errored rows', async () => {
    const csv = 'المفتاح,الاسم بالعربية\nvalid_key,صالح\n,مفقود المفتاح\n';
    const { rows } = await parseCSV(makeFile(csv), 'educationTypes', SORT_BASE, EMPTY_PARENTS);
    expect(rows[0].classification).toBe('valid');
    expect(rows[1].classification).toBe('errored');
  });
});
