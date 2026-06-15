import { Outlet } from 'react-router-dom';
import {
  Activity,
  ClipboardCheck,
  Cpu,
  DoorOpen,
  History,
  LayoutGrid,
  MapPin,
  ScrollText,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
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
      { key: 'lookup', label: 'استعلام متقدم', icon: <Search size={18} />, to: ROUTES.biometric.overview, end: true },
      { key: 'verify', label: 'التحقق من الهوية', icon: <ShieldCheck size={18} />, to: ROUTES.biometric.verify },
    ],
  },
  {
    label: 'التسجيل والحركة',
    items: [
      { key: 'assignment', label: 'تعيين المتقدمين', icon: <MapPin size={18} />, to: ROUTES.biometric.assignment },
      { key: 'enroll', label: 'تسجيل البصمة', icon: <UserPlus size={18} />, to: ROUTES.biometric.enroll },
      { key: 'committeeAttendance', label: 'حضور اللجان', icon: <ClipboardCheck size={18} />, to: ROUTES.biometric.committeeAttendance },
      { key: 'gateVerification', label: 'تحقق البوابات', icon: <DoorOpen size={18} />, to: ROUTES.biometric.gateVerification },
    ],
  },
  {
    label: 'السجلات والرقابة',
    items: [
      { key: 'history', label: 'سجل التسجيل', icon: <ScrollText size={18} />, to: ROUTES.biometric.history },
      { key: 'verificationLog', label: 'سجل التحقق', icon: <History size={18} />, to: ROUTES.biometric.verificationLog },
      { key: 'monitoring', label: 'مراقبة الأجهزة', icon: <Activity size={18} />, to: ROUTES.biometric.monitoring },
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
