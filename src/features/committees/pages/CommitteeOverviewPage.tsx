import { Users, Briefcase, CheckCircle, Activity } from 'lucide-react';
import { PageHeader, StatCard, Card, CardHeader, CardBody, Badge } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { num } from '@/shared/lib/format';

export function CommitteeOverviewPage(): JSX.Element {
  const totalApplicants = MOCK.committees.reduce((s, c) => s + c.applicants, 0);
  const totalCompleted = MOCK.committees.reduce((s, c) => s + c.completed, 0);
  const completionRate = Math.round((totalCompleted / totalApplicants) * 100);

  return (
    <>
      <PageHeader title="لجان القبول" subtitle="إدارة 5 لجان تستقبل المتقدمين على مدار اليوم" />

      <div className="grid grid-4 mb-6">
        <StatCard label="عدد اللجان" value={MOCK.committees.length} icon={<Briefcase size={18} />} iconBg="var(--gold-50)" iconColor="var(--gold-700)" />
        <StatCard label="إجمالي المتقدمين" value={totalApplicants} icon={<Users size={18} />} iconBg="var(--teal-50)" iconColor="var(--teal-600)" />
        <StatCard label="تم الفحص" value={totalCompleted} icon={<CheckCircle size={18} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
        <StatCard label="نسبة الإنجاز" value={`${completionRate}%`} icon={<Activity size={18} />} iconBg="var(--warning-bg)" iconColor="var(--warning)" />
      </div>

      <div className="grid grid-cols-auto">
        {MOCK.committees.map((c) => {
          const pct = Math.round((c.completed / c.applicants) * 100);
          return (
            <Card key={c.id}>
              <CardHeader title={c.name} subtitle={`المسؤول: ${c.head}`} actions={<Badge tone="brand">{num(c.members)} أعضاء</Badge>} />
              <CardBody>
                <div className="flex items-center justify-between mb-3 text-sm">
                  <span className="text-tertiary">الإنجاز</span>
                  <span className="font-bold mono">{num(c.completed)} / {num(c.applicants)}</span>
                </div>
                <div className="progress mb-3"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                <div className="flex items-center justify-between text-xs text-tertiary">
                  <span>اكتمل {pct}%</span>
                  <span>متبقّي {num(c.applicants - c.completed)} متقدم</span>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
