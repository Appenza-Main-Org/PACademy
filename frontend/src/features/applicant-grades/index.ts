/**
 * Public surface of the Applicant Grades feature.
 *
 * Anything that needs to be consumed outside the feature (route file,
 * sidebar, command palette) goes through this barrel.
 */

export { ApplicantGradesPage } from './pages/ApplicantGradesPage';
export type { GradeKind, GradeRow, AdjustmentReason, GradeAdjustment } from './types';
