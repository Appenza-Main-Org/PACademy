import { PageHeader, Card, Badge } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { num } from '@/shared/lib/format';

export function CommitteeListPage(): JSX.Element {
  return (
    <>
      <PageHeader title="قائمة اللجان" subtitle="عرض تفصيلي لكل لجنة وأعضائها" />
      <Card>
        <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>اللجنة</th>
                <th>المسؤول</th>
                <th>عدد الأعضاء</th>
                <th>المتقدمون</th>
                <th>تم</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {MOCK.committees.map((c) => {
                const pct = Math.round((c.completed / c.applicants) * 100);
                return (
                  <tr key={c.id}>
                    <td className="font-bold">{c.name}</td>
                    <td>{c.head}</td>
                    <td className="mono">{num(c.members)}</td>
                    <td className="mono">{num(c.applicants)}</td>
                    <td className="mono">{num(c.completed)}</td>
                    <td>
                      {pct >= 70 ? <Badge tone="success">{pct}% — اكتمال جيد</Badge> : pct >= 40 ? <Badge tone="warning">{pct}% — متوسط</Badge> : <Badge tone="danger">{pct}% — متأخر</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
