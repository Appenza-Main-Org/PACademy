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
