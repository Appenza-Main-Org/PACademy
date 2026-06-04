export type ApplicationFormActionKey = 'preview' | 'print' | 'download-pdf';

export interface ApplicationFormAction {
  key: ApplicationFormActionKey;
  label: string;
  query: string;
}

export const APPLICATION_FORM_ACTIONS: readonly ApplicationFormAction[] = [
  { key: 'preview', label: 'معاينة الطلب', query: '' },
  { key: 'print', label: 'طباعة الطلب', query: '?print=1' },
  { key: 'download-pdf', label: 'تحميل الطلب PDF', query: '?download=pdf' },
] as const;

export interface ApplicationFormActionState {
  paid: boolean;
  parentsApproved: boolean;
  firstExamDate: string | null;
  appointmentLocked: boolean;
}

export function canUseApplicationFormActions(state: ApplicationFormActionState): boolean {
  return Boolean(state.paid && state.parentsApproved && state.firstExamDate && state.appointmentLocked);
}

export function formatApplicationFormFilename(applicantId: string): string {
  const cleanId = applicantId.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return `police-academy-application-${cleanId || 'applicant'}.pdf`;
}
