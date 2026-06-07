import type { MoiApplicantSession } from './moi-session.mock';
import type { ProfileSnapshot } from './profileData';

export interface ProfileValidationContext {
  isMoiVerified: boolean;
  moiSession: MoiApplicantSession | null;
  selectedCategoryKey: string | null;
  selectedFaculty: string | null;
  selectedSpecialization: string | null;
}

export interface ProfileValidationResult {
  isValid: boolean;
  messages: string[];
}

const REQUIRED_MESSAGE = 'مطلوب';

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function addIfBlank(messages: string[], label: string, value: unknown): void {
  if (isBlank(value)) messages.push(`${label}: ${REQUIRED_MESSAGE}`);
}

function addIfMissingNumber(messages: string[], label: string, value: unknown): void {
  if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) {
    messages.push(`${label}: ${REQUIRED_MESSAGE}`);
  }
}

export function validateProfileBeforePayment(
  snapshot: ProfileSnapshot | null,
  context: ProfileValidationContext,
): ProfileValidationResult {
  if (!snapshot) {
    return {
      isValid: false,
      messages: ['يجب حفظ البيانات الشخصية والدراسية أولاً قبل الانتقال إلى السداد.'],
    };
  }

  const messages: string[] = [];
  if (!context.selectedCategoryKey) messages.push('فئة التقديم: مطلوب');
  validatePersonalFields(messages, snapshot, context);
  validateThanawiFields(messages, snapshot);
  validateUniversityFields(messages, snapshot, context);

  if (snapshot.values.declaration !== true) {
    messages.push('الإقرار الإلكتروني: يجب الموافقة على شروط الإلتحاق والإقرار الإلكتروني');
  }

  return { isValid: messages.length === 0, messages };
}

function validatePersonalFields(
  messages: string[],
  snapshot: ProfileSnapshot,
  context: ProfileValidationContext,
): void {
  const { values, manualPersonal } = snapshot;
  if (context.isMoiVerified) {
    addIfBlank(messages, 'الإسم رباعي', context.moiSession?.fullName);
    addIfBlank(messages, 'الرقم القومي', context.moiSession?.nationalId);
    addIfBlank(messages, 'تاريخ الميلاد', context.moiSession?.dateOfBirthAr);
    addIfBlank(messages, 'النوع', context.moiSession?.gender);
    addIfBlank(messages, 'رقم المحمول', context.moiSession?.mobile);
    addIfBlank(messages, 'البريد الإلكتروني', context.moiSession?.email);
  } else {
    addIfBlank(messages, 'الإسم رباعي', manualPersonal.fullName);
    addIfBlank(messages, 'تاريخ الميلاد', manualPersonal.dateOfBirthAr);
    addIfBlank(messages, 'النوع', manualPersonal.gender);
    addIfBlank(messages, 'محل الميلاد', manualPersonal.birthGovernorate);
    addIfBlank(messages, 'رقم المحمول', manualPersonal.mobile);
    addIfBlank(messages, 'البريد الإلكتروني', manualPersonal.email);
    if (context.selectedCategoryKey === 'officers_general') {
      addIfBlank(messages, 'فئة المدرسة', manualPersonal.officerApplicantType);
    }
  }

  addIfBlank(messages, 'الديانة', manualPersonal.religion);
  addIfBlank(messages, 'الحالة الاجتماعية', manualPersonal.maritalStatus);
  addIfBlank(messages, 'القسم / مركز الميلاد', values.birthDistrict);
  addIfBlank(messages, 'العنوان التفصيلي لمحل الميلاد', values.birthAddressDetail);
  addIfBlank(messages, 'محافظة الإقامة', values.addressGovernorate);
  addIfBlank(messages, 'القسم / مركز الإقامة', values.addressDistrict);
  addIfBlank(messages, 'العنوان التفصيلي لمحل الإقامة', values.currentAddressDetail);
}

function validateThanawiFields(messages: string[], snapshot: ProfileSnapshot): void {
  const { values } = snapshot;
  addIfBlank(messages, 'دولة المدرسة', values.thanawiCountry);
  addIfBlank(messages, 'نوع الشهادة', values.thanawiType);
  addIfBlank(messages, 'اسم المدرسة', values.schoolNameAr);
  addIfBlank(messages, 'عنوان المدرسة', values.schoolAddress);
  addIfBlank(messages, 'تاريخ الحصول على الشهادة', values.thanawiGradDate);
  addIfMissingNumber(messages, 'مجموع الثانوية العامة', values.thanawiTotal);
  addIfMissingNumber(messages, 'النسبة المئوية للثانوية العامة', values.thanawiPercentage);
}

function validateUniversityFields(
  messages: string[],
  snapshot: ProfileSnapshot,
  context: ProfileValidationContext,
): void {
  const { values, qualificationLevel } = snapshot;
  const requiresUniversityQualification = context.selectedCategoryKey !== 'officers_general';
  if (requiresUniversityQualification) {
    addIfBlank(messages, 'المؤهل / الدرجة العلمية', qualificationLevel);
    addIfBlank(messages, 'الجامعة', values.bachelorUniversity);
    addIfBlank(messages, 'الكلية', context.selectedFaculty ?? values.bachelorFaculty);
    addIfBlank(messages, 'التخصص', context.selectedSpecialization ?? values.bachelorSpecialization);
    if (context.selectedCategoryKey !== 'law_bachelor') {
      addIfBlank(messages, 'المجموعة', values.bachelorMajor);
      addIfBlank(messages, 'الشعبة', values.bachelorBranch);
      addIfMissingNumber(messages, 'النسبة المئوية للجامعة', values.bachelorPercentage);
    }
    addIfMissingNumber(messages, 'سنة التخرج', values.bachelorYear);
    addIfBlank(messages, 'تقدير الجامعة', values.bachelorGrade);
  }

  if (qualificationLevel === 'master' || qualificationLevel === 'doctorate') {
    addIfMissingNumber(messages, 'سنة الحصول على الماجستير', values.postgradYear);
    addIfBlank(messages, 'تقدير الماجستير', values.postgradGrade);
  }
  if (qualificationLevel === 'doctorate') {
    addIfMissingNumber(messages, 'سنة الحصول على الدكتوراه', values.doctorateYear);
    addIfBlank(messages, 'تقدير الدكتوراه', values.doctorateGrade);
  }
}
