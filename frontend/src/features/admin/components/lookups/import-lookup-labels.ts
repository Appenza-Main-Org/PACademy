/**
 * import-lookup-labels.ts — Arabic display labels for all 21 import lookup keys.
 * Used in template filenames and modal titles.
 */

import type { ImportLookupKey } from '../../api/lookup-import';

export const LOOKUP_IMPORT_LABELS: Record<ImportLookupKey, string> = {
  governorates: 'المحافظات',
  specializations: 'التخصصات',
  ranks: 'الرتب',
  colleges: 'الكليات',
  qualifications: 'المؤهلات',
  nationalities: 'الجنسيات',
  relationships: 'صلات القرابة',
  caseTypes: 'أنواع القضايا',
  educationTypes: 'أنواع التعليم',
  maritalStatuses: 'الحالات الاجتماعية',
  universities: 'الجامعات',
  faculties: 'الكليات الجامعية',
  specialties: 'التخصصات الدراسية',
  specialtyTypes: 'أنواع التخصصات',
  degreeTypes: 'الدرجات العلمية',
  jobs: 'الوظائف',
  examTypes: 'أنواع الاختبارات',
  examGroups: 'مجموعات الاختبارات',
  committeeTypes: 'أنواع اللجان',
  rejectionReasons: 'أسباب الرفض',
  notificationDepartments: 'جهات الإشعارات',
};
