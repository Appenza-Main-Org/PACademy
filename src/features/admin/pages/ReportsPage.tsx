import { Download } from 'lucide-react';
import { PageHeader, Button, Card, CardHeader, CardBody } from '@/shared/components';
import { BarChart, LineChart, DonutChart } from '@/shared/components/charts';
import { useApplicantDistribution } from '@/features/applicants/api/applicant.queries';
import { MOCK } from '@/shared/mock-data';

export function ReportsPage(): JSX.Element {
  const { data: govDist } = useApplicantDistribution('governorate');
  const { data: certDist } = useApplicantDistribution('certType');
  const { data: statusDist } = useApplicantDistribution('status');

  return (
    <>
      <PageHeader
        title="التقارير الإحصائية"
        subtitle="تقارير قابلة للتصدير عن منظومة القبول"
        actions={<Button variant="secondary" leadingIcon={<Download size={16} />}>تصدير PDF</Button>}
      />

      <div className="grid mb-6" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader title="السداد عبر آخر 14 يوم" />
          <CardBody>
            <LineChart data={MOCK.last14Days.map((d) => ({ label: d.label, value: d.payments }))} color="#1A8754" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="حالات الطلبات" />
          <CardBody>
            <DonutChart data={(statusDist ?? []).map((d) => ({ label: d.label, value: d.value }))} centerLabel="حالة" />
          </CardBody>
        </Card>
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader title="المتقدمون حسب المحافظة" />
          <CardBody>
            <BarChart data={(govDist ?? []).slice(0, 12).map((d) => ({ label: d.label, value: d.value }))} color="#2D5BA0" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="نوع الشهادة" />
          <CardBody>
            <DonutChart data={(certDist ?? []).map((d) => ({ label: d.label, value: d.value }))} centerLabel="متقدم" />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
