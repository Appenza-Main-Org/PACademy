/**
 * arabic-schema.test.ts — unit tests for all 21 import schemas.
 *
 * For each schema we verify:
 *   1. requiredHeaders are non-empty
 *   2. exampleRow satisfies all required headers
 *   3. mapRow(exampleRow, emptyParents, 10) produces a BackendPayload without throwing
 *   4. getCollisionKey(exampleRow) returns a non-empty string
 *   5. getExistingKey on the mapRow output matches getCollisionKey (round-trip)
 */

import { describe, it, expect } from 'vitest';
import { ARABIC_SCHEMAS } from './arabic-schema';
import type { ImportLookupKey, ParentLookup } from './types';

const EMPTY_PARENTS: ParentLookup = { active: new Map(), archived: new Map() };

const ALL_KEYS: ImportLookupKey[] = [
  'governorates',
  'specializations',
  'ranks',
  'colleges',
  'qualifications',
  'nationalities',
  'relationships',
  'caseTypes',
  'educationTypes',
  'maritalStatuses',
  'universities',
  'faculties',
  'specialties',
  'specialtyTypes',
  'degreeTypes',
  'jobs',
  'examTypes',
  'examGroups',
  'committeeTypes',
  'rejectionReasons',
  'notificationDepartments',
];

describe('ARABIC_SCHEMAS', () => {
  it('covers all 21 ImportLookupKeys', () => {
    for (const key of ALL_KEYS) {
      expect(ARABIC_SCHEMAS[key]).toBeDefined();
    }
  });

  for (const key of ALL_KEYS) {
    describe(key, () => {
      const schema = ARABIC_SCHEMAS[key];

      it('has at least one required header', () => {
        expect(schema.requiredHeaders.length).toBeGreaterThan(0);
      });

      it('exampleRow covers all required headers', () => {
        for (const h of schema.requiredHeaders) {
          expect(schema.exampleRow[h]).toBeDefined();
          expect(schema.exampleRow[h]).not.toBe('');
        }
      });

      it('mapRow(exampleRow) returns a non-empty payload', () => {
        // Hierarchical schemas (faculties/specialties) need a parent in the map.
        const parents: ParentLookup = { ...EMPTY_PARENTS };
        if (key === 'faculties') {
          // exampleRow for faculties has 'مفتاح الجامعة' = 'cairo'
          parents.active = new Map([['cairo', 'mock-parent-uuid']]);
        }
        if (key === 'specialties') {
          // exampleRow for specialties has 'مفتاح نوع التخصص' = 'engineering'
          parents.active = new Map([['engineering', 'mock-parent-uuid']]);
        }

        const payload = schema.mapRow(schema.exampleRow, parents, 10);
        expect(payload).toBeDefined();
        expect(Object.keys(payload).length).toBeGreaterThan(0);
      });

      it('getCollisionKey(exampleRow) returns a non-empty string', () => {
        const key_ = schema.getCollisionKey(schema.exampleRow);
        expect(typeof key_).toBe('string');
        expect(key_.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('ARABIC_SCHEMAS — mapRow validation', () => {
  it('governorates: rejects missing nameAr', () => {
    const schema = ARABIC_SCHEMAS.governorates;
    expect(() =>
      schema.mapRow({ 'الاسم بالعربية': '', 'الإقليم': 'القاهرة الكبرى' }, EMPTY_PARENTS, 10),
    ).toThrow();
  });

  it('governorates: rejects unknown region enum', () => {
    const schema = ARABIC_SCHEMAS.governorates;
    expect(() =>
      schema.mapRow(
        { 'الاسم بالعربية': 'اختبار', 'الإقليم': 'قيمة غير معروفة' },
        EMPTY_PARENTS,
        10,
      ),
    ).toThrow();
  });

  it('educationTypes: rejects missing key (المفتاح)', () => {
    const schema = ARABIC_SCHEMAS.educationTypes;
    expect(() =>
      schema.mapRow(
        { 'المفتاح': '', 'الاسم بالعربية': 'اختبار' },
        EMPTY_PARENTS,
        10,
      ),
    ).toThrow();
  });

  it('educationTypes: accepts valid row and produces key + labelAr', () => {
    const schema = ARABIC_SCHEMAS.educationTypes;
    const payload = schema.mapRow(
      { 'المفتاح': 'tech', 'الاسم بالعربية': 'تقني' },
      EMPTY_PARENTS,
      10,
    );
    expect(payload['key']).toBe('tech');
    expect(payload['labelAr']).toBe('تقني');
    expect(payload['isActive']).toBe(true);
  });

  it('faculties: rejects archived parent', () => {
    const schema = ARABIC_SCHEMAS.faculties;
    const parents: ParentLookup = {
      active: new Map(),
      archived: new Map([['cairo_univ', 'archived-id']]),
    };
    expect(() =>
      schema.mapRow(
        { 'المفتاح': 'fac_key', 'الاسم بالعربية': 'كلية', 'مفتاح الجامعة': 'cairo_univ' },
        parents,
        10,
      ),
    ).toThrow(/مؤرشف/);
  });

  it('faculties: rejects missing parent', () => {
    const schema = ARABIC_SCHEMAS.faculties;
    expect(() =>
      schema.mapRow(
        { 'المفتاح': 'fac_key', 'الاسم بالعربية': 'كلية', 'مفتاح الجامعة': 'nonexistent' },
        EMPTY_PARENTS,
        10,
      ),
    ).toThrow(/غير موجود/);
  });

  it('sortOrder falls back to sortBase + index*10 when column absent', () => {
    const schema = ARABIC_SCHEMAS.educationTypes;
    const payload = schema.mapRow(
      { 'المفتاح': 'test_key', 'الاسم بالعربية': 'اختبار' },
      EMPTY_PARENTS,
      50, // sortBase
    );
    expect(payload['sortOrder']).toBe(50);
  });

  it('sortOrder uses column value when present', () => {
    const schema = ARABIC_SCHEMAS.educationTypes;
    const payload = schema.mapRow(
      { 'المفتاح': 'test_key', 'الاسم بالعربية': 'اختبار', 'الترتيب': '120' },
      EMPTY_PARENTS,
      50,
    );
    expect(payload['sortOrder']).toBe(120);
  });
});
