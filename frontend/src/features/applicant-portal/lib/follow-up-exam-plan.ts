export type FollowUpPipelineState = 'pending' | 'in-progress' | 'passed' | 'failed' | 'awaiting-approval';

export interface FollowUpExam {
  id: string;
  key: string;
  nameAr: string;
}

export interface FollowUpExamPlanEntry {
  examId: string;
  order: number;
  isRequired: boolean;
  /** Optional backend guard: inactive plan/stage rows must not appear to applicants. */
  isActive?: boolean;
  isEnabled?: boolean;
  stageIsActive?: boolean;
}

export interface FollowUpExamPlan {
  id: string;
  cycleId: string;
  categoryId: string;
  exams: FollowUpExamPlanEntry[];
}

export interface FollowUpResultRow {
  serial: number;
  testLabel: string;
  date: string | null;
  result: { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' };
  notes: string;
}

interface BuildFollowUpRowsInput {
  plan: FollowUpExamPlan | null | undefined;
  exams: readonly FollowUpExam[];
  followUp: Record<string, FollowUpPipelineState> | null | undefined;
  firstExamDate: string | null;
}

const RESULT_TONE: Record<FollowUpPipelineState, FollowUpResultRow['result']> = {
  passed: { label: 'اجتاز', tone: 'success' },
  failed: { label: 'لم يجتز', tone: 'danger' },
  'in-progress': { label: 'جارٍ', tone: 'warning' },
  'awaiting-approval': { label: 'بانتظار الاعتماد', tone: 'warning' },
  pending: { label: 'لم يبدأ', tone: 'neutral' },
};

const LEGACY_FOLLOW_UP_KEYS: Record<string, string> = {
  aptitude: 'capacities',
  appearance_external: 'traits',
  appearance_internal: 'traits',
  posture: 'traits',
  build: 'traits',
  physical: 'sports',
  medical: 'medical',
  psychology: 'medical',
  medical_advanced: 'medical',
  security_review: 'investigation',
};

function resultForExam(
  followUp: Record<string, FollowUpPipelineState> | null | undefined,
  exam: FollowUpExam,
): FollowUpResultRow['result'] {
  const state =
    followUp?.[exam.key] ??
    followUp?.[exam.id] ??
    followUp?.[LEGACY_FOLLOW_UP_KEYS[exam.key] ?? ''] ??
    'pending';
  return RESULT_TONE[state] ?? RESULT_TONE.pending;
}

export function buildFollowUpRows({
  plan,
  exams,
  followUp,
  firstExamDate,
}: BuildFollowUpRowsInput): FollowUpResultRow[] {
  if (!plan) return [];

  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  return plan.exams
    .slice()
    .filter(
      (entry) =>
        entry.isActive !== false &&
        entry.isEnabled !== false &&
        entry.stageIsActive !== false,
    )
    .filter((entry) => examById.has(entry.examId))
    .sort((a, b) => a.order - b.order)
    .map((entry, index) => {
      const exam = examById.get(entry.examId)!;
      return {
        serial: index + 1,
        testLabel: exam.nameAr,
        date: index === 0 ? firstExamDate : null,
        result: resultForExam(followUp, exam),
        notes: entry.isRequired ? '—' : 'اختبار تكميلي',
      };
    });
}
