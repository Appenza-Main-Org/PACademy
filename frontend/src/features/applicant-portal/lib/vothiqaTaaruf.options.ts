/**
 * Option lists for وثيقة تعارف dropdowns — re-exported / adapted from
 * the same sources Stage 7 (بيانات العائلة) uses so the two pages
 * stay in lockstep.
 *
 * Stage 7 uses `SearchSelect` for governorate (long list) and `Select`
 * for profession + qualification. Stage 11 uses our local `Cell` with
 * `type="select"` — the option arrays here match Stage 7 exactly, so
 * the data the applicant sees is identical even if the chrome differs
 * slightly (plain native select vs searchable popover).
 */

import { REF_GOVERNORATES } from '@/shared/mock-data/referenceData';
import { PROFESSION_OPTIONS as STAGE7_PROFESSION_OPTIONS } from './familyData';

export interface SelectOption {
  value: string;
  label: string;
}

/** Mirror of `GOV_OPTIONS` in Stage7FamilyPage. */
export const GOVERNORATE_OPTIONS: ReadonlyArray<SelectOption> = REF_GOVERNORATES.map(
  (g) => ({ value: g.nameAr, label: g.nameAr }),
);

/** Mirror of `PROFESSION_OPTIONS` in familyData — drop the empty
 * placeholder option since `Cell type="select"` already prepends one. */
export const PROFESSION_OPTIONS: ReadonlyArray<SelectOption> = STAGE7_PROFESSION_OPTIONS.filter(
  (o) => o.value !== '',
).map((o) => ({ value: o.value, label: o.label }));

/** Mirror of `QUALIFICATION_OPTIONS` defined locally in Stage7FamilyPage. */
export const QUALIFICATION_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'none', label: 'بدون مؤهل' },
  { value: 'primary', label: 'ابتدائي' },
  { value: 'preparatory', label: 'إعدادي' },
  { value: 'secondary', label: 'ثانوي' },
  { value: 'diploma', label: 'دبلوم' },
  { value: 'bachelor', label: 'بكالوريوس / ليسانس' },
  { value: 'masters', label: 'ماجستير' },
  { value: 'phd', label: 'دكتوراه' },
  { value: 'other', label: 'أخرى' },
];

/** Religion picker — matches Stage 7's inline `<Select>`. */
export const RELIGION_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'مسلم', label: 'مسلم' },
  { value: 'مسيحي', label: 'مسيحي' },
];

/** Female-form religion options for the grandmothers / mother / aunts.
 * The actual stored value matches the male form so the print mirror's
 * label-agnostic «الديانة» field renders consistently. */
export const RELIGION_OPTIONS_FEMALE: ReadonlyArray<SelectOption> = [
  { value: 'مسلم', label: 'مسلمة' },
  { value: 'مسيحي', label: 'مسيحية' },
];

/** Nationality picker — small fixed list, مصرية as the default. */
export const NATIONALITY_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'مصرية', label: 'مصرية' },
  { value: 'سعودية', label: 'سعودية' },
  { value: 'إماراتية', label: 'إماراتية' },
  { value: 'كويتية', label: 'كويتية' },
  { value: 'قطرية', label: 'قطرية' },
  { value: 'سورية', label: 'سورية' },
  { value: 'لبنانية', label: 'لبنانية' },
  { value: 'فلسطينية', label: 'فلسطينية' },
  { value: 'سودانية', label: 'سودانية' },
  { value: 'ليبية', label: 'ليبية' },
  { value: 'تونسية', label: 'تونسية' },
  { value: 'مغربية', label: 'مغربية' },
  { value: 'جزائرية', label: 'جزائرية' },
  { value: 'يمنية', label: 'يمنية' },
  { value: 'أردنية', label: 'أردنية' },
  { value: 'أخرى', label: 'أخرى' },
];

/** Housing-type picker — mirrors what an admissions reviewer would expect. */
export const HOUSING_TYPE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'تمليك', label: 'تمليك' },
  { value: 'إيجار', label: 'إيجار' },
  { value: 'تمليك العائلة', label: 'تمليك العائلة' },
  { value: 'سكن حكومي', label: 'سكن حكومي' },
];

/** Marital-status picker for adult relatives — Stage 7 omits this on
 * relative cards (it's a free text field), but the وثيقة تعارف PDF
 * carries a dedicated «الحالة الاجتماعية» row, so we pin the values. */
export const MARITAL_STATUS_ADULT_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: 'أعزب', label: 'أعزب' },
  { value: 'متزوج', label: 'متزوج' },
  { value: 'متزوجة', label: 'متزوجة' },
  { value: 'مطلق', label: 'مطلق' },
  { value: 'مطلقة', label: 'مطلقة' },
  { value: 'أرمل', label: 'أرمل' },
  { value: 'أرملة', label: 'أرملة' },
];
