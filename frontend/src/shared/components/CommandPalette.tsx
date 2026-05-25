/**
 * CommandPalette — global ⌘K search + quick actions.
 * Source: Tasks/KARASA_GAPS.md §10.4.A.
 *
 * Lightweight cmdk-style palette built on the existing Modal primitive
 * to avoid adding the cmdk dependency. Indexes routes + applicants +
 * audit shortcuts + reports.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Database, FileText, Search, Settings, Shield, Users } from 'lucide-react';
import { Modal } from './Modal';
import { Input } from './Input';
import { ROUTES } from '@/config/routes';
import { MOCK } from '@/shared/mock-data';

interface CommandItem {
  id: string;
  label: string;
  href: string;
  group: 'navigation' | 'applicants' | 'admin';
  icon?: JSX.Element;
}

const NAVIGATION: CommandItem[] = [
  { id: 'nav-admin',       label: 'لوحة تحكم الإدارة',           href: ROUTES.admin.dashboard,       group: 'navigation' },
  { id: 'nav-applicants',  label: 'قائمة المتقدمين',              href: ROUTES.admin.applicants,      group: 'navigation', icon: <ClipboardList size={14} strokeWidth={1.75} /> },
  { id: 'nav-users',       label: 'مستخدمو المنظومة',            href: ROUTES.admin.users,           group: 'navigation', icon: <Users size={14} strokeWidth={1.75} /> },
  { id: 'nav-audit',       label: 'سجل العمليات',                  href: ROUTES.admin.audit,           group: 'navigation', icon: <Shield size={14} strokeWidth={1.75} /> },
  { id: 'nav-reports',     label: 'التقارير',                       href: ROUTES.admin.reports,         group: 'navigation', icon: <FileText size={14} strokeWidth={1.75} /> },
  { id: 'nav-lookups',     label: 'الأكواد المرجعية',                href: ROUTES.admin.adminLookups,    group: 'navigation', icon: <Database size={14} strokeWidth={1.75} /> },
  { id: 'nav-cycles',      label: 'دورات القبول',                  href: ROUTES.admin.cycles,          group: 'navigation' },
  { id: 'nav-settings',    label: 'الإعدادات العامة',              href: ROUTES.admin.settings,        group: 'navigation', icon: <Settings size={14} strokeWidth={1.75} /> },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element {
  const [term, setTerm] = useState('');
  useEffect(() => { if (!open) setTerm(''); }, [open]);

  const items = useMemo(() => {
    const q = term.trim().toLowerCase();
    const applicants = MOCK.applicants.slice(0, 60).map<CommandItem>((a) => ({
      id: `app-${a.id}`,
      label: `${a.name} · ${a.id}`,
      href: ROUTES.admin.applicantDetail(a.id),
      group: 'applicants',
    }));
    const all = [...NAVIGATION, ...applicants];
    if (!q) return all.slice(0, 12);
    return all.filter((item) => item.label.toLowerCase().includes(q) || item.label.includes(term)).slice(0, 30);
  }, [term]);

  return (
    <Modal open={open} onClose={onClose} title="بحث عام في المنظومة" size="md" withFlourishes={false} transparentBackdrop>
      <Modal.Body>
        <Input
          autoFocus
          placeholder="ابحث عن متقدم، مستخدم، تقرير… (⌘K)"
          leadingIcon={<Search size={14} strokeWidth={1.75} />}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          containerClassName="mb-4"
        />
        <ul className="flex flex-col gap-1" role="listbox">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.href}
                onClick={onClose}
                className="flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-sm text-ink-900 hover:border-border-subtle hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                <span className="text-2xs text-ink-500">
                  {item.group === 'navigation' ? 'تنقّل' : item.group === 'applicants' ? 'متقدم' : 'إدارة'}
                </span>
              </Link>
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-6 text-center text-sm text-ink-500">لا توجد نتائج</li>
          )}
        </ul>
      </Modal.Body>
    </Modal>
  );
}

/* Hook: registers a global ⌘K / Ctrl+K shortcut to open the palette. */
export function useCommandPaletteShortcut(setOpen: (b: boolean) => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setOpen]);
}
