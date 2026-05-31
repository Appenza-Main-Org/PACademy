import type { SchoolCategoryRow } from '@/features/lookups';

export const GENERAL_SECTION_CATEGORY_KEY = 'officers_general';

export const SECONDARY_CERTIFICATE_NOT_FOUND_MESSAGE =
  'لم يتم العثور على بيانات شهادة الثانوية في قاعدة البيانات. يرجى اختيار أحد أنواع الشهادات الأجنبية المتاحة.';

export interface CertificateTypeOption {
  value: string;
  label: string;
}

export function shouldShowSecondaryCertificateNotFoundMessage(
  selectedCategoryKey: string | null | undefined,
): boolean {
  return selectedCategoryKey === GENERAL_SECTION_CATEGORY_KEY;
}

export function buildManualCertificateTypeOptions(
  rows: readonly Pick<SchoolCategoryRow, 'name' | 'isActive' | 'externalGradesImport'>[],
  selectedCategoryKey: string | null | undefined,
): CertificateTypeOption[] {
  const activeRows = rows.filter((row) => row.isActive);
  const visibleRows = selectedCategoryKey === GENERAL_SECTION_CATEGORY_KEY
    ? activeRows.filter((row) => !row.externalGradesImport)
    : activeRows;

  return visibleRows.map((row) => ({ value: row.name, label: row.name }));
}
