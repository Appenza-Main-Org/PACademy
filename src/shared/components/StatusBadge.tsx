import { Badge } from './Badge';
import { STATUS_LABELS } from '@/shared/mock-data/dictionaries';
import type { ApplicantStatus, InvestigationStatus, ResultOutcome, PaymentStatus } from '@/shared/types/domain';

export function StatusBadge({ status }: { status: ApplicantStatus }): JSX.Element {
  const def = STATUS_LABELS[status] ?? { label: status, color: 'neutral' as const };
  return <Badge tone={def.color}>{def.label}</Badge>;
}

export function InvestigationBadge({ status }: { status: InvestigationStatus }): JSX.Element {
  if (status === 'cleared') return <Badge tone="success">تم الإفراج</Badge>;
  if (status === 'flagged') return <Badge tone="danger">تم الإيقاف</Badge>;
  return <Badge tone="warning">قيد الفحص</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }): JSX.Element {
  if (status === 'paid') return <Badge tone="success">مدفوع</Badge>;
  return <Badge tone="warning">غير مدفوع</Badge>;
}

export function ResultBadge({ outcome }: { outcome: ResultOutcome }): JSX.Element {
  if (outcome === 'pass') return <Badge tone="success">ناجح</Badge>;
  if (outcome === 'fail') return <Badge tone="danger">راسب</Badge>;
  return <Badge tone="neutral">قيد المعالجة</Badge>;
}
