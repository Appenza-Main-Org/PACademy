/**
 * Sprint 6 — Board / Secretariat new pages.
 * Source: RFP Scope Document §4 sections A, B, C, D.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, CheckCircle2, Gavel, Mic, Pause, Play, Plus, Printer, ScrollText, Trash2, Users, XCircle } from 'lucide-react';
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
import { IconSeal, IconStamp } from '@/shared/components/icons';
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

      {/* Live session strip */}
      {session.status === 'live' && (
        <Card className="mb-5 border-success bg-success-bg/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="relative inline-flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
              </span>
              <p className="font-ar-display text-sm font-bold text-success">الجلسة جارية الآن · بثّ مباشر</p>
            </div>
            <div className="flex items-center gap-3 text-2xs text-ink-700">
              <span>الحضور: <span className="font-bold font-numeric tnum">{session.attendees.length || 5}</span> / 6</span>
              <span aria-hidden className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1 text-success font-medium">
                <Check size={11} strokeWidth={1.75} /> النصاب مكتمل
              </span>
            </div>
          </div>
        </Card>
      )}

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
          <div className="mt-4 rounded-md border border-border-subtle bg-ink-50 p-3 text-2xs">
            <p className="font-medium text-ink-900">تقدّم المراجعة</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.round(((activeIdx + 1) / Math.max(1, session.applicantIds.length)) * 100)}%` }} />
            </div>
            <p className="mt-1 text-ink-500">تمّ مناقشة <span className="font-numeric tnum font-bold">{activeIdx + 1}</span> من <span className="font-numeric tnum font-bold">{session.applicantIds.length}</span> متقدم</p>
          </div>
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
              <div className="mb-4 flex items-center gap-3 rounded-md border border-gold-300 bg-gold-50 p-4">
                <Avatar name={activeApplicantId} size="lg" />
                <div className="flex-1">
                  <p className="font-bold text-ink-900">المتقدم رقم <span className="font-mono" dir="ltr">{activeApplicantId}</span></p>
                  <p className="mt-0.5 text-2xs text-ink-700">يستعرض أمين السر ملفه الكامل أمام أعضاء الهيئة الآن — كل المراحل السابقة مُجتازة.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-2xs">
                    <Badge tone="success">طبي · لائق</Badge>
                    <Badge tone="success">رياضي · ناجح</Badge>
                    <Badge tone="success">نفسي · لائق</Badge>
                    <Badge tone="success">تحريات · إفراج</Badge>
                  </div>
                </div>
              </div>

              <div className="mb-3 flex flex-col gap-2">
                <p className="text-sm font-medium text-ink-900">تصويت الأعضاء (سرّي)</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {[{ id: 'BM-01', name: 'اللواء د. محمود سعيد' }, { id: 'BM-03', name: 'العميد د. أحمد محمود' }, { id: 'BM-04', name: 'العقيد محمد إبراهيم' }, { id: 'BM-05', name: 'الرائد طارق علي' }].map((member) => {
                    const myVote = votes[activeApplicantId]?.[member.id];
                    return (
                      <div key={member.id} className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={member.name} size="sm" />
                          <span className="truncate text-sm">{member.name}</span>
                        </div>
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

              {/* Live tally with bars */}
              {(() => {
                const totalCast = counts.pass + counts.reject + counts.defer;
                const decided = totalCast === 4;
                const verdict = decided
                  ? counts.pass > counts.reject && counts.pass > counts.defer
                    ? 'pass'
                    : counts.reject > counts.pass && counts.reject > counts.defer
                      ? 'reject'
                      : 'defer'
                  : null;
                const containerCls = verdict === 'pass'
                  ? 'border-success bg-success-bg/40'
                  : verdict === 'reject'
                    ? 'border-terra-500 bg-terra-50'
                    : 'border-gold-300 bg-gold-50';
                return (
                  <div className={`rounded-md border-s-4 p-3 ${containerCls}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-2xs font-bold text-gold-700">مُحصِّلة الأصوات (لرئيس الجلسة)</p>
                      {decided && verdict === 'pass' ? (
                        <Badge tone="success">
                          <IconStamp width={11} height={11} className="me-1 inline-block" />
                          قرار: قبول · جاهز للاعتماد
                        </Badge>
                      ) : (
                        <span className="text-2xs text-gold-700">{totalCast} / 4 صوّتوا</span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-2xs">
                      <TallyBar label="قبول" count={counts.pass} total={4} color="bg-success" />
                      <TallyBar label="رفض" count={counts.reject} total={4} color="bg-terra-500" />
                      <TallyBar label="تأجيل" count={counts.defer} total={4} color="bg-gold-500" />
                    </div>
                  </div>
                );
              })()}
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
            <PrintLayout
              title="قرار رسمي صادر عن هيئة قبول أكاديمية الشرطة"
              subtitle={`القرار رقم ${open.number}`}
              reportId={open.id}
              generatedAt={fmtDate(open.date)}
            >
              {/* Decision number stamp */}
              <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border-2 border-gold-500 bg-gold-50 p-4">
                <div className="flex items-center gap-3">
                  <ScrollText size={28} strokeWidth={1.75} className="text-gold-700" aria-hidden />
                  <div>
                    <p className="text-2xs uppercase tracking-wide text-ink-500">قرار هيئة القبول رقم</p>
                    <p className="font-mono text-2xl font-bold text-gold-700" dir="ltr">{open.number}</p>
                  </div>
                </div>
                <div className="text-end text-2xs">
                  <p className="text-ink-500">صادر بتاريخ</p>
                  <p className="mt-0.5 font-medium text-ink-900">{fmtDate(open.date)}</p>
                  <p className="mt-0.5 font-medium text-ink-700" dir="rtl">الموافق {open.hijriDate} هـ</p>
                </div>
              </div>

              {/* Outcome verdict box */}
              <div
                className={
                  'mb-6 flex items-center justify-between gap-3 rounded-md border-2 p-3 ' +
                  (open.outcome === 'accepted'
                    ? 'border-success bg-success-bg'
                    : open.outcome === 'rejected'
                      ? 'border-terra-500 bg-terra-50'
                      : 'border-gold-500 bg-gold-50')
                }
              >
                <div className="flex items-center gap-3">
                  {open.outcome === 'accepted' ? (
                    <CheckCircle2 size={22} strokeWidth={1.75} className="text-success" aria-hidden />
                  ) : open.outcome === 'rejected' ? (
                    <XCircle size={22} strokeWidth={1.75} className="text-terra-600" aria-hidden />
                  ) : (
                    <Pause size={22} strokeWidth={1.75} className="text-gold-700" aria-hidden />
                  )}
                  <div>
                    <p className="text-2xs uppercase tracking-wide text-ink-500">حُكم الهيئة</p>
                    <p className="font-ar-display text-lg font-bold text-ink-900">
                      {open.outcome === 'accepted' && 'القبول النهائي بالأكاديمية'}
                      {open.outcome === 'rejected' && 'رفض الترشّح'}
                      {open.outcome === 'deferred' && 'تأجيل القرار للدورة القادمة'}
                    </p>
                  </div>
                </div>
                <div className="text-end font-mono text-2xs text-ink-700" dir="ltr">
                  <p>{fmtDate(open.date, 'short')}</p>
                  <p className="text-ink-500">{open.hijriDate} هـ</p>
                </div>
              </div>

              {/* Identity block */}
              <div className="mb-5 grid grid-cols-2 gap-3 rounded-md border border-border-default bg-ink-50 p-4 text-2xs">
                <div>
                  <p className="uppercase tracking-wide text-ink-500">رقم المتقدم</p>
                  <p className="mt-0.5 font-mono text-sm text-ink-900" dir="ltr">{open.applicantId}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-ink-500">رقم الجلسة</p>
                  <p className="mt-0.5 font-mono text-sm text-ink-900" dir="ltr">{open.sessionId}</p>
                </div>
              </div>

              {/* Formal Arabic body */}
              <article className="rounded-md border border-border-subtle bg-surface-card p-5">
                <p className="mb-3 font-ar-display text-md font-bold text-ink-900">بسم الله الرحمن الرحيم</p>
                <p className="mb-3 text-sm leading-loose text-ink-900">
                  بناءً على اطّلاع الهيئة العليا لقبول طلبة كلية الشرطة على ملفّ المتقدم رقم
                  <span className="mx-1 inline-block font-mono font-bold" dir="ltr">{open.applicantId}</span>،
                  وبعد استعراض كامل نتائجه في مراحل الفحص الطبّي، واللياقة البدنية، والاختبارات النفسية، والتحريات الأمنية،
                  وبموجب أحكام كرّاسة الشروط لدورة <span className="font-numeric tnum">2026</span>،
                  واستناداً إلى المداولة الرسمية أثناء الجلسة المنعقدة بتاريخ {fmtDate(open.date, 'short')}،
                </p>
                <p className="mb-3 text-sm leading-loose text-ink-900 font-medium">قرّرت الهيئة بإجماع الأعضاء الحاضرين ما يلي:</p>
                <article className="border-r-2 border-gold-500 bg-gold-50/40 px-4 py-3 text-sm leading-loose text-ink-900">{open.body}</article>
                <p className="mt-3 text-sm leading-loose text-ink-900">
                  وقد صدر هذا القرار رسمياً بتاريخ {fmtDate(open.date)} الموافق {open.hijriDate} هـ، وأُودع بسجلّ قرارات الهيئة برقم
                  <span className="mx-1 inline-block font-mono font-bold" dir="ltr">{open.number}</span>،
                  وعلى الإدارات المختصّة اتّخاذ إجراءات التنفيذ.
                </p>
                <p className="mt-3 text-sm font-medium text-ink-900">والله ولي التوفيق،،</p>
              </article>

              {/* Signature blocks */}
              <div className="mt-9 grid grid-cols-3 gap-6 text-2xs">
                {open.signatures.length > 0 ? (
                  open.signatures.map((s, i) => (
                    <DecisionSignature
                      key={i}
                      title={i === 0 ? 'رئيس الهيئة' : i === open.signatures.length - 1 ? 'أمين سرّ الهيئة' : 'عضو الهيئة'}
                      name={s}
                    />
                  ))
                ) : (
                  <>
                    <DecisionSignature title="رئيس الهيئة" name="اللواء د. محمود سعيد عبد الفتّاح" />
                    <DecisionSignature title="عضو الهيئة" name="العميد د. أحمد محمود الشّريف" />
                    <DecisionSignature title="أمين سرّ الهيئة" name="العقيد محمد إبراهيم الشّافعي" />
                  </>
                )}
              </div>

              {/* Official seal */}
              <div className="mt-6 flex items-center justify-between gap-4">
                <div className="text-2xs text-ink-500">
                  <p>هذا القرار صادر بصورة رسمية ومُعتمد بختم الإدارة.</p>
                  <p className="mt-0.5">أيّ نسخة بدون الختم الرسمي تُعتبر لاغية.</p>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <span aria-hidden className="text-gold-600">
                    <IconSeal width={72} height={72} />
                  </span>
                  <p className="text-2xs font-medium text-gold-700">ختم هيئة القبول</p>
                </div>
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

function TallyBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }): JSX.Element {
  const pct = Math.round((count / Math.max(1, total)) * 100);
  return (
    <div className="rounded-md border border-border-subtle bg-surface-card p-2 text-center">
      <p className="text-ink-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-bold tnum text-ink-900" dir="ltr">{count}</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full transition-all duration-base ease-standard ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DecisionSignature({ title, name }: { title: string; name: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center text-center">
      <span aria-hidden className="block h-12 w-full border-b border-dashed border-ink-700/60" />
      <p className="mt-2 font-medium text-ink-900">{title}</p>
      <p className="mt-0.5 text-ink-700">{name}</p>
    </div>
  );
}

/* Re-export marker for outline */
export const __sprint6Marker__ = { Mic, Gavel, Check };
