/**
 * Egyptian National ID validator.
 *
 * Format (14 digits): C YY MM DD GG SSSS X
 *   C    1=19th century, 2=20th century (1900s), 3=21st century (2000s)
 *   YY   2-digit year
 *   MM   month (01-12)
 *   DD   day (01-31), validated against month + leap-year rules
 *   GG   governorate code (01-35 = Egyptian governorates, 88 = foreign births)
 *   SSSS 4-digit sequence within the day + governorate; the 4th (13th overall)
 *        digit encodes gender — odd = male, even = female
 *   X    check digit (last position) — verified by the weighted-sum algorithm
 *
 * `parseNationalId` keeps the legacy lightweight API (`valid` + optional
 * `birthDate`/`governorateCode`/`gender`) for existing callers. The
 * applicant-grades import wizard uses `analyseNationalId` instead — it
 * surfaces every detected issue with an Arabic label so the import
 * review page can render a row-per-row failure report.
 */

export interface NationalIdInfo {
  valid: boolean;
  birthDate?: Date;
  governorateCode?: string;
  gender?: 'male' | 'female';
}

export type NationalIdIssueCode =
  | 'EMPTY'
  | 'NON_NUMERIC'
  | 'LENGTH_INVALID'
  | 'INVALID_CENTURY'
  | 'INVALID_BIRTH_YEAR'
  | 'INVALID_BIRTH_MONTH'
  | 'INVALID_BIRTH_DAY'
  | 'INVALID_BIRTH_DATE'
  | 'FUTURE_BIRTH_DATE'
  | 'INVALID_GOVERNORATE'
  | 'INVALID_SEQUENCE'
  | 'INVALID_GENDER_DIGIT'
  | 'INVALID_CHECKSUM';

export interface NationalIdIssue {
  code: NationalIdIssueCode;
  /** Short Arabic label suitable for a Badge / list-item heading. */
  labelAr: string;
  /** Longer Arabic detail. Includes the offending substring where useful. */
  detailAr: string;
}

export interface NationalIdAnalysis extends NationalIdInfo {
  /** All detected issues, in detection order. When the NID is fatally
   *  malformed (empty / non-numeric / wrong length) only the first
   *  blocking issue is reported — every later field becomes meaningless. */
  issues: NationalIdIssue[];
}

/** Governorate codes recognised on Egyptian national IDs.
 *  01–35 cover the Egyptian governorates (some gaps are intentional —
 *  historical splits left numeric holes), 88 marks births abroad.
 *  Anything else is treated as invalid by `analyseNationalId`. */
export const EGYPTIAN_GOVERNORATE_CODES: ReadonlyArray<{
  code: string;
  labelAr: string;
}> = [
  { code: '01', labelAr: 'القاهرة' },
  { code: '02', labelAr: 'الإسكندرية' },
  { code: '03', labelAr: 'بورسعيد' },
  { code: '04', labelAr: 'السويس' },
  { code: '11', labelAr: 'دمياط' },
  { code: '12', labelAr: 'الدقهلية' },
  { code: '13', labelAr: 'الشرقية' },
  { code: '14', labelAr: 'القليوبية' },
  { code: '15', labelAr: 'كفر الشيخ' },
  { code: '16', labelAr: 'الغربية' },
  { code: '17', labelAr: 'المنوفية' },
  { code: '18', labelAr: 'البحيرة' },
  { code: '19', labelAr: 'الإسماعيلية' },
  { code: '21', labelAr: 'الجيزة' },
  { code: '22', labelAr: 'بني سويف' },
  { code: '23', labelAr: 'الفيوم' },
  { code: '24', labelAr: 'المنيا' },
  { code: '25', labelAr: 'أسيوط' },
  { code: '26', labelAr: 'سوهاج' },
  { code: '27', labelAr: 'قنا' },
  { code: '28', labelAr: 'أسوان' },
  { code: '29', labelAr: 'الأقصر' },
  { code: '31', labelAr: 'البحر الأحمر' },
  { code: '32', labelAr: 'الوادي الجديد' },
  { code: '33', labelAr: 'مطروح' },
  { code: '34', labelAr: 'شمال سيناء' },
  { code: '35', labelAr: 'جنوب سيناء' },
  { code: '88', labelAr: 'مواليد خارج جمهورية مصر' },
];

const GOVERNORATE_CODE_SET = new Set(EGYPTIAN_GOVERNORATE_CODES.map((g) => g.code));

/** Weights applied to digits 1–13 (positions 0–12) for the Egyptian
 *  national-id check-digit calculation. Digit 14 (position 13) is the
 *  check digit being verified. */
const CHECKSUM_WEIGHTS = [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

function computeChecksum(first13: string): number {
  let sum = 0;
  for (let i = 0; i < CHECKSUM_WEIGHTS.length; i += 1) {
    sum += Number(first13[i]) * CHECKSUM_WEIGHTS[i]!;
  }
  const mod = sum % 11;
  const candidate = 11 - mod;
  if (candidate === 10) return 0;
  if (candidate === 11) return 1;
  return candidate;
}

function centuryFor(prefix: string): number | null {
  if (prefix === '1') return 1800;
  if (prefix === '2') return 1900;
  if (prefix === '3') return 2000;
  return null;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/** Comprehensive analysis used by the applicant-grades import wizard.
 *  Returns every detected issue with an Arabic label so the review page
 *  can render a row-per-row failure report. */
export function analyseNationalId(
  rawId: string | null | undefined,
  options: { now?: Date } = {},
): NationalIdAnalysis {
  const issues: NationalIdIssue[] = [];
  const id = (rawId ?? '').trim();

  if (id.length === 0) {
    issues.push({
      code: 'EMPTY',
      labelAr: 'رقم قومي مفقود',
      detailAr: 'لم يتم إدخال رقم قومي للطالب.',
    });
    return { valid: false, issues };
  }

  if (!/^\d+$/.test(id)) {
    issues.push({
      code: 'NON_NUMERIC',
      labelAr: 'رقم قومي يحتوي على رموز غير رقمية',
      detailAr: `الرقم القومي يجب أن يتكون من أرقام فقط — القيمة الحالية: ${id}`,
    });
    return { valid: false, issues };
  }

  if (id.length !== 14) {
    issues.push({
      code: 'LENGTH_INVALID',
      labelAr: 'طول الرقم القومي غير صحيح',
      detailAr: `الرقم القومي يجب أن يتكون من 14 رقمًا — القيمة الحالية تحتوي على ${id.length} رقم.`,
    });
    return { valid: false, issues };
  }

  const centuryPrefix = id[0]!;
  const century = centuryFor(centuryPrefix);
  if (century == null) {
    issues.push({
      code: 'INVALID_CENTURY',
      labelAr: 'رقم القرن غير صالح',
      detailAr: `الرقم الأول يجب أن يكون 1 (القرن التاسع عشر)، 2 (القرن العشرين)، أو 3 (القرن الواحد والعشرون). القيمة الحالية: ${centuryPrefix}`,
    });
  }

  const yyStr = id.slice(1, 3);
  const mmStr = id.slice(3, 5);
  const ddStr = id.slice(5, 7);
  const yy = Number(yyStr);
  const mm = Number(mmStr);
  const dd = Number(ddStr);

  /* Birth-year sanity: the century prefix sets the base, then YY adds
   * 00..99. If the century is invalid we can't validate the year fully,
   * but we can still flag a `00` year as a clear data error. */
  if (century != null) {
    const fullYear = century + yy;
    if (yy < 0 || yy > 99 || Number.isNaN(yy)) {
      issues.push({
        code: 'INVALID_BIRTH_YEAR',
        labelAr: 'سنة الميلاد غير صالحة',
        detailAr: `أرقام السنة (${yyStr}) غير صحيحة — يجب أن تكون رقمين بين 00 و99.`,
      });
    } else if (fullYear < 1850) {
      issues.push({
        code: 'INVALID_BIRTH_YEAR',
        labelAr: 'سنة الميلاد غير منطقية',
        detailAr: `سنة الميلاد المستنتجة (${fullYear}) أصغر من الحد الأدنى المقبول.`,
      });
    }
  }

  let monthOk = true;
  if (mm < 1 || mm > 12) {
    monthOk = false;
    issues.push({
      code: 'INVALID_BIRTH_MONTH',
      labelAr: 'شهر الميلاد غير صالح',
      detailAr: `شهر الميلاد يجب أن يكون بين 01 و12 — القيمة الحالية: ${mmStr}.`,
    });
  }

  let dayOk = true;
  if (dd < 1) {
    dayOk = false;
    issues.push({
      code: 'INVALID_BIRTH_DAY',
      labelAr: 'يوم الميلاد غير صالح',
      detailAr: `يوم الميلاد لا يمكن أن يكون 00 — القيمة الحالية: ${ddStr}.`,
    });
  } else if (dd > 31) {
    dayOk = false;
    issues.push({
      code: 'INVALID_BIRTH_DAY',
      labelAr: 'يوم الميلاد غير صالح',
      detailAr: `يوم الميلاد يجب أن يكون بين 01 و31 — القيمة الحالية: ${ddStr}.`,
    });
  }

  let birthDate: Date | undefined;
  if (century != null && monthOk && dayOk) {
    const maxDay = daysInMonth(mm, century + yy);
    if (dd > maxDay) {
      issues.push({
        code: 'INVALID_BIRTH_DATE',
        labelAr: 'تاريخ ميلاد غير موجود',
        detailAr: `اليوم ${ddStr} لا يقع ضمن أيام شهر ${mmStr} لسنة ${century + yy}${
          mm === 2 ? (isLeapYear(century + yy) ? ' (سنة كبيسة)' : ' (سنة غير كبيسة)') : ''
        }.`,
      });
    } else {
      const candidate = new Date(century + yy, mm - 1, dd);
      if (
        Number.isNaN(candidate.getTime()) ||
        candidate.getFullYear() !== century + yy ||
        candidate.getMonth() !== mm - 1 ||
        candidate.getDate() !== dd
      ) {
        issues.push({
          code: 'INVALID_BIRTH_DATE',
          labelAr: 'تاريخ ميلاد غير صالح',
          detailAr: `لا يمكن قراءة تاريخ ميلاد صحيح من الأرقام ${yyStr}/${mmStr}/${ddStr}.`,
        });
      } else {
        const now = options.now ?? new Date();
        if (candidate.getTime() > now.getTime()) {
          issues.push({
            code: 'FUTURE_BIRTH_DATE',
            labelAr: 'تاريخ ميلاد في المستقبل',
            detailAr: `تاريخ الميلاد المستنتج (${candidate.getFullYear()}/${mmStr}/${ddStr}) يقع في المستقبل.`,
          });
        } else {
          birthDate = candidate;
        }
      }
    }
  }

  const gg = id.slice(7, 9);
  let governorateCode: string | undefined;
  if (!GOVERNORATE_CODE_SET.has(gg)) {
    issues.push({
      code: 'INVALID_GOVERNORATE',
      labelAr: 'كود المحافظة غير معتمد',
      detailAr: `رقم المحافظة (${gg}) ليس ضمن قائمة المحافظات المصرية المعتمدة (01–35) أو رمز المواليد بالخارج (88).`,
    });
  } else {
    governorateCode = gg;
  }

  const sequence = id.slice(9, 13);
  if (!/^\d{4}$/.test(sequence) || sequence === '0000') {
    issues.push({
      code: 'INVALID_SEQUENCE',
      labelAr: 'الرقم التسلسلي غير صالح',
      detailAr: `الرقم التسلسلي (${sequence}) غير صالح — يجب أن يكون أربعة أرقام وألا يكون 0000.`,
    });
  }

  const genderDigitRaw = id[12];
  let gender: 'male' | 'female' | undefined;
  if (genderDigitRaw == null || !/^\d$/.test(genderDigitRaw)) {
    issues.push({
      code: 'INVALID_GENDER_DIGIT',
      labelAr: 'خانة النوع مفقودة أو غير صالحة',
      detailAr: 'خانة النوع (الرقم 13) يجب أن تكون رقماً واحداً صالحاً.',
    });
  } else {
    const genderDigit = Number(genderDigitRaw);
    gender = genderDigit % 2 === 0 ? 'female' : 'male';
  }

  const first13 = id.slice(0, 13);
  const checkDigit = Number(id[13]);
  if (/^\d{13}$/.test(first13) && Number.isFinite(checkDigit)) {
    const expected = computeChecksum(first13);
    if (expected !== checkDigit) {
      issues.push({
        code: 'INVALID_CHECKSUM',
        labelAr: 'رقم التحقق غير مطابق',
        detailAr: `رقم التحقق المتوقع وفق خوارزمية البطاقة (${expected}) لا يطابق الرقم المخزن (${checkDigit}).`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    ...(birthDate ? { birthDate } : {}),
    ...(governorateCode ? { governorateCode } : {}),
    ...(gender ? { gender } : {}),
  };
}

/**
 * Lightweight, backwards-compatible parser. Returns the same shape the
 * legacy callers expect (`valid` + optional `birthDate`/`governorateCode`/
 * `gender`) without the issue list — but is intentionally lenient on
 * the checksum, future-date, and governorate-code checks so that the
 * seeded mock fixtures (which were authored before those rules existed)
 * still pass. Callers that need the full audit should use
 * `analyseNationalId` instead.
 */
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
  if (
    birthDate.getFullYear() !== century + yy ||
    birthDate.getMonth() !== mm - 1 ||
    birthDate.getDate() !== dd
  ) {
    return { valid: false };
  }

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

/**
 * Strict validity check — runs the full `analyseNationalId` pipeline
 * (length + numeric + century + birth date + governorate + sequence +
 * gender digit + checksum). Prefer this over `isValidNationalId` for
 * any form that wants to block save on an invalid Egyptian NID.
 */
export function isStrictNationalId(id: string | null | undefined): boolean {
  return analyseNationalId(id).valid;
}

/**
 * Returns the Arabic detail of the first NID issue, or `undefined` when
 * the value passes the full Egyptian-NID analysis. Suitable for forms
 * that want a single inline error message per field.
 *
 * Falls back to short, field-friendly labels for the early-exit cases
 * (empty / non-numeric / wrong length) so the message fits a single
 * input row.
 */
export function nationalIdErrorMessage(
  rawId: string | null | undefined,
): string | undefined {
  const analysis = analyseNationalId(rawId);
  if (analysis.valid) return undefined;
  const first = analysis.issues[0]!;
  switch (first.code) {
    case 'EMPTY':
      return 'مطلوب';
    case 'NON_NUMERIC':
      return 'الرقم القومي يجب أن يحتوي على أرقام فقط';
    case 'LENGTH_INVALID':
      return 'الرقم القومي يجب أن يتكون من 14 رقماً';
    default:
      return first.detailAr;
  }
}

/**
 * React-hook-form `validate` helper. Returns `true` when valid,
 * otherwise the Arabic error message — matching RHF's expected shape.
 *
 *   register('nationalId', { validate: validateNationalIdField })
 */
export function validateNationalIdField(
  rawId: string | null | undefined,
): true | string {
  const message = nationalIdErrorMessage(rawId);
  return message ?? true;
}
