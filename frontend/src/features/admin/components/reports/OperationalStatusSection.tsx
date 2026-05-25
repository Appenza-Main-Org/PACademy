/**
 * Section 5 — الحالة التشغيلية الفورية (Operational live status).
 * 4-column grid: committees, medical stations, board sessions, ongoing exams.
 */

import { ClipboardList, Stethoscope, Users2, Wifi } from 'lucide-react';
import { Card, CardBody, CardHeader, EmptyState } from '@/shared/components';
import { IconStamp } from '@/shared/components/icons';
import { num } from '@/shared/lib/format';
import type { OperationalStatus } from '@/shared/types/domain';
import { SectionHeading } from './SectionHeading';

interface OperationalStatusSectionProps {
  status: OperationalStatus;
}

export function OperationalStatusSection({ status }: OperationalStatusSectionProps): JSX.Element {
  const totalCommitteeQueue = status.committees.reduce((sum, committee) => sum + committee.todayQueue, 0);
  const totalCommitteeProcessed = status.committees.reduce((sum, committee) => sum + committee.todayProcessed, 0);
  const committeeThroughput =
    totalCommitteeQueue > 0 ? Math.round((totalCommitteeProcessed / totalCommitteeQueue) * 100) : 0;
  const busiestStation = status.medicalStations
    .slice()
    .sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes)[0];
  const liveSessions = status.boardSessions.filter((session) => session.state === 'live').length;
  const abandonedExams = status.ongoingExams.reduce((sum, exam) => sum + exam.abandonedCount, 0);

  return (
    <section className="mb-8">
      <SectionHeading
        title="الحالة التشغيلية الفورية"
        trailing={
          <div className="grid grid-cols-2 gap-2 text-2xs md:grid-cols-4">
            <OpsPill label="إنجاز اللجان" value={`${committeeThroughput}%`} tone={committeeThroughput >= 65 ? 'success' : 'warning'} />
            <OpsPill label="أطول انتظار" value={busiestStation ? `${busiestStation.avgWaitMinutes}د` : '—'} tone={busiestStation && busiestStation.avgWaitMinutes >= 35 ? 'warning' : 'success'} />
            <OpsPill label="جلسات مباشرة" value={num(liveSessions)} tone={liveSessions > 0 ? 'warning' : 'success'} />
            <OpsPill label="انسحاب اختبار" value={num(abandonedExams)} tone={abandonedExams > 0 ? 'warning' : 'success'} />
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Tile A — Committees */}
        <Card variant="compact">
          <CardHeader title="اللجان النشطة" subtitle="معالجة اليوم" />
          <CardBody>
            {status.committees.length === 0 ? (
              <EmptyState variant="generic" title="لا توجد لجان نشطة اليوم" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {status.committees.map((c) => {
                  const ratio =
                    c.todayQueue > 0 ? Math.min(1, c.todayProcessed / c.todayQueue) : 0;
                  return (
                    <li key={c.id} className="flex flex-col gap-1.5 text-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 truncate text-ink-700">
                          <ClipboardList size={12} strokeWidth={1.75} className="text-ink-500" />
                          <span className="truncate">{c.name}</span>
                          {c.signedOffToday && (
                            <span
                              aria-label="تم الاعتماد"
                              className="inline-flex items-center rounded-pill bg-gold-50 px-1.5 py-0.5 text-gold-700"
                            >
                              <IconStamp width={10} height={10} className="me-0.5" />
                              معتمد
                            </span>
                          )}
                        </span>
                        <span className="font-numeric tnum text-ink-500 shrink-0">
                          {num(c.todayProcessed)} / {num(c.todayQueue)}
                        </span>
                      </div>
                      <span className="block h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
                        <span
                          className="block h-full rounded-pill"
                          style={{
                            width: `${Math.round(ratio * 100)}%`,
                            background: ratio >= 0.65 ? 'var(--success)' : 'var(--gold-500)',
                          }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Tile B — Medical stations */}
        <Card variant="compact">
          <CardHeader title="طوابير القومسيون الطبي" subtitle="مرتبة حسب طول الطابور" />
          <CardBody>
            {status.medicalStations.length === 0 ? (
              <EmptyState variant="generic" title="لا توجد محطات نشطة" />
            ) : (
              <ul className="flex flex-col gap-2 text-2xs">
                {status.medicalStations.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate text-ink-700">
                      <Stethoscope size={12} strokeWidth={1.75} className="text-ink-500" />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="font-numeric tnum text-ink-700">{num(s.queue)}</span>
                      <span className="text-ink-500">انتظار</span>
                      <span className="font-numeric tnum text-ink-500">~{s.avgWaitMinutes}د</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Tile C — Board sessions */}
        <Card variant="compact">
          <CardHeader title="جلسات الهيئة اليوم" subtitle="حالة الجلسات الجارية" />
          <CardBody>
            {status.boardSessions.length === 0 ? (
              <EmptyState variant="generic" title="لا توجد جلسات اليوم" />
            ) : (
              <ul className="flex flex-col gap-2 text-2xs">
                {status.boardSessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate text-ink-700">
                      <Users2 size={12} strokeWidth={1.75} className="text-ink-500" />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="font-numeric tnum text-ink-700">{s.scheduledTime}</span>
                      <SessionState state={s.state} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Tile D — Ongoing exams */}
        <Card variant="compact">
          <CardHeader title="الاختبارات الإلكترونية الجارية" subtitle="جلسات قيد الإجراء" />
          <CardBody>
            {status.ongoingExams.length === 0 ? (
              <EmptyState variant="generic" title="لا توجد اختبارات جارية" />
            ) : (
              <ul className="flex flex-col gap-2.5 text-2xs">
                {status.ongoingExams.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-ink-700">
                        <Wifi size={12} strokeWidth={1.75} className="text-ink-500" />
                        <span className="truncate">{e.name}</span>
                      </span>
                      <span className="font-numeric tnum text-ink-500 shrink-0">{e.startedTime}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-ink-500">
                      <span>
                        مشاركون: <span className="font-numeric tnum text-ink-700">{num(e.takingCount)}</span>
                      </span>
                      <span>
                        إنجاز: <span className="font-numeric tnum text-ink-700">{e.avgCompletionPercent}%</span>
                      </span>
                      <span>
                        منسحب: <span className="font-numeric tnum text-terra-700">{num(e.abandonedCount)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

function OpsPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning';
}): JSX.Element {
  return (
    <span
      className={`inline-flex items-center justify-between gap-2 rounded-md border px-2.5 py-1 ${
        tone === 'success'
          ? 'border-teal-100 bg-teal-50 text-teal-700'
          : 'border-gold-200 bg-gold-50 text-gold-700'
      }`}
    >
      <span>{label}</span>
      <span className="font-numeric tnum font-bold">{value}</span>
    </span>
  );
}

function SessionState({ state }: { state: 'scheduled' | 'live' | 'decided' }): JSX.Element {
  if (state === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-terra-50 px-1.5 py-0.5 text-terra-700">
        <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-terra-500" />
        مباشر
      </span>
    );
  }
  if (state === 'decided') {
    return (
      <span className="inline-flex items-center rounded-pill bg-gold-50 px-1.5 py-0.5 text-gold-700">
        <IconStamp width={10} height={10} className="me-0.5" />
        معتمدة
      </span>
    );
  }
  return <span className="inline-flex items-center rounded-pill bg-ink-100 px-1.5 py-0.5 text-ink-500">مقررة</span>;
}
