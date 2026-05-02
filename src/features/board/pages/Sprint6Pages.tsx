/**
 * Sprint 6 — Board / Secretariat new pages.
 * Source: KARASA §4 sections A, B, C, D.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, Gavel, Mic, Pause, Play, Plus, Printer, Trash2, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  KhayameyaStripe,
  LoadingState,
  PageHeader,
  PrintLayout,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, shortName } from '@/shared/lib/format';
import { boardService } from '../api/board.service';
import type { BoardDecision, BoardMember, BoardSession } from '@/shared/types/domain';

/* ─────────────── Sessions list refresh + create ─────────────── */

export function BoardSessionsListPage(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['board', 'sessions'], queryFn: () => boardService.listSessions() });

  const columns: DataTableColumn<BoardSession>[] = [
    {
      key: 'id',
      label: 'الجلسة',
      render: (s) => (
        <Link to={`${ROUTES.board.sessions}/${s.id}/live`} className="font-mono font-medium text-gold-700 hover:underline" dir="ltr">
          {s.id}
        </Link>
      ),
    },
    { key: 'date', label: 'الموعد', render: (s) => fmtDate(s.date, 'short') },
    { key: 'time', label: 'الوقت', render: (s) => <span className="font-numeric tnum" dir="ltr">{s.time}</span> },
    { key: 'location', label: 'المكان', render: (s) => s.location, hideOn: 'sm' },
    { key: 'attendees', label: 'الحضور', numeric: true, render: (s) => s.attendees.length },
    { key: 'applicants', label: 'المتقدمون', numeric: true, render: (s) => s.applicantIds.length },
    { key: 'status', label: 'الحالة', render: (s) => {
      const map = { scheduled: { tone: 'info' as const, label: 'مجدولة' }, live: { tone: 'warning' as const, label: 'جارية' }, closed: { tone: 'success' as const, label: 'مغلقة' } };
      return <Badge tone={map[s.status].tone} dot={s.status === 'live'}>{map[s.status].label}</Badge>;
    } },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="الجلسات"
        subtitle="جلسات الهيئة المُجدولة، الجارية، والمنتهية"
        actions={
          <Link to={`${ROUTES.board.sessions}/create`}>
            <Button variant="primary" leadingIcon={<CalendarPlus size={14} strokeWidth={1.75} />}>جلسة جديدة</Button>
          </Link>
        }
      />
      <Card>
        <DataTable
          data={data ?? []}
          columns={columns}
          rowKey={(s) => s.id}
          loading={isLoading}
          empty={<EmptyState variant="generic" title="لا توجد جلسات" />}
          zebraStripes
        />
      </Card>
    </CenteredShell>
  );
}

export function BoardSessionCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [location, setLocation] = useState('قاعة الاجتماعات الكبرى - أكاديمية الشرطة');
  const [agenda, setAgenda] = useState('مراجعة طلبات قبول مستجدة\nإقرار نتائج المرحلة السابقة');

  return (
    <CenteredShell>
      <PageHeader title="جدولة جلسة جديدة" subtitle="إعداد موعد، مكان، وبنود جدول الأعمال" />
      <Card>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const next = await boardService.createSession({
              date: new Date(`${date}T${time}:00`).toISOString(),
              time,
              location,
              agenda: agenda.split('\n').filter(Boolean),
              attendees: [],
              applicantIds: [],
            });
            toast(`تم جدولة الجلسة ${next.id}`, 'success');
            navigate(ROUTES.board.sessions);
          }}
        >
          <Input label="التاريخ" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="الوقت" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          <Input label="المكان" required value={location} onChange={(e) => setLocation(e.target.value)} containerClassName="md:col-span-2" />
          <Textarea label="جدول الأعمال (سطر لكل بند)" value={agenda} onChange={(e) => setAgenda(e.target.value)} containerClassName="md:col-span-2" />
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate(ROUTES.board.sessions)}>إلغاء</Button>
            <Button type="submit" variant="primary" leadingIcon={<CalendarPlus size={14} strokeWidth={1.75} />}>جدولة الجلسة</Button>
          </div>
        </form>
      </Card>
    </CenteredShell>
  );
}

/* ─────────────── Live session interface ─────────────── */

export function BoardSessionLivePage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: session, isLoading, error, refetch } = useQuery({
    queryKey: ['board', 'session', id],
    queryFn: () => boardService.getSession(id),
    enabled: Boolean(id),
  });
  const startMut = useMutation({ mutationFn: () => boardService.startSession(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['board'] }) });
  const closeMut = useMutation({ mutationFn: () => boardService.closeSession(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['board'] }) });

  const [activeIdx, setActiveIdx] = useState(0);
  const [votes, setVotes] = useState<Record<string, Record<string, 'pass' | 'reject' | 'defer'>>>({});

  if (isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (error) return <CenteredShell><ErrorState error={error} onRetry={() => refetch()} /></CenteredShell>;
  if (!session) return <CenteredShell><EmptyState variant="generic" title="الجلسة غير موجودة" /></CenteredShell>;

  const activeApplicantId = session.applicantIds[activeIdx];
  const tally = activeApplicantId ? Object.values(votes[activeApplicantId] ?? {}) : [];
  const counts = { pass: tally.filter((v) => v === 'pass').length, reject: tally.filter((v) => v === 'reject').length, defer: tally.filter((v) => v === 'defer').length };

  return (
    <CenteredShell>
      <PageHeader
        title={`الجلسة الحيّة · ${session.id}`}
        subtitle={`${fmtDate(session.date, 'short')} - ${session.time} · ${session.location}`}
        breadcrumbs={[{ label: 'الجلسات', href: ROUTES.board.sessions }, { label: session.id }]}
        actions={
          <div className="flex items-center gap-2">
            {session.status === 'scheduled' && (
              <Button variant="primary" leadingIcon={<Play size={14} strokeWidth={1.75} />} onClick={() => startMut.mutate()}>بدء الجلسة</Button>
            )}
            {session.status === 'live' && (
              <Button variant="danger" leadingIcon={<Pause size={14} strokeWidth={1.75} />} onClick={() => closeMut.mutate()}>إغلاق الجلسة</Button>
            )}
            {session.status === 'closed' && <Badge tone="success">الجلسة مُغلقة</Badge>}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader title="جدول الأعمال" subtitle={`${session.agenda.length} بنود`} />
          <ol className="flex flex-col gap-2 text-sm">
            {session.agenda.map((item, i) => (
              <li key={i} className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">
                <span className="text-2xs text-ink-500 font-mono" dir="ltr">{i + 1}</span> {item}
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader
            title={`المتقدم قيد المناقشة · ${activeIdx + 1} / ${session.applicantIds.length}`}
            subtitle={activeApplicantId ?? '—'}
            actions={
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => i - 1)}>السابق</Button>
                <Button variant="ghost" size="sm" disabled={activeIdx >= session.applicantIds.length - 1} onClick={() => setActiveIdx((i) => i + 1)}>التالي</Button>
              </div>
            }
          />

          {activeApplicantId && (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-md border border-border-subtle bg-ink-50 p-4">
                <Avatar name={activeApplicantId} size="lg" />
                <div className="flex-1">
                  <p className="font-bold text-ink-900">المتقدم رقم <span className="font-mono" dir="ltr">{activeApplicantId}</span></p>
                  <p className="mt-0.5 text-2xs text-ink-500">يستعرض أمين السر ملفه الكامل أمام أعضاء الهيئة الآن.</p>
                </div>
              </div>

              <div className="mb-3 flex flex-col gap-2">
                <p className="text-sm font-medium text-ink-900">صوت الأعضاء</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {[{ id: 'BM-01', name: 'اللواء د. محمود سعيد' }, { id: 'BM-03', name: 'العميد د. أحمد محمود' }, { id: 'BM-04', name: 'العقيد محمد إبراهيم' }, { id: 'BM-05', name: 'الرائد طارق علي' }].map((member) => {
                    const myVote = votes[activeApplicantId]?.[member.id];
                    return (
                      <div key={member.id} className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2">
                        <span className="text-sm">{member.name}</span>
                        <div className="flex items-center gap-1">
                          {(['pass', 'reject', 'defer'] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setVotes({ ...votes, [activeApplicantId]: { ...(votes[activeApplicantId] ?? {}), [member.id]: v } })}
                              className={
                                'rounded-md px-2 py-1 text-2xs ' +
                                (myVote === v
                                  ? v === 'pass' ? 'bg-success text-white' : v === 'reject' ? 'bg-terra-500 text-white' : 'bg-gold-500 text-white'
                                  : 'border border-border-default text-ink-700 hover:bg-ink-50')
                              }
                            >
                              {v === 'pass' ? 'قبول' : v === 'reject' ? 'رفض' : 'تأجيل'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
                <p className="font-bold">مُحصِّلة الأصوات (يراها رئيس الجلسة فقط)</p>
                <p className="mt-1">قبول <span className="font-bold font-numeric tnum">{counts.pass}</span> · رفض <span className="font-bold font-numeric tnum">{counts.reject}</span> · تأجيل <span className="font-bold font-numeric tnum">{counts.defer}</span></p>
              </div>
            </>
          )}
        </Card>
      </div>
    </CenteredShell>
  );
}

/* ─────────────── Decisions list with print preview ─────────────── */

export function BoardDecisionsListPage(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['board', 'decisions'], queryFn: () => boardService.listDecisions() });
  const [open, setOpen] = useState<BoardDecision | null>(null);

  const columns: DataTableColumn<BoardDecision>[] = [
    { key: 'number', label: 'رقم القرار', render: (d) => <button onClick={() => setOpen(d)} className="font-mono font-medium text-gold-700 hover:underline" dir="ltr">{d.number}</button> },
    { key: 'date', label: 'التاريخ', render: (d) => fmtDate(d.date, 'short') },
    { key: 'hijri', label: 'الهجري', render: (d) => d.hijriDate },
    { key: 'applicant', label: 'المتقدم', render: (d) => <span dir="ltr" className="font-mono">{d.applicantId}</span> },
    {
      key: 'outcome',
      label: 'القرار',
      render: (d) => (
        <Badge tone={d.outcome === 'accepted' ? 'success' : d.outcome === 'rejected' ? 'danger' : 'warning'}>
          {d.outcome === 'accepted' ? 'قبول' : d.outcome === 'rejected' ? 'رفض' : 'تأجيل'}
        </Badge>
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">طباعة</span>,
      align: 'end',
      render: (d) => (
        <Button variant="ghost" size="sm" leadingIcon={<Printer size={12} strokeWidth={1.75} />} onClick={() => setOpen(d)}>
          عرض / طباعة
        </Button>
      ),
    },
  ];

  return (
    <CenteredShell>
      <PageHeader title="القرارات" subtitle="القرارات الرسمية الصادرة عن الهيئة" />
      <Card>
        <DataTable data={data ?? []} columns={columns} rowKey={(d) => d.id} loading={isLoading} empty={<EmptyState variant="generic" title="لا توجد قرارات بعد" />} zebraStripes />
      </Card>

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `القرار ${open.number}` : ''} size="lg">
        {open && (
          <Drawer.Body>
            <PrintLayout title="قرار رسمي · هيئة قبول أكاديمية الشرطة" subtitle={open.number} reportId={open.id} generatedAt={fmtDate(open.date)}>
              <p className="mb-3 text-2xs text-ink-500">رقم القرار: <span dir="ltr" className="font-mono">{open.number}</span></p>
              <p className="mb-2 text-2xs text-ink-500">التاريخ: {fmtDate(open.date)} ({open.hijriDate})</p>
              <p className="mb-6 text-2xs text-ink-500">المتقدم: <span dir="ltr" className="font-mono">{open.applicantId}</span></p>

              <article className="text-sm leading-relaxed">{open.body}</article>

              <div className="mt-9 grid grid-cols-3 gap-6 text-2xs">
                {open.signatures.map((s, i) => (
                  <div key={i} className="border-t border-ink-700 pt-2 text-center">{s}</div>
                ))}
              </div>

              <div className="mt-6"><KhayameyaStripe height="lg" /></div>
            </PrintLayout>
            <div className="mt-3 flex justify-end no-print">
              <Button variant="primary" leadingIcon={<Printer size={14} strokeWidth={1.75} />} onClick={() => window.print()}>طباعة</Button>
            </div>
          </Drawer.Body>
        )}
      </Drawer>
    </CenteredShell>
  );
}

/* ─────────────── Members CRUD ─────────────── */

export function BoardMembersPage(): JSX.Element {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['board', 'members'], queryFn: () => boardService.listMembers() });
  const addMut = useMutation({
    mutationFn: (payload: Omit<BoardMember, 'id'>) => boardService.addMember(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', 'members'] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => boardService.removeMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', 'members'] }),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState('');
  const [rank, setRank] = useState('عقيد');
  const [role, setRole] = useState<BoardMember['role']>('member');

  const columns: DataTableColumn<BoardMember>[] = useMemo(() => [
    { key: 'name', label: 'الاسم', render: (m) => <div className="flex items-center gap-3"><Avatar name={m.name} size="sm" /><div><p className="text-sm font-medium text-ink-900">{shortName(m.name, 4)}</p><p className="text-2xs text-ink-500" dir="ltr">{m.id}</p></div></div> },
    { key: 'rank', label: 'الرتبة', render: (m) => m.rank },
    { key: 'role', label: 'الدور', render: (m) => <Badge tone={m.role === 'chair' ? 'success' : m.role === 'secretary' ? 'info' : 'neutral'}>{m.role === 'chair' ? 'رئيس' : m.role === 'secretary' ? 'أمين سر' : 'عضو'}</Badge> },
    {
      key: '_actions',
      label: <span className="sr-only">حذف</span>,
      align: 'end',
      render: (m) => (
        <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => removeMut.mutate(m.id, { onSuccess: () => toast('تم حذف العضو', 'warning') })}>
          <Trash2 size={14} strokeWidth={1.75} />
        </Button>
      ),
    },
  ], [removeMut]);

  return (
    <CenteredShell>
      <PageHeader
        title="أعضاء الهيئة"
        subtitle="إدارة قائمة أعضاء الهيئة العليا"
        actions={
          <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />} onClick={() => setDrawerOpen(true)}>
            إضافة عضو
          </Button>
        }
      />
      <Card>
        <DataTable data={data ?? []} columns={columns} rowKey={(m) => m.id} loading={isLoading} empty={<EmptyState variant="generic" title="لا توجد أعضاء" />} zebraStripes />
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="إضافة عضو هيئة" size="sm">
        <Drawer.Body>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              addMut.mutate({ name, rank, role }, { onSuccess: () => { toast('تم إضافة العضو', 'success'); setDrawerOpen(false); } });
            }}
          >
            <Input label="الاسم بالكامل" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="الرتبة" value={rank} onChange={(e) => setRank(e.target.value)} />
            <Select
              label="الدور"
              value={role}
              onChange={(e) => setRole(e.target.value as BoardMember['role'])}
              options={[
                { value: 'chair', label: 'رئيس' },
                { value: 'secretary', label: 'أمين سر' },
                { value: 'member', label: 'عضو' },
              ]}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="primary" leadingIcon={<Users size={14} strokeWidth={1.75} />}>إضافة</Button>
            </div>
          </form>
        </Drawer.Body>
      </Drawer>
    </CenteredShell>
  );
}

/* Re-export marker for outline */
export const __sprint6Marker__ = { Mic, Gavel, Check };
