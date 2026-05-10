/**
 * FawryConfigCard — admin form for the cycle's Fawry merchant config.
 * Closes CP9 of the PA Academy admin scope checkpoints. Reads from
 * `cycle.fees.fawryConfig` and persists via `cyclesService.update()`; the
 * applicant-side Stage 6 surface consumes the same shape (AF-7).
 *
 * Extracted from `CycleDetailPage` so the Admission Setup section's "الرسوم
 * المالية" step can compose the same card without forking the mutation.
 */

import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button, Card, Input, toast } from '@/shared/components';
import { date as fmtDate } from '@/shared/lib/format';
import type { AdmissionCycle } from '@/shared/types/domain';
import { useCycleUpdate } from '../../api/cycles.queries';

interface FawryConfigCardProps {
  cycle: AdmissionCycle;
  readOnly: boolean;
}

export function FawryConfigCard({ cycle, readOnly }: FawryConfigCardProps): JSX.Element {
  const updateMut = useCycleUpdate();
  const fawry = cycle.fees?.fawryConfig;
  const [merchantCode, setMerchantCode] = useState(fawry?.merchantCode ?? '');
  const [label, setLabel] = useState(fawry?.label ?? 'فوري');
  const [retryWindowHours, setRetryWindowHours] = useState<number>(
    fawry?.retryWindowHours ?? 48,
  );

  const dirty =
    merchantCode !== (fawry?.merchantCode ?? '') ||
    label !== (fawry?.label ?? 'فوري') ||
    retryWindowHours !== (fawry?.retryWindowHours ?? 48);

  const save = (): void => {
    if (readOnly || !dirty) return;
    updateMut.mutate(
      {
        id: cycle.id,
        patch: {
          fees: {
            applicationFee: cycle.fees?.applicationFee ?? 0,
            ...cycle.fees,
            fawryConfig: {
              merchantCode: merchantCode.trim(),
              label: label.trim() || 'فوري',
              retryWindowHours: Math.max(1, Math.floor(retryWindowHours)),
            },
          },
        },
      },
      {
        onSuccess: () => toast('تم حفظ إعدادات بوابة فوري', 'success'),
        onError: (err) => toast((err as Error).message ?? 'تعذر حفظ الإعدادات', 'danger'),
      },
    );
  };

  return (
    <Card>
      <header className="mb-4 flex items-start gap-3">
        <span aria-hidden className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Smartphone size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <h2 className="font-ar-display text-md font-bold text-ink-900">إعدادات بوابة فوري</h2>
          <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">
            رمز التاجر، تسمية البوابة المعروضة للمتقدم، ومدة صلاحية رمز السداد بالساعات.
            تُستهلَك هذه القيم من الواجهة الأمامية على مرحلة سداد الرسوم.
          </p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label="رمز التاجر"
          dir="ltr"
          placeholder="PA-ACADEMY-…"
          value={merchantCode}
          onChange={(e) => setMerchantCode(e.target.value)}
          disabled={readOnly}
        />
        <Input
          label="تسمية البوابة"
          placeholder="فوري"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={readOnly}
        />
        <Input
          label="مدة صلاحية رمز السداد (بالساعات)"
          type="number"
          dir="ltr"
          value={String(retryWindowHours)}
          onChange={(e) => setRetryWindowHours(Number.parseInt(e.target.value, 10) || 0)}
          disabled={readOnly}
          helper="القيمة المرجعية في وثائق وزارة الداخلية: 48 ساعة"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-2xs text-ink-500">
          {fawry
            ? `آخر تحديث: ${fmtDate(cycle.updatedAt, 'short')}`
            : 'لم يتم ضبط إعدادات فوري لهذه الدورة بعد'}
        </p>
        <Button
          variant="primary"
          onClick={save}
          disabled={readOnly || !dirty || !merchantCode.trim()}
          isLoading={updateMut.isPending}
        >
          حفظ الإعدادات
        </Button>
      </div>
    </Card>
  );
}
