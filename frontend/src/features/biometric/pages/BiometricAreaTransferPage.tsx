import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, MoveRight, RefreshCw, Users } from 'lucide-react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { biometricService, type AreaMoveCandidate } from '../api/biometric.service';

const EXAM_RESULTS = ['ناجح', 'راسب', 'لم تظهر'] as const;
const ALL = '';

/**
 * BiometricAreaTransferPage — bulk-move applicants between ZKBioTime areas
 * (device zones). Filter the cohort by committee and current exam result,
 * multi-select, pick a target area, and reassign in one call via the platform's
 * adjust_area endpoint. Candidates are PACademy-sourced; the areas picker + move
 * require a configured ZKBioTime connection (otherwise the API returns 409).
 *
 * @example
 * <Route path="zk-area-transfer" element={<BiometricAreaTransferPage />} />
 */
export function BiometricAreaTransferPage(): JSX.Element {
  const qc = useQueryClient();
  const [committee, setCommittee] = useState(ALL);
  const [examResult, setExamResult] = useState(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetArea, setTargetArea] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const candidates = useQuery({
    queryKey: ['biometric', 'area-move', 'candidates'],
    queryFn: () => biometricService.getAreaMoveCandidates(),
  });
  const areas = useQuery({
    queryKey: ['biometric', 'zk', 'areas'],
    queryFn: () => biometricService.getZkAreas(),
    retry: false,
  });

  const rows = candidates.data ?? [];

  // Committee options derived from the full candidate set (distinct, sorted).
  const committeeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.committee) set.add(r.committee);
    return [{ value: ALL, label: 'كل اللجان' }, ...[...set].sort((a, b) => a.localeCompare(b, 'ar')).map((c) => ({ value: c, label: c }))];
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (!committee || r.committee === committee) && (!examResult || r.currentExamResult === examResult),
      ),
    [rows, committee, examResult],
  );

  const areaOptions = useMemo(
    () => [
      { value: '', label: '— اختر المنطقة المستهدفة —' },
      ...(areas.data?.data ?? []).map((a) => ({
        value: String(a.id),
        label: a.area_name || a.area_code || `#${a.id}`,
      })),
    ],
    [areas.data],
  );

  const selectedInView = filtered.filter((r) => selected.has(r.applicantId));
  const allInViewSelected = filtered.length > 0 && selectedInView.length === filtered.length;

  const toggleRow = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllInView = (): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allInViewSelected) filtered.forEach((r) => next.delete(r.applicantId));
      else filtered.forEach((r) => next.add(r.applicantId));
      return next;
    });
  };

  const move = useMutation({
    mutationFn: () =>
      biometricService.adjustZkArea({
        applicantIds: [...selected],
        areaId: Number(targetArea),
      }),
    onSuccess: (res) => {
      if (!res.ok && res.moved === 0) {
        toast(res.message ?? 'تعذّر النقل', 'warning');
      } else {
        const skippedNote = res.skipped.length ? ` · تم تخطي ${res.skipped.length} (غير مسجّل على المنظومة)` : '';
        toast(`تم نقل ${res.moved} متقدم إلى المنطقة المحددة${skippedNote}`, 'success');
      }
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['biometric', 'area-move', 'candidates'] });
    },
    onError: (e) => toast((e as Error)?.message ?? 'تعذّر تنفيذ النقل', 'danger'),
    onSettled: () => setConfirmOpen(false),
  });

  const targetAreaLabel = areaOptions.find((o) => o.value === targetArea)?.label ?? '';
  const canMove = selected.size > 0 && Boolean(targetArea);

  return (
    <div className="space-y-6">
      <PageHeader
        title="نقل المتقدمين بين المناطق"
        subtitle="نقل جماعي للمتقدمين بين مناطق أجهزة ZKBioTime — حدّد اللجنة ونتيجة الاختبار ثم اختر المنطقة المستهدفة"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void candidates.refetch();
              void areas.refetch();
            }}
            disabled={candidates.isFetching}
          >
            <RefreshCw size={16} className={candidates.isFetching ? 'me-1.5 animate-spin' : 'me-1.5'} />
            تحديث
          </Button>
        }
      />

      {/* ── Filters + move bar ──────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Filter size={18} style={{ color: 'var(--accent-600)' }} />
              التصفية والنقل
            </span>
          }
          subtitle="التصفية حسب اللجنة ونتيجة الاختبار"
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="اللجنة"
              options={committeeOptions}
              value={committee}
              onChange={(e) => setCommittee(e.target.value)}
            />
            <Select
              label="نتيجة الاختبار"
              options={[{ value: ALL, label: 'كل النتائج' }, ...EXAM_RESULTS.map((r) => ({ value: r, label: r }))]}
              value={examResult}
              onChange={(e) => setExamResult(e.target.value)}
            />
            <Select
              label="المنطقة المستهدفة"
              options={areaOptions}
              value={targetArea}
              onChange={(e) => setTargetArea(e.target.value)}
              disabled={areas.isError || areas.isLoading}
            />
            <div className="flex items-end">
              <Button
                variant="primary"
                className="w-full"
                disabled={!canMove}
                onClick={() => setConfirmOpen(true)}
              >
                <MoveRight size={16} className="me-1.5 rtl:scale-x-[-1]" />
                نقل المحددين ({selected.size})
              </Button>
            </div>
          </div>
          {areas.isError && (
            <div className="rounded-lg border border-dashed border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-700">
              لم يتم ضبط اتصال منظومة ZKBioTime — اضبط عنوان الخادم وبيانات الدخول من شاشة «الأجهزة والأفراد» قبل تنفيذ النقل.
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Candidates table ────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Users size={18} style={{ color: 'var(--accent-600)' }} />
              المتقدمون
            </span>
          }
          actions={<Badge tone="info">{filtered.length} متقدم</Badge>}
        />
        <CardBody>
          {candidates.isLoading ? (
            <LoadingState variant="table" />
          ) : candidates.isError ? (
            <ErrorState
              title="تعذّر تحميل المتقدمين"
              description={(candidates.error as Error)?.message ?? 'حدث خطأ غير متوقع'}
              onRetry={() => void candidates.refetch()}
            />
          ) : !filtered.length ? (
            <EmptyState variant="generic" title="لا يوجد متقدمون مطابقون للتصفية" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-2xs text-ink-500">
                    <th className="px-3 py-2 text-start font-medium">
                      <input
                        type="checkbox"
                        aria-label="تحديد الكل"
                        checked={allInViewSelected}
                        onChange={toggleAllInView}
                      />
                    </th>
                    <th className="px-3 py-2 text-start font-medium">الاسم</th>
                    <th className="px-3 py-2 text-start font-medium">الرقم القومي</th>
                    <th className="px-3 py-2 text-start font-medium">اللجنة</th>
                    <th className="px-3 py-2 text-start font-medium">نتيجة الاختبار</th>
                    <th className="px-3 py-2 text-start font-medium">الحالة على المنظومة</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <CandidateRow
                      key={r.applicantId}
                      row={r}
                      checked={selected.has(r.applicantId)}
                      onToggle={() => toggleRow(r.applicantId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="تأكيد نقل المتقدمين"
        description={`سيتم نقل ${selected.size} متقدم إلى المنطقة «${targetAreaLabel}» على منظومة ZKBioTime. المتقدمون غير المسجّلين على المنظومة سيتم تخطّيهم.`}
        actionLabel="تأكيد النقل"
        tone="primary"
        onAction={() => move.mutate()}
        isActionLoading={move.isPending}
        actionLoadingLabel="جارٍ النقل…"
        isActionDisabled={!canMove}
      />
    </div>
  );
}

function CandidateRow({
  row,
  checked,
  onToggle,
}: {
  row: AreaMoveCandidate;
  checked: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <tr className="border-t border-ink-100">
      <td className="px-3 py-2">
        <input type="checkbox" aria-label={`تحديد ${row.name}`} checked={checked} onChange={onToggle} />
      </td>
      <td className="px-3 py-2 font-medium text-ink-900">{row.name || '—'}</td>
      <td className="px-3 py-2 font-mono text-xs">{row.nationalId || '—'}</td>
      <td className="px-3 py-2">{row.committee || '—'}</td>
      <td className="px-3 py-2">{row.currentExamResult || '—'}</td>
      <td className="px-3 py-2">
        {row.linked ? (
          <Badge tone="success">مسجّل على المنظومة</Badge>
        ) : (
          <Badge tone="neutral">يُرحّل عند النقل</Badge>
        )}
      </td>
    </tr>
  );
}
