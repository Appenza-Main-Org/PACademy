/**
 * LookupsReviewPage — DEV-only visual review surface for the Lookup
 * Management Module.
 *
 * Mounted at `/_dev/lookups`. Gated by `import.meta.env.DEV` in
 * routes.tsx, so the production bundle tree-shakes this entire branch.
 *
 * Renders each of the 31 lookup types in sequence (tree for
 * hierarchical, grid for flat) plus all 4 mapping matrices, so a
 * reviewer can sanity-check tree expand/collapse, drag reorder,
 * search, mapping toggle, and form drawer behavior on a single page.
 */

import { useState } from 'react';
import { Card } from '@/shared/components';
import { LookupTree } from '@/features/lookups/components/LookupTree';
import { LookupGrid } from '@/features/lookups/components/LookupGrid';
import { LookupFormDrawer } from '@/features/lookups/components/LookupFormDrawer';
import { MappingMatrix } from '@/features/lookups/components/MappingMatrix';
import {
  HIERARCHICAL_TYPES,
  LOOKUP_TYPE_CODES,
  type LookupItem,
  type LookupMappingKind,
  type LookupTypeCode,
} from '@/features/lookups';

const MAPPING_DEFS: Array<{
  kind: LookupMappingKind;
  rowsTypeCode: LookupTypeCode;
  colsTypeCode: LookupTypeCode;
  rowsLabel: string;
  colsLabel: string;
}> = [
  {
    kind: 'categorySpecializations',
    rowsTypeCode: 'APPLICANT_CATEGORIES',
    colsTypeCode: 'SPECIALIZATIONS',
    rowsLabel: 'فئات المتقدمين',
    colsLabel: 'التخصصات',
  },
  {
    kind: 'categoryCommittees',
    rowsTypeCode: 'APPLICANT_CATEGORIES',
    colsTypeCode: 'COMMITTEES',
    rowsLabel: 'فئات المتقدمين',
    colsLabel: 'لجان القبول',
  },
  {
    kind: 'categoryTests',
    rowsTypeCode: 'APPLICANT_CATEGORIES',
    colsTypeCode: 'TESTS',
    rowsLabel: 'فئات المتقدمين',
    colsLabel: 'الاختبارات',
  },
  {
    kind: 'periodCategories',
    rowsTypeCode: 'ADMISSION_PERIODS',
    colsTypeCode: 'APPLICANT_CATEGORIES',
    rowsLabel: 'فترات التقديم',
    colsLabel: 'فئات المتقدمين',
  },
];

export function LookupsReviewPage(): JSX.Element {
  const [editing, setEditing] = useState<{ item: LookupItem | null; typeCode: LookupTypeCode } | null>(null);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-ar-display text-2xl font-bold text-ink-900">
          Lookup Management — DEV review
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          الصفحة تعرض كل أنواع البيانات المرجعية الـ31 + جداول الارتباط الأربعة. مخصصة للمراجعة
          البصرية أثناء التطوير.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-ar-display text-xl font-bold text-ink-900">جداول الارتباط</h2>
        {MAPPING_DEFS.map((def) => (
          <Card key={def.kind} className="p-4">
            <h3 className="mb-3 font-medium text-ink-900">{def.kind}</h3>
            <MappingMatrix {...def} />
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-ar-display text-xl font-bold text-ink-900">
          الأنواع الـ{LOOKUP_TYPE_CODES.length}
        </h2>
        {LOOKUP_TYPE_CODES.map((code) => {
          const isTree = HIERARCHICAL_TYPES.has(code);
          return (
            <Card key={code} className="p-4">
              <h3 className="mb-3 flex items-center justify-between">
                <span className="font-medium text-ink-900">{code}</span>
                <span className="text-2xs text-ink-500">{isTree ? 'هرمية' : 'مسطّحة'}</span>
              </h3>
              {isTree ? (
                <LookupTree
                  typeCode={code}
                  onEdit={(item) => setEditing({ item, typeCode: code })}
                  onCreate={() => setEditing({ item: null, typeCode: code })}
                  onDelete={() => {
                    /* noop in review surface */
                  }}
                />
              ) : (
                <LookupGrid
                  typeCode={code}
                  onEdit={(item) => setEditing({ item, typeCode: code })}
                  onCreate={() => setEditing({ item: null, typeCode: code })}
                />
              )}
            </Card>
          );
        })}
      </section>

      <LookupFormDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        editing={editing?.item ?? null}
        typeCode={editing?.typeCode ?? 'RELATIONSHIP_CATEGORY'}
      />
    </div>
  );
}
