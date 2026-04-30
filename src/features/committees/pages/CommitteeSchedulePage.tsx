import { PageHeader, Card, CardHeader, CardBody, Badge } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';

const SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00'];
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export function CommitteeSchedulePage(): JSX.Element {
  return (
    <>
      <PageHeader title="الجدول الزمني" subtitle="مواعيد جلسات اللجان لهذا الأسبوع" />
      <Card>
        <CardHeader title="الأسبوع الحالي" />
        <CardBody>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>الموعد</th>
                  {DAYS.map((d) => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot, si) => (
                  <tr key={slot}>
                    <td className="mono font-bold">{slot}</td>
                    {DAYS.map((d, di) => {
                      const c = MOCK.committees[(si + di) % MOCK.committees.length]!;
                      return (
                        <td key={d}>
                          <Badge tone="brand">{c.name}</Badge>
                          <div className="text-xs text-tertiary mt-2">{c.head}</div>
                        </td>
                      );
                    })}
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
