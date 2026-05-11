/**
 * Lookup Management Module — domain types.
 *
 * One canonical shape for every admin-managed reference list across the
 * platform. The brief specifies 20 type codes; this implementation extends
 * that to 31 to preserve compatibility with the 5 live consumers of the
 * pre-existing `LookupKey`/`ReferenceTab` systems (see
 * `docs/migration/lookups/INVENTORY.md` §3).
 *
 * Backend integration target — see INTEGRATION CONTRACT JSDoc on
 * `lookups.service.ts`.
 */

/** Every admin-managed lookup category. Each code maps to one row in
 *  `lookup_types` and many rows in `lookup_items`. */
export const LOOKUP_TYPE_CODES = [
  // Brief — 20 canonical codes.
  'RELATIONSHIP_CATEGORY',
  'TESTS',
  'TEST_MODELS',
  'SPECIALIZATIONS',
  'UNIVERSITIES',
  'FACULTIES',
  'APPLICANT_CATEGORIES',
  'COMMITTEES',
  'ACADEMIC_GRADES',
  'EDUCATIONAL_ENTITY_RANKING',
  'COUNTRIES',
  'GOVERNORATES',
  'POLICE_DEPARTMENTS',
  'JOBS',
  'QUALIFICATIONS',
  'ADMISSION_PERIODS',
  'APPLICANT_NETWORK',
  'SCHOOL_LANGUAGE',
  'FOREIGN_APPLICANTS',
  'EDUCATION_LEVELS',
  // Extensions — preserve consumers of the pre-existing LookupKey system.
  'EDUCATION_TYPES',
  'MARITAL_STATUSES',
  'SPECIALTIES',
  'SPECIALTY_TYPES',
  'DEGREE_TYPES',
  'EXAM_TYPES',
  'EXAM_GROUPS',
  'COMMITTEE_TYPES',
  'REJECTION_REASONS',
  'NOTIFICATION_DEPARTMENTS',
  'APPLICANT_SECTIONS',
  'NATIONAL_ID_MISSING_REASONS',
  'NATIONALITIES',
  'CASE_TYPES',
] as const;

export type LookupTypeCode = (typeof LOOKUP_TYPE_CODES)[number];

/** Type codes whose items form a parent–child tree. All others are flat. */
export const HIERARCHICAL_TYPES: ReadonlySet<LookupTypeCode> = new Set<LookupTypeCode>([
  'RELATIONSHIP_CATEGORY',
  'TESTS',
  'TEST_MODELS',
  'COUNTRIES',
  'GOVERNORATES',
  'POLICE_DEPARTMENTS',
  'JOBS',
  'APPLICANT_CATEGORIES',
  // Pre-existing parent–child wiring preserved from MOCK.lookups.
  'FACULTIES',
  'SPECIALTIES',
  'SPECIALTY_TYPES',
]);

/** A lookup-type registry row. The set is closed (admin cannot add new
 *  types from the UI); only the rows under a type are mutable. */
export interface LookupType {
  id: string;
  code: LookupTypeCode;
  nameAr: string;
  nameEn: string;
  isHierarchical: boolean;
  isActive: boolean;
}

/** A single managed row inside a lookup type. */
export interface LookupItem {
  id: string;
  lookupTypeCode: LookupTypeCode;
  parentId: string | null;
  /** Stable machine code, e.g. `UNI-001`. Matches `/^[A-Z][A-Z_]*-\d{3,}$/`. */
  code: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Optional structured extras — used for ACADEMIC_GRADES (min/max %) and
   *  any future per-type fields that don't merit promotion to first-class. */
  metadata: Record<string, unknown> | null;
  /** Effective-date window (inclusive) for the row. */
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  /** Set on soft-delete. Live rows have `deletedAt: null`. */
  deletedAt: string | null;
}

/** A `LookupItem` enriched with its computed subtree, for tree views. */
export type LookupTreeNode = LookupItem & {
  children: LookupTreeNode[];
  /** 0 for root rows, 1 for direct children, etc. */
  level: number;
};

/** A single edge in one of the four mapping tables. */
export interface LookupMappingPair {
  categoryId: string;
  targetId: string;
}

/** All four mapping kinds carried in a single payload. */
export interface LookupMappings {
  categorySpecializations: LookupMappingPair[];
  categoryCommittees: LookupMappingPair[];
  categoryTests: LookupMappingPair[];
  periodCategories: LookupMappingPair[];
}

/** Discriminated key for `useLookupMappings` / `useAddMapping` / `useRemoveMapping`. */
export type LookupMappingKind = keyof LookupMappings;

/** Query filter shape for `lookupsService.listItems`. */
export interface LookupFilters {
  typeCode: LookupTypeCode;
  search?: string;
  includeInactive?: boolean;
  /** For hierarchical types, list direct children of this parent. `null`
   *  matches root rows; `undefined` matches at any level. */
  parentId?: string | null;
  page?: number;
  pageSize?: number;
}

/** Typed conflict codes thrown by `lookupsService`. Mirrors the SQL Server
 *  invariants documented in `docs/DB_CONSTRAINTS.md` §10 "Lookups —
 *  invariants". */
export type LookupConflictCode =
  | 'CIRCULAR_HIERARCHY'
  | 'PARENT_HAS_CHILDREN'
  | 'SELF_PARENT'
  | 'DUPLICATE_CODE'
  | 'DUPLICATE_MAPPING'
  | 'INVALID_DATE_RANGE'
  | 'IN_USE';
