/**
 * Step 11 — مواعيد الاختبارات.
 *
 * Thin alias kept for backwards compatibility with the standalone
 * `/admin/admission-setup/exam-dates` route and any `index.ts` consumers
 * that already import the previous symbol name. The substantive
 * implementation lives in
 * `components/examSchedule/ExamScheduleStep.tsx`, which is the
 * per-category exam-schedule editor the wizard step now renders.
 */

import { ExamScheduleStep } from '../components/examSchedule/ExamScheduleStep';

export function ExamDatesPage(): JSX.Element {
  return <ExamScheduleStep />;
}
