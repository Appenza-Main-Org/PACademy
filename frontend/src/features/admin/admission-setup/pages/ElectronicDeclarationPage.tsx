/**
 * Step 15 — الإقرار الإلكتروني (NEW).
 * Long-text editor + version log + publish action. Save bumps the version
 * number and creates a new draft; publish flips `publishedAt` so applicants
 * see it on Stage 9. Preview pane mirrors the applicant-side rendering.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Save, Send } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  EmptyState,
  PageHeader,
  Textarea,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  useElectronicDeclaration,
  usePublishDeclaration,
  useSetDeclaration,
} from '../api/admission-setup.queries';

export function ElectronicDeclarationPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: current } = useElectronicDeclaration(cycle.id);
  const setMut = useSetDeclaration();
  const publishMut = usePublishDeclaration();

  const [bodyAr, setBodyAr] = useState(current?.bodyAr ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState<Date | null>(
    current?.effectiveFrom ? new Date(current.effectiveFrom) : new Date(),
  );

  useEffect(() => {
    setBodyAr(current?.bodyAr ?? '');
    setEffectiveFrom(current?.effectiveFrom ? new Date(current.effectiveFrom) : new Date());
  }, [current]);

  const dirty =
    bodyAr !== (current?.bodyAr ?? '') ||
    (effectiveFrom?.toISOString() ?? '') !== (current?.effectiveFrom ?? '');

  const save = (): void => {
    if (!canWrite || !effectiveFrom) return;
    setMut.mutate(
      { cycleId: cycle.id, bodyAr: bodyAr.trim(), effectiveFrom: effectiveFrom.toISOString() },
      {
        onSuccess: (next) =>
          toast(`تم حفظ النسخة رقم ${toEasternArabicNumerals(next.version)}`, 'success'),
        onError: (err) => toast((err).message, 'danger'),
      },
    );
  };

  const publish = (): void => {
    if (!canWrite || !current) return;
    publishMut.mutate(current.id, {
      onSuccess: () => toast('تم نشر الإقرار للمتقدمين', 'success'),
      onError: (err) => toast((err).message, 'danger'),
    });
  };

  const isPublished = Boolean(current?.publishedAt);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الإقرار الإلكتروني"
        subtitle={
          current
            ? `النسخة الحالية: ${toEasternArabicNumerals(current.version)} ${isPublished ? '— منشور' : '— مسودة'}`
            : 'لم يتم إنشاء أي إقرار بعد لهذه الدورة.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={save}
              disabled={!canWrite || !dirty || !bodyAr.trim()}
              isLoading={setMut.isPending}
            >
              حفظ كنسخة جديدة
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Send size={14} strokeWidth={1.75} />}
              onClick={publish}
              disabled={!canWrite || !current || isPublished || dirty}
              isLoading={publishMut.isPending}
            >
              نشر
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <Textarea
            label="نص الإقرار"
            value={bodyAr}
            onChange={(e) => setBodyAr(e.target.value)}
            rows={14}
            disabled={!canWrite}
          />
          <div className="flex flex-col gap-2">
            <DatePicker
              label="تاريخ السريان"
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              disabled={!canWrite}
            />
            {current && (
              <div className="rounded-md border border-border-subtle bg-ink-50 p-3 text-2xs">
                <p className="text-ink-700">
                  <span className="font-medium">آخر حفظ: </span>
                  {fmtDate(current.createdAt, 'full')}
                </p>
                {isPublished && (
                  <p className="mt-1 text-success">
                    <span className="font-medium">تاريخ النشر: </span>
                    {fmtDate(current.publishedAt, 'full')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <header className="mb-3 flex items-center gap-2">
          <Eye size={16} strokeWidth={1.75} className="text-teal-600" />
          <h3 className="font-ar-display text-md font-bold text-ink-900">
            معاينة (كما يظهر للمتقدم في مرحلة طباعة البطاقة)
          </h3>
          <Badge tone={isPublished ? 'success' : 'warning'}>
            {isPublished ? 'منشور' : 'مسودة'}
          </Badge>
        </header>
        <article className="whitespace-pre-wrap rounded-md border border-border-subtle bg-surface-card p-4 text-sm leading-relaxed text-ink-900">
          {bodyAr.trim() || (
            <span className="text-ink-500">— نص الإقرار سيظهر هنا بعد كتابته —</span>
          )}
        </article>
      </Card>

      <Link to={ROUTES.applicant + '/print-card'} className="text-2xs text-teal-600 hover:underline">
        فتح صفحة طباعة البطاقة (المتقدم) →
      </Link>
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
