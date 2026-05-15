/**
 * Academic-grade lookup accessor — `metadata.minPercentage` /
 * `metadata.maxPercentage` are stored as untyped numbers under the
 * row's metadata bag so the lookup catalogue stays type-uniform. This
 * file is the single boundary between "raw row" and "typed range".
 *
 * Range is inclusive on both ends; e.g. امتياز might be `[85, 100]`.
 * The downstream year-row Combobox in application settings shows the
 * range under a picked تقدير as a hint.
 */

import type { AcademicGradeRow } from '../types';

export interface AcademicGradeRange {
  min: number;
  max: number;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function readPercentageRange(
  row: AcademicGradeRow,
): AcademicGradeRange | null {
  const md = (row.metadata ?? {}) as {
    minPercentage?: unknown;
    maxPercentage?: unknown;
  };
  if (!isNumber(md.minPercentage) || !isNumber(md.maxPercentage)) return null;
  if (md.minPercentage > md.maxPercentage) return null;
  return { min: md.minPercentage, max: md.maxPercentage };
}
