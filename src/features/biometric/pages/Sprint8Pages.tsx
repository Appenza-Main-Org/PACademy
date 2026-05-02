/**
 * Sprint 8 — Biometric verification + monitoring.
 * Source: KARASA §8 sections B, C.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Camera, Fingerprint, ScanLine, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { LineChart } from '@/shared/components/charts';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { biometricService } from '../api/biometric.service';
import { date as fmtDate, num } from '@/shared/lib/format';

export function BiometricVerifyOpsPage(): JSX.Element {
  const [method, setMethod] = useState<'face' | 'fingerprint' | 'barcode'>('face');
  const [station, setStation] = useState<'gate' | 'exam-room' | 'committee'>('gate');
  const [nationalId, setNationalId] = useState('29812345678901');
  const [result, setResult] = useState<Awaited<ReturnType<typeof biometricService.verify>> | null>(null);

  return (
    <CenteredShell>
      <PageHeader
        title="بوابة التحقق البيومتري"
        subtitle="تحقق فوري من هوية المتقدمين عند الدخول والخروج وقاعات الاختبار"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader title="إعدادات المحطة" />
          <div className="flex flex-col gap-3">
            <Select label="المحطة" value={station} onChange={(e) => setStation(e.target.value as typeof station)} options={[
              { value: 'gate', label: 'البوابة الرئيسية' },
              { value: 'exam-room', label: 'قاعة الاختبارات' },
              { value: 'committee', label: 'اللجنة' },
            ]} />
            <Select label="طريقة التحقق" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} options={[
              { value: 'face', label: 'الوجه' },
              { value: 'fingerprint', label: 'البصمة' },
              { value: 'barcode', label: 'الباركود' },
            ]} />
            <Input label="الرقم القومي / الباركود" dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            <Button
              variant="primary"
              size="lg"
              leadingIcon={method === 'face' ? <Camera size={14} strokeWidth={1.75} /> : method === 'fingerprint' ? <Fingerprint size={14} strokeWidth={1.75} /> : <ScanLine size={14} strokeWidth={1.75} />}
              onClick={async () => {
                const r = await biometricService.verify({ nationalId, station, method });
                setResult(r);
                if (r.ok) toast(`تطابق · ${Math.round((r.matchScore ?? 0) * 100)}%`, 'success');
                else toast(r.reason ?? 'لم يتطابق', 'danger');
              }}
            >
              ابدأ التحقق
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="نتيجة آخر تحقق" />
          {!result && <EmptyState variant="generic" title="ابدأ التحقق لاستعراض نتيجة" />}
          {result && result.applicant && (
            <div className="flex items-start gap-4 rounded-lg border border-border-subtle bg-ink-50 p-4">
              <Avatar name={result.applicant.name} size="xl" />
              <div className="flex-1">
                <p className="font-bold text-ink-900">{result.applicant.name}</p>
                <p className="text-2xs text-ink-500 font-mono" dir="ltr">{result.applicant.id} · {result.applicant.nationalId}</p>
                <div className="mt-3 flex items-center gap-2">
                  {result.matchScore && result.matchScore >= 0.85 ? (
                    <Badge tone="success" icon={<ShieldCheck size={11} strokeWidth={1.75} />}>
                      تطابق · {Math.round(result.matchScore * 100)}%
                    </Badge>
                  ) : (
                    <Badge tone="danger" icon={<ShieldAlert size={11} strokeWidth={1.75} />}>تأكيد يدوي مطلوب</Badge>
                  )}
                  <span className="text-2xs text-ink-500">{fmtDate(result.timestamp, 'short')}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="ملاحظة الخصوصية" />
        <p className="text-sm text-ink-500">
          بياناتك البيومترية مُشفّرة ومحفوظة كقوالب، ولا تُخزَّن صور أو بصمات خام. كل عمليات
          التحقق تُسجَّل في سجل العمليات (audit) ويمكن للمتقدم طلب نسخة من سجل الأنشطة.
        </p>
      </Card>
    </CenteredShell>
  );
}

export function BiometricMonitoringPage(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['biometric', 'monitoring'], queryFn: () => biometricService.monitoring() });

  return (
    <CenteredShell>
      <PageHeader title="مراقبة العمليات البيومترية" subtitle="نظرة فورية على العمليات بكل المحطات خلال آخر 24 ساعة" />

      <div className="grid gap-5 lg:grid-cols-3">
        {(['gate', 'exam-room', 'committee'] as const).map((s) => (
          <Card key={s}>
            <CardHeader title={s === 'gate' ? 'البوابة الرئيسية' : s === 'exam-room' ? 'قاعات الاختبارات' : 'اللجنة'} subtitle="آخر 24 ساعة" />
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold font-numeric tnum text-ink-900">{num(data?.perStation?.[s]?.total ?? 0)}</span>
              <span className="text-2xs text-ink-500">عملية</span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-2xs">
              <Badge tone="success">تطابق {data?.perStation?.[s]?.match ?? 0}</Badge>
              <Badge tone="danger">فشل {data?.perStation?.[s]?.failed ?? 0}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="حركة آخر 24 ساعة" subtitle="عدد العمليات لكل ساعة" />
        {isLoading ? <p className="text-sm text-ink-500">جارٍ التحميل…</p> : (
          <LineChart
            height={200}
            data={(data?.last24h ?? []).slice().reverse().map((d) => ({ label: new Date(d.ts).getHours().toString(), value: d.count }))}
            color="var(--accent-500)"
          />
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="آخر العمليات الفاشلة" subtitle="تحتاج تأكيد يدوي" />
        {!data?.recentFailures || data.recentFailures.length === 0 ? (
          <p className="text-sm text-ink-500">لا توجد عمليات فاشلة حالياً.</p>
        ) : (
          <ol className="flex flex-col">
            {data.recentFailures.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 border-b border-border-subtle py-2 last:border-b-0 text-sm">
                <div className="flex items-center gap-3">
                  <Activity size={14} strokeWidth={1.75} className="text-terra-700" aria-hidden />
                  <span className="font-mono" dir="ltr">{f.applicantId}</span>
                  <Badge tone="neutral">{f.station}</Badge>
                </div>
                <div className="flex items-center gap-2 text-2xs text-ink-500">
                  <span>تطابق {f.confidence}%</span>
                  <span>·</span>
                  <span>{fmtDate(f.ts, 'rel')}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </CenteredShell>
  );
}
