/**
 * Per-section zod schemas for the admin Add/Edit applicant form (RFP pp.22-36).
 *
 * Composed top-level schema = identity ∪ contact ∪ address ∪ category ∪
 * (general | overseas | higher) education ∪ family. The form discriminates
 * `education` on `kind` driven by the chosen department.
 *
 * Validation rules — RFP eligibility:
 *  - National ID: 14 digits, valid Egyptian format (parsed by national-id.ts)
 *  - Mobile: `01[0125]\d{8}`
 *  - Egyptian-only nationality (hard-coded; copy from portal validation)
 */

import { z } from 'zod';
import type { DepartmentKey } from '@/shared/types/domain';

const NID_REGEX = /^[0-9]{14}$/;
const EG_PHONE_REGEX = /^01[0125][0-9]{8}$/;
const REQUIRED = 'مطلوب';
const requiredText = (min = 1, message = REQUIRED) =>
  z
    .string({ required_error: message, invalid_type_error: message })
    .trim()
    .min(min, message);
const optionalText = (max = 200) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(max).optional().or(z.literal('')),
  );
const requiredNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    schema,
  );
const URL_OR_HANDLE = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().max(200).optional().or(z.literal('')),
  );

/* ── §1 Identity ─────────────────────────────────────────────────────────── */
export const identitySchema = z.object({
  nationalId: z.string().regex(NID_REGEX, 'الرقم القومي يجب أن يكون 14 رقماً'),
  fullName: z.object({
    first: requiredText(2),
    second: requiredText(2),
    third: requiredText(2),
    fourth: requiredText(2),
  }),
  religion: z.enum(['مسلم', 'مسيحي'], { errorMap: () => ({ message: 'مطلوب' }) }),
  maritalStatus: z.enum(['أعزب', 'متزوج', 'مطلق', 'أرمل'], {
    errorMap: () => ({ message: 'مطلوب' }),
  }),
});

/* ── §2 Address ──────────────────────────────────────────────────────────── */
export const addressSchema = z.object({
  currentAddress: z.object({
    governorate: requiredText(),
    city: requiredText(),
    detail: requiredText(2),
    street: optionalText(),
  }),
});

/* ── §3 Contact ──────────────────────────────────────────────────────────── */
export const contactSchema = z.object({
  contact: z.object({
    homePhone: optionalText(),
    mobilePhone: z.string().regex(EG_PHONE_REGEX, 'رقم محمول مصري غير صحيح'),
    email: optionalText().pipe(z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal(''))),
    socialFacebook: URL_OR_HANDLE,
    socialInstagram: URL_OR_HANDLE,
    socialX: URL_OR_HANDLE,
    socialOther: URL_OR_HANDLE,
  }),
});

/* ── §4 Department ───────────────────────────────────────────────────────── */
export const departmentSchema = z.object({
  department: z.enum(
    ['general_first', 'general_second', 'special', 'lawyers', 'masters', 'doctorate'],
    { errorMap: () => ({ message: 'مطلوب' }) },
  ),
  cycleId: z.string().min(1).optional(),
});

/* ── §5 Education (discriminated by kind, driven by department) ──────────── */
const educationGeneralSchema = z.object({
  kind: z.literal('general'),
  certificateName: requiredText(2),
  schoolName: requiredText(2),
  totalScore: requiredNumber(z.coerce.number().min(1, 'مطلوب').max(410)),
  seatType: optionalText(),
  branch: z.enum(['علمي علوم', 'علمي رياضة', 'أدبي'], {
    errorMap: () => ({ message: 'مطلوب' }),
  }),
  schoolCategory: optionalText(),
  graduationYear: requiredNumber(z.coerce.number().int().min(2018, 'العام غير صحيح').max(new Date().getFullYear())),
  percentage: requiredNumber(z.coerce.number().min(1, 'مطلوب').max(100)).optional(),
});

const educationOverseasSchema = z.object({
  kind: z.literal('overseas'),
  certificateName: requiredText(2),
  schoolName: requiredText(2),
  totalScore: requiredNumber(z.coerce.number().min(1, 'مطلوب')),
  seatType: optionalText(),
  schoolCategory: optionalText(),
  country: requiredText(2),
  graduationYear: requiredNumber(z.coerce.number().int().min(2018).max(new Date().getFullYear())),
});

const educationHigherSchema = z.object({
  kind: z.literal('higher'),
  specialization: requiredText(2),
  university: requiredText(2),
  faculty: requiredText(2),
  totalScore: requiredNumber(z.coerce.number().min(1, 'مطلوب')),
  grade: optionalText(),
  higherSpecialization: optionalText(),
  graduationYear: requiredNumber(z.coerce.number().int().min(1990).max(new Date().getFullYear())),
  secondary: z.object({
    certificateName: requiredText(2),
    totalScore: requiredNumber(z.coerce.number().min(1, 'مطلوب').max(410)),
    schoolCategory: optionalText(),
    country: optionalText(),
    percentage: requiredNumber(z.coerce.number().min(1, 'مطلوب').max(100)).optional(),
  }),
});

export const educationSchema = z.discriminatedUnion('kind', [
  educationGeneralSchema,
  educationOverseasSchema,
  educationHigherSchema,
]);

/** Pick the right education `kind` for a given department per RFP. */
export const EDUCATION_KIND_BY_DEPT: Record<
  DepartmentKey,
  'general' | 'overseas' | 'higher'
> = {
  general_first: 'general',
  general_second: 'general',
  special: 'higher',
  lawyers: 'higher',
  masters: 'higher',
  doctorate: 'higher',
};

/* ── §6 Family (mirrors Stage7 portal) ───────────────────────────────────── */
const familyMemberSchema = z.object({
  fullName: requiredText(2),
  nationalId: z
    .string()
    .regex(NID_REGEX, 'الرقم القومي يجب أن يكون 14 رقماً')
    .optional()
    .or(z.literal('')),
  occupation: optionalText(),
  alive: z.boolean(),
  governorate: optionalText(),
  education: optionalText(),
});

const familyMemberOptionalSchema = familyMemberSchema.partial({
  fullName: true,
  alive: true,
});

const relativeSchema = familyMemberSchema.extend({
  relationshipId: z.string().min(1, 'مطلوب'),
});

export const familySchema = z.object({
  family: z.object({
    father: familyMemberOptionalSchema.optional(),
    mother: familyMemberOptionalSchema.optional(),
    paternalGrandfather: familyMemberOptionalSchema.optional(),
    paternalGrandmother: familyMemberOptionalSchema.optional(),
    maternalGrandfather: familyMemberOptionalSchema.optional(),
    maternalGrandmother: familyMemberOptionalSchema.optional(),
    siblings: z.array(familyMemberOptionalSchema).default([]),
    relatives: z.array(relativeSchema).default([]),
  }),
});

/* ── Composed top-level ──────────────────────────────────────────────────── */
export const applicantInputSchema = identitySchema
  .merge(addressSchema)
  .merge(contactSchema)
  .merge(departmentSchema)
  .merge(familySchema)
  .extend({ education: educationSchema });

export type ApplicantInput = z.infer<typeof applicantInputSchema>;

/** Section keys used for the right-rail anchor map. */
export const SECTION_ORDER = [
  'identity',
  'address',
  'contact',
  'department',
  'education',
  'family',
  'relatives',
] as const;
export type SectionKey = (typeof SECTION_ORDER)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  identity: 'هوية المتقدم',
  address: 'العنوان الحالي',
  contact: 'بيانات الاتصال',
  department: 'فئة التقدم',
  education: 'البيانات الدراسية',
  family: 'بيانات الأسرة الأساسية',
  relatives: 'بيانات الأقارب',
};
