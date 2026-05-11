/**
 * arabic-schema.ts — single source of truth for all 21 import schemas.
 *
 * Each schema drives the template generator, the file parser, the shape
 * validator, and the row mapper. Adding a column means one edit here.
 *
 * Two families:
 *   A. Gap-I generic lookups (13) — share LookupRow shape; key-based collision.
 *   B. Sprint-1 typed lookups (8) — typed Ref* shapes; nameAr-based collision.
 */

import type {
  EnumMap,
  ImportLookupKey,
  LookupSchema,
  ParentLookup,
} from './types';

/* ── Shared helpers ──────────────────────────────────────────────────────── */

function makeEnum(pairs: [ar: string, backend: string][]): EnumMap {
  return {
    forwardArToBackend: Object.fromEntries(pairs),
    reverseBackendToAr: Object.fromEntries(pairs.map(([ar, be]) => [be, ar])),
  };
}

/**
 * Generates an auto-key from an Arabic name (matches the backend's autoKey
 * logic used in referenceDataService for Sprint-1 lookups).
 */
function autoKey(nameAr: string): string {
  return nameAr
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 24) || 'key';
}

function requireField(
  row: Record<string, string>,
  header: string,
): string {
  const v = row[header]?.trim();
  if (!v) throw new Error(`الحقل "${header}" مطلوب`);
  return v;
}

function optionalField(row: Record<string, string>, header: string): string | null {
  return row[header]?.trim() || null;
}

function resolveEnum(
  value: string,
  enumMap: EnumMap,
  columnLabel: string,
): string {
  const mapped = enumMap.forwardArToBackend[value];
  if (!mapped) {
    const valid = Object.keys(enumMap.forwardArToBackend).join(' / ');
    throw new Error(`القيمة "${value}" في "${columnLabel}" غير معروفة. القيم المتاحة: ${valid}`);
  }
  return mapped;
}

function resolveParentKey(
  keyValue: string,
  parents: ParentLookup,
  columnLabel: string,
): string {
  const id = parents.active.get(keyValue);
  if (!id) {
    if (parents.archived.has(keyValue)) {
      throw new Error(`المرجع "${keyValue}" في "${columnLabel}" مؤرشف — استعِد السجل أولاً`);
    }
    throw new Error(`المرجع "${keyValue}" في "${columnLabel}" غير موجود`);
  }
  return id;
}

/* ── Region enum (governorates) ─────────────────────────────────────────── */

const regionEnum = makeEnum([
  ['القاهرة الكبرى', 'Cairo'],
  ['الدلتا', 'Delta'],
  ['قناة السويس', 'Canal'],
  ['الصعيد', 'Upper'],
  ['الحدود', 'Frontier'],
]);

/* ── Faculty type enum (specializations) ────────────────────────────────── */

const facultyTypeEnum = makeEnum([
  ['مدني', 'Civil'],
  ['عسكري', 'Military'],
]);

/* ── Applicability enum (ranks) ─────────────────────────────────────────── */

const applicableTo = makeEnum([
  ['ضابط', 'Officer'],
  ['ضابط صف', 'NCO'],
  ['مدني', 'Civilian'],
]);

/* ── College type enum ───────────────────────────────────────────────────── */

const collegeType = makeEnum([
  ['حكومي', 'Public'],
  ['خاص', 'Private'],
  ['أزهري', 'Azhar'],
]);

/* ── Qualification level enum ───────────────────────────────────────────── */

const qualLevel = makeEnum([
  ['ثانوي', 'Secondary'],
  ['دبلوم', 'Diploma'],
  ['بكالوريوس', 'Bachelor'],
  ['ماجستير', 'Master'],
  ['دكتوراه', 'PhD'],
]);

/* ── Relationship side enum ─────────────────────────────────────────────── */

const relSide = makeEnum([
  ['من جهة الأب', 'Paternal'],
  ['من جهة الأم', 'Maternal'],
]);

/* ── Case severity enum ─────────────────────────────────────────────────── */

const caseSev = makeEnum([
  ['منخفض', 'Low'],
  ['متوسط', 'Medium'],
  ['عالٍ', 'High'],
  ['بالغ', 'Critical'],
]);

/* ── Gender enum (specialties) ──────────────────────────────────────────── */

const genderEnum = makeEnum([
  ['ذكور', 'Male'],
  ['إناث', 'Female'],
]);

/* ── SCHEMA MAP ─────────────────────────────────────────────────────────── */

export const ARABIC_SCHEMAS: Record<ImportLookupKey, LookupSchema> = {

  /* ── Sprint-1 typed lookups ───────────────────────────────────────────── */

  governorates: {
    lookupKey: 'governorates',
    requiredHeaders: ['الاسم بالعربية', 'الإقليم'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: { 'الإقليم': regionEnum },
    exampleRow: {
      'الاسم بالعربية': 'القاهرة',
      'الاسم بالإنجليزية': 'Cairo',
      'الإقليم': 'القاهرة الكبرى',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const regionAr = requireField(ar, 'الإقليم');
      const region = resolveEnum(regionAr, regionEnum, 'الإقليم');
      return {
        nameAr,
        nameEn: optionalField(ar, 'الاسم بالإنجليزية') ?? '',
        region,
        isActive: true,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  specializations: {
    lookupKey: 'specializations',
    requiredHeaders: ['الاسم بالعربية', 'الكود', 'نوع الكلية'],
    optionalHeaders: ['الترتيب'],
    parentLookup: null,
    enums: { 'نوع الكلية': facultyTypeEnum },
    exampleRow: {
      'الاسم بالعربية': 'علوم الحاسب',
      'الكود': 'CS',
      'نوع الكلية': 'مدني',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const code = requireField(ar, 'الكود');
      const facultyTypeAr = requireField(ar, 'نوع الكلية');
      const facultyType = resolveEnum(facultyTypeAr, facultyTypeEnum, 'نوع الكلية');
      return {
        nameAr,
        code,
        facultyType,
        isActive: true,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  ranks: {
    lookupKey: 'ranks',
    requiredHeaders: ['الاسم بالعربية', 'المستوى', 'ينطبق على'],
    optionalHeaders: ['الترتيب'],
    parentLookup: null,
    enums: { 'ينطبق على': applicableTo },
    exampleRow: {
      'الاسم بالعربية': 'ملازم أول',
      'المستوى': '3',
      'ينطبق على': 'ضابط',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const level = Number(requireField(ar, 'المستوى'));
      if (!Number.isInteger(level) || level < 1) throw new Error('"المستوى" يجب أن يكون رقماً صحيحاً موجباً');
      const appAr = requireField(ar, 'ينطبق على');
      const applicableToVal = resolveEnum(appAr, applicableTo, 'ينطبق على');
      return {
        nameAr,
        level,
        applicableTo: applicableToVal,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  colleges: {
    lookupKey: 'colleges',
    requiredHeaders: ['الاسم بالعربية', 'رمز المحافظة', 'نوع الكلية'],
    optionalHeaders: ['الترتيب'],
    parentLookup: null,
    enums: { 'نوع الكلية': collegeType },
    exampleRow: {
      'الاسم بالعربية': 'كلية الآداب',
      'رمز المحافظة': 'cairo_gov',
      'نوع الكلية': 'حكومي',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const governorateId = requireField(ar, 'رمز المحافظة');
      const typeAr = requireField(ar, 'نوع الكلية');
      const type = resolveEnum(typeAr, collegeType, 'نوع الكلية');
      return {
        nameAr,
        governorateId,
        type,
        isActive: true,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  qualifications: {
    lookupKey: 'qualifications',
    requiredHeaders: ['الاسم بالعربية', 'المستوى', 'تطلب كلية'],
    optionalHeaders: ['الترتيب'],
    parentLookup: null,
    enums: { 'المستوى': qualLevel },
    exampleRow: {
      'الاسم بالعربية': 'بكالوريوس هندسة',
      'المستوى': 'بكالوريوس',
      'تطلب كلية': 'نعم',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const levelAr = requireField(ar, 'المستوى');
      const level = resolveEnum(levelAr, qualLevel, 'المستوى');
      const facultyRequired = requireField(ar, 'تطلب كلية') === 'نعم';
      return {
        nameAr,
        level,
        facultyRequired,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  nationalities: {
    lookupKey: 'nationalities',
    requiredHeaders: ['الاسم بالعربية', 'رمز ISO'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: {
      'الاسم بالعربية': 'مصري',
      'الاسم بالإنجليزية': 'Egyptian',
      'رمز ISO': 'EG',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const isoCode = requireField(ar, 'رمز ISO');
      return {
        nameAr,
        nameEn: optionalField(ar, 'الاسم بالإنجليزية') ?? '',
        isoCode,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  relationships: {
    lookupKey: 'relationships',
    requiredHeaders: ['الاسم بالعربية', 'الدرجة', 'الجهة'],
    optionalHeaders: ['الترتيب'],
    parentLookup: null,
    enums: { 'الجهة': relSide },
    exampleRow: {
      'الاسم بالعربية': 'عم',
      'الدرجة': '3',
      'الجهة': 'من جهة الأب',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const degree = Number(requireField(ar, 'الدرجة'));
      if (!Number.isInteger(degree) || degree < 1) throw new Error('"الدرجة" يجب أن يكون رقماً صحيحاً موجباً');
      const sideAr = requireField(ar, 'الجهة');
      const side = resolveEnum(sideAr, relSide, 'الجهة');
      return {
        nameAr,
        degree,
        side,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  caseTypes: {
    lookupKey: 'caseTypes',
    requiredHeaders: ['الاسم بالعربية', 'الخطورة', 'يحجب التقديم'],
    optionalHeaders: ['الترتيب'],
    parentLookup: null,
    enums: { 'الخطورة': caseSev },
    exampleRow: {
      'الاسم بالعربية': 'سرقة',
      'الخطورة': 'عالٍ',
      'يحجب التقديم': 'نعم',
      'الترتيب': '10',
    },
    getCollisionKey: (ar) => ar['الاسم بالعربية']?.trim() ?? '',
    getExistingKey: (row) => String(row['nameAr'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const nameAr = requireField(ar, 'الاسم بالعربية');
      const sevAr = requireField(ar, 'الخطورة');
      const severity = resolveEnum(sevAr, caseSev, 'الخطورة');
      const blocksApplication = requireField(ar, 'يحجب التقديم') === 'نعم';
      return {
        nameAr,
        severity,
        blocksApplication,
        sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase,
      };
    },
  },

  /* ── Gap-I generic lookups (LookupRow shape) ─────────────────────────── */
  /* All have: المفتاح (required), الاسم بالعربية (required),
     الاسم بالإنجليزية (optional), الترتيب (optional). */

  educationTypes: {
    lookupKey: 'educationTypes',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'thanaweya_amma', 'الاسم بالعربية': 'ثانوية عامة', 'الاسم بالإنجليزية': 'General Secondary', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها (فقط: a-z, 0-9, _, -)`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  maritalStatuses: {
    lookupKey: 'maritalStatuses',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'single', 'الاسم بالعربية': 'أعزب', 'الاسم بالإنجليزية': 'Single', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  universities: {
    lookupKey: 'universities',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'cairo', 'الاسم بالعربية': 'جامعة القاهرة', 'الاسم بالإنجليزية': 'Cairo University', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  faculties: {
    lookupKey: 'faculties',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية', 'مفتاح الجامعة'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: 'universities',
    enums: {},
    exampleRow: { 'المفتاح': 'eng_cairo', 'الاسم بالعربية': 'كلية الهندسة - القاهرة', 'مفتاح الجامعة': 'cairo', 'الاسم بالإنجليزية': 'Engineering - Cairo', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      const universityKey = requireField(ar, 'مفتاح الجامعة');
      const universityId = resolveParentKey(universityKey, parents, 'مفتاح الجامعة');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), universityId, sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  specialtyTypes: {
    lookupKey: 'specialtyTypes',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'engineering', 'الاسم بالعربية': 'هندسة', 'الاسم بالإنجليزية': 'Engineering', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  specialties: {
    lookupKey: 'specialties',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية', 'مفتاح نوع التخصص'],
    optionalHeaders: ['الاسم بالإنجليزية', 'النوع', 'الترتيب'],
    parentLookup: 'specialtyTypes',
    enums: { 'النوع': genderEnum },
    exampleRow: { 'المفتاح': 'civil_eng', 'الاسم بالعربية': 'هندسة مدنية', 'مفتاح نوع التخصص': 'engineering', 'النوع': 'ذكور', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      const stKey = requireField(ar, 'مفتاح نوع التخصص');
      const specialtyTypeId = resolveParentKey(stKey, parents, 'مفتاح نوع التخصص');
      const genderRaw = optionalField(ar, 'النوع');
      const gender = genderRaw ? resolveEnum(genderRaw, genderEnum, 'النوع') : null;
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), specialtyTypeId, gender, sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  degreeTypes: {
    lookupKey: 'degreeTypes',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'bachelor', 'الاسم بالعربية': 'بكالوريوس', 'الاسم بالإنجليزية': 'Bachelor', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  jobs: {
    lookupKey: 'jobs',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'engineer', 'الاسم بالعربية': 'مهندس', 'الاسم بالإنجليزية': 'Engineer', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  examTypes: {
    lookupKey: 'examTypes',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'written', 'الاسم بالعربية': 'تحريري', 'الاسم بالإنجليزية': 'Written', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  examGroups: {
    lookupKey: 'examGroups',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'group_a', 'الاسم بالعربية': 'مجموعة أ', 'الاسم بالإنجليزية': 'Group A', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  committeeTypes: {
    lookupKey: 'committeeTypes',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'admission', 'الاسم بالعربية': 'لجنة قبول', 'الاسم بالإنجليزية': 'Admission Committee', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  rejectionReasons: {
    lookupKey: 'rejectionReasons',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'age_exceed', 'الاسم بالعربية': 'تجاوز السن', 'الاسم بالإنجليزية': 'Age Exceeded', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },

  notificationDepartments: {
    lookupKey: 'notificationDepartments',
    requiredHeaders: ['المفتاح', 'الاسم بالعربية'],
    optionalHeaders: ['الاسم بالإنجليزية', 'الترتيب'],
    parentLookup: null,
    enums: {},
    exampleRow: { 'المفتاح': 'medical', 'الاسم بالعربية': 'القومسيون الطبي', 'الاسم بالإنجليزية': 'Medical Commission', 'الترتيب': '10' },
    getCollisionKey: (ar) => ar['المفتاح']?.trim() ?? '',
    getExistingKey: (row) => String(row['key'] ?? ''),
    mapRow(ar, _parents, sortBase) {
      const key = requireField(ar, 'المفتاح');
      if (!/^[a-z0-9_-]+$/.test(key)) throw new Error(`المفتاح "${key}" يحتوي على أحرف غير مسموح بها`);
      const labelAr = requireField(ar, 'الاسم بالعربية');
      return { key, labelAr, labelEn: optionalField(ar, 'الاسم بالإنجليزية'), sortOrder: ar['الترتيب'] ? Number(ar['الترتيب']) : sortBase, isActive: true };
    },
  },
};

// Make autoKey visible for tests that need it.
export { autoKey };
