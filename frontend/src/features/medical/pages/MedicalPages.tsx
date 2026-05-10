import { Link, useSearchParams } from 'react-router-dom';
import { Stethoscope, Users, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, Card, CardHeader, CardBody, Badge, StatCard, EmptyState, Avatar } from '@/shared/components';
import { ResultBadge } from '@/shared/components/StatusBadge';
import { medicalService } from '../api/medical.service';
import { MOCK } from '@/shared/mock-data';
import { num, shortName } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';

export function MedicalOverviewPage(): JSX.Element {
  const totalQueue = MOCK.medicalStations.reduce((s, x) => s + x.queue, 0);
  const totalCompleted = MOCK.medicalStations.reduce((s, x) => s + x.completed, 0);
  return (
    <>
      <PageHeader title="القومسيون الطبي" subtitle="8 عيادات تخصصية تستقبل المتقدمين" />

      <div className="grid grid-4 mb-6">
        <StatCard label="عيادات نشطة" value={MOCK.medicalStations.length} icon={<Stethoscope size={18} />} iconBg="var(--teal-100)" iconColor="var(--teal-700)" />
        <StatCard label="في الانتظار"   value={totalQueue}                      icon={<Clock size={18} />}      iconBg="var(--warning-bg)" iconColor="var(--warning)" />
        <StatCard label="تم اليوم"       value={totalCompleted}                  icon={<CheckCircle size={18} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
        <StatCard label="متقدمون اليوم"  value={totalQueue + totalCompleted}    icon={<Users size={18} />}      iconBg="var(--teal-50)" iconColor="var(--teal-600)" />
      </div>

      <div className="grid grid-cols-auto">
        {MOCK.medicalStations.map((s) => {
          const pct = Math.round((s.completed / (s.completed + s.queue)) * 100);
          return (
            <Card key={s.id}>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <div className="stat-icon" style={{ background: 'var(--teal-100)', color: 'var(--teal-700)' }}>
                    <Stethoscope size={18} />
                  </div>
                  <Badge tone="info">{s.id}</Badge>
                </div>
                <div className="font-bold text-md mb-1">{s.name}</div>
                <div className="text-xs text-tertiary mb-3">{s.doctor}</div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span><Clock size={14} className="inline-block align-middle" /> الانتظار</span>
                  <span className="mono font-bold">{num(s.queue)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span><CheckCircle size={14} className="inline-block align-middle" /> تم</span>
                  <span className="mono font-bold">{num(s.completed)}</span>
                </div>
                <div className="progress mb-3"><div className="progress-fill success" style={{ width: `${pct}%` }} /></div>
                <Link to={`${ROUTES.medical.queue}?station=${s.id}`} className="btn btn-secondary inline-flex w-full items-center justify-center">
                  عرض القائمة <ArrowLeft size={14} />
                </Link>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function MedicalQueuePage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const stationId = params.get('station') ?? MOCK.medicalStations[0].id;
  const { data: queue, isLoading } = useQuery({
    queryKey: ['medical', 'queue', stationId],
    queryFn: () => medicalService.getQueue(stationId),
  });
  const station = MOCK.medicalStations.find((s) => s.id === stationId);

  return (
    <>
      <PageHeader
        title={station ? `قائمة انتظار — ${station.name}` : 'قائمة الانتظار'}
        subtitle={station ? `الطبيب: ${station.doctor}` : ''}
      />

      <Card>
        <CardBody>
          <div className="filters">
            <select className="select" value={stationId} onChange={(e) => setParams({ station: e.target.value })}>
              {MOCK.medicalStations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {isLoading ? <div className="empty">جارٍ التحميل…</div> : !queue || queue.length === 0 ? <EmptyState title="لا يوجد متقدمون في الانتظار" /> : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>الترتيب</th>
                    <th>المتقدم</th>
                    <th>الكود</th>
                    <th>اللجنة</th>
                    <th>المرحلة</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((a) => (
                    <tr key={a.id}>
                      <td className="mono font-bold">#{a.orderNumber}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={a.name} size="sm" />
                          <span className="font-semibold">{shortName(a.name, 3)}</span>
                        </div>
                      </td>
                      <td className="mono text-xs text-tertiary">{a.id}</td>
                      <td><Badge tone="brand">{a.committee}</Badge></td>
                      <td className="text-xs">{a.stageLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

export function MedicalResultsPage(): JSX.Element {
  return (
    <>
      <PageHeader title="إدراج النتائج" subtitle="تسجيل نتائج الكشف الطبي للمتقدمين" />
      <Card>
        <CardHeader title="نتائج اليوم" subtitle="آخر النتائج المُدخلة" />
        <CardBody>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>المتقدم</th>
                  <th>العيادة</th>
                  <th>النتيجة</th>
                  <th>الطبيب</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.applicants.slice(0, 12).map((a, i) => (
                  <tr key={a.id}>
                    <td>{shortName(a.name, 3)}</td>
                    <td>{MOCK.medicalStations[i % MOCK.medicalStations.length].name}</td>
                    <td><ResultBadge outcome={a.results.medical} /></td>
                    <td className="text-xs text-tertiary">{MOCK.medicalStations[i % MOCK.medicalStations.length].doctor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
