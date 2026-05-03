/**
 * OutgoingLettersPage — صادر workflow.
 * Source: KARASA §5.2.C.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { investigationsService } from '../api/investigations.service';
import { date as fmtDate } from '@/shared/lib/format';
import type { OutgoingLetter } from '@/shared/types/domain';

const RECIPIENTS = [
  'الإدارة العامة للأحوال المدنية',
  'الإدارة العامة لمكافحة المخدرات',
  'مديرية الأمن — القاهرة',
  'وزارة الخارجية',
  'إدارة المباحث العامة',
];

const TEMPLATES = [
  { value: 'standard-inquiry', label: 'استعلام معياري' },
  { value: 'criminal-history-request', label: 'طلب سجل جنائي' },
  { value: 'verification-of-residence', label: 'تأكيد محل الإقامة' },
];

const STATUS_LABEL: Record<OutgoingLetter['status'], string> = {
  drafted: 'مسودّة',
  sent: 'مُرسَل',
  acknowledged: 'تم التأكيد',
  responded: 'تم الردّ',
  closed: 'مغلق',
};

const STATUS_TONE: Record<OutgoingLetter['status'], 'neutral' | 'info' | 'warning' | 'success'> = {
  drafted: 'neutral',
  sent: 'info',
  acknowledged: 'warning',
  responded: 'success',
  closed: 'neutral',
};

export function OutgoingLettersPage(): JSX.Element {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['investigations', 'letters'],
    queryFn: () => investigationsService.listLetters(),
  });
  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof investigationsService.createLetter>[0]) =>
      investigationsService.createLetter(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investigations', 'letters'] }),
  });
  const sendMut = useMutation({
    mutationFn: (id: string) => investigationsService.sendLetter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investigations', 'letters'] }),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [to, setTo] = useState(RECIPIENTS[0]!);
  const [subject, setSubject] = useState('استعلام عن سجل المتقدم');
  const [template, setTemplate] = useState(TEMPLATES[0]!.value);

  const columns: DataTableColumn<OutgoingLetter>[] = [
    { key: 'id', label: 'الرقم', width: 96, render: (l) => <span className="font-mono" dir="ltr">{l.id}</span> },
    { key: 'to', label: 'إلى', render: (l) => l.to },
    { key: 'subject', label: 'الموضوع', render: (l) => l.subject },
    { key: 'status', label: 'الحالة', render: (l) => <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge> },
    { key: 'sentAt', label: 'تاريخ الإرسال', render: (l) => l.sentAt ? <span className="text-2xs text-ink-500">{fmtDate(l.sentAt, 'short')}</span> : '—' },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (l) => (
        l.status === 'drafted' ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Send size={12} strokeWidth={1.75} />}
            onClick={() => sendMut.mutate(l.id, { onSuccess: () => toast('تم إرسال الكتاب', 'success') })}
          >
            إرسال
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الصادر"
        subtitle="كتب رسمية مُوجَّهة لجهات خارجية مرتبطة بالتحريات"
        actions={
          <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />} onClick={() => setDrawerOpen(true)}>
            إنشاء كتاب جديد
          </Button>
        }
      />

      <Card>
        <DataTable
          data={data ?? []}
          columns={columns}
          rowKey={(l) => l.id}
          loading={isLoading}
          error={isError ? <ErrorState error={error} onRetry={() => refetch()} /> : undefined}
          empty={<EmptyState variant="generic" title="لا توجد كتب صادرة" />}
          zebraStripes
        />
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="كتاب صادر جديد" size="md">
        <Drawer.Body>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate(
                { to, subject, template, send: false },
                { onSuccess: () => { toast('تم حفظ المسودّة', 'success'); setDrawerOpen(false); } },
              );
            }}
          >
            <Select label="الجهة المُرسَل إليها" value={to} onChange={(e) => setTo(e.target.value)} options={RECIPIENTS.map((r) => ({ value: r, label: r }))} />
            <Input label="الموضوع" required value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Select label="القالب" value={template} onChange={(e) => setTemplate(e.target.value)} options={TEMPLATES} />
            <Textarea label="ملاحظات إضافية" placeholder="أي تفاصيل إضافية ترد في نص الكتاب" />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="primary">حفظ كمسودّة</Button>
            </div>
          </form>
        </Drawer.Body>
      </Drawer>
    </>
  );
}
