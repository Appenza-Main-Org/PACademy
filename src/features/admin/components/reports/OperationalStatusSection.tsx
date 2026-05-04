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
  return (
    <section className="mb-8">
      <SectionHeading
        title="الحالة التشغيلية الفورية"
        eyebrow="RFP Scope Document §3 · §4(2-1) · §4(2-4) · §4(2-7)"
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
                            background: 'var(--accent-500)',
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
