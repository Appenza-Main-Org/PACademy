/**
 * Test schedules — Post-polish (Bucket C).
 *
 * Deterministic seed for the demo applicant `APP-2026000`. One
 * past-attended-and-passed test, one upcoming scheduled test, one
 * future-scheduled test in the officers_general sequence.
 */

import type { TestSchedule } from '@/shared/types/domain';

const APPLICANT_ID = 'APP-2026000';

const dayOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
};

export const TEST_SCHEDULES: readonly TestSchedule[] = [
  {
    id: 'TS-001',
    applicantId: APPLICANT_ID,
    kind: 'aptitude',
    scheduledAt: dayOffset(-14),
    location: 'مقر الكلية - مدينة 6 أكتوبر - قاعة الاختبارات الرئيسية',
    status: 'passed',
    resultAt: dayOffset(-13),
    score: 82,
    notes: 'أداء جيد جداً في القسم اللفظي والرياضي',
    instructions: [
      'إحضار بطاقة الرقم القومي الأصلية',
      'الحضور قبل الموعد بثلاثين دقيقة',
      'إغلاق الهواتف المحمولة قبل دخول القاعة',
    ],
  },
  {
    id: 'TS-002',
    applicantId: APPLICANT_ID,
    kind: 'posture',
    scheduledAt: dayOffset(3),
    location: 'مقر الكلية - عيادة الكشف الطبي - الدور الأول',
    status: 'scheduled',
    instructions: [
      'الحضور بزي رياضي مناسب للكشف',
      'إحضار صورة من بطاقة الرقم القومي',
      'الالتزام بالحضور في الموعد المحدد',
    ],
  },
  {
    id: 'TS-003',
    applicantId: APPLICANT_ID,
    kind: 'medical',
    scheduledAt: dayOffset(10),
    location: 'القومسيون الطبي العام - شارع الزراعة - الدقي',
    status: 'scheduled',
    instructions: [
      'الصيام عن الطعام والشراب لمدة 8 ساعات قبل الموعد',
      'إحضار تقارير طبية سابقة (إن وُجدت)',
      'إحضار نظارة طبية إن كنت تستخدمها',
    ],
  },
];
