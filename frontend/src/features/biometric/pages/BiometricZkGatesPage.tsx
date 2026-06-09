import { useQuery } from '@tanstack/react-query';
import { Cpu, DoorOpen, RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import { biometricService, type ZkDevice, type ZkEmployee } from '../api/biometric.service';

/**
 * BiometricZkGatesPage — active devices grouped by gate (area), each showing the
 * applicants enrolled on it and its live connection status. Devices and people
 * come from the ZKBioTime directory; an employee belongs to a device when they
 * share the device's area id.
 *
 * @example
 * <Route path="zk-gates" element={<BiometricZkGatesPage />} />
 */
export function BiometricZkGatesPage(): JSX.Element {
  const devices = useQuery({
    queryKey: ['biometric', 'zk', 'devices', 'gates'],
    queryFn: () => biometricService.getZkDevices(),
    refetchInterval: 10_000,
  });
  const employees = useQuery({
    queryKey: ['biometric', 'zk', 'employees', 'gates'],
    queryFn: () => biometricService.getZkEmployees(1, 500),
    refetchInterval: 10_000,
  });

  const refetchAll = (): void => {
    void devices.refetch();
    void employees.refetch();
  };

  const allEmployees = employees.data?.data ?? [];
  const deviceList = [...(devices.data?.data ?? [])].sort((a, b) =>
    a.state === b.state ? 0 : a.state === '1' ? -1 : 1,
  );

  const connectedCount = deviceList.filter((d) => d.state === '1').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="الأجهزة والبوابات"
        subtitle="الأجهزة النشطة وحالة اتصالها، والبوابة (المنطقة) لكل جهاز، والمتقدمون المسجلون عليه"
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={connectedCount > 0 ? 'success' : 'neutral'}>
              {connectedCount} متصل من {deviceList.length}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={refetchAll}
              disabled={devices.isFetching || employees.isFetching}
            >
              <RefreshCw size={16} className={devices.isFetching ? 'me-1.5 animate-spin' : 'me-1.5'} />
              تحديث
            </Button>
          </div>
        }
      />

      {devices.isLoading ? (
        <LoadingState variant="card-grid" />
      ) : devices.isError ? (
        <ErrorState
          title="تعذّر تحميل الأجهزة"
          description={(devices.error as Error)?.message ?? 'تأكد من تفعيل منظومة ZKBioTime'}
          onRetry={() => void devices.refetch()}
        />
      ) : !deviceList.length ? (
        <EmptyState variant="generic" title="لا توجد أجهزة مسجلة" />
      ) : (
        deviceList.map((device) => (
          <DeviceGateCard key={device.id} device={device} employees={allEmployees} />
        ))
      )}
    </div>
  );
}

function DeviceGateCard({ device, employees }: { device: ZkDevice; employees: ZkEmployee[] }): JSX.Element {
  const areaId = (device.area as { id?: number } | undefined)?.id ?? null;
  const onDevice = employees.filter((e) => (e.area ?? []).some((a) => a.id === areaId));
  const connected = device.state === '1';

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Cpu size={18} style={{ color: 'var(--accent-600)' }} />
            {device.terminal_name || device.alias || device.sn}
            <span className="font-mono text-2xs text-ink-400">{device.sn}</span>
            <Badge tone="info">
              <DoorOpen size={11} className="me-1 inline-block" />
              {device.area_name || 'بدون بوابة'}
            </Badge>
            <Badge tone={connected ? 'success' : 'neutral'}>{connected ? 'متصل' : 'غير متصل'}</Badge>
          </span>
        }
        actions={<Badge tone="neutral">{onDevice.length} متقدم</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="البوابة / المنطقة" value={device.area_name || '—'} />
          <Metric label="آخر نشاط" value={device.last_activity || '—'} />
          <Metric label="البصمات / الوجوه" value={`${device.fp_count ?? 0} / ${device.face_count ?? 0}`} />
          <Metric label="عدد المستخدمين" value={String(device.user_count ?? onDevice.length)} />
        </div>

        {!onDevice.length ? (
          <p className="rounded-md border border-dashed border-ink-200 px-4 py-4 text-center text-sm text-ink-500">
            لا يوجد متقدمون مسجّلون على هذا الجهاز.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-2xs text-ink-500">
                  <th className="px-3 py-2 text-start font-medium">#</th>
                  <th className="px-3 py-2 text-start font-medium">كود المتقدم</th>
                  <th className="px-3 py-2 text-start font-medium">الاسم</th>
                  <th className="px-3 py-2 text-start font-medium">البصمة</th>
                  <th className="px-3 py-2 text-start font-medium">الوجه</th>
                </tr>
              </thead>
              <tbody>
                {onDevice.map((e, i) => {
                  const fpCount = matchFingerCount(e.fingerprint);
                  const hasFace = hasFaceBio(e);
                  return (
                    <tr key={e.id} className="border-t border-ink-100">
                      <td className="px-3 py-2 tabular-nums text-ink-500">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{e.emp_code}</td>
                      <td className="px-3 py-2 font-medium text-ink-900">
                        {[e.first_name, e.last_name].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={fpCount > 0 ? 'success' : 'neutral'}>
                          {fpCount > 0 ? `مسجّلة (${fingerLabel(fpCount)})` : 'غير مسجّلة'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={hasFace ? 'success' : 'neutral'}>{hasFace ? 'مسجّلة' : 'غير مسجّلة'}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">
      <p className="text-2xs text-ink-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-ink-900">{value}</p>
    </div>
  );
}

/** Arabic-correct finger count label, e.g. 1 → "إصبع واحد", 5 → "5 أصابع". */
function fingerLabel(n: number): string {
  if (n === 1) return 'إصبع واحد';
  if (n === 2) return 'إصبعان';
  if (n >= 3 && n <= 10) return `${n} أصابع`;
  return `${n} إصبع`;
}

function matchFingerCount(fingerprint?: string | null): number {
  const m = String(fingerprint ?? '').match(/:(\d+)/);
  if (m) return Number(m[1]);
  return fingerprint && String(fingerprint).trim() !== '' && String(fingerprint).trim() !== '-' ? 1 : 0;
}

function hasFaceBio(e: ZkEmployee): boolean {
  const present = (v?: string | null): boolean => Boolean(v && String(v).trim() !== '' && String(v).trim() !== '-');
  return present(e.face) || present(e.vl_face) || Number(e.vl_face_photo ?? 0) > 0;
}
