import { Outlet } from 'react-router-dom';
import { ScanFace, UserPlus, History } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'البيومتري',
    items: [
      { key: 'overview', label: 'تحقق فوري',     icon: <ScanFace size={18} />,  to: ROUTES.biometric.overview, end: true },
      { key: 'enroll',   label: 'تسجيل بصمة',    icon: <UserPlus size={18} />,  to: ROUTES.biometric.enroll },
      { key: 'history',  label: 'سجل التحقق',    icon: <History size={18} />,   to: ROUTES.biometric.history },
    ],
  },
];

export function BiometricLayout(): JSX.Element {
  return (
    <AppShell app="biometric" appLabel="البيومتري · 2.6" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
