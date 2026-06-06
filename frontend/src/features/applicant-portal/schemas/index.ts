/**
 * Per-stage zod schemas — Sprint 2.
 * Source: Tasks/KARASA_GAPS.md §2.2 stages 1-11.
 *
 * Schemas drive both react-hook-form validation and inferred TS types so
 * the form values stay aligned with the service contract.
 */

import { z } from 'zod';
import { nationalIdErrorMessage } from '@/shared/lib/national-id';

const EG_PHONE_REGEX = /^01[0125][0-9]{8}$/;

/** Zod field that validates an Egyptian National ID through the full
 *  analyser (length + numeric + century + birth date + governorate +
 *  sequence + gender digit). Each failure surfaces a
 *  specific Arabic message instead of a generic «14 رقماً» error. */
const nationalIdField = z.string().superRefine((value, ctx) => {
  const message = nationalIdErrorMessage(value);
  if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

export const stage1Schema = z.object({
  nationalId: nationalIdField,
  phoneNumber: z.string().regex(EG_PHONE_REGEX, 'رقم الهاتف غير صحيح'),
  /* Captcha — applicant types the answer to a randomly-generated arithmetic
   * challenge. The expected value is set on each render and matched at
   * submit time. Validated as a coerced number to keep the schema typed. */
  captcha: z.string().min(1, 'أدخل ناتج العملية'),
});
export type Stage1Values = z.infer<typeof stage1Schema>;

export const stage2Schema = z.object({
  smsCode: z.string().regex(/^[0-9]{6}$/, 'الرمز يجب أن يكون 6 أرقام'),
});
export type Stage2Values = z.infer<typeof stage2Schema>;

/* Stage 3, 4, 5 schemas removed in the MOI-alignment refactor — see
 * `stage345Schema` below for the collapsed single-page form. */

export const stage6Schema = z.object({
  /* Single-method scheduling — Fawry code only. Credit-card path was
   * removed per ops feedback; reintroduce by extending this enum. */
  method: z.enum(['fawry-code']),
});
export type Stage6Values = z.infer<typeof stage6Schema>;

/**
 * Stage 3+4+5 collapsed — applicant-data form (PDF p.4 / MOI-aligned).
 *
 * The MOI reference flow uses a single scrollable page with section
 * headings rather than three separate sub-pages. The bachelor block is
 * conditional on the chosen category (non-`officers_general`). Personal
 * data fields (name, NID, DOB, gender, mobile, email) are prefilled
 * read-only from the MOI session and stored separately on the wizard
 * store — they don't appear here.
 *
 * Marital data is intentionally absent here; it moves into the
 * `/applicant/profile/family` page per the MOI reference (PDF p.8 dropdown).
 */
export const stage345Schema = z
  .object({
    /* Bachelor block — required only when category !== officers_general. */
    bachelorMajor: z.string().optional().or(z.literal('')),
    bachelorBranch: z.string().optional().or(z.literal('')),
    bachelorSpecialization: z.string().optional().or(z.literal('')),
    bachelorFaculty: z.string().optional().or(z.literal('')),
    bachelorUniversity: z.string().optional().or(z.literal('')),
    bachelorPercentage: z.union([z.coerce.number().min(0).max(100), z.literal('')]).optional(),
    bachelorYear: z.union([z.coerce.number().int().min(1990).max(2099), z.literal('')]).optional(),

    /* Thanaweya block — always required. `thanawiType` accepts any string
     * because the manual-entry path sources it from the `school-categories`
     * lookup (e.g. الشهادات المعادلة من الخارج); the matched-by-grades path
     * carries the branch from the imported row. */
    thanawiCountry: z.string().min(1, 'مطلوب'),
    thanawiTotal: z.coerce.number().min(0, 'مطلوب'),
    thanawiType: z.string().min(1, 'مطلوب'),
    thanawiPercentage: z.coerce.number().min(0).max(100),
    schoolNameAr: z.string().min(1, 'مطلوب'),
    schoolAddress: z.string().min(1, 'مطلوب'),

    /* Thanaweya — optional graduation date (auto-filled from grades
     * import when available, manual otherwise). */
    thanawiGradDate: z.string().optional().or(z.literal('')),
    /* التقدير — qualitative grade rating for thanaweya (manual path). */
    thanawiGrade: z.string().optional().or(z.literal('')),
    /* التقدير العام — qualitative grade rating for the bachelor degree. */
    bachelorGrade: z.string().optional().or(z.literal('')),

    /* Master-level block — labelled بيانات الماجستير in the UI. Rendered
     * for `specialized_officers` whose qualification is master OR
     * doctorate (doctorate applicants must also fill master data per the
     * academic hierarchy). All fields optional at schema-level so other
     * categories pass validation. The historical `postgrad*` field names
     * stay for backwards-compat with already-persisted drafts. */
    postgradDegree: z.string().optional().or(z.literal('')),
    postgradSpecialization: z.string().optional().or(z.literal('')),
    postgradUniversity: z.string().optional().or(z.literal('')),
    postgradYear: z.union([z.coerce.number().int().min(1990).max(2099), z.literal('')]).optional(),
    postgradGrade: z.string().optional().or(z.literal('')),

    /* Doctorate block — only rendered when qualification === 'doctorate'.
     * Mirror shape of the master block above. */
    doctorateYear: z.union([z.coerce.number().int().min(1990).max(2099), z.literal('')]).optional(),
    doctorateGrade: z.string().optional().or(z.literal('')),

    /* Birth-place picker (separate from MOI's birthGovernorate). */
    birthDistrict: z.string().optional().or(z.literal('')),
    /* Detailed birth-place address — paired with birthGovernorate +
     *  birthDistrict above. Added 2026-05-21 to split the address block
     *  into separate birth/residence detail fields. */
    birthAddressDetail: z.string().optional().or(z.literal('')),

    /* Address + contact. Mobile + email come from MOI and are not editable.
     * `fax` was retired from the UI; kept here as optional so legacy
     * persisted drafts don't fail validation.
     * `currentAddressDetail` is the detailed residence address (paired
     * with addressGovernorate + addressDistrict below). */
    currentAddressDetail: z.string().optional().or(z.literal('')),
    addressGovernorate: z.string().min(1, 'مطلوب'),
    addressDistrict: z.string().min(1, 'مطلوب'),
    homePhone: z.string().optional().or(z.literal('')),
    fax: z.string().optional().or(z.literal('')),
    secondaryMobile: z.string().optional().or(z.literal('')),
    /* Social handles — accept either a bare/@-prefixed username OR a
     * full profile URL on the respective platform. Empty is allowed. */
    facebook: z
      .string()
      .regex(
        /^(?:$|@?[A-Za-z0-9.]{3,50}|https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9.]+\/?)$/i,
        'صيغة الفيسبوك غير صحيحة',
      )
      .optional()
      .or(z.literal('')),
    twitter: z
      .string()
      .regex(
        /^(?:$|@?[A-Za-z0-9_]{1,15}|https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+\/?)$/i,
        'صيغة تويتر غير صحيحة',
      )
      .optional()
      .or(z.literal('')),
    instagram: z
      .string()
      .regex(
        /^(?:$|@?[A-Za-z0-9._]{1,30}|https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+\/?)$/i,
        'صيغة إنستجرام غير صحيحة',
      )
      .optional()
      .or(z.literal('')),

    /* Footer attestation — must be checked before حفظ والمتابعة is enabled. */
    declaration: z.literal(true, {
      errorMap: () => ({ message: 'يجب الموافقة على شروط الإلتحاق والإقرار الإلكتروني' }),
    }),
  });
export type Stage345Values = z.infer<typeof stage345Schema>;

/** Verify step (PDF p.5 lower) — applicant re-enters NID + mobile. */
export const verifyApplicantSchema = z.object({
  nationalId: nationalIdField,
  mobile: z.string().regex(EG_PHONE_REGEX, 'رقم المحمول غير صحيح'),
});
export type VerifyApplicantValues = z.infer<typeof verifyApplicantSchema>;

/* Stage 7 family schema removed in the MOI-alignment refactor. The new
 * page collects only الوالد / الوالدة / زوج الوالدة (PDF pp.8-10) and
 * uses an inline form shape rather than the previous extended family tree
 * (grandparents + siblings + relatives to the 4th degree). */

export const stage8Schema = z.object({
  slotId: z.string().min(1, 'اختر موعداً'),
});
export type Stage8Values = z.infer<typeof stage8Schema>;

/* Stage 9 (print-card) and Stage 10 (follow-up) have no editable form. */
export const stage9Schema = z.object({});
export const stage10Schema = z.object({});
export type Stage9Values = z.infer<typeof stage9Schema>;
export type Stage10Values = z.infer<typeof stage10Schema>;

export const stage11Schema = z.object({
  housing: z.enum(['own', 'rent', 'family-owned']),
  travelHistory: z.array(
    z.object({
      country: z.string(),
      year: z.coerce.number().int(),
      reason: z.string(),
    }),
  ).default([]),
  socialAccounts: z.array(z.object({ platform: z.string(), handle: z.string() })).default([]),
});
export type Stage11Values = z.infer<typeof stage11Schema>;
