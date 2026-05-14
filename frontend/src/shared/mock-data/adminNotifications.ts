/**
 * Admin notification seed — Gap L (admin-gaps).
 *
 * A handful of representative entries: general broadcast, category-scoped,
 * student-specific. Real backend supplies these via /api/admin/notifications.
 */

import type { AdminNotification } from '@/shared/types/domain';

const NOW = Date.now();
const day = (offsetDays: number): string => new Date(NOW + offsetDays * 86_400_000).toISOString();

export const ADMIN_NOTIFICATIONS_SEED: AdminNotification[] = [
  {
    id: 'AN-0001',
    type: 'general',
    titleAr: 'فتح باب التقديم لدورة 2026',
    bodyAr:
      'بدأ استقبال طلبات الالتحاق بكلية الشرطة لعام 2026 من 1 سبتمبر حتى 30 أكتوبر. يُرجى مراجعة الشروط والمستندات المطلوبة قبل التسجيل.',
    audience: [{ type: 'general' }],
    publishAt: day(-3),
    expireAt: day(20),
    status: 'published',
    createdBy: 'U-001',
    createdAt: day(-3),
  },
  {
    id: 'AN-0002',
    type: 'category',
    titleAr: 'موعد اختبار القدرات لقسم الضباط العام',
    bodyAr:
      'سيُعقد اختبار القدرات للمتقدمين على قسم الضباط العام يوم الأحد 15 سبتمبر بمقر الأكاديمية. الحضور قبل الموعد بساعة.',
    audience: [{ type: 'category', categoryKeys: ['officers_general'] }],
    publishAt: day(-1),
    expireAt: day(7),
    status: 'published',
    createdBy: 'U-002',
    createdAt: day(-1),
  },
  {
    id: 'AN-0003',
    type: 'student',
    titleAr: 'تنبيه استكمال المستندات',
    bodyAr: 'يرجى استكمال شهادة الميلاد وصورة الرقم القومي قبل تاريخ 20 سبتمبر.',
    audience: [{ type: 'student', nationalId: '30501010101011' }],
    publishAt: day(0),
    status: 'published',
    createdBy: 'U-001',
    createdAt: day(0),
  },
  {
    id: 'AN-0004',
    type: 'general',
    titleAr: 'مسودة — جدول إعلان نتائج الكشف الطبي',
    bodyAr: 'يتم إعلان نتائج الكشف الطبي يوم 25 سبتمبر بإذن الله.',
    audience: [{ type: 'general' }],
    publishAt: day(5),
    expireAt: day(30),
    status: 'scheduled',
    createdBy: 'U-001',
    createdAt: day(0),
  },
];
