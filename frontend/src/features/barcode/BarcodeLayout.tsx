import { Outlet } from 'react-router-dom';
import {
  Barcode as BarcodeIcon,
  Grid3x3,
  History,
  Layers,
  RefreshCw,
  ScanLine,
  Search,
} from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'التنقل',
    items: [
      { key: 'hub', label: 'كل التطبيقات', icon: <Grid3x3 size={18} />, to: ROUTES.hub },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { key: 'overview', label: 'إنشاء باركود', icon: <BarcodeIcon size={18} />, to: ROUTES.barcode.overview, end: true },
      { key: 'scan',     label: 'الماسح',         icon: <ScanLine size={18} />,    to: ROUTES.barcode.scan },
      { key: 'lookup',   label: 'استعلام',        icon: <Search size={18} />,      to: ROUTES.barcode.lookup },
    ],
  },
  {
    label: 'الأدوات والسجلات',
    items: [
      { key: 'batch',   label: 'دفعة كروت', icon: <Layers size={18} />,    to: ROUTES.barcode.batch },
      { key: 'replace', label: 'بدل فاقد',  icon: <RefreshCw size={18} />, to: ROUTES.barcode.replace },
      { key: 'scans',   label: 'سجل المسح', icon: <History size={18} />,   to: ROUTES.barcode.scans },
    ],
  },
];

export function BarcodeLayout(): JSX.Element {
  return (
    <AppShell app="barcode" appLabel="الباركود · 2.5" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
