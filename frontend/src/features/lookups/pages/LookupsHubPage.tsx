/**
 * LookupsHubPage — `/admin/lookups[/:tab]`.
 *
 * Placeholder during the schema migration. The real tab-rail UX
 * arrives in the next commit (Commit D). This stub keeps the route
 * mounted and the typed service+queries reachable.
 */

import { LoadingState, PageHeader } from '@/shared/components';
import { ROUTES } from '@/config/routes';

export function LookupsHubPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الأكواد المرجعية"
        subtitle="إدارة الأكواد المرجعية للمنظومة — صلات القرابة، الاختبارات، اللجان، الجغرافيا، التنبيهات."
        breadcrumbs={[
          { label: 'الإدارة', href: ROUTES.admin.dashboard },
          { label: 'الأكواد المرجعية' },
        ]}
      />
      <LoadingState variant="card-grid" />
    </div>
  );
}
