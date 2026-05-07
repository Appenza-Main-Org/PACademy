/**
 * PrimitivesReviewPage — visual review surface for the Radix-based shared primitives.
 *
 * Mounted at `/_dev/primitives`. The route is gated by `import.meta.env.DEV`
 * in `routes.tsx`, so this page does not exist in production builds.
 *
 * Each section renders one example of a Phase 2B primitive so a designer or
 * reviewer can sanity-check focus, motion, RTL, and tone across the whole set
 * on a single page.
 */

import { useState } from 'react';
import { Bell, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  Accordion,
  AlertDialog,
  Button,
  Dialog,
  DropdownMenu,
  Popover,
  SearchSelect,
  Sheet,
  Tabs,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';

const GOVERNORATES: readonly SearchSelectOption[] = [
  { value: 'cai', label: 'القاهرة' },
  { value: 'giz', label: 'الجيزة' },
  { value: 'alx', label: 'الإسكندرية' },
  { value: 'qly', label: 'القليوبية' },
  { value: 'shr', label: 'الشرقية' },
  { value: 'gha', label: 'الغربية' },
  { value: 'mnf', label: 'المنوفية' },
  { value: 'dak', label: 'الدقهلية' },
  { value: 'kfs', label: 'كفر الشيخ' },
  { value: 'fay', label: 'الفيوم' },
];

export function PrimitivesReviewPage(): JSX.Element {
  const [alertOpen, setAlertOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gov, setGov] = useState<string | null>('cai');

  return (
    <TooltipProvider>
      <main
        dir="rtl"
        className="mx-auto max-w-5xl px-6 py-12 font-ar"
        data-app="admin"
      >
        <header className="mb-10">
          <p className="text-2xs font-mono uppercase tracking-wide text-ink-400">
            DEV ONLY · /_dev/primitives
          </p>
          <h1 className="mt-2 font-ar-display text-3xl font-bold text-ink-900">
            مراجعة المكونات الأساسية (Radix)
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            عرض شاشة واحدة لكل مكوّن جديد قبل ترحيل الميزات إلى استخدامها.
          </p>
        </header>

        <Section title="AlertDialog">
          <Button onClick={() => setAlertOpen(true)} variant="primary">
            فتح تأكيد الاعتماد
          </Button>
          <AlertDialog
            open={alertOpen}
            onOpenChange={setAlertOpen}
            title="اعتماد نهائي"
            description="بمجرد الاعتماد لا يمكن التراجع. هل تريد المتابعة؟"
            actionLabel="اعتماد"
            onAction={() => setAlertOpen(false)}
            tone="primary"
          />
        </Section>

        <Section title="Dialog">
          <Button onClick={() => setDialogOpen(true)} variant="secondary">
            فتح حوار
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="تفاصيل المتقدم"
            description="عرض ملخّص لبيانات الملف"
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  إغلاق
                </Button>
                <Button variant="primary" onClick={() => setDialogOpen(false)}>
                  حفظ
                </Button>
              </>
            }
          >
            <p className="text-sm text-ink-700 leading-normal">
              هذه نافذة عامة قابلة للإغلاق بزر الإغلاق أو بالنقر خارجها أو بمفتاح الهروب.
            </p>
          </Dialog>
        </Section>

        <Section title="Sheet">
          <Button onClick={() => setSheetOpen(true)} variant="secondary">
            فتح اللوحة الجانبية
          </Button>
          <Sheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="مرفقات الملف"
            description="عرض جانبي يبقى الصفحة الأم مرئية"
            size="md"
            footer={
              <Button variant="primary" onClick={() => setSheetOpen(false)}>
                إغلاق
              </Button>
            }
          >
            <p className="text-sm text-ink-700 leading-normal">
              تنزلق هذه اللوحة من الحافة النهائية للمستند (يسار في RTL، يمين في LTR).
            </p>
          </Sheet>
        </Section>

        <Section title="Popover">
          <Popover>
            <Popover.Trigger asChild>
              <Button variant="secondary" leadingIcon={<Bell size={16} />}>
                تنبيهات
              </Button>
            </Popover.Trigger>
            <Popover.Content>
              <h3 className="mb-2 text-sm font-medium text-ink-900">آخر التنبيهات</h3>
              <ul className="space-y-2 text-sm text-ink-700">
                <li>تم استلام شهادة جديدة</li>
                <li>اعتماد نهائي بانتظار التوقيع</li>
                <li>تذكير بمواعيد اللجنة</li>
              </ul>
            </Popover.Content>
          </Popover>
        </Section>

        <Section title="Tooltip">
          <div className="flex items-center gap-3">
            <Tooltip content="نسخ الرقم القومي">
              <button
                type="button"
                aria-label="نسخ"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-500 hover:bg-ink-50 hover:text-ink-900 focus-visible:shadow-[var(--ring)] focus-visible:outline-none"
              >
                <Copy size={16} />
              </button>
            </Tooltip>
            <Tooltip content="تعديل" side="bottom">
              <button
                type="button"
                aria-label="تعديل"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-500 hover:bg-ink-50 hover:text-ink-900 focus-visible:shadow-[var(--ring)] focus-visible:outline-none"
              >
                <Pencil size={16} />
              </button>
            </Tooltip>
          </div>
        </Section>

        <Section title="DropdownMenu">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="إجراءات">
                <MoreHorizontal size={18} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Label>إجراءات</DropdownMenu.Label>
              <DropdownMenu.Item leadingIcon={<Pencil size={14} />} shortcut="⌘E">
                تعديل
              </DropdownMenu.Item>
              <DropdownMenu.Item leadingIcon={<Copy size={14} />}>نسخ</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item destructive leadingIcon={<Trash2 size={14} />}>
                حذف
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </Section>

        <Section title="SearchSelect (Combobox-equivalent on Radix Popover)">
          <div className="max-w-sm">
            <SearchSelect
              value={gov}
              onChange={setGov}
              options={GOVERNORATES}
              ariaLabel="المحافظة"
              placeholder="اختر المحافظة"
            />
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">نظرة عامة</Tabs.Tab>
              <Tabs.Tab value="cycles" badge={3}>
                الدورات
              </Tabs.Tab>
              <Tabs.Tab value="categories">الفئات</Tabs.Tab>
              <Tabs.Tab value="locked" disabled>
                مغلق
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview" className="pt-4 text-sm text-ink-700">
              ملخّص الحالة الحالية للنظام.
            </Tabs.Panel>
            <Tabs.Panel value="cycles" className="pt-4 text-sm text-ink-700">
              قائمة الدورات المفتوحة.
            </Tabs.Panel>
            <Tabs.Panel value="categories" className="pt-4 text-sm text-ink-700">
              قائمة الفئات المرجعية.
            </Tabs.Panel>
          </Tabs>
        </Section>

        <Section title="Accordion">
          <Accordion type="single" defaultValue="overview" collapsible>
            <Accordion.Item value="overview">
              <Accordion.Trigger>نظرة عامة</Accordion.Trigger>
              <Accordion.Content>
                المنظومة تربط تسع تطبيقات خلف واجهة موحّدة، بدعم كامل للعربية واتجاه RTL.
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="phases">
              <Accordion.Trigger>المراحل</Accordion.Trigger>
              <Accordion.Content>
                مرحلة عامة، مرحلة المتقدم، ومرحلة الموظفين — تتبع كل منها قواعد صلاحيات مختلفة.
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="brand">
              <Accordion.Trigger>الهوية البصرية</Accordion.Trigger>
              <Accordion.Content>
                تستند إلى لوحة Arabic Heritage Modern: نيلي عميق + ذهب تراثي + لون آجر للحالات الحرجة.
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </Section>
      </main>
    </TooltipProvider>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps): JSX.Element {
  return (
    <section className="mb-10 border-b border-border-subtle pb-10 last:border-0">
      <h2 className="mb-4 font-ar-display text-lg font-bold text-ink-900">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}
