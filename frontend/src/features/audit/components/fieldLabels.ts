/**
 * Arabic field-label dictionary — Gap E (admin-gaps).
 *
 * Maps the 20 most common JSON keys that surface in audit diffs to their
 * Arabic UI labels. Keys not in this dictionary fall through to their raw
 * camelCase form. Keep additions terse and product-register.
 */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  /* Identity / contact (high traffic) */
  name: 'الاسم',
  fullName: 'الاسم الكامل',
  nationalId: 'الرقم القومي',
  mobilePhone: 'رقم الموبايل',
  homePhone: 'هاتف المنزل',
  email: 'البريد الإلكتروني',

  /* Address */
  governorate: 'المحافظة',
  city: 'المدينة',
  detail: 'العنوان التفصيلي',
  street: 'الشارع',

  /* Personal */
  religion: 'الديانة',
  maritalStatus: 'الحالة الاجتماعية',
  birthDate: 'تاريخ الميلاد',
  gender: 'النوع',

  /* Education / status */
  certType: 'نوع الشهادة',
  status: 'الحالة',
  stage: 'المرحلة',

  /* Workflow */
  capacity: 'الطاقة',
  capacityPerDay: 'الطاقة اليومية',
  cycleId: 'الدورة',
  reason: 'السبب',
};

/** Get the Arabic label for a JSON key, falling back to the raw key. */
export function fieldLabel(key: string): string {
  return AUDIT_FIELD_LABELS[key] ?? key;
}
