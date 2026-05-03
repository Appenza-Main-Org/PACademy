/**
 * Category required-test labels + lucide icon assignments.
 * Source: Bucket B3 brief — verbatim Arabic labels.
 */

import {
  Activity,
  BookOpen,
  Brain,
  ClipboardList,
  Crosshair,
  Ruler,
  Shield,
  Stethoscope,
  TestTube,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { RequiredTestKind } from '@/shared/types/domain';

export const TEST_KIND_LABEL_AR: Record<RequiredTestKind, string> = {
  aptitude: 'اختبار القدرات',
  posture: 'كشف الهيئة',
  medical: 'الكشف الطبي',
  physical: 'الاختبار الرياضي',
  psychological: 'الاختبار النفسي',
  interview: 'مقابلة شخصية',
  drug: 'تحليل مخدرات',
  security_review: 'مراجعة أمنية',
  tactical_training: 'تدريب تكتيكي',
  security_training: 'تدريب على التأمين',
  specialized_courses: 'دورات تخصصية',
};

export const TEST_KIND_ICON: Record<RequiredTestKind, LucideIcon> = {
  aptitude: ClipboardList,
  posture: Ruler,
  medical: Stethoscope,
  physical: Activity,
  psychological: Brain,
  interview: UserCheck,
  drug: TestTube,
  security_review: Shield,
  tactical_training: Crosshair,
  security_training: Shield,
  specialized_courses: BookOpen,
};
