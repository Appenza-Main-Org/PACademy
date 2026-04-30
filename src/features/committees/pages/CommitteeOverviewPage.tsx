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
        <StatCard label="عدد اللجان" value={MOCK.committees.length} icon={<Briefcase size={18} />} iconBg="#E5DEF5" iconColor="#6B46C1" />
        <StatCard label="إجمالي المتقدمين" value={totalApplicants} icon={<Users size={18} />} iconBg="#DDE7F2" iconColor="#2D5BA0" />
        <StatCard label="تم الفحص" value={totalCompleted} icon={<CheckCircle size={18} />} iconBg="#D7F0E1" iconColor="#1A8754" />
        <StatCard label="نسبة الإنجاز" value={`${completionRate}%`} icon={<Activity size={18} />} iconBg="#FBE9CC" iconColor="#B8770A" />
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
