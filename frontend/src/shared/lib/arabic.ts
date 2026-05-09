/**
 * Arabic-specific text utilities.
 */

const RANK_TOKENS = new Set([
  'د.', 'العميد', 'العقيد', 'الرائد', 'النقيب',
  'الملازم', 'أول', 'الملازم أول',
]);

export function stripRank(name: string): string {
  if (!name) return '';
  const tokens = name.split(' ').filter(Boolean);
  return tokens.filter((t) => !RANK_TOKENS.has(t)).join(' ').trim();
}

export function truncateName(name: string, maxParts = 4): string {
  if (!name) return '';
  return name.split(' ').slice(0, maxParts).join(' ');
}

/**
 * Normalize Arabic text — collapse alef variants, strip diacritics, lowercase.
 * Used for case-insensitive search.
 */
export function normalizeArabic(s: string): string {
  if (!s) return '';
  return s
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
}

const ORDINALS_FEMININE = [
  'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة',
  'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة',
  'الحادية عشرة', 'الثانية عشرة', 'الثالثة عشرة', 'الرابعة عشرة',
  'الخامسة عشرة', 'السادسة عشرة', 'السابعة عشرة', 'الثامنة عشرة',
  'التاسعة عشرة', 'العشرون',
];

/**
 * Arabic feminine ordinal for a 1-indexed integer (used for committees,
 * lessons, classes — all feminine nouns). Falls back to the numeric form
 * past the precomputed range so callers don't need to bound-check.
 */
export function arabicOrdinal(n: number): string {
  if (!Number.isFinite(n) || n < 1) return '';
  const i = Math.floor(n) - 1;
  return ORDINALS_FEMININE[i] ?? `رقم ${n}`;
}

const ARABIC_DAYS_OF_WEEK = [
  'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
];

const HOUR_WORDS_FEMININE = [
  'الثانية عشرة', // 0/12 → midnight is "twelfth at night"
  'الواحدة', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة',
  'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة',
  'الحادية عشرة',
];

/**
 * Day-of-week name in Arabic for a Date or ISO string.
 */
export function arabicDayOfWeek(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return ARABIC_DAYS_OF_WEEK[date.getDay()] ?? '';
}

/**
 * Arabic prose for a 24-hour `HH:mm` clock time, used for printed
 * surfaces. Returns `{ hourWord, periodWord }` so the caller can
 * compose the full sentence (e.g. 'الساعة السادسة صباحاً'). The
 * period word is `صباحاً` (morning), `ظهراً` (noon), `مساءً` (evening),
 * or `ليلاً` (night) per common Arabic usage.
 */
export function arabicTimeOfDay(time: string): { hourWord: string; periodWord: string } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return { hourWord: '', periodWord: '' };
  const hh = Number.parseInt(m[1]!, 10);
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) return { hourWord: '', periodWord: '' };
  const hour12 = hh % 12; // 0-11
  const hourWord = HOUR_WORDS_FEMININE[hour12] ?? '';
  let periodWord: string;
  if (hh < 5) periodWord = 'ليلاً';
  else if (hh < 12) periodWord = 'صباحاً';
  else if (hh < 16) periodWord = 'ظهراً';
  else if (hh < 19) periodWord = 'عصراً';
  else periodWord = 'مساءً';
  return { hourWord, periodWord };
}

const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Convert ASCII digits in a string to Eastern Arabic-Indic numerals
 * (٠–٩). Non-digit characters pass through unchanged. Used for printed
 * surfaces where the visual style of Eastern numerals is required.
 */
export function toEasternArabicNumerals(s: string | number): string {
  const str = String(s);
  let out = '';
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      out += EASTERN_DIGITS[c - 48];
    } else {
      out += str[i];
    }
  }
  return out;
}
