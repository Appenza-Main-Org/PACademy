import { useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader, Card, Badge, EmptyState, Skeleton } from '@/shared/components';
import { useAuditLog } from '@/features/audit/api/audit.queries';
import { date as fmtDate, shortName } from '@/shared/lib/format';
import { AUDIT_ACTIONS } from '@/shared/mock-data/dictionaries';
import type { AuditAction } from '@/shared/types/domain';

export function AuditPage(): JSX.Element {
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const { data, isLoading } = useAuditLog({ action, limit: 80 });

  return (
    <>
      <PageHeader
        title="سجل النشاط"
        subtitle="كل الإجراءات الإدارية مسجّلة على النظام"
      />

      <Card>
        <div className="card-body">
          <div className="filters">
            <div className="search flex-1">
              <input className="input" placeholder="بحث في السجل…" />
              <Search size={18} />
            </div>
            <select className="select" value={action} onChange={(e) => setAction(e.target.value as AuditAction | 'all')}>
              <option value="all">كل الإجراءات</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a.action} value={a.action}>{a.label}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={42} />)}</div>
          ) : !data || data.length === 0 ? (
            <EmptyState title="لا توجد سجلات" />
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>الإجراء</th>
                    <th>الكيان</th>
                    <th>التفاصيل</th>
                    <th>عنوان IP</th>
                    <th>الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((e) => (
                    <tr key={e.id}>
                      <td>{shortName(e.userName, 3)}</td>
                      <td><Badge tone={e.actionColor}>{e.actionLabel}</Badge></td>
                      <td className="text-sm">{e.entity}</td>
                      <td className="text-xs text-secondary">{e.details}</td>
                      <td className="mono text-xs text-tertiary">{e.ip}</td>
                      <td className="text-xs text-tertiary">{fmtDate(e.timestamp, 'rel')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
