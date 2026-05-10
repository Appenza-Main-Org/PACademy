/**
 * NidLookupResultCard — read-only display of a found candidate.
 *
 * Renders below NidLookupField after a `status: 'found'` lookup.
 * Auto-filled fields in the create form mirror this data; the card
 * exists to make the source of truth visible and to give the admin
 * a "تعديل" override link for edge cases (typo in the directory).
 */

import { CheckCircle2, Pencil } from 'lucide-react';
import { Card, Badge } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import type { OfficerCandidate } from '../../api/nid-lookup.service';

interface NidLookupResultCardProps {
  data: OfficerCandidate;
  onEditOverride?: () => void;
  className?: string;
}

const USER_TYPE_LABEL: Record<OfficerCandidate['userType'], string> = {
  officer: 'ضابط',
  civilian: 'مدنى',
  contractor: 'متعاقد',
};

export function NidLookupResultCard({
  data,
  onEditOverride,
  className,
}: NidLookupResultCardProps): JSX.Element {
  return (
    <Card variant="elevated" className={cn('border-r-4 border-r-teal-500', className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
          <CheckCircle2 size={16} strokeWidth={2} />
          <span>تم التحقق من الهوية</span>
        </div>
        {onEditOverride && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-2xs font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
            onClick={onEditOverride}
          >
            <Pencil size={12} strokeWidth={1.75} />
            تعديل
          </button>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
        <Field label="الاسم رباعياً" value={data.fullArabicName} />
        <Field label="الرقم القومى" value={data.nationalId} mono />
        <Field label="رمز الضابط / الكود" value={data.officerCode} mono />
        <Field label="رقم المحمول" value={data.mobileNumber} mono />
        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium text-ink-500">الفئة</span>
          <Badge tone="brand">{USER_TYPE_LABEL[data.userType]}</Badge>
        </div>
      </dl>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-medium text-ink-500">{label}</dt>
      <dd
        className={cn('text-sm font-medium text-ink-900', mono && 'font-mono tnum')}
        dir={mono ? 'ltr' : undefined}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
