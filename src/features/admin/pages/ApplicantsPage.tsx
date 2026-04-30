import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { PageHeader, Card, Avatar, Button, EmptyState, Skeleton, Badge } from '@/shared/components';
import { StatusBadge, PaymentBadge } from '@/shared/components/StatusBadge';
import { useApplicants } from '@/features/applicants/api/applicant.queries';
import { ROUTES } from '@/config/routes';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName, maskNationalId } from '@/shared/lib/format';
import { STATUS_LABELS } from '@/shared/mock-data/dictionaries';
import type { ApplicantStatus } from '@/shared/types/domain';

const PAGE_SIZE = 15;

export function ApplicantsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicantStatus | 'all'>('all');
  const [governorate, setGovernorate] = useState<string>('all');
  const [certType, setCertType] = useState<string>('all');

  const { data, isLoading } = useApplicants({
    page,
    pageSize: PAGE_SIZE,
    search,
    status,
    governorate,
    certType,
  });

  return (
    <>
      <PageHeader
        title="إدارة المتقدمين"
        subtitle="بحث وتصفية وإدارة طلبات التقدم"
        actions={
          <Button variant="secondary" leadingIcon={<Download size={16} />}>تصدير CSV</Button>
        }
      />

      <Card>
        <div className="card-body">
          <div className="filters">
            <div className="search flex-1">
              <input className="input" type="search" placeholder="بحث بالاسم / الرقم القومي / كود التقدم" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              <Search size={18} />
            </div>
            <select className="select" value={status} onChange={(e) => { setStatus(e.target.value as ApplicantStatus | 'all'); setPage(1); }}>
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select className="select" value={governorate} onChange={(e) => { setGovernorate(e.target.value); setPage(1); }}>
              <option value="all">كل المحافظات</option>
              {MOCK.governorates.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="select" value={certType} onChange={(e) => { setCertType(e.target.value); setPage(1); }}>
              <option value="all">كل الشهادات</option>
              <option value="ثانوية عامة">ثانوية عامة</option>
              <option value="ثانوية أزهرية">ثانوية أزهرية</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-3"><Skeleton height={48} /><Skeleton height={48} /><Skeleton height={48} /><Skeleton height={48} /></div>
          ) : !data || data.data.length === 0 ? (
            <EmptyState title="لا توجد نتائج" description="جرّب تعديل عوامل التصفية" />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المتقدم</th>
                      <th>الرقم القومي</th>
                      <th>المحافظة</th>
                      <th>الشهادة</th>
                      <th>الدفع</th>
                      <th>المرحلة</th>
                      <th>الحالة</th>
                      <th>التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link to={ROUTES.admin.applicantDetail(a.id)} className="flex items-center gap-3">
                            <Avatar name={a.name} size="sm" />
                            <div className="flex flex-col">
                              <span className="font-semibold">{shortName(a.name, 3)}</span>
                              <span className="text-xs text-tertiary mono">{a.id}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="mono">{maskNationalId(a.nationalId)}</td>
                        <td>{a.governorate}</td>
                        <td className="text-xs text-secondary">{a.certType}<br /><span className="text-tertiary">{a.certSection}</span></td>
                        <td><PaymentBadge status={a.paymentStatus} /></td>
                        <td><Badge tone="info">{a.stageLabel}</Badge></td>
                        <td><StatusBadge status={a.status} /></td>
                        <td className="text-xs text-tertiary">{fmtDate(a.registeredAt, 'short')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-tertiary">{num(data.total)} نتيجة · صفحة {num(data.page)} من {num(data.totalPages)}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={data.page <= 1}>السابق</Button>
                  <Button variant="secondary" size="sm" onClick={() => setPage(Math.min(data.totalPages, page + 1))} disabled={data.page >= data.totalPages}>التالي</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </>
  );
}
