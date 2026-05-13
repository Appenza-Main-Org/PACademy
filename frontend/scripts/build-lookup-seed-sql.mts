/**
 * Generates an idempotent SQL MERGE script that seeds dbo.lookup_items
 * from the frontend mock LOOKUPS_SEED. Re-runnable: row IDs are derived
 * deterministically (SHA-1 of `${typeCode}:${code}`) so re-running won't
 * insert duplicates.
 *
 * Output: backend/scripts/seeds/010_lookup_catalogue_seed.sql
 *
 * Run with: npx tsx frontend/scripts/build-lookup-seed-sql.mts
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOOKUPS_SEED } from '../src/features/lookups/mock/lookups.mock';
import type { LookupKey } from '../src/features/lookups/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../../backend/scripts/seeds/010_lookup_catalogue_seed.sql');

const TYPE_CODE: Record<LookupKey, string> = {
  'relationships':                'RELATIONSHIPS',
  'relationship-degree-tiers':    'RELATIONSHIP_DEGREE_TIERS',
  'tests':                        'TESTS',
  'test-results':                 'TEST_RESULTS',
  'committees':                   'COMMITTEES',
  'specializations':              'SPECIALIZATIONS',
  'faculties':                    'FACULTIES',
  'applicant-categories':         'APPLICANT_CATEGORIES',
  'nationalities-countries':      'NATIONALITIES_COUNTRIES',
  'governorates':                 'GOVERNORATES',
  'police-stations':              'POLICE_STATIONS',
  'jobs':                         'JOBS',
  'qualifications':               'QUALIFICATIONS',
  'announcements':                'ANNOUNCEMENTS',
  'applicant-divisions':          'APPLICANT_DIVISIONS',
  'school-categories':            'SCHOOL_CATEGORIES',
  'nid-missing-reasons':          'NID_MISSING_REASONS',
};

const HIERARCHICAL: ReadonlySet<LookupKey> = new Set(['relationships', 'jobs']);

const SEED_ACTOR_GUID = '00000000-0000-0000-0000-000000000001';

function detGuid(typeCode: string, code: string): string {
  const h = createHash('sha1').update(`${typeCode}:${code}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

interface SplitFields {
  parentCode?: string | null;
  facultyCode?: string | null;
  extras: Record<string, unknown>;
}

function splitFields(key: LookupKey, row: Record<string, unknown>): SplitFields {
  const extras: Record<string, unknown> = {};
  let parentCode: string | null | undefined;
  let facultyCode: string | null | undefined;

  switch (key) {
    case 'relationships':
      parentCode = row.parentCode as string | null;
      extras.branch = row.branch;
      extras.gender = row.gender;
      extras.degree = row.degree;
      break;
    case 'relationship-degree-tiers':
      extras.degreeRange = row.degreeRange;
      extras.maxDegree = row.maxDegree;
      break;
    case 'tests':
      extras.kind = row.kind;
      extras.order = row.order;
      extras.required = row.required;
      break;
    case 'test-results':
      extras.outcome = row.outcome;
      extras.tone = row.tone;
      break;
    case 'committees':
      extras.kind = row.kind;
      extras.chairTitle = row.chairTitle;
      break;
    case 'specializations':
      facultyCode = (row.facultyCode as string) ?? null;
      break;
    case 'applicant-categories':
      extras.genderScope = row.genderScope;
      extras.applicationMode = row.applicationMode;
      break;
    case 'nationalities-countries':
      extras.iso2 = row.iso2;
      extras.isArab = row.isArab;
      break;
    case 'governorates':
      extras.region = row.region;
      break;
    case 'police-stations':
      extras.governorateCode = row.governorateCode;
      extras.kind = row.kind;
      break;
    case 'jobs':
      parentCode = (row.parentCode as string | null) ?? null;
      break;
    case 'qualifications':
      extras.level = row.level;
      extras.track = row.track;
      break;
    case 'announcements':
      extras.categoryCode = row.categoryCode;
      extras.gender = row.gender;
      extras.divisionCode = row.divisionCode;
      extras.publishAt = row.publishAt;
      extras.expireAt = row.expireAt;
      extras.body = row.body;
      break;
    case 'nid-missing-reasons':
      extras.requiresUpload = row.requiresUpload;
      break;
    default:
      break;
  }

  return { parentCode, facultyCode, extras };
}

function sqlString(s: string | null | undefined): string {
  if (s === null || s === undefined) return 'NULL';
  return "N'" + s.replace(/'/g, "''") + "'";
}

function sqlBool(b: boolean | null | undefined): string {
  if (b === null || b === undefined) return 'NULL';
  return b ? '1' : '0';
}

function sqlNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'NULL';
  return String(n);
}

function sqlGuid(g: string | null | undefined): string {
  if (!g) return 'NULL';
  return `'${g}'`;
}

const sections: string[] = [];

sections.push(`-- Auto-generated by frontend/scripts/build-lookup-seed-sql.mts
-- DO NOT edit by hand. Re-run the generator after editing
-- frontend/src/features/lookups/mock/lookups.mock.ts.
--
-- Idempotent — uses MERGE keyed on (lookup_type_code, code). Row IDs are
-- derived deterministically (SHA-1 of 'TYPE:code') so re-runs match.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;
`);

let totalRows = 0;

for (const key of Object.keys(LOOKUPS_SEED) as LookupKey[]) {
  const typeCode = TYPE_CODE[key];
  const rows = LOOKUPS_SEED[key] as Record<string, unknown>[];
  if (rows.length === 0) continue;
  totalRows += rows.length;

  const values: string[] = [];
  rows.forEach((row, idx) => {
    const split = splitFields(key, row);
    const id = detGuid(typeCode, String(row.code));
    const parentId = HIERARCHICAL.has(key) && split.parentCode
      ? detGuid(typeCode, split.parentCode)
      : null;
    const extrasJson = JSON.stringify(split.extras);

    values.push(
      `    (${sqlGuid(id)}, ${sqlString(typeCode)}, ${sqlString(String(row.code))}, ` +
      `${sqlString(String(row.name))}, NULL, ${sqlBool(Boolean(row.isActive))}, ${sqlNum(idx)}, ` +
      `${sqlGuid(parentId)}, NULL, NULL, ${sqlString(extrasJson)}, ${sqlString(split.facultyCode)})`
    );
  });

  sections.push(`-- ${typeCode} (${rows.length} rows)
MERGE INTO dbo.lookup_items AS tgt
USING (VALUES
${values.join(',\n')}
) AS src(id, lookup_type_code, code, name_ar, name_en, is_active, sort_order, parent_id, start_date, end_date, extras, faculty_code)
ON tgt.lookup_type_code = src.lookup_type_code AND tgt.code = src.code AND tgt.deleted_at IS NULL
WHEN NOT MATCHED THEN
  INSERT (id, lookup_type_code, code, name_ar, name_en, is_active, sort_order, parent_id,
          start_date, end_date, extras, faculty_code, created_at, created_by, updated_at, updated_by)
  VALUES (src.id, src.lookup_type_code, src.code, src.name_ar, src.name_en, src.is_active, src.sort_order,
          src.parent_id, src.start_date, src.end_date, src.extras, src.faculty_code,
          SYSUTCDATETIME(), '${SEED_ACTOR_GUID}', SYSUTCDATETIME(), '${SEED_ACTOR_GUID}');
`);
}

sections.push(`COMMIT;
PRINT 'Lookup catalogue seed applied — ${totalRows} rows merged.';
`);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, sections.join('\n'), 'utf8');
console.log(`Wrote ${OUT_PATH} (${totalRows} rows across ${Object.keys(LOOKUPS_SEED).length} types).`);
