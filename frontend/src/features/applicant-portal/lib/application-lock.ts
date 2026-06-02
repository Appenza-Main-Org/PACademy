import type { ApplicantDraft } from '@/shared/types/domain';

export const DEFAULT_APPLICATION_INSTRUCTIONS = [
  'قبل التقدم: راجع البيانات المسجلة على بوابة وزارة الداخلية، وتأكد من صحتها.',
  'أثناء التقدم: سيطلب منك إدخال بيانات الدراسة بدقة. أي مخالفة قد تؤدي إلى منعك من الاختبار.',
  'مقابل الخدمة: يسدد مرة واحدة خلال الدورة الحالية من خلال وسيلة السداد المعتمدة.',
  'احرص على طباعة بطاقة التردد والإقرار قبل موعد أول اختبار، وعلى توقيعها من المتقدم وولي الأمر.',
] as const;

type LockableDraft = Pick<ApplicantDraft, 'payment' | 'parentsApproved' | 'parentsApprovedAt' | 'examSlot'>;

export interface ApplicantRouteLockState {
  paymentLocked: boolean;
  familyLocked: boolean;
  appointmentLocked: boolean;
}

export function isApplicationLocked(
  draft: Partial<LockableDraft> | null | undefined,
  isPaymentConfirmed: boolean,
): boolean {
  return isApplicantPaymentLocked(draft, isPaymentConfirmed);
}

export function isApplicantPaymentLocked(
  draft: Partial<LockableDraft> | null | undefined,
  isPaymentConfirmed: boolean,
): boolean {
  return Boolean(isPaymentConfirmed || draft?.payment?.paidAt || draft?.examSlot);
}

export function isApplicantFamilyLocked(
  draft: Partial<LockableDraft> | null | undefined,
  isParentsApproved: boolean,
): boolean {
  return Boolean(isParentsApproved || draft?.parentsApproved || draft?.parentsApprovedAt || draft?.examSlot);
}

export function isApplicantAppointmentLocked(
  draft: Partial<LockableDraft> | null | undefined,
): boolean {
  return Boolean(draft?.examSlot);
}

export function isApplicantEditRoute(pathname: string): boolean {
  const path = pathname.replace(/^\/applicant\/?/, '');
  return path === 'profile' ||
    path.startsWith('profile/') ||
    path === 'payment' ||
    path === 'exam-schedule';
}

export function isApplicantRouteLocked(pathname: string, state: ApplicantRouteLockState): boolean {
  const path = pathname.replace(/^\/applicant\/?/, '');
  if (path === 'profile' || path.startsWith('profile/')) {
    if (path === 'profile/family' || path === 'profile/family-review') {
      return state.familyLocked;
    }
    return state.paymentLocked;
  }
  if (path === 'payment') return state.paymentLocked;
  if (path === 'exam-schedule') return state.appointmentLocked;
  return false;
}

export function normalizeApplicationInstructions(
  value: readonly string[] | string | null | undefined,
): readonly string[] {
  const lines: readonly string[] =
    typeof value === 'string' ? value.split(/\r?\n/) : value ?? [];
  const normalized = lines.map((line) => line.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : DEFAULT_APPLICATION_INSTRUCTIONS;
}
