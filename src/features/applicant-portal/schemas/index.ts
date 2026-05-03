/**
 * Per-stage zod schemas — Sprint 2.
 * Source: Tasks/KARASA_GAPS.md §2.2 stages 1-11.
 *
 * Schemas drive both react-hook-form validation and inferred TS types so
 * the form values stay aligned with the service contract.
 */

import { z } from 'zod';

const NID_REGEX = /^[0-9]{14}$/;
const EG_PHONE_REGEX = /^01[0125][0-9]{8}$/;

export const stage1Schema = z.object({
  nationalId: z.string().regex(NID_REGEX, 'الرقم القومي يجب أن يكون 14 رقماً'),
  phoneNumber: z.string().regex(EG_PHONE_REGEX, 'رقم الهاتف غير صحيح'),
});
export type Stage1Values = z.infer<typeof stage1Schema>;

export const stage2Schema = z.object({
  smsCode: z.string().regex(/^[0-9]{6}$/, 'الرمز يجب أن يكون 6 أرقام'),
});
export type Stage2Values = z.infer<typeof stage2Schema>;

export const stage3Schema = z.object({
  firstName: z.string().min(2, 'مطلوب'),
  secondName: z.string().min(2, 'مطلوب'),
  thirdName: z.string().min(2, 'مطلوب'),
  fourthName: z.string().min(2, 'مطلوب'),
  /* dateOfBirth and gender are derived from the National ID — see Stage3PersonalPage */
  dateOfBirth: z.string().min(1, 'مطلوب'),
  gender: z.enum(['male', 'female']),
  placeOfBirth: z.string().min(1, 'مطلوب'),
  religion: z.enum(['مسلم', 'مسيحي']),
  currentAddress: z.string().min(5, 'مطلوب'),
  permanentAddress: z.string().min(5, 'مطلوب'),
  permanentSameAsCurrent: z.boolean().optional().default(false),
  homePhone: z.string().optional(),
  mobilePhone: z.string().regex(EG_PHONE_REGEX, 'رقم محمول غير صحيح'),
  email: z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal('')),
});
export type Stage3Values = z.infer<typeof stage3Schema>;

export const stage4Schema = z.object({
  certificateType: z.string().min(1, 'مطلوب'),
  certificateYear: z.coerce.number().int().min(2020, 'العام غير صحيح').max(new Date().getFullYear()),
  seatNumber: z.string().optional(),
  totalScore: z.coerce.number().min(0),
  percentage: z.coerce.number().min(0).max(100),
  schoolName: z.string().min(1, 'مطلوب'),
  schoolGovernorate: z.string().min(1, 'مطلوب'),
  azharBranch: z.enum(['علمي', 'أدبي']).optional(),
});
export type Stage4Values = z.infer<typeof stage4Schema>;

export const stage5Schema = z
  .object({
    maritalStatus: z.enum(['أعزب', 'متزوج', 'مطلق', 'أرمل']),
    spouseName: z.string().optional(),
    spouseNationalId: z.string().optional(),
    marriageDate: z.string().optional(),
    spouseOccupation: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.maritalStatus === 'متزوج') {
      if (!data.spouseName) ctx.addIssue({ code: 'custom', path: ['spouseName'], message: 'مطلوب' });
      if (!data.spouseNationalId)
        ctx.addIssue({ code: 'custom', path: ['spouseNationalId'], message: 'مطلوب' });
      if (!data.marriageDate)
        ctx.addIssue({ code: 'custom', path: ['marriageDate'], message: 'مطلوب' });
    }
  });
export type Stage5Values = z.infer<typeof stage5Schema>;

export const stage6Schema = z.object({
  method: z.enum(['fawry', 'card']),
});
export type Stage6Values = z.infer<typeof stage6Schema>;

const familyMemberSchema = z.object({
  fullName: z.string().min(2, 'مطلوب'),
  nationalId: z.string().regex(NID_REGEX, 'الرقم القومي يجب أن يكون 14 رقماً').optional().or(z.literal('')),
  occupation: z.string().optional(),
  alive: z.boolean(),
  causeOfDeath: z.string().optional(),
  governorate: z.string().optional(),
  education: z.string().optional(),
});

export const stage7Schema = z.object({
  father: familyMemberSchema,
  mother: familyMemberSchema,
  paternalGrandfather: familyMemberSchema,
  paternalGrandmother: familyMemberSchema,
  maternalGrandfather: familyMemberSchema,
  maternalGrandmother: familyMemberSchema,
  siblings: z.array(familyMemberSchema).default([]),
  relatives: z.array(familyMemberSchema.extend({ relationshipId: z.string().min(1, 'مطلوب') })).default([]),
});
export type Stage7Values = z.infer<typeof stage7Schema>;

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
  politicalAffiliation: z.object({
    has: z.boolean(),
    details: z.string().optional(),
  }),
  religiousGroup: z.string().optional(),
  religiousRole: z.string().optional(),
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
