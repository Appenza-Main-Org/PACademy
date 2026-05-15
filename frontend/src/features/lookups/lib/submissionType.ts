/**
 * Submission-type accessor — single sanctioned read path for the
 * `gradingMode` value on a `submission-types` lookup row.
 *
 * Use this instead of reaching into `row.metadata` directly — the metadata
 * slot is intentionally untyped on `LookupRowBase` so the assertion lives in
 * one place. The seed pipeline writes `metadata.gradingMode`; the assertion
 * here is the boundary between "raw row" and "typed GradingMode".
 */

import type { SubmissionTypeRow } from '../types';
import { assertGradingMode, type GradingMode } from './gradingModes';

export function readGradingMode(row: SubmissionTypeRow): GradingMode {
  const value = (row.metadata ?? {}) as { gradingMode?: unknown };
  assertGradingMode(value.gradingMode);
  return value.gradingMode;
}
