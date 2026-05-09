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
