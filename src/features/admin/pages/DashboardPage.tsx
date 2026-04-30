import { Users, CreditCard, Hourglass, Check, Download, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, StatCard, Card, CardHeader, CardBody, Badge, Button, Avatar } from '@/shared/components';
import { LineChart, DonutChart } from '@/shared/components/charts';
import { useApplicantStats, useApplicantDistribution } from '@/features/applicants/api/applicant.queries';
import { useAuditLog } from '@/features/audit/api/audit.queries';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { StatusBadge } from '@/shared/components/StatusBadge';

export function DashboardPage(): JSX.Element {
  const { data: stats } = useApplicantStats();
  const { data: certDist } = useApplicantDistribution('certType');
  const { data: govDist } = useApplicantDistribution('governorate');
  const { data: audit } = useAuditLog({ limit: 8 });

  const k = stats ?? MOCK.kpis;
  const recent = MOCK.applicants
    .slice()
    .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="لوحة تحكم النظام"
        subtitle="نظرة شاملة على حالة المتقدمين، النشاط، والمؤشرات الحيوية"
        actions={
          <>
            <Button variant="secondary" leadingIcon={<Download size={16} />}>تصدير تقرير</Button>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>متقدم جديد</Button>
          </>
        }
      />

      <div className="grid grid-4 mb-6">
        <StatCard label="إجمالي المتقدمين" value={k.totalApplicants} icon={<Users size={18} />} iconBg="#DDE7F2" iconColor="#2D5BA0" trend={{ label: '+12%' }} />
        <StatCard label="مدفوع الرسوم" value={k.paidApplicants} icon={<CreditCard size={18} />} iconBg="#D7F0E1" iconColor="#1A8754" trend={{ label: `${Math.round(k.paidApplicants / k.totalApplicants * 100)}%` }} />
        <StatCard label="قيد المراجعة" value={k.underReview} icon={<Hourglass size={18} />} iconBg="#FBE9CC" iconColor="#B8770A" trend={{ label: '+5%' }} />
        <StatCard label="تم القبول" value={k.approved} icon={<Check size={18} />} iconBg="#D7F0E1" iconColor="#1A8754" trend={{ label: 'مستقر' }} />
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader title="حركة التسجيلات — آخر 14 يوم" subtitle="عدد المتقدمين المسجلين يومياً" actions={<Badge tone="info">+18% أسبوعياً</Badge>} />
          <CardBody>
            <LineChart data={MOCK.last14Days.map((d) => ({ label: d.label, value: d.registrations }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="توزيع نوع الشهادة" subtitle="نسبة كل نوع شهادة" />
          <CardBody>
            <DonutChart data={(certDist ?? []).map((d) => ({ label: d.label, value: d.value }))} centerLabel="متقدم" />
          </CardBody>
        </Card>
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader
            title="آخر المتقدمين"
            subtitle={`أحدث ${recent.length} طلبات تقديم`}
            actions={<Link to={ROUTES.admin.applicants} className="btn btn-ghost btn-sm">عرض الكل</Link>}
          />
          <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>المتقدم</th>
                  <th>المحافظة</th>
                  <th>الشهادة</th>
                  <th>الحالة</th>
                  <th>تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
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
                    <td>{a.governorate}</td>
                    <td className="text-xs text-secondary">{a.certType} — {a.certSection}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="text-xs text-tertiary">{fmtDate(a.registeredAt, 'short')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="آخر النشاط" subtitle={`${num(audit?.length ?? 0)} حدث`} />
          <CardBody style={{ padding: 8 }}>
            <div className="activity">
              {(audit ?? []).map((e) => (
                <div className="activity-item" key={e.id}>
                  <span className="activity-icon" style={{ background: 'var(--surface-muted)' }}>
                    <Badge tone={e.actionColor} className="text-xs">{e.actionLabel}</Badge>
                  </span>
                  <div className="activity-body">
                    <div className="activity-title">{shortName(e.userName, 3)}</div>
                    <div className="activity-meta">{e.details} · {fmtDate(e.timestamp, 'rel')}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="التوزيع الجغرافي" subtitle="عدد المتقدمين حسب المحافظة" />
        <CardBody>
          <div className="grid grid-cols-auto" style={{ gap: 16 }}>
            {(govDist ?? []).slice(0, 9).map((g) => {
              const max = govDist?.[0]?.value ?? 1;
              const pct = (g.value / max) * 100;
              return (
                <div key={g.label} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{g.label}</span>
                    <span className="text-xs text-tertiary mono">{num(g.value)}</span>
                  </div>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
