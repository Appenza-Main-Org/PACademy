import { PageHeader, Card, CardHeader, CardBody, Badge } from '@/shared/components';
import { useAuthStore } from '@/features/auth';
import { LockPolicyCard } from '../components/auth/LockPolicyCard';

export function SettingsPage(): JSX.Element {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');

  return (
    <>
      <PageHeader title="الإعدادات العامة" subtitle="ضبط شروط القبول والتكاملات الخارجية" />

      <div className="grid grid-2">
        <Card>
          <CardHeader title="شروط التقديم" subtitle="السنة الحالية: 2026" />
          <CardBody>
            <div className="flex flex-col gap-3 text-sm">
              <SettingRow label="الحد الأدنى للمجموع" value="380 / 410" />
              <SettingRow label="الحد الأدنى للنسبة" value="92.7 %" />
              <SettingRow label="السن (ذكور)" value="17 — 21 سنة" />
              <SettingRow label="السن (إناث)" value="17 — 22 سنة" />
              <SettingRow label="الطول الأدنى (ذكور)" value="170 سم" />
              <SettingRow label="الطول الأدنى (إناث)" value="160 سم" />
              <SettingRow label="رسم التقديم" value="1500 ج.م" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="التكاملات الخارجية" subtitle="حالة الاتصال بالمنظومات الحكومية" />
          <CardBody>
            <div className="flex flex-col gap-3 text-sm">
              <IntegrationRow name="منصة التحقق الرقمي" ok />
              <IntegrationRow name="بوابة الدفع الإلكتروني" ok />
              <IntegrationRow name="منظومة الأحوال المدنية" ok />
              <IntegrationRow name="منظومة الثانوية العامة" ok />
              <IntegrationRow name="قطاع الأمن العام" pending />
              <IntegrationRow name="القطاع الطبي" ok />
            </div>
          </CardBody>
        </Card>
      </div>

      {isSuperAdmin && (
        <div className="mt-5">
          <LockPolicyCard />
        </div>
      )}
    </>
  );
}

function SettingRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value mono">{value}</span>
    </div>
  );
}

function IntegrationRow({ name, ok, pending }: { name: string; ok?: boolean; pending?: boolean }): JSX.Element {
  return (
    <div className="detail-row">
      <span className="detail-label">{name}</span>
      <span className="detail-value">
        {ok && <Badge tone="success">متصل ✓</Badge>}
        {pending && <Badge tone="warning">قيد التحقق</Badge>}
      </span>
    </div>
  );
}
