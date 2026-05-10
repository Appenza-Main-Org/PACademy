/**
 * Step 14 — التنبيهات.
 * Embeds the Gap-L NotificationsPage in-place inside the Admission Setup
 * shell. Same drawer, same publish/unpublish/soft-delete mutations, same
 * audit emissions; only the breadcrumb + step header is added on top.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { NotificationsPage } from '@/features/admin/pages/NotificationsPage';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';

export function NotificationsStepPage(): JSX.Element {
  return (
    <AdmissionSetupShell
      headerActions={
        <Link to={ROUTES.admin.notifications} className="inline-flex">
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
          >
            فتح إدارة التنبيهات الكاملة
          </Button>
        </Link>
      }
    >
      <NotificationsPage />
    </AdmissionSetupShell>
  );
}
