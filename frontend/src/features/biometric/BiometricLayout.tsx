import { Outlet } from 'react-router-dom';
import { Activity, Cpu, DoorOpen, History, LayoutGrid, ShieldCheck, UserPlus, Search, Users } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'منظومة ZKBioTime',
    items: [
      { key: 'zkDirectory', label: 'الأجهزة والأفراد', icon: <Cpu size={18} />, to: ROUTES.biometric.zkDirectory },
      { key: 'zkGates', label: 'الأجهزة والبوابات', icon: <LayoutGrid size={18} />, to: ROUTES.biometric.zkGates },
    ],
  },
  {
    label: 'الاستعلام والتحقق',
    items: [
      { key: 'lookup',     label: 'استعلام متقدم', icon: <Search size={18} />, to: ROUTES.biometric.overview, end: true },
      { key: 'verify',     label: 'التحقق من الهوية', icon: <ShieldCheck size={18} />, to: ROUTES.biometric.verify },
      { key: 'roleInquiry', label: 'استعلام حسب الدور', icon: <Users size={18} />, to: ROUTES.biometric.roleInquiry },
    ],
  },
  {
    label: 'التسجيل والحركة',
    items: [
      { key: 'enroll',     label: 'تسجيل البصمة', icon: <UserPlus size={18} />, to: ROUTES.biometric.enroll },
      { key: 'gate',       label: 'بوابة الدخول والخروج', icon: <DoorOpen size={18} />, to: ROUTES.biometric.gate },
      { key: 'attendance', label: 'الحضور والتواجد', icon: <Users size={18} />, to: ROUTES.biometric.attendance },
    ],
  },
  {
    label: 'السجلات والرقابة',
    items: [
      { key: 'history',    label: 'سجل التحقق',   icon: <History size={18} />,  to: ROUTES.biometric.history },
      { key: 'monitoring', label: 'المراقبة',     icon: <Activity size={18} />, to: ROUTES.biometric.monitoring },
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
