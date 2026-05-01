/**
 * Domain status badges.
 * Source: Tasks/DESIGN_SYSTEM.md §4.5.
 *
 * Maps domain enums to Badge tones with consistent Arabic labels.
 * Use these instead of rendering raw status strings in tables / cards so
 * vocabulary stays consistent across the platform.
 */

import { Ban } from 'lucide-react';
import { Badge } from './Badge';
import { STATUS_LABELS } from '@/shared/mock-data/dictionaries';
import type {
  ApplicantStatus,
  InvestigationStatus,
  ResultOutcome,
  PaymentStatus,
} from '@/shared/types/domain';

export function StatusBadge({ status }: { status: ApplicantStatus }): JSX.Element {
  const def = STATUS_LABELS[status] ?? { label: status, color: 'neutral' as const };
  /* "Live" states (pending review) get a dot per §4.5; terminal states omit it. */
  const live = status === 'pending' || status === 'under-review';
  return (
    <Badge tone={def.color} dot={live}>
      {def.label}
    </Badge>
  );
}

/**
 * Suspended-applicant badge — strong terra tone with Ban icon.
 * Used wherever the karasa requires the suspended-applicant guard
 * (Tasks/KARASA_GAPS.md §3.2.E and elsewhere).
 */
export function SuspendedBadge(): JSX.Element {
  return (
    <Badge tone="danger" icon={<Ban size={11} strokeWidth={2.2} aria-hidden />}>
      موقوف
    </Badge>
  );
}

export function InvestigationBadge({ status }: { status: InvestigationStatus }): JSX.Element {
  if (status === 'cleared') return <Badge tone="success">تم الإفراج</Badge>;
  if (status === 'flagged') return <Badge tone="danger">تم الإيقاف</Badge>;
  return (
    <Badge tone="warning" dot>
      قيد الفحص
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }): JSX.Element {
  if (status === 'paid') return <Badge tone="success">مدفوع</Badge>;
  return (
    <Badge tone="warning" dot>
      غير مدفوع
    </Badge>
  );
}

export function ResultBadge({ outcome }: { outcome: ResultOutcome }): JSX.Element {
  if (outcome === 'pass') return <Badge tone="success">ناجح</Badge>;
  if (outcome === 'fail') return <Badge tone="danger">راسب</Badge>;
  return <Badge tone="neutral">قيد المعالجة</Badge>;
}
