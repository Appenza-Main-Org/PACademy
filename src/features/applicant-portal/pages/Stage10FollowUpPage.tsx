/**
 * Stage 10 — pipeline follow-up (KARASA §2.2 stage 10).
 * Status of every downstream stage + next-action CTA.
 */

import { Link } from 'react-router-dom';
import { Activity, AlertCircle, CheckCircle2, Clock, ShieldQuestion, XCircle } from 'lucide-react';
import { Badge, Card, LoadingState } from '@/shared/components';
import { useDraft, useFollowUp } from '../api/applicantPortal.queries';
import type { PipelineState } from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';

const APPLICANT_ID = 'APP-2026000';

const STAGE_LABELS: Record<keyof NonNullable<ReturnType<typeof useFollowUp>['data']>, string> = {
  capacities: 'اختبار القدرات',
  traits: 'اختبار السمات',
  sports: 'اللياقة البدنية',
  medical: 'القومسيون الطبي',
  investigation: 'التحريات',
  finalResult: 'النتيجة النهائية',
};

const TONE_MAP: Record<PipelineState, { tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; icon: JSX.Element; label: string }> = {
  pending:           { tone: 'neutral', icon: <Clock size={14} strokeWidth={1.75} />, label: 'لم يبدأ' },
  'in-progress':     { tone: 'info',    icon: <Activity size={14} strokeWidth={1.75} />, label: 'جارٍ' },
  passed:            { tone: 'success', icon: <CheckCircle2 size={14} strokeWidth={1.75} />, label: 'اجتاز' },
  failed:            { tone: 'danger',  icon: <XCircle size={14} strokeWidth={1.75} />, label: 'لم يجتز' },
  'awaiting-approval': { tone: 'warning', icon: <ShieldQuestion size={14} strokeWidth={1.75} />, label: 'بانتظار الاعتماد' },
};

export function Stage10FollowUpPage(): JSX.Element {
  const { data: draft } = useDraft(APPLICANT_ID);
  const { data: followUp, isLoading } = useFollowUp(APPLICANT_ID);

  if (isLoading || !followUp) return <LoadingState variant="card-grid" count={6} />;

  const investigationOpen = followUp.investigation === 'in-progress' || followUp.investigation === 'awaiting-approval';

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <h2 className="font-ar-display text-xl font-bold text-ink-900">متابعة إجراءات التقدم</h2>
        <p className="mt-1 text-sm text-ink-500">
          تابع كل مراحل الفحص والاختبار من هنا. سيتم إخطارك فور تحديث أي حالة.
        </p>
        {draft?.examSlot && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-teal-50 px-3 py-2 text-xs text-teal-700">
            موعدك القادم: <span dir="ltr" className="font-numeric tnum">{fmtDate(draft.examSlot.date, 'short')} - {draft.examSlot.time}</span>
            · {draft.examSlot.location}
          </p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map((key) => {
          const state = followUp[key];
          const cfg = TONE_MAP[state];
          return (
            <Card key={key} className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-bold text-ink-900">{STAGE_LABELS[key]}</h3>
                <p className="mt-0.5 text-xs text-ink-500">حالة المرحلة الحالية</p>
              </div>
              <Badge tone={cfg.tone} icon={cfg.icon}>{cfg.label}</Badge>
            </Card>
          );
        })}
      </div>

      {investigationOpen && (
        <Card className="border-gold-300 bg-gold-50">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} strokeWidth={1.75} className="mt-0.5 text-gold-700" aria-hidden />
            <div>
              <h3 className="text-md font-bold text-gold-700">يُرجى البدء في وثيقة التعارف</h3>
              <p className="mt-1 text-sm text-gold-700/90">
                انتقل إلى وثيقة التعارف لاستكمال البيانات المطلوبة من إدارة التحريات.
              </p>
              <Link
                to={`${ROUTES.applicant}/acquaintance-doc`}
                className="mt-3 inline-flex items-center rounded-md bg-gold-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gold-600"
              >
                ابدأ وثيقة التعارف ←
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
