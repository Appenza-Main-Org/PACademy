import { Outlet } from 'react-router-dom';
import { Activity, BookOpen, ChartBar, FileText, Grid3x3, Pencil } from 'lucide-react';
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
    label: 'بنك الأسئلة',
    items: [
      { key: 'bank',   label: 'الأسئلة',       icon: <BookOpen size={18} />, to: ROUTES.questionBank.overview, end: true },
      { key: 'manage', label: 'إدارة الأسئلة', icon: <Pencil size={18} />,   to: ROUTES.questionBank.crud },
    ],
  },
  {
    label: 'الاختبارات والنتائج',
    items: [
      { key: 'exams',   label: 'الاختبارات', icon: <FileText size={18} />, to: ROUTES.questionBank.exams },
      { key: 'proctor', label: 'المراقبة',   icon: <Activity size={18} />, to: ROUTES.questionBank.proctor },
      { key: 'results', label: 'النتائج',    icon: <ChartBar size={18} />, to: ROUTES.questionBank.results },
    ],
  },
];

export function ExamsLayout(): JSX.Element {
  return (
    <AppShell app="exams" appLabel="بنك الأسئلة · 2.7" sidebar={SIDEBAR}>
      <Outlet />
    </AppShell>
  );
}
