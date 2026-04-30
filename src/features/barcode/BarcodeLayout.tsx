import { Outlet } from 'react-router-dom';
import { Barcode as BarcodeIcon, Search, Layers } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'الباركود',
    items: [
      { key: 'overview', label: 'إنشاء باركود', icon: <BarcodeIcon size={18} />, to: ROUTES.barcode.overview, end: true },
      { key: 'lookup',   label: 'استعلام',       icon: <Search size={18} />,     to: ROUTES.barcode.lookup },
      { key: 'batch',    label: 'دفعة كروت',     icon: <Layers size={18} />,     to: ROUTES.barcode.batch },
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
