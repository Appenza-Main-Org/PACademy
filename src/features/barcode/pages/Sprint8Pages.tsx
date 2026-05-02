/**
 * Sprint 8 — Barcode scanner + replacement.
 * Source: KARASA §7 sections B, C, E.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, History, RefreshCw, ScanLine } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { date as fmtDate } from '@/shared/lib/format';
import { barcodeService } from '../api/barcode.service';
import type { BarcodeScan } from '@/shared/types/domain';

export function BarcodeScannerPage(): JSX.Element {
  const [code, setCode] = useState('');
  const [station, setStation] = useState('البوابة الرئيسية');
  const [action, setAction] = useState<BarcodeScan['action']>('attendance');
  const [result, setResult] = useState<{ scan: BarcodeScan; duplicate: boolean } | null>(null);

  const scanMut = useMutation({
    mutationFn: () => barcodeService.scan({ code, scannedBy: 'U-006', station, action }),
    onSuccess: (r) => {
      setResult(r);
      if (r.duplicate) toast('تنبيه: مسح مكرر خلال آخر 10 ثوانٍ — يحتاج تأكيد', 'warning');
      else toast('تم تسجيل المسح', 'success');
    },
  });

  return (
    <CenteredShell>
      <PageHeader
        title="ماسح الباركود"
        subtitle="مسح الباركود لتسجيل حضور المتقدم أو دخول/خروج البوابة أو الإحالة لمحطة أخرى"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader title="مسح يدوي" subtitle="يستخدم عند تعذّر استخدام الكاميرا" />
          <div className="flex flex-col gap-3">
            <Input label="رمز الباركود" required dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="26-CAI-00001234" />
            <Select label="المحطة" value={station} onChange={(e) => setStation(e.target.value)} options={[
              { value: 'البوابة الرئيسية', label: 'البوابة الرئيسية' },
              { value: 'لجنة طلبة 1', label: 'لجنة طلبة 1' },
              { value: 'القومسيون الطبي', label: 'القومسيون الطبي' },
              { value: 'قاعة الاختبارات', label: 'قاعة الاختبارات' },
            ]} />
            <Select label="نوع الإجراء" value={action} onChange={(e) => setAction(e.target.value as BarcodeScan['action'])} options={[
              { value: 'attendance', label: 'تسجيل حضور' },
              { value: 'gate-in', label: 'دخول بوابة' },
              { value: 'gate-out', label: 'خروج بوابة' },
              { value: 'forward', label: 'إحالة لمحطة أخرى' },
            ]} />
            <Button variant="primary" size="lg" leadingIcon={<ScanLine size={14} strokeWidth={1.75} />} isLoading={scanMut.isPending} onClick={() => scanMut.mutate()}>
              تسجيل المسح
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="ماسح كاميرا" subtitle="حسب توافر كاميرا الجهاز (متاح على الـ tablet)" />
          <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-strong bg-ink-50 p-6 text-center">
            <Camera size={36} strokeWidth={1.75} className="text-ink-500" />
            <p className="text-sm text-ink-500">سيتم تفعيل الكاميرا تلقائياً عند فتح التطبيق على جهاز يدعم getUserMedia.</p>
            <p className="text-2xs text-ink-400">التكامل الكامل مع zxing/MediaPipe جزء من Sprint 10 (تشغيل أجهزة المسح الفعلية).</p>
          </div>
        </Card>
      </div>

      {result?.scan && (
        <Card className="mt-6">
          <CardHeader title="آخر مسح" subtitle={fmtDate(result.scan.ts, 'short')} actions={result.duplicate ? <Badge tone="warning">مكرر</Badge> : <Badge tone="success">تم التسجيل</Badge>} />
          <div className="flex items-center gap-3">
            <Avatar name={result.scan.applicantId} size="lg" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-900">المتقدم: <span className="font-mono" dir="ltr">{result.scan.applicantId}</span></p>
              <p className="text-2xs text-ink-500">المحطة: {result.scan.station} · الإجراء: {ACTION_LABEL[result.scan.action]}</p>
            </div>
          </div>
        </Card>
      )}
    </CenteredShell>
  );
}

const ACTION_LABEL: Record<BarcodeScan['action'], string> = {
  attendance: 'تسجيل حضور',
  'gate-in': 'دخول البوابة',
  'gate-out': 'خروج البوابة',
  forward: 'إحالة لمحطة',
};

export function BarcodeReplacementPage(): JSX.Element {
  const qc = useQueryClient();
  const [applicantId, setApplicantId] = useState('APP-2026000005');
  const [reason, setReason] = useState('فقد البطاقة الأصلية');

  const replaceMut = useMutation({
    mutationFn: () => barcodeService.replace(applicantId, reason),
    onSuccess: (r) => {
      toast(`تم إصدار باركود بديل: ${r.code}`, 'success');
      qc.invalidateQueries({ queryKey: ['barcode'] });
    },
  });

  return (
    <CenteredShell>
      <PageHeader title="إصدار بدل فاقد" subtitle="إلغاء الباركود الحالي وإصدار باركود جديد للمتقدم" />
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="رقم المتقدم" required dir="ltr" value={applicantId} onChange={(e) => setApplicantId(e.target.value)} />
          <Input label="السبب" required value={reason} onChange={(e) => setReason(e.target.value)} />
          <Textarea label="ملاحظات" placeholder="أي ملاحظات إضافية تُحفظ في سجل العمليات" containerClassName="md:col-span-2" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" leadingIcon={<RefreshCw size={14} strokeWidth={1.75} />} isLoading={replaceMut.isPending} onClick={() => replaceMut.mutate()}>
            إصدار بدل فاقد
          </Button>
        </div>
      </Card>
    </CenteredShell>
  );
}

export function BarcodeScansHistoryPage(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['barcode', 'scans'], queryFn: () => barcodeService.listScans() });

  const columns: DataTableColumn<BarcodeScan>[] = [
    { key: 'id', label: 'الرقم', render: (s) => <span className="font-mono" dir="ltr">{s.id}</span> },
    { key: 'applicant', label: 'المتقدم', render: (s) => <span className="font-mono" dir="ltr">{s.applicantId}</span> },
    { key: 'station', label: 'المحطة', render: (s) => s.station },
    { key: 'action', label: 'الإجراء', render: (s) => ACTION_LABEL[s.action] },
    { key: 'ts', label: 'الوقت', render: (s) => <span className="text-2xs text-ink-500">{fmtDate(s.ts, 'rel')}</span> },
    { key: 'scannedBy', label: 'بواسطة', render: (s) => s.scannedBy },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="سجل عمليات المسح"
        subtitle="كل عملية مسح تُسجَّل مع المحطة والإجراء والمستخدم"
        actions={<Badge tone="info"><History size={11} strokeWidth={1.75} className="me-1 inline-block" /> {data?.length ?? 0} عملية</Badge>}
      />
      <Card>
        <DataTable data={data ?? []} columns={columns} rowKey={(s) => s.id} loading={isLoading} empty={<EmptyState variant="generic" title="لا توجد عمليات مسح" />} zebraStripes density="compact" />
      </Card>
    </CenteredShell>
  );
}
