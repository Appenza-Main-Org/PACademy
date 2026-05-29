import { Outlet } from 'react-router-dom';
import { Activity, History, ShieldCheck, Stethoscope, UserPlus, DoorOpen, Search } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'العمليات',
    items: [
      { key: 'lookup',     label: 'استعلام متقدم', icon: <Search size={18} />, to: ROUTES.biometric.overview, end: true },
      { key: 'verify',     label: 'التحقق من الهوية', icon: <ShieldCheck size={18} />, to: ROUTES.biometric.verify },
      { key: 'security',   label: 'بوابة التأمين', icon: <DoorOpen size={18} />, to: ROUTES.biometric.securityGate },
      { key: 'medical',    label: 'تحقق القومسيون', icon: <Stethoscope size={18} />, to: ROUTES.biometric.medicalVerify },
    ],
  },
  {
    label: 'الإدارة والسجلات',
    items: [
      { key: 'enroll',     label: 'تسجيل البصمة', icon: <UserPlus size={18} />, to: ROUTES.biometric.enroll },
      { key: 'monitoring', label: 'المراقبة',     icon: <Activity size={18} />, to: ROUTES.biometric.monitoring },
      { key: 'history',    label: 'سجل التحقق',   icon: <History size={18} />,  to: ROUTES.biometric.history },
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
