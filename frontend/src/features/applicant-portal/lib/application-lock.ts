import type { ApplicantDraft } from '@/shared/types/domain';

export const DEFAULT_APPLICATION_INSTRUCTIONS = [
  'قبل التقدم: راجع البيانات المسجلة على بوابة وزارة الداخلية، وتأكد من صحتها.',
  'أثناء التقدم: سيطلب منك إدخال بيانات الدراسة بدقة. أي مخالفة قد تؤدي إلى منعك من الاختبار.',
  'مقابل الخدمة: يسدد مرة واحدة خلال الدورة الحالية من خلال وسيلة السداد المعتمدة.',
  'احرص على طباعة بطاقة التردد والإقرار قبل موعد أول اختبار، وعلى توقيعها من المتقدم وولي الأمر.',
] as const;

type LockableDraft = Pick<ApplicantDraft, 'payment' | 'examSlot'>;

export function isApplicationLocked(
  draft: Partial<LockableDraft> | null | undefined,
  isPaymentConfirmed: boolean,
): boolean {
  return Boolean(isPaymentConfirmed || draft?.payment?.paidAt || draft?.examSlot);
}

export function isApplicantEditRoute(pathname: string): boolean {
  const path = pathname.replace(/^\/applicant\/?/, '');
  return path === 'profile' ||
    path.startsWith('profile/') ||
    path === 'payment' ||
    path === 'exam-schedule' ||
    path === 'acquaintance-doc';
}

export function normalizeApplicationInstructions(
  value: readonly string[] | string | null | undefined,
): readonly string[] {
  const lines: readonly string[] =
    typeof value === 'string' ? value.split(/\r?\n/) : value ?? [];
  const normalized = lines.map((line) => line.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : DEFAULT_APPLICATION_INSTRUCTIONS;
}
