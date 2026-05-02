import { Outlet } from 'react-router-dom';
import { BookOpen, ChartBar, FileText, Pencil } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import type { SidebarSection } from '@/app/layouts/Sidebar';
import { ROUTES } from '@/config/routes';

const SIDEBAR: SidebarSection[] = [
  {
    label: 'بنك الأسئلة',
    items: [
      { key: 'bank',     label: 'الأسئلة',          icon: <BookOpen size={18} />, to: ROUTES.questionBank.overview, end: true },
      { key: 'manage',   label: 'إدارة الأسئلة',     icon: <Pencil size={18} />,   to: ROUTES.questionBank.crud },
      { key: 'exams',    label: 'الاختبارات',         icon: <FileText size={18} />, to: ROUTES.questionBank.exams },
      { key: 'results',  label: 'النتائج',            icon: <ChartBar size={18} />, to: ROUTES.questionBank.results },
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
