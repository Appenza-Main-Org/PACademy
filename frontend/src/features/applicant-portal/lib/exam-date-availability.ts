export function normalizeExamDateValue(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dayFirstMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (!dayFirstMatch) return null;

  const day = Number(dayFirstMatch[1]);
  const month = Number(dayFirstMatch[2]);
  const year = Number(dayFirstMatch[3]);
  if (!isValidDateParts(year, month, day)) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isBookableExamDate(value: string, now: Date = new Date()): boolean {
  const normalized = normalizeExamDateValue(value);
  if (!normalized) return false;
  return localDayTime(normalized) >= startOfLocalDay(now).getTime();
}

export function filterBookableExamDates(values: readonly string[], now: Date = new Date()): string[] {
  return values.reduce<string[]>((acc, value) => {
    const normalized = normalizeExamDateValue(value);
    if (normalized && isBookableExamDate(normalized, now) && !acc.includes(normalized)) {
      acc.push(normalized);
    }
    return acc;
  }, []);
}

/**
 * Apply the General Settings booking-window cap to a list of already-bookable
 * dates: a date is selectable only if it lies within `slotWindowDays` days of
 * today (i.e., the booking window opens N days before each exam date — the
 * literal reading of «عدد الأيام المسموح للطالب خلالها باختيار موعد الاختبار قبل تاريخ الاختبار»).
 * Pass null/undefined to leave the list untouched.
 */
export function filterDatesWithinBookingWindow(
  values: readonly string[],
  slotWindowDays: number | null | undefined,
  now: Date = new Date(),
): string[] {
  if (slotWindowDays == null || !Number.isFinite(slotWindowDays) || slotWindowDays < 0) {
    return values.slice();
  }
  const todayMs = startOfLocalDay(now).getTime();
  const windowMs = slotWindowDays * 24 * 60 * 60 * 1000;
  return values.filter((value) => {
    const normalized = normalizeExamDateValue(value);
    if (!normalized) return false;
    const examMs = localDayTime(normalized);
    return examMs - todayMs <= windowMs;
  });
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function localDayTime(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!).getTime();
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
