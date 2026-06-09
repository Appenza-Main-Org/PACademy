import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Cpu, Fingerprint, Pause, Play, Plug, RefreshCw, Server, Users, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  toast,
} from '@/shared/components';
import { biometricService, type ZkTestResult } from '../api/biometric.service';

/**
 * BiometricZkDirectoryPage — live directory pulled straight from the ZKBioTime
 * platform: registered terminals (devices) and personnel (employees). Backed by
 * GET /api/biometric/zk/devices and /api/biometric/zk/employees, which require
 * Biometric:Mode=zkbiotime on the backend (otherwise 409 ZK_MODE_INACTIVE).
 *
 * @example
 * <Route path="zk-directory" element={<BiometricZkDirectoryPage />} />
 */
export function BiometricZkDirectoryPage(): JSX.Element {
  const devices = useQuery({
    queryKey: ['biometric', 'zk', 'devices'],
    queryFn: () => biometricService.getZkDevices(),
  });
  const employees = useQuery({
    queryKey: ['biometric', 'zk', 'employees'],
    queryFn: () => biometricService.getZkEmployees(1, 200),
  });

  const refetchAll = (): void => {
    void devices.refetch();
    void employees.refetch();
  };

  // Realtime identify feed — auto-refreshes every 3s while `live` is on.
  const [live, setLive] = useState(true);
  const feed = useQuery({
    queryKey: ['biometric', 'zk', 'recent-punches'],
    queryFn: () => biometricService.getZkRecentPunches(300, 25),
    refetchInterval: live ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  const punches = feed.data?.data ?? [];

  return (
    <div className="space-y-6">
      <ZkConfigCard
        onSaved={() => {
          void devices.refetch();
          void employees.refetch();
          void feed.refetch();
        }}
      />
      <PageHeader
        title="أجهزة ومستخدمو ZKBioTime"
        subtitle="قائمة مباشرة بالأجهزة (الترمينالات) والأفراد المسجلين على منظومة ZKBioTime"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={refetchAll}
            disabled={devices.isFetching || employees.isFetching}
          >
            <RefreshCw size={16} className="me-1.5" />
            تحديث
          </Button>
        }
      />

      {/* ── Realtime identify feed (1:N) ────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Fingerprint size={18} style={{ color: 'var(--accent-600)' }} />
              تحديد الهوية من الجهاز · مباشر
              {live && (
                <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-600">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  مباشر
                </span>
              )}
            </span>
          }
          subtitle="ضع البصمة أو الوجه على الجهاز — تظهر الهوية تلقائياً خلال ثوانٍ"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant={live ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setLive((v) => !v)}
              >
                {live ? <Pause size={16} className="me-1.5" /> : <Play size={16} className="me-1.5" />}
                {live ? 'إيقاف المباشر' : 'تشغيل المباشر'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void feed.refetch()}
                disabled={feed.isFetching}
              >
                <RefreshCw size={16} className={feed.isFetching ? 'animate-spin' : ''} />
              </Button>
            </div>
          }
        />
        <CardBody>
          {feed.isError ? (
            <div className="rounded-lg border border-terra-200 bg-terra-50 px-4 py-3 text-sm text-terra-700">
              {(feed.error as Error)?.message ?? 'تعذّر الاتصال بالجهاز'}
            </div>
          ) : !punches.length ? (
            <div className="rounded-lg border border-dashed border-gold-300 bg-gold-50 px-4 py-6 text-center text-sm text-gold-700">
              لا توجد بصمات حديثة. اطلب من المتقدم وضع البصمة على الجهاز — ستظهر هنا تلقائياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-2xs text-ink-500">
                    <th className="px-3 py-2 text-start font-medium">وقت القراءة</th>
                    <th className="px-3 py-2 text-start font-medium">كود الموظف</th>
                    <th className="px-3 py-2 text-start font-medium">الاسم</th>
                    <th className="px-3 py-2 text-start font-medium">طريقة التحقق</th>
                    <th className="px-3 py-2 text-start font-medium">البوابة</th>
                    <th className="px-3 py-2 text-start font-medium">الجهاز</th>
                    <th className="px-3 py-2 text-start font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {punches.map((p, i) => (
                    <tr
                      key={`${p.empCode}-${p.uploadTime}-${i}`}
                      className={i === 0 ? 'border-t border-ink-100 bg-accent-50/40' : 'border-t border-ink-100'}
                    >
                      <td className="px-3 py-2 text-xs text-ink-600">{p.uploadTime || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.empCode}</td>
                      <td className="px-3 py-2 font-medium text-ink-900">
                        {p.applicantName || p.deviceName || '—'}
                      </td>
                      <td className="px-3 py-2">{p.verifyTypeDisplay || String(p.verifyType ?? '')}</td>
                      <td className="px-3 py-2">{p.areaName || '—'}</td>
                      <td className="px-3 py-2 font-mono text-2xs text-ink-600">
                        {p.terminalAlias || p.terminalSn || '—'}
                        {p.terminalAlias && p.terminalSn ? (
                          <span className="block text-ink-400">{p.terminalSn}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {p.applicantId ? (
                          <Badge tone="success">متقدم مسجّل</Badge>
                        ) : (
                          <Badge tone="neutral">غير مرتبط بمتقدم</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Devices ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Cpu size={18} style={{ color: 'var(--accent-600)' }} />
              الأجهزة
            </span>
          }
          actions={
            devices.data ? <Badge tone="info">{devices.data.count} جهاز</Badge> : undefined
          }
        />
        <CardBody>
          {devices.isLoading ? (
            <LoadingState variant="table" />
          ) : devices.isError ? (
            <ErrorState
              title="تعذّر تحميل الأجهزة"
              description={(devices.error as Error)?.message ?? 'تأكد من تفعيل منظومة ZKBioTime'}
              onRetry={() => void devices.refetch()}
            />
          ) : !devices.data?.data.length ? (
            <EmptyState variant="generic" title="لا توجد أجهزة مسجلة" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-2xs text-ink-500">
                    <th className="px-3 py-2 text-start font-medium">#</th>
                    <th className="px-3 py-2 text-start font-medium">الرقم التسلسلي</th>
                    <th className="px-3 py-2 text-start font-medium">الاسم</th>
                    <th className="px-3 py-2 text-start font-medium">المنطقة</th>
                    <th className="px-3 py-2 text-start font-medium">المستخدمون</th>
                    <th className="px-3 py-2 text-start font-medium">البصمات / الوجوه</th>
                    <th className="px-3 py-2 text-start font-medium">آخر نشاط</th>
                    <th className="px-3 py-2 text-start font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.data.data.map((d, i) => (
                    <tr key={d.id} className="border-t border-ink-100">
                      <td className="px-3 py-2 tabular-nums text-ink-500">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{d.sn}</td>
                      <td className="px-3 py-2">{d.terminal_name || d.alias || '—'}</td>
                      <td className="px-3 py-2">{d.area_name || '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{d.user_count ?? 0}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {(d.fp_count ?? 0)} / {(d.face_count ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-600">{d.last_activity || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge tone={d.state === '1' ? 'success' : 'neutral'}>
                          {d.state === '1' ? 'متصل' : 'غير متصل'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Employees ───────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Users size={18} style={{ color: 'var(--accent-600)' }} />
              الأفراد المسجلون
            </span>
          }
          actions={
            employees.data ? <Badge tone="info">{employees.data.count} فرد</Badge> : undefined
          }
        />
        <CardBody>
          {employees.isLoading ? (
            <LoadingState variant="table" />
          ) : employees.isError ? (
            <ErrorState
              title="تعذّر تحميل الأفراد"
              description={(employees.error as Error)?.message ?? 'تأكد من تفعيل منظومة ZKBioTime'}
              onRetry={() => void employees.refetch()}
            />
          ) : !employees.data?.data.length ? (
            <EmptyState variant="generic" title="لا يوجد أفراد مسجلون على المنظومة" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-2xs text-ink-500">
                    <th className="px-3 py-2 text-start font-medium">#</th>
                    <th className="px-3 py-2 text-start font-medium">كود الموظف (الرقم القومي)</th>
                    <th className="px-3 py-2 text-start font-medium">الاسم</th>
                    <th className="px-3 py-2 text-start font-medium">القسم</th>
                    <th className="px-3 py-2 text-start font-medium">المنطقة</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.data.data.map((e, i) => (
                    <tr key={e.id} className="border-t border-ink-100">
                      <td className="px-3 py-2 tabular-nums text-ink-500">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{e.emp_code}</td>
                      <td className="px-3 py-2">
                        {[e.first_name, e.last_name].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-3 py-2">{e.department?.dept_name || '—'}</td>
                      <td className="px-3 py-2">
                        {(e.area ?? []).map((a) => a.area_name).filter(Boolean).join('، ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * ZkConfigCard — set the ZKBioTime server (host/port), credentials, and timezone
 * offset from the admin screen (persisted via /api/biometric/zk/config), plus a
 * one-click «اختبار الاتصال» (test connection).
 */
function ZkConfigCard({ onSaved }: { onSaved: () => void }): JSX.Element {
  const config = useQuery({
    queryKey: ['biometric', 'zk', 'config'],
    queryFn: () => biometricService.getZkConfig(),
    retry: false,
  });

  // Heartbeat — lightly pings the server every 10s to show live connection health.
  const heartbeat = useQuery({
    queryKey: ['biometric', 'zk', 'heartbeat'],
    queryFn: () => biometricService.getZkDevices(),
    refetchInterval: 10_000,
    retry: false,
  });
  const online = heartbeat.isSuccess && !heartbeat.isError;
  const heartbeatCount = heartbeat.data?.count ?? 0;

  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [offset, setOffset] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ZkTestResult | null>(null);

  useEffect(() => {
    const c = config.data;
    if (!c) return;
    if (c.baseUrl) {
      try {
        const u = new URL(c.baseUrl);
        setHost(u.hostname);
        setPort(u.port || '80');
      } catch {
        /* ignore malformed url */
      }
    }
    setUsername(c.username ?? '');
    setOffset(c.serverTimeUtcOffsetHours ?? '0');
    setPasswordSet(Boolean(c.passwordSet));
  }, [config.data]);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await biometricService.saveZkConfig({
        BaseUrl: `http://${host.trim()}:${port.trim()}`,
        Username: username.trim(),
        ServerTimeUtcOffsetHours: offset.trim(),
        ...(password.trim() ? { Password: password.trim() } : {}),
      });
      toast('تم حفظ إعدادات الاتصال', 'success');
      setPassword('');
      void config.refetch();
      onSaved();
    } catch (e) {
      toast((e as Error)?.message ?? 'تعذّر الحفظ', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (): Promise<void> => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await biometricService.testZkConnection());
    } catch (e) {
      setTest({ ok: false, deviceCount: 0, message: (e as Error)?.message ?? 'تعذّر الاتصال' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Server size={18} style={{ color: 'var(--accent-600)' }} />
            إعدادات الاتصال بمنظومة ZKBioTime
          </span>
        }
        subtitle="عنوان الخادم والمنفذ وبيانات الدخول — تُحفظ في النظام بدون إعادة تشغيل"
        actions={
          <div className="flex items-center gap-2">
            {config.data?.source && (
              <Badge tone="neutral">{config.data.source === 'database' ? 'محفوظة بالنظام' : 'من ملف الإعداد'}</Badge>
            )}
            <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? 'إخفاء' : 'تعديل'}
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {/* Live heartbeat + test button */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {online && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${
                  online ? 'bg-emerald-500' : heartbeat.isError ? 'bg-terra-500' : 'bg-ink-300'
                }`}
              />
            </span>
            <div className="leading-tight">
              <p
                className={`text-sm font-bold ${
                  online ? 'text-emerald-700' : heartbeat.isError ? 'text-terra-700' : 'text-ink-500'
                }`}
              >
                {online ? `الخادم متصل · ${heartbeatCount} جهاز` : heartbeat.isError ? 'الخادم غير متصل' : 'جارٍ فحص الاتصال…'}
              </p>
              <p className="font-mono text-2xs text-ink-400" dir="ltr">
                {config.data?.baseUrl ?? '—'}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={testing}>
            <Plug size={16} className={testing ? 'me-1.5 animate-pulse' : 'me-1.5'} />
            {testing ? 'جارٍ الاختبار…' : 'اختبار الاتصال'}
          </Button>
        </div>
        {test && (
          <div
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
              test.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-terra-200 bg-terra-50 text-terra-700'
            }`}
          >
            {test.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {test.message}
          </div>
        )}
        {open && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="عنوان الخادم (IP)" dir="ltr" value={host} onChange={(e) => setHost(e.target.value)} />
            <Input label="المنفذ" dir="ltr" value={port} onChange={(e) => setPort(e.target.value)} />
            <Input label="اسم المستخدم" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input
              label="كلمة المرور"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={passwordSet ? '•••••• (محفوظة — اتركها فارغة للإبقاء)' : ''}
            />
            <Input
              label="فرق توقيت الخادم (ساعات)"
              dir="ltr"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
            />
            <div className="flex items-end justify-end">
              <Button variant="primary" onClick={() => void save()} isLoading={busy} disabled={!host.trim() || !port.trim()}>
                حفظ
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
