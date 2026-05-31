import assert from 'node:assert/strict';
import {
  buildFollowUpRows,
  type FollowUpExam,
  type FollowUpExamPlan,
  type FollowUpPipelineState,
} from '../src/features/applicant-portal/lib/follow-up-exam-plan.ts';

const exams: FollowUpExam[] = [
  {
    id: 'AX-01',
    key: 'aptitude',
    nameAr: 'اختبار القدرات المعدل',
  },
  {
    id: 'AX-10',
    key: 'medical',
    nameAr: 'قومي طبي خاص',
  },
  {
    id: 'AX-12',
    key: 'psychology',
    nameAr: 'اتزان نفسي متقدم',
  },
  {
    id: 'AX-05',
    key: 'physical',
    nameAr: 'لياقة تكتيكية',
  },
  {
    id: 'AX-99',
    key: 'archived',
    nameAr: 'اختبار مؤرشف',
  },
];

const plan: FollowUpExamPlan = {
  id: 'plan-1',
  cycleId: 'CYC-TEST',
  categoryId: 'officers_general',
  exams: [
    { examId: 'AX-12', order: 3, isRequired: true },
    { examId: 'AX-01', order: 1, isRequired: true },
    { examId: 'AX-DISABLED', order: 5, isRequired: true },
    { examId: 'AX-REMOVED', order: 6, isRequired: true, isActive: false },
    { examId: 'AX-99', order: 7, isRequired: true, stageIsActive: false },
    { examId: 'AX-05', order: 4, isRequired: false },
    { examId: 'AX-10', order: 2, isRequired: true },
  ],
};

const followUp: Record<string, FollowUpPipelineState> = {
  aptitude: 'passed',
  medical: 'awaiting-approval',
  psychology: 'in-progress',
  physical: 'pending',
};

const rows = buildFollowUpRows({
  plan,
  exams,
  followUp,
  firstExamDate: '2026-06-01T08:00:00.000Z',
});

assert.deepEqual(
  rows.map((row) => row.testLabel),
  ['اختبار القدرات المعدل', 'قومي طبي خاص', 'اتزان نفسي متقدم', 'لياقة تكتيكية'],
);
assert.deepEqual(rows.map((row) => row.serial), [1, 2, 3, 4]);
assert.deepEqual(rows.map((row) => row.result.label), ['اجتاز', 'بانتظار الاعتماد', 'جارٍ', 'لم يبدأ']);
assert.equal(rows[0]?.date, '2026-06-01T08:00:00.000Z');
assert.equal(rows[1]?.date, null);

console.log('follow-up exam-plan rows reflect configured enabled tests, order, and names');
