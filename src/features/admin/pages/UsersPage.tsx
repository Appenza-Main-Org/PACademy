import { Plus } from 'lucide-react';
import { PageHeader, Card, Avatar, Button, Badge } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { ROLE_DEFINITIONS, type Role } from '@/features/auth';
import { date as fmtDate, shortName } from '@/shared/lib/format';

export function UsersPage(): JSX.Element {
  return (
    <>
      <PageHeader
        title="مستخدمو المنظومة"
        subtitle={`${MOCK.users.length} مستخدماً نشطاً عبر ٩ تطبيقات`}
        actions={<Button variant="primary" leadingIcon={<Plus size={16} />}>مستخدم جديد</Button>}
      />
      <Card>
        <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الدور الوظيفي</th>
                <th>الوحدة</th>
                <th>التطبيقات المسموح بها</th>
                <th>الحالة</th>
                <th>آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {MOCK.users.map((u) => {
                const def = ROLE_DEFINITIONS[u.role as Role];
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <div className="flex flex-col">
                          <span className="font-semibold">{shortName(u.name, 4)}</span>
                          <span className="text-xs text-tertiary mono">{u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone="brand">{def?.labelAr ?? u.role}</Badge></td>
                    <td className="text-sm">{u.unit}</td>
                    <td className="text-xs text-tertiary mono" style={{ maxWidth: 240 }}>{def?.apps.join(' · ') ?? '—'}</td>
                    <td>{u.active ? <Badge tone="success">نشط</Badge> : <Badge tone="neutral">معطّل</Badge>}</td>
                    <td className="text-xs text-tertiary">{fmtDate(u.lastLogin, 'rel')}</td>
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
