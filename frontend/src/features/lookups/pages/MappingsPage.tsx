/**
 * MappingsPage — `/admin/lookups/mappings/:kind`.
 *
 * Tabs across the 4 mapping kinds; each tab renders a MappingMatrix
 * bound to the appropriate row/column lookup types.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Tabs } from '@/shared/components';
import { MappingMatrix } from '../components/MappingMatrix';
import type { LookupMappingKind, LookupTypeCode } from '../types';

const MAPPING_DEFS: Record<
  LookupMappingKind,
  {
    label: string;
    rowsTypeCode: LookupTypeCode;
    colsTypeCode: LookupTypeCode;
    rowsLabel: string;
    colsLabel: string;
  }
> = {
  categorySpecializations: {
    label: 'الفئة × التخصص',
    rowsTypeCode: 'APPLICANT_CATEGORIES',
    colsTypeCode: 'SPECIALIZATIONS',
    rowsLabel: 'فئات المتقدمين',
    colsLabel: 'التخصصات',
  },
  categoryCommittees: {
    label: 'الفئة × اللجنة',
    rowsTypeCode: 'APPLICANT_CATEGORIES',
    colsTypeCode: 'COMMITTEES',
    rowsLabel: 'فئات المتقدمين',
    colsLabel: 'لجان القبول',
  },
  categoryTests: {
    label: 'الفئة × الاختبار',
    rowsTypeCode: 'APPLICANT_CATEGORIES',
    colsTypeCode: 'TESTS',
    rowsLabel: 'فئات المتقدمين',
    colsLabel: 'الاختبارات',
  },
  periodCategories: {
    label: 'الفترة × الفئة',
    rowsTypeCode: 'ADMISSION_PERIODS',
    colsTypeCode: 'APPLICANT_CATEGORIES',
    rowsLabel: 'فترات التقديم',
    colsLabel: 'فئات المتقدمين',
  },
};

const KINDS: LookupMappingKind[] = Object.keys(MAPPING_DEFS) as LookupMappingKind[];

function isMappingKind(value: string | undefined): value is LookupMappingKind {
  return value !== undefined && (KINDS as string[]).includes(value);
}

export function MappingsPage(): JSX.Element {
  const { kind: rawKind } = useParams<{ kind?: string }>();
  const navigate = useNavigate();
  const kind: LookupMappingKind = isMappingKind(rawKind) ? rawKind : 'categoryCommittees';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="جداول الارتباط"
        subtitle="اربط فئات المتقدمين بالتخصصات واللجان والاختبارات وفترات التقديم."
      />
      <Tabs value={kind} onValueChange={(next) => navigate(`/admin/lookups/mappings/${next}`)}>
        <Tabs.List>
          {KINDS.map((k) => (
            <Tabs.Tab key={k} value={k}>
              {MAPPING_DEFS[k].label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {KINDS.map((k) => (
          <Tabs.Panel key={k} value={k}>
            <div className="pt-4">
              <MappingMatrix kind={k} {...MAPPING_DEFS[k]} />
            </div>
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
