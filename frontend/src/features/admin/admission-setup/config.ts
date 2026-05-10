/**
 * 15-step Admission Setup config — the single source of truth.
 *
 * Consumed by:
 *   • <AdmissionSetupSidebar>  — renders submenu entries in `order` ascending
 *   • routes.tsx               — registers one route per entry
 *   • <AdmissionSetupBreadcrumbs> + <StepHeader> — "الخطوة N من ١٥" badge
 *   • <AdmissionSetupIndexPage> — 15 cards on the landing
 *
 * Adding a 16th step is a single append here plus a route segment in
 * `ROUTES.admin.admissionSetup` and a page file. No Sidebar / routes.tsx /
 * shell changes.
 *
 * ─── Audit notes (composition map) ────────────────────────────────────
 * Step  Compose target                                       Strategy
 *  1    CycleDetailPage (Gap F)                              Compose
 *  2    CategoryConditionBuilder (Gap G)                     Compose
 *  3    CycleDetailPage status workflow (Gap F)              Compose
 *  4    CategoryConditionBuilder age section (Gap G)         Compose
 *  5    CategoryConditionBuilder marital section (Gap G)     Compose
 *  6    Cycle.fees + FawryConfigCard inside CycleDetail (K)  Compose
 *  7    ExamPlanEditor (Gap J)                               Compose
 *  8    CommitteeListPage / CommitteeDetailPage (Gap H)      Compose
 *  9    —                                                    NEW
 * 10    Committee.scoreCriteria type exists, no UI shipped   NEW
 * 11    —                                                    NEW
 * 12    Committee.availableDates / capacityPerDay (Gap H)    Compose
 * 13    —                                                    NEW
 * 14    NotificationsPage (Gap L)                            Compose
 * 15    —                                                    NEW
 * ──────────────────────────────────────────────────────────────────────
 */

import {
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardSignature,
  FileSignature,
  Gauge,
  Heart,
  Link2,
  Settings2,
  ShieldCheck,
  Sigma,
  Split,
  UserCog,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import type { Permission } from '@/features/auth';
import type { AdmissionSetupStepKey } from './types';

export interface AdmissionSetupStep {
  key: AdmissionSetupStepKey;
  /** 1..15 — drives sidebar/breadcrumb sort. */
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
    key: 'cycle_metadata',
    order: 1,
    labelAr: 'بيانات سنة التقديم',
    routeSegment: 'cycle-metadata',
    icon: CalendarDays,
    permission: 'admission-setup:read',
    reuses: 'features/admin/pages/CycleDetailPage.tsx',
    isImplemented: true,
    subtitleAr: 'اسم الدورة، السنة، الفئة، تواريخ الفتح والإغلاق.',
  },
  {
    key: 'application_settings',
    order: 2,
    labelAr: 'إعدادات التقديم',
    routeSegment: 'application-settings',
    icon: Settings2,
    permission: 'admission-setup:read',
    reuses: 'features/admin/pages/CycleDetailPage.tsx',
    isImplemented: true,
    subtitleAr: 'الفئات المفتوحة، السعة، شروط القبول الموسّعة.',
  },
  {
    key: 'application_status',
    order: 3,
    labelAr: 'حالة التقديم',
    routeSegment: 'application-status',
    icon: ClipboardCheck,
    permission: 'admission-setup:read',
    reuses: 'features/admin/pages/CycleDetailPage.tsx',
    isImplemented: true,
    subtitleAr: 'تفعيل، تمديد، إغلاق، أرشفة الدورة.',
  },
  {
    key: 'age_rules',
    order: 4,
    labelAr: 'شروط السن',
    routeSegment: 'age-rules',
    icon: UserCog,
    permission: 'admission-setup:read',
    reuses: 'features/admin/components/categories/CategoryConditionBuilder.tsx',
    isImplemented: true,
    subtitleAr: 'الحد الأدنى والأقصى للسن لكل فئة، مع تاريخ احتساب السن.',
  },
  {
    key: 'marital_status_rules',
    order: 5,
    labelAr: 'الحالة الاجتماعية',
    routeSegment: 'marital-status-rules',
    icon: Heart,
    permission: 'admission-setup:read',
    reuses: 'features/admin/components/categories/CategoryConditionBuilder.tsx',
    isImplemented: true,
    subtitleAr: 'الحالات الاجتماعية المسموح بها لكل فئة.',
  },
  {
    key: 'fees',
    order: 6,
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
    order: 7,
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
    order: 8,
    labelAr: 'إدارة اللجان',
    routeSegment: 'committees',
    icon: ShieldCheck,
    permission: 'admission-setup:read',
    reuses: 'features/committees/pages/CommitteeListPage.tsx',
    isImplemented: true,
    subtitleAr: 'إنشاء اللجان وتعيين الرؤساء والأعضاء.',
  },
  {
    key: 'committee_merge_split',
    order: 9,
    labelAr: 'دمج وفصل اللجان',
    routeSegment: 'committee-merge-split',
    icon: Split,
    permission: 'admission-setup:read',
    isImplemented: true,
    subtitleAr: 'قواعد دمج عدة لجان أو فصل لجنة إلى عدة لجان.',
  },
  {
    key: 'score_thresholds',
    order: 10,
    labelAr: 'درجات القبول',
    routeSegment: 'score-thresholds',
    icon: Gauge,
    permission: 'admission-setup:read',
    isImplemented: true,
    subtitleAr: 'الحد الأدنى والأقصى لقبول كل لجنة.',
  },
  {
    key: 'exam_dates',
    order: 11,
    labelAr: 'مواعيد الاختبارات',
    routeSegment: 'exam-dates',
    icon: CalendarRange,
    permission: 'admission-setup:read',
    isImplemented: true,
    subtitleAr: 'أول ميعاد متاح، أيام التقديم، أيام الإجازة.',
  },
  {
    key: 'date_committee_binding',
    order: 12,
    labelAr: 'ربط المواعيد باللجان',
    routeSegment: 'date-committee-binding',
    icon: Link2,
    permission: 'admission-setup:read',
    reuses: 'features/committees/pages/CommitteeDetailPage.tsx',
    isImplemented: true,
    subtitleAr: 'تخصيص الأيام والسعة اليومية لكل لجنة.',
  },
  {
    key: 'total_score',
    order: 13,
    labelAr: 'المجموع الكلي',
    routeSegment: 'total-score',
    icon: Sigma,
    permission: 'admission-setup:read',
    isImplemented: true,
    subtitleAr: 'وزن كل اختبار في المجموع النهائي لكل فئة.',
  },
  {
    key: 'notifications',
    order: 14,
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
    order: 15,
    labelAr: 'الإقرار الإلكتروني',
    routeSegment: 'electronic-declaration',
    icon: FileSignature,
    permission: 'admission-setup:read',
    isImplemented: true,
    subtitleAr: 'نص الإقرار المعروض على المتقدم في مرحلة الطباعة.',
  },
];

/** Cheap O(15) lookup by key. */
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
