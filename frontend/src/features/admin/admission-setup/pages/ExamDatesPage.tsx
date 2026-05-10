/**
 * Step 11 — مواعيد الاختبارات (NEW).
 * Editor for the cycle's exam-date config: first-available date, the set
 * of bookable days, and an optional blackout-day subset. Validation runs
 * service-side (`firstAvailableDate ≥ cycle.startDate`, bookableDays ≥
 * firstAvailableDate, blackouts ⊂ bookableDays).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Plus, Save, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  EmptyState,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  useExamDateConfig,
  useSetExamDateConfig,
} from '../api/admission-setup.queries';

export function ExamDatesPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: config } = useExamDateConfig(cycle.id);
  const setMut = useSetExamDateConfig();

  const [firstAvailable, setFirstAvailable] = useState<Date | null>(null);
  const [bookableDays, setBookableDays] = useState<string[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [pickDay, setPickDay] = useState<Date | null>(null);

  useEffect(() => {
    if (config) {
      setFirstAvailable(new Date(config.firstAvailableDate));
      setBookableDays(config.bookableDays);
      setBlackoutDates(config.blackoutDates);
    } else {
      setFirstAvailable(new Date(cycle.openDate));
      setBookableDays([]);
      setBlackoutDates([]);
    }
  }, [config, cycle]);

  const sortedDays = useMemo(() => [...bookableDays].sort(), [bookableDays]);

  const addDay = (): void => {
    if (!pickDay) return;
    const iso = pickDay.toISOString().slice(0, 10);
    if (bookableDays.includes(iso)) {
      toast('هذا اليوم مضاف بالفعل', 'warning');
      return;
    }
    setBookableDays((prev) => [...prev, iso]);
    setPickDay(null);
  };

  const removeDay = (iso: string): void => {
    setBookableDays((prev) => prev.filter((d) => d !== iso));
    setBlackoutDates((prev) => prev.filter((d) => d !== iso));
  };

  const toggleBlackout = (iso: string): void => {
    setBlackoutDates((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]));
  };

  const save = (): void => {
    if (!canWrite || !firstAvailable) return;
    setMut.mutate(
      {
        cycleId: cycle.id,
        firstAvailableDate: firstAvailable.toISOString(),
        bookableDays,
        blackoutDates,
      },
      {
        onSuccess: () => toast('تم حفظ مواعيد الاختبارات', 'success'),
        onError: (err) => toast((err).message, 'danger'),
      },
    );
  };

  const dirty =
    !config ||
    (firstAvailable?.toISOString() ?? '') !== config.firstAvailableDate ||
    JSON.stringify([...bookableDays].sort()) !== JSON.stringify([...config.bookableDays].sort()) ||
    JSON.stringify([...blackoutDates].sort()) !== JSON.stringify([...config.blackoutDates].sort());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="مواعيد الاختبارات"
        subtitle="أول ميعاد متاح، أيام التقديم، وأيام الإجازة لهذه الدورة."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
            onClick={save}
            disabled={!canWrite || !dirty || !firstAvailable || bookableDays.length === 0}
            isLoading={setMut.isPending}
          >
            حفظ المواعيد
          </Button>
        }
      />
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <DatePicker
            label="أول ميعاد متاح"
            value={firstAvailable}
            onChange={setFirstAvailable}
            disabled={!canWrite}
          />
          <div className="flex items-end gap-2">
            <DatePicker
              label="إضافة يوم تقديم"
              value={pickDay}
              onChange={setPickDay}
              disabled={!canWrite}
            />
            <Button
              variant="secondary"
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
              onClick={addDay}
              disabled={!canWrite || !pickDay}
            >
              إضافة
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <header className="mb-3 flex items-center gap-2">
          <CalendarPlus size={16} strokeWidth={1.75} className="text-teal-600" />
          <h3 className="font-ar-display text-md font-bold text-ink-900">
            أيام التقديم المختارة ({sortedDays.length})
          </h3>
        </header>
        {sortedDays.length === 0 ? (
          <p className="text-sm text-ink-500">لم يتم إضافة أيام بعد. استخدم الحقل أعلاه لإضافة أول يوم.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {sortedDays.map((iso) => {
              const blackout = blackoutDates.includes(iso);
              return (
                <li key={iso} className="flex items-center justify-between py-2">
                  <span className="font-mono text-sm text-ink-700" dir="ltr">{fmtDate(iso, 'short')}</span>
                  <div className="flex items-center gap-2">
                    {blackout ? (
                      <Badge tone="warning">يوم إجازة</Badge>
                    ) : (
                      <Badge tone="neutral">يوم تقديم</Badge>
                    )}
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => toggleBlackout(iso)}>
                          {blackout ? 'إلغاء الإجازة' : 'تعيين كإجازة'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
                          onClick={() => removeDay(iso)}
                        >
                          حذف
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب اختيار دورة قبول"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}
