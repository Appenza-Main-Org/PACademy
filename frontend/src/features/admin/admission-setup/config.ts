/**
 * Admission Setup config — the single source of truth for the wizard.
 *
 * Consumed by:
 *   • <AdmissionSetupSidebar>  — renders submenu entries in `order` ascending
 *   • routes.tsx               — registers one route per entry
 *   • <AdmissionSetupBreadcrumbs> + <StepHeader> — "الخطوة N من M" badge
 *   • <AdmissionSetupIndexPage> — launcher that picks an existing cycle
 *
 * Cycle metadata (name / year / dates) is NOT a wizard step — admins
 * configure cycles in the Cycles section, then enter this wizard by
 * selecting one of those already-configured cycles. The wizard only
 * covers per-cycle admission settings.
 *
 * Adding a new step is a single append here plus a route segment in
 * `ROUTES.admin.admissionSetup` and a page file. No Sidebar / routes.tsx /
 * shell changes.
 */

import {
  ClipboardCheck,
  ClipboardSignature,
  FileSignature,
  Settings2,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import type { Permission } from '@/features/auth';
import type { AdmissionSetupStepKey } from './types';

export interface AdmissionSetupStep {
  key: AdmissionSetupStepKey;
  /** 1..N — drives sidebar/breadcrumb sort. */
  order: number;
  labelAr: string;
  /** URL segment after `/admin/admission-setup/`. */
  routeSegment: string;
  icon: LucideIcon;
  permission: Permission;
  /** Optional path to the existing page/component this step composes over. */
  reuses?: string;
  /**
   * `true` when the step ships interactive content, `false` when the route
   * resolves to a `<StepPlaceholder />` "قيد التطوير" shell. Index-page
   * status pills key off this until per-step `isComplete(cycleId)` checks
   * exist (see `lib/step-status.ts`).
   */
  isImplemented: boolean;
  /** Brief Arabic subtitle shown under the card on the index landing. */
  subtitleAr: string;
}

export const ADMISSION_SETUP_STEPS: readonly AdmissionSetupStep[] = [
  {
    key: 'application_settings',
    order: 1,
    labelAr: 'إعدادات التقديم',
    routeSegment: 'application-settings',
    icon: Settings2,
    permission: 'admission-setup:read',
    reuses: 'features/admin/pages/CycleDetailPage.tsx',
    isImplemented: true,
    subtitleAr: 'الفئات المفتوحة، السعة، شروط القبول الموسّعة.',
  },
  {
    key: 'fees',
    order: 2,
    labelAr: 'الرسوم المالية',
    routeSegment: 'fees',
    icon: Wallet,
    permission: 'admission-setup:read',
    reuses: 'features/admin/pages/CycleDetailPage.tsx',
    isImplemented: true,
    subtitleAr: 'رسوم التقديم وإعدادات بوابة فوري.',
  },
  {
    key: 'exams',
    order: 3,
    labelAr: 'إدارة الاختبارات',
    routeSegment: 'exams',
    icon: ClipboardSignature,
    permission: 'admission-setup:read',
    reuses: 'features/admin/components/exams/ExamPlanEditor.tsx',
    isImplemented: true,
    subtitleAr: 'ترتيب الاختبارات وإلزاميتها ورسومها لكل فئة.',
  },
  {
    key: 'committees',
    order: 4,
    labelAr: 'إدارة مواعيد الاختبارات واللجان',
    routeSegment: 'committees',
    icon: ShieldCheck,
    permission: 'admission-setup:read',
    reuses: 'features/committees/pages/CommitteeListPage.tsx',
    isImplemented: true,
    subtitleAr: 'إنشاء اللجان وتعيين الرؤساء والأعضاء وربطها بمواعيد الاختبارات.',
  },
  {
    key: 'notifications',
    order: 5,
    labelAr: 'التنبيهات',
    routeSegment: 'notifications',
    icon: ClipboardCheck,
    permission: 'admission-setup:read',
    reuses: 'features/admin/pages/NotificationsPage.tsx',
    isImplemented: true,
    subtitleAr: 'إعداد رسائل النظام للمتقدمين.',
  },
  {
    key: 'electronic_declaration',
    order: 6,
    labelAr: 'الإقرار الإلكتروني',
    routeSegment: 'electronic-declaration',
    icon: FileSignature,
    permission: 'admission-setup:read',
    isImplemented: true,
    subtitleAr: 'مستند الإقرار (PDF) المعروض على المتقدم في مرحلة الطباعة.',
  },
];

/** Cheap O(N) lookup by key. */
export function getStepByKey(key: AdmissionSetupStepKey): AdmissionSetupStep {
  const step = ADMISSION_SETUP_STEPS.find((s) => s.key === key);
  if (!step) throw new Error(`Unknown admission-setup step: ${key as string}`);
  return step;
}

/** Resolve the step matching a route pathname, or null if not under the section. */
export function getStepByPath(pathname: string): AdmissionSetupStep | null {
  for (const step of ADMISSION_SETUP_STEPS) {
    const fullPath = `/admin/admission-setup/${step.routeSegment}`;
    if (pathname === fullPath || pathname.startsWith(`${fullPath}/`)) return step;
  }
  return null;
}

/** Total step count, derived from the array — change one place to re-pace. */
export const ADMISSION_SETUP_TOTAL_STEPS = ADMISSION_SETUP_STEPS.length;

/** Localstorage key for the persisted sidebar group expansion state. */
export const ADMISSION_SETUP_SIDEBAR_STORAGE_KEY = 'pa-sidebar-groups';

/** Sessionstorage key for the picked cycle context. */
export const ADMISSION_SETUP_CYCLE_STORAGE_KEY = 'pa-admission-setup-cycle';

/** Internal — used by `routes.tsx` to assert the route table matches the config. */
export const ADMISSION_SETUP_ROUTE_BASE = ROUTES.admin.admissionSetup.index;
