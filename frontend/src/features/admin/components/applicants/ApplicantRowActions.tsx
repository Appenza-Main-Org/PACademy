import { useState } from 'react';
import { Ban, MoreVertical, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  Modal,
} from '@/shared/components';
import {
  useDeleteApplicant,
  useResetApplicant,
  useSetApplicantSuspension,
} from '@/features/applicants/api/applicant.queries';
import { useApplicantGradeByNid } from '@/features/applicant-grades/api/grades.queries';
import type { Applicant } from '@/shared/types/domain';

interface ApplicantRowActionsProps {
  applicant: Applicant;
  activeCycleId: string | null;
}

const PRESERVED_ITEMS = [
  'الرقم القومي',
  'رقم الهاتف',
  'جلسة التحقق من وزارة الداخلية',
  'وقت التحقق',
  'تاريخ الميلاد والسن',
  'نوع المؤهل والنسبة / التقدير المسترجع من التحقق',
] as const;

const CLEARED_ITEMS = [
  'البيانات الشخصية المدخلة يدوياً',
  'حسابات التواصل',
  'العنوان',
  'بيانات التعليم غير المسترجعة من وزارة الداخلية',
  'بيانات الأسرة والأقارب',
  'حجوزات الاختبارات',
  'بيانات السداد والموافقات',
  'موعد أول اختبار وطباعة بطاقة التردد',
] as const;

export function ApplicantRowActions({
  applicant,
  activeCycleId,
}: ApplicantRowActionsProps): JSX.Element {
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [reason, setReason] = useState('');

  const gradeQuery = useApplicantGradeByNid(applicant.nationalId, activeCycleId);
  const resetMutation = useResetApplicant();
  const deleteMutation = useDeleteApplicant();
  const suspensionMutation = useSetApplicantSuspension();
  const hasGrade = Boolean(gradeQuery.data);
  const isSuspended = Boolean(applicant.suspended);
  const mutationPending =
    resetMutation.isPending || deleteMutation.isPending || suspensionMutation.isPending;

  const closeReset = (): void => setResetOpen(false);
  const closeDelete = (): void => {
    setDeleteOpen(false);
    setDeleteConfirm('');
  };
  const closeSuspend = (): void => {
    setSuspendOpen(false);
    setReason('');
  };

  const handleReset = (): void => {
    resetMutation.mutate(applicant.id, { onSuccess: closeReset });
  };

  const handleDelete = (): void => {
    deleteMutation.mutate(applicant.id, { onSuccess: closeDelete });
  };

  const handleSuspension = (): void => {
    suspensionMutation.mutate(
      { id: applicant.id, suspended: !isSuspended, reason: isSuspended ? undefined : reason.trim() },
      { onSuccess: closeSuspend },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="secondary"
            size="icon"
            aria-label={`إجراءات ${applicant.name}`}
            disabled={mutationPending}
            // Icon buttons render children sr-only — the visible glyph must come
            // through leadingIcon. base.css resets `button { border: none }`, so
            // border-solid restores the secondary variant's 1px border.
            leadingIcon={<MoreVertical size={16} strokeWidth={2} aria-hidden />}
            className="!h-8 !w-8 border-solid text-ink-700 data-[state=open]:bg-ink-100 data-[state=open]:text-ink-900"
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" className="min-w-56">
          <DropdownMenu.Label>إجراءات الطلب</DropdownMenu.Label>
          {hasGrade && (
            <DropdownMenu.Item
              onSelect={() => setResetOpen(true)}
              leadingIcon={<RotateCcw size={15} strokeWidth={1.75} aria-hidden />}
              destructive
            >
              إعادة تعيين الطلب
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={() => setSuspendOpen(true)}
            leadingIcon={
              isSuspended
                ? <Undo2 size={15} strokeWidth={1.75} aria-hidden />
                : <Ban size={15} strokeWidth={1.75} aria-hidden />
            }
            destructive={!isSuspended}
          >
            {isSuspended ? 'إلغاء الإيقاف' : 'إيقاف الطلب'}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => setDeleteOpen(true)}
            leadingIcon={<Trash2 size={15} strokeWidth={1.75} aria-hidden />}
            destructive
          >
            حذف الطلب
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

      <Modal
        open={resetOpen}
        onClose={closeReset}
        title="إعادة تعيين الطلب"
        subtitle={applicant.name}
        size="md"
        transparentBackdrop={false}
      >
        <Modal.Body className="space-y-5">
          <SummaryList title="سيتم الاحتفاظ بـ" items={PRESERVED_ITEMS} tone="safe" />
          <SummaryList title="سيتم مسح" items={CLEARED_ITEMS} tone="danger" />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeReset} disabled={resetMutation.isPending}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            onClick={handleReset}
            isLoading={resetMutation.isPending}
            loadingLabel="جارٍ إعادة التعيين"
          >
            تأكيد إعادة التعيين
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={closeDelete}
        title="حذف الطلب نهائياً"
        subtitle={applicant.name}
        size="sm"
        transparentBackdrop={false}
      >
        <Modal.Body className="space-y-4">
          <p className="rounded-lg border border-terra-200 bg-terra-50 px-4 py-3 text-sm leading-7 text-terra-700">
            هذا الإجراء لا يمكن التراجع عنه وسيحذف الطلب وكل السجلات التابعة له.
          </p>
          <label className="flex flex-col gap-2 text-sm font-medium text-ink-700">
            اكتب الرقم القومي للتأكيد
            <input
              className="input text-end font-mono"
              dir="ltr"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={applicant.nationalId}
            />
          </label>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDelete} disabled={deleteMutation.isPending}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleteConfirm !== applicant.nationalId}
            isLoading={deleteMutation.isPending}
            loadingLabel="جارٍ الحذف"
          >
            حذف الطلب
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={suspendOpen}
        onClose={closeSuspend}
        title={isSuspended ? 'إلغاء إيقاف الطلب' : 'إيقاف الطلب'}
        subtitle={applicant.name}
        size="sm"
        transparentBackdrop={false}
      >
        <Modal.Body className="space-y-4">
          {isSuspended ? (
            <p className="text-sm leading-7 text-ink-600">
              سيتم السماح للمتقدم باستكمال إجراءات الطلب مرة أخرى.
            </p>
          ) : (
            <label className="flex flex-col gap-2 text-sm font-medium text-ink-700">
              سبب الإيقاف
              <textarea
                className="input min-h-28 resize-y py-3 leading-7"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="اكتب سبب الإيقاف"
              />
            </label>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeSuspend} disabled={suspensionMutation.isPending}>
            إلغاء
          </Button>
          <Button
            variant={isSuspended ? 'primary' : 'danger'}
            onClick={handleSuspension}
            disabled={!isSuspended && reason.trim().length === 0}
            isLoading={suspensionMutation.isPending}
            loadingLabel="جارٍ الحفظ"
          >
            {isSuspended ? 'إلغاء الإيقاف' : 'إيقاف الطلب'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function SummaryList({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: 'safe' | 'danger';
}): JSX.Element {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-card p-4">
      <h3 className={tone === 'danger' ? 'text-sm font-bold text-terra-700' : 'text-sm font-bold text-teal-700'}>
        {title}
      </h3>
      <ul className="mt-3 grid gap-2 text-sm leading-7 text-ink-700 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
