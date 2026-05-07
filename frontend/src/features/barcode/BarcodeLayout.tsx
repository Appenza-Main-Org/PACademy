import { Outlet } from 'react-router-dom';
import { Barcode as BarcodeIcon, History, Layers, RefreshCw, ScanLine, Search } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'الباركود',
    items: [
      { key: 'overview', label: 'إنشاء باركود', icon: <BarcodeIcon size={18} />, to: ROUTES.barcode.overview, end: true },
      { key: 'scan',     label: 'الماسح',         icon: <ScanLine size={18} />,    to: ROUTES.barcode.scan },
      { key: 'lookup',   label: 'استعلام',        icon: <Search size={18} />,      to: ROUTES.barcode.lookup },
      { key: 'batch',    label: 'دفعة كروت',      icon: <Layers size={18} />,      to: ROUTES.barcode.batch },
      { key: 'replace',  label: 'بدل فاقد',       icon: <RefreshCw size={18} />,   to: ROUTES.barcode.replace },
      { key: 'scans',    label: 'سجل المسح',      icon: <History size={18} />,     to: ROUTES.barcode.scans },
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
