/**
 * Department workflows — Post-polish (RFP §3 / §6).
 *
 * One workflow per `DepartmentKey`. Every workflow is a 5–7-stage pipeline
 * derived from the RFP scope: identity check → preliminary medical →
 * aptitude → traits → final medical → board → final decision. Tests are
 * keyed to the app that records the result (`ownerApp`).
 *
 * Seeded deterministically (no rng()) so the configurator opens to a stable
 * shape that the visual reviewer can audit screen-to-screen.
 */

import type {
  ApplicantWorkflowProgress,
  DepartmentKey,
  DepartmentWorkflow,
  WorkflowStage,
  WorkflowTransitionEvent,
} from '@/shared/types/domain';

const DEFAULT_CYCLE_ID = 'CYC-2026-M-1';
const DEFAULT_USER = 'العميد د. أحمد محمود الفقي';

interface StageSeed {
  name: string;
  statusOnEnter: WorkflowStage['statusOnEnter'];
  allowedNextStatuses: WorkflowStage['allowedNextStatuses'];
  tests: Array<{
    name: string;
    kind: WorkflowStage['tests'][number]['kind'];
    required: boolean;
    ownerApp: WorkflowStage['tests'][number]['ownerApp'];
    criterion: WorkflowStage['tests'][number]['passCriterion'];
    notes?: string;
  }>;
}

function buildStages(deptKey: DepartmentKey, seeds: StageSeed[]): WorkflowStage[] {
  return seeds.map((s, i) => ({
    id: `WSTG-${deptKey}-${i + 1}`,
    order: i + 1,
    name: s.name,
    statusOnEnter: s.statusOnEnter,
    allowedNextStatuses: s.allowedNextStatuses,
    tests: s.tests.map((t, j) => ({
      id: `WTST-${deptKey}-${i + 1}-${j + 1}`,
      name: t.name,
      kind: t.kind,
      required: t.required,
      ownerApp: t.ownerApp,
      passCriterion: t.criterion,
      notes: t.notes,
    })),
  }));
}

/**
 * Each stage uses a UNIQUE `statusOnEnter` so the editor's validator (which
 * blocks duplicates) is happy on first open. Forward statuses chain so every
 * `allowedNextStatuses` entry is reachable from a later stage.
 */
const COMMON_PIPELINE: StageSeed[] = [
  {
    name: 'تحقق الهوية وإصدار الباركود',
    statusOnEnter: 'pending',
    allowedNextStatuses: ['documents-required', 'under-review', 'rejected'],
    tests: [
      {
        name: 'تطابق الرقم القومي',
        kind: 'biometric',
        required: true,
        ownerApp: 'biometric',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
      {
        name: 'إصدار باركود التقدم',
        kind: 'biometric',
        required: true,
        ownerApp: 'barcode',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
    ],
  },
  {
    name: 'مراجعة المستندات الأولية',
    statusOnEnter: 'documents-required',
    allowedNextStatuses: ['under-review', 'rejected'],
    tests: [
      {
        name: 'مراجعة الأوراق المرفوعة',
        kind: 'investigation',
        required: true,
        ownerApp: 'admin',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
    ],
  },
  {
    name: 'الفحص الطبي الأولي',
    statusOnEnter: 'under-review',
    allowedNextStatuses: ['under_medical_review', 'rejected'],
    tests: [
      {
        name: 'الكشف الطبي الأولي',
        kind: 'medical',
        required: true,
        ownerApp: 'medical',
        criterion: { type: 'boolean', mustBe: 'pass' },
        notes: 'يشمل القياسات وBMI والإبصار',
      },
      {
        name: 'تحليل المخدرات',
        kind: 'medical',
        required: true,
        ownerApp: 'medical',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
    ],
  },
  {
    name: 'اختبار اللياقة البدنية',
    statusOnEnter: 'under_medical_review',
    allowedNextStatuses: ['passed_physical', 'rejected'],
    tests: [
      {
        name: 'اختبار اللياقة البدنية',
        kind: 'physical',
        required: true,
        ownerApp: 'committee',
        criterion: { type: 'minScore', min: 60, max: 100 },
      },
    ],
  },
  {
    name: 'اختبار القدرات والسمات',
    statusOnEnter: 'passed_physical',
    allowedNextStatuses: ['failed_interview', 'awaiting_board_decision', 'rejected'],
    tests: [
      {
        name: 'اختبار القدرات',
        kind: 'written',
        required: true,
        ownerApp: 'exams',
        criterion: { type: 'minScore', min: 60, max: 100 },
      },
      {
        name: 'اختبار السمات الشخصية',
        kind: 'interview',
        required: true,
        ownerApp: 'committee',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
    ],
  },
  {
    name: 'هيئة القبول',
    statusOnEnter: 'awaiting_board_decision',
    allowedNextStatuses: ['approved', 'rejected', 'on-hold'],
    tests: [
      {
        name: 'مقابلة الهيئة',
        kind: 'interview',
        required: true,
        ownerApp: 'board',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
    ],
  },
  {
    name: 'القرار النهائي',
    statusOnEnter: 'failed_interview',
    allowedNextStatuses: ['approved', 'rejected'],
    tests: [
      {
        name: 'إصدار قرار القبول',
        kind: 'interview',
        required: true,
        ownerApp: 'admin',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
    ],
  },
];

const SPECIAL_PIPELINE: StageSeed[] = [
  ...COMMON_PIPELINE.slice(0, 4),
  {
    name: 'التدريب التكتيكي التخصصي',
    statusOnEnter: 'under-review',
    allowedNextStatuses: ['awaiting_board_decision', 'rejected'],
    tests: [
      {
        name: 'تقييم التدريب التكتيكي',
        kind: 'physical',
        required: true,
        ownerApp: 'committee',
        criterion: { type: 'minScore', min: 70, max: 100 },
      },
    ],
  },
  ...COMMON_PIPELINE.slice(4),
];

const POSTGRADUATE_PIPELINE: StageSeed[] = [
  COMMON_PIPELINE[0],
  {
    name: 'مراجعة الأبحاث الأكاديمية',
    statusOnEnter: 'under-review',
    allowedNextStatuses: ['under-review', 'rejected'],
    tests: [
      {
        name: 'مراجعة الإنتاج العلمي',
        kind: 'written',
        required: true,
        ownerApp: 'admin',
        criterion: { type: 'boolean', mustBe: 'pass' },
      },
    ],
  },
  COMMON_PIPELINE[3],
  COMMON_PIPELINE[4],
  COMMON_PIPELINE[5],
  COMMON_PIPELINE[6],
];

const NOW = new Date('2026-04-15T09:00:00.000Z').toISOString();

const DEPT_PIPELINES: Record<DepartmentKey, StageSeed[]> = {
  general_first: COMMON_PIPELINE,
  general_second: COMMON_PIPELINE,
  special: SPECIAL_PIPELINE,
  lawyers: COMMON_PIPELINE,
  masters: POSTGRADUATE_PIPELINE,
  doctorate: POSTGRADUATE_PIPELINE,
};

const DEPT_NAMES_AR: Record<DepartmentKey, string> = {
  general_first: 'سير عمل قسم عام · دور أول · 2026',
  general_second: 'سير عمل قسم عام · دور ثاني · 2026',
  special: 'سير عمل قسم خاص · 2026',
  lawyers: 'سير عمل الحقوقيين · 2026',
  masters: 'سير عمل ماجستير · 2026',
  doctorate: 'سير عمل دكتوراه · 2026',
};

export const WORKFLOWS: DepartmentWorkflow[] = (
  Object.keys(DEPT_PIPELINES) as DepartmentKey[]
).map((dept, i) => ({
  id: `WF-${dept.toUpperCase()}`,
  department: dept,
  name: DEPT_NAMES_AR[dept],
  cycleId: DEFAULT_CYCLE_ID,
  stages: buildStages(dept, DEPT_PIPELINES[dept]),
  isActive: i < 4,
  version: i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1,
  createdAt: NOW,
  updatedAt: NOW,
  updatedBy: DEFAULT_USER,
}));

/**
 * Sample applicant progress entries — one per workflow, applied to the first
 * applicant. The runtime service derives a deterministic snapshot for any
 * applicant that lacks a seeded entry, so this set is intentionally sparse.
 */
export const APPLICANT_WORKFLOW_PROGRESS: ApplicantWorkflowProgress[] = WORKFLOWS.flatMap((wf, idx) => {
  const stages = wf.stages;
  const completed = stages.slice(0, Math.min(idx + 1, stages.length - 1));
  const current = stages[completed.length] ?? null;
  return [
    {
      applicantId: `APP-${String(2026000000 + idx + 1).padStart(10, '0')}`,
      workflowId: wf.id,
      workflowVersion: wf.version,
      currentStageId: current?.id ?? null,
      completedStageIds: completed.map((s) => s.id),
      testResults: completed.flatMap((stage) =>
        stage.tests.map((t) => ({
          stageId: stage.id,
          testId: t.id,
          outcome: 'pass' as const,
          score: t.passCriterion.type === 'minScore' ? 78 : undefined,
          recordedAt: NOW,
          recordedBy: DEFAULT_USER,
        })),
      ),
    },
  ];
});

const TRANSITION_REASONS: Record<string, string> = {
  approved: 'استكمال المرحلة بنجاح',
  rejected: 'لم يجتز شروط المرحلة',
  on_hold: 'إيقاف مؤقت بانتظار مستندات',
};

export const WORKFLOW_TRANSITIONS: WorkflowTransitionEvent[] = APPLICANT_WORKFLOW_PROGRESS.flatMap(
  (prog) => {
    const wf = WORKFLOWS.find((w) => w.id === prog.workflowId);
    if (!wf) return [];
    return prog.completedStageIds.map((stageId, i) => {
      const stage = wf.stages.find((s) => s.id === stageId)!;
      const prev = wf.stages[i - 1] ?? null;
      const fromStatus = prev?.statusOnEnter ?? null;
      return {
        id: `WTRN-${prog.applicantId}-${i + 1}`,
        applicantId: prog.applicantId,
        ts: new Date('2026-04-10T09:00:00.000Z').getTime() + i * 86_400_000,
        fromStatus,
        toStatus: stage.statusOnEnter,
        fromStageId: prev?.id ?? null,
        toStageId: stage.id,
        actorId: 'U-001',
        actorName: DEFAULT_USER,
        reason: TRANSITION_REASONS.approved,
      };
    });
  },
);
