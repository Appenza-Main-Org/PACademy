/**
 * Academy exams seed — Gap J (admin-gaps).
 *
 * The 13 exams listed in RFP §p.40, in the canonical sequence the academy
 * runs them. Real backend supplies these via `GET /api/exams/academy`.
 */

import type { AcademyExam, CycleCategoryExamPlan } from '@/shared/types/domain';

export const ACADEMY_EXAMS: AcademyExam[] = [
  { id: 'AX-01', key: 'aptitude',           group: 'preliminary',  nameAr: 'القدرات',          scoreType: 'numeric',   isQualifying: true  },
  { id: 'AX-02', key: 'height',             group: 'preliminary',  nameAr: 'الطول',            scoreType: 'numeric',   isQualifying: true  },
  { id: 'AX-03', key: 'appearance_external',group: 'committees',   nameAr: 'السمات الخارجي',   scoreType: 'qualitative', isQualifying: true },
  { id: 'AX-04', key: 'appearance_internal',group: 'committees',   nameAr: 'السمات الداخلي',   scoreType: 'qualitative', isQualifying: true },
  { id: 'AX-05', key: 'physical',           group: 'physical',     nameAr: 'الرياضي',          scoreType: 'pass_fail', isQualifying: true  },
  { id: 'AX-06', key: 'physical_retake',    group: 'physical',     nameAr: 'إعادة الرياضي',    scoreType: 'pass_fail', isQualifying: false },
  { id: 'AX-07', key: 'posture',            group: 'committees',   nameAr: 'الهيئة',           scoreType: 'qualitative', isQualifying: true },
  { id: 'AX-08', key: 'build',              group: 'committees',   nameAr: 'القوام',           scoreType: 'qualitative', isQualifying: true },
  { id: 'AX-09', key: 'build_retake',       group: 'committees',   nameAr: 'إعادة القوام',     scoreType: 'qualitative', isQualifying: false },
  { id: 'AX-10', key: 'medical',            group: 'medical',      nameAr: 'الطبي',            scoreType: 'pass_fail', isQualifying: true  },
  { id: 'AX-11', key: 'medical_retake',     group: 'medical',      nameAr: 'إعادة الطبي',      scoreType: 'pass_fail', isQualifying: false },
  { id: 'AX-12', key: 'psychology',         group: 'psychology',   nameAr: 'الاتزان النفسي',   scoreType: 'qualitative', isQualifying: true },
  { id: 'AX-13', key: 'medical_advanced',   group: 'medical',      nameAr: 'الطبي المتقدم',    scoreType: 'pass_fail', isQualifying: true  },
];

/* Default exam plan — applied to every (cycle, category) pair on first
 * read. Real backend stores these per (cycleId, categoryId). */
export const DEFAULT_EXAM_PLAN_ENTRIES = ACADEMY_EXAMS.filter((e) => e.isQualifying).map((e, idx) => ({
  examId: e.id,
  order: (idx + 1) * 10,
  isRequired: true,
}));

export const CYCLE_CATEGORY_EXAM_PLANS: CycleCategoryExamPlan[] = [];
