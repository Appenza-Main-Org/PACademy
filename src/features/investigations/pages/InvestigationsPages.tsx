import { useState } from 'react';
import { ShieldAlert, AlertTriangle, ShieldCheck, Hourglass } from 'lucide-react';
import { PageHeader, Card, CardBody, StatCard, Skeleton } from '@/shared/components';
import { useQuery } from '@tanstack/react-query';
import { investigationsService } from '../api/investigations.service';
import { date as fmtDate, num, shortName, maskNationalId } from '@/shared/lib/format';
import type { InvestigationStatus } from '@/shared/types/domain';
import { InvestigationBadge } from '@/shared/components/StatusBadge';

function useCases(filters: { status?: InvestigationStatus | 'all' }) {
  return useQuery({ queryKey: ['investigations', 'cases', filters], queryFn: () => investigationsService.getCases(filters) });
}
function useStats() {
  return useQuery({ queryKey: ['investigations', 'stats'], queryFn: () => investigationsService.getStats() });
}

function CasesTable({ filter }: { filter: 'all' | InvestigationStatus }): JSX.Element {
  const { data, isLoading } = useCases({ status: filter });
  if (isLoading) return <Skeleton height={220} />;
  if (!data || data.length === 0) return <div className="empty"><div className="empty-title">لا توجد قضايا</div></div>;
  return (
    <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
      <table className="table">
        <thead>
          <tr>
            <th>المتقدم</th>
            <th>الرقم القومي</th>
            <th>المحافظة</th>
            <th>المحقق</th>
            <th>الإحالة</th>
            <th>الاستلام</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.applicantId}>
              <td>
                <div className="font-semibold">{shortName(c.applicantName, 3)}</div>
                <div className="text-xs text-tertiary mono">{c.applicantId}</div>
              </td>
              <td className="mono">{maskNationalId(c.nationalId)}</td>
              <td>{c.governorate}</td>
              <td className="text-sm">{shortName(c.officer, 3)}</td>
              <td className="text-xs text-tertiary">{fmtDate(c.sentAt, 'short')}</td>
              <td className="text-xs text-tertiary">{c.receivedAt ? fmtDate(c.receivedAt, 'short') : '—'}</td>
              <td><InvestigationBadge status={c.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvestigationsCasesPage(): JSX.Element {
  const [filter, setFilter] = useState<'all' | InvestigationStatus>('all');
  const { data: stats } = useStats();
  return (
    <>
      <PageHeader title="ملفات التحريات" subtitle="جميع ملفات التحريات الجارية والمنتهية" />

      <div className="alert alert-warning mb-5">
        <ShieldAlert size={20} />
        <div className="alert-body">
          <div className="alert-title">معلومات سرية</div>
          <div>الرقم القومي مخفي جزئياً · لا يجوز تصدير هذه البيانات إلا بإذن أمين السر</div>
        </div>
      </div>

      <div className="grid grid-4 mb-6">
        <StatCard label="إجمالي القضايا" value={stats?.total ?? 0}    icon={<ShieldAlert size={18} />} iconBg="#FBD6D6" iconColor="#B82C2C" />
        <StatCard label="قيد الفحص"      value={stats?.pending ?? 0}  icon={<Hourglass size={18} />}   iconBg="#FBE9CC" iconColor="#B8770A" />
        <StatCard label="تم الإفراج"     value={stats?.cleared ?? 0}  icon={<ShieldCheck size={18} />} iconBg="#D7F0E1" iconColor="#1A8754" />
        <StatCard label="تم الإيقاف"     value={stats?.flagged ?? 0}  icon={<AlertTriangle size={18} />} iconBg="#FBD6D6" iconColor="#B82C2C" />
      </div>

      <Card>
        <CardBody>
          <div className="filters">
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | InvestigationStatus)}>
              <option value="all">كل الحالات</option>
              <option value="pending">قيد الفحص</option>
              <option value="cleared">تم الإفراج</option>
              <option value="flagged">تم الإيقاف</option>
            </select>
            <span className="chip">{num(stats?.total ?? 0)} قضية</span>
          </div>
          <CasesTable filter={filter} />
        </CardBody>
      </Card>
    </>
  );
}

export function IncomingPage(): JSX.Element {
  return (
    <>
      <PageHeader title="الوارد" subtitle="ملفات تم استلامها من قطاع الأمن العام" />
      <Card><CardBody><CasesTable filter="cleared" /></CardBody></Card>
    </>
  );
}

export function OutgoingPage(): JSX.Element {
  return (
    <>
      <PageHeader title="الصادر" subtitle="ملفات تم إرسالها للأمن العام بانتظار الرد" />
      <Card><CardBody><CasesTable filter="pending" /></CardBody></Card>
    </>
  );
}
