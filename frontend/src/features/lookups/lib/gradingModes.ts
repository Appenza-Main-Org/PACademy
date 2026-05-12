/**
 * Grading modes — discriminates how an applicant-category's results are
 * captured downstream.
 *
 *  - `GRADES`  → numeric (مجموع / نسبة مئوية), e.g. ثانوية عامة.
 *  - `TAGDIR`  → qualitative (ممتاز / جيد جدًا / جيد / مقبول),
 *               e.g. بكالوريوس / دراسات عليا / ضباط متخصصون.
 *
 * Every row in the `submission-types` lookup carries one value via
 * `metadata.gradingMode`. The accessor in `./submissionType.ts` is the
 * sanctioned way to read it.
 */

export const GRADING_MODES = ['GRADES', 'TAGDIR'] as const;
export type GradingMode = (typeof GRADING_MODES)[number];

export const GRADING_MODE_LABELS_AR: Record<GradingMode, string> = {
  GRADES: 'درجات',
  TAGDIR: 'تقدير',
};

/** Strict-mode guard — throws if a value is not a valid GradingMode. */
export function assertGradingMode(value: unknown): asserts value is GradingMode {
  if (value !== 'GRADES' && value !== 'TAGDIR') {
    throw new Error(`Invalid gradingMode: ${String(value)}`);
  }
}
