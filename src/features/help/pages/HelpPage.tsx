/**
 * HelpPage — context help, keyboard shortcuts, support contacts.
 * Source: Tasks/KARASA_GAPS.md §10.4.D.
 */

import { ChevronDown, HelpCircle, Keyboard, Mail, Phone, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { Card, CardHeader, PageHeader } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { AppShell } from '@/app/layouts/AppShell';
import { PublicShell } from '@/app/layouts/PublicShell';
import { useAuthStore } from '@/features/auth';

const SHORTCUTS = [
  { keys: '⌘ K', label: 'البحث العام' },
  { keys: 'Esc', label: 'إغلاق نافذة منبثقة' },
  { keys: 'Tab', label: 'التنقل بين الحقول' },
  { keys: 'Enter', label: 'تأكيد الإجراء الافتراضي' },
];

const FAQ = [
  { q: 'كيف أعيد ضبط كلمة المرور؟', a: 'من الملف الشخصي > الأمن، أدخل كلمة المرور الحالية ثم الجديدة. للضباط الذين يستخدمون MOIPASS، تتم إعادة الضبط من خلال البوابة الحكومية.' },
  { q: 'كيف أصدر تقريراً مخصصاً؟', a: 'من قسم التقارير، اختر القالب والدورة، ثم انقر التصدير بصيغة Excel أو PDF.' },
  { q: 'ماذا أفعل إذا فقد المتقدم كارت التردد؟', a: 'من قسم الباركود > بدل فاقد، أدخل رقم المتقدم والسبب لإصدار باركود جديد. يتم إلغاء الكارت الأصلي تلقائياً.' },
  { q: 'كيف أعتمد نتائج اللجنة كقرار نهائي؟', a: 'من تفاصيل اللجنة، اختر النتائج المراد اعتمادها بـ checkbox ثم انقر "اعتماد المحدد". هذا الإجراء متاح لرئيس اللجنة فقط.' },
];

export function HelpPage(): JSX.Element {
  const [open, setOpen] = useState<number | null>(0);
  const user = useAuthStore((s) => s.user);
  const Shell = user ? AppShell : PublicShell;

  return (
    <Shell appLabel="الدعم والمساعدة">
      <CenteredShell>
        <PageHeader
          title="مركز الدعم"
          subtitle="إجابات للأسئلة الشائعة، اختصارات لوحة المفاتيح، وقنوات التواصل"
        />

        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardHeader title="الخط الساخن" />
            <p className="inline-flex items-center gap-2 text-md font-mono text-teal-700" dir="ltr"><Phone size={18} strokeWidth={1.75} /> 19000</p>
            <p className="mt-1 text-2xs text-ink-500">من الأحد إلى الخميس · 9 ص — 9 م</p>
          </Card>
          <Card>
            <CardHeader title="البريد الإلكتروني" />
            <p className="inline-flex items-center gap-2 text-sm font-mono text-teal-700" dir="ltr"><Mail size={16} strokeWidth={1.75} /> support@police-academy.gov.eg</p>
            <p className="mt-1 text-2xs text-ink-500">ردنا خلال 24 ساعة عمل</p>
          </Card>
          <Card>
            <CardHeader title="فيديوهات تعليمية" />
            <p className="inline-flex items-center gap-2 text-sm text-ink-700"><PlayCircle size={16} strokeWidth={1.75} /> 12 فيديو شامل لكل تطبيقات المنظومة</p>
            <p className="mt-1 text-2xs text-ink-500">سيُتاح المركز التعليمي قريباً.</p>
          </Card>
        </div>

        <Card className="mt-5">
          <CardHeader title="اختصارات لوحة المفاتيح" actions={<Keyboard size={16} strokeWidth={1.75} />} />
          <ul className="grid gap-2 md:grid-cols-2">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-sm">
                <span className="text-ink-700">{s.label}</span>
                <kbd className="rounded-sm border border-border-default bg-ink-50 px-2 py-0.5 text-2xs font-mono text-ink-900" dir="ltr">{s.keys}</kbd>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-5">
          <CardHeader title="الأسئلة الشائعة" actions={<HelpCircle size={16} strokeWidth={1.75} />} />
          <ul className="flex flex-col gap-2">
            {FAQ.map((item, i) => (
              <li key={item.q}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-3 text-start text-sm font-medium text-ink-900 hover:bg-ink-50"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                >
                  {item.q}
                  <ChevronDown size={14} strokeWidth={1.75} className={'transition-transform ' + (open === i ? 'rotate-180' : '')} />
                </button>
                {open === i && (
                  <p className="mt-1 rounded-md bg-ink-50 px-3 py-2 text-2xs text-ink-700 leading-normal">{item.a}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </CenteredShell>
    </Shell>
  );
}
