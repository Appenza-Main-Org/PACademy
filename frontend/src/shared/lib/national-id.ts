/**
 * Egyptian National ID validator.
 *
 * Format (14 digits): C YY MM DD GG SSSS X
 *   C    1=20th century, 2=21st century
 *   YY   2-digit year
 *   MM   month (01-12)
 *   DD   day (01-31)
 *   GG   governorate code (01-88)
 *   SSSS sequence; gender from the last digit (odd=male, even=female)
 *   X    check digit
 */

export interface NationalIdInfo {
  valid: boolean;
  birthDate?: Date;
  governorateCode?: string;
  gender?: 'male' | 'female';
}

export function parseNationalId(id: string): NationalIdInfo {
  if (!id || !/^\d{14}$/.test(id)) return { valid: false };
  const century = id[0] === '2' ? 1900 : id[0] === '3' ? 2000 : 0;
  if (century === 0) return { valid: false };
  const yy = Number(id.slice(1, 3));
  const mm = Number(id.slice(3, 5));
  const dd = Number(id.slice(5, 7));
  const gg = id.slice(7, 9);
  const sequence = id.slice(9, 13);
  const last = Number(sequence[sequence.length - 1]);

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { valid: false };

  const birthDate = new Date(century + yy, mm - 1, dd);
  if (Number.isNaN(birthDate.getTime())) return { valid: false };

  return {
    valid: true,
    birthDate,
    governorateCode: gg,
    gender: last % 2 === 0 ? 'female' : 'male',
  };
}

export function isValidNationalId(id: string): boolean {
  return parseNationalId(id).valid;
}
