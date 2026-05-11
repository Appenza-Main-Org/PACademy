/**
 * AppSettingsReviewPage — DEV-only review surface for the Application
 * Settings three-tier editor. Mounts the full screen against live mock
 * data so a designer can spot visual regressions without driving the
 * cycle wizard.
 */

import { CategoryAccordion } from '@/features/admin/admission-setup/components/applicationSettings/CategoryAccordion';
import { ScopeBanner } from '@/features/admin/admission-setup/components/applicationSettings/ScopeBanner';
import { StickyBulkSaveBar } from '@/features/admin/admission-setup/components/applicationSettings/StickyBulkSaveBar';
import { UnsavedChangesPrompt } from '@/features/admin/admission-setup/components/applicationSettings/UnsavedChangesPrompt';

export function AppSettingsReviewPage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8" data-app="admin">
      <h1 className="font-ar-display text-2xl font-bold text-ink-900">
        إعدادات التقديم — DEV review
      </h1>
      <p className="text-sm text-ink-600">
        المكون الكامل ضمن بيئة معزولة. التعديلات هنا تكتب إلى نفس الـ mock
        store الذي يستهلكه معالج الإعداد.
      </p>
      <ScopeBanner />
      <CategoryAccordion />
      <StickyBulkSaveBar />
      <UnsavedChangesPrompt />
    </div>
  );
}
