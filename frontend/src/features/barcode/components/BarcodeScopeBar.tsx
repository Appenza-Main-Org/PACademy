/**
 * BarcodeScopeBar — operator-scope control for the print surfaces
 * (US-BC-011 → US-BC-016). Admins pick which scope to operate under and may
 * toggle the same-day override; scoped-role operators see a locked summary.
 *
 * Feature-local (two consumers — Generate + Batch) — below the shared-promote
 * threshold.
 */

import { Lock, ShieldCheck } from 'lucide-react';
import { Badge, Card, CardBody, Select, Switch } from '@/shared/components';
import { BARCODE_COMMITTEE_OPTIONS, BARCODE_EXAM_TYPE_OPTIONS } from '../lib/barcodeGroups';
import { scopeHasSameDayGate, type OperatorScope, type OperatorScopeKind } from '../lib/barcodeScope';

const SCOPE_KIND_OPTIONS: ReadonlyArray<{ value: OperatorScopeKind; label: string }> = [
  { value: 'admin', label: 'كل المتقدمين (مدير)' },
  { value: 'student-committee', label: 'لجنة طلبة' },
  { value: 'exam-committee', label: 'لجنة اختبار' },
  { value: 'medical', label: 'القومسيون الطبي' },
];

const SCOPE_KIND_LABEL: Record<OperatorScopeKind, string> = {
  'admin': 'كل المتقدمين',
  'student-committee': 'لجنة طلبة',
  'exam-committee': 'لجنة اختبار',
  'medical': 'القومسيون الطبي',
};

interface BarcodeScopeBarProps {
  scope: OperatorScope;
  onChange: (next: OperatorScope) => void;
  /** True for scoped-role operators — the scope kind cannot be changed. */
  locked: boolean;
  /** True for barcode:config holders — may toggle the same-day override. */
  canOverride: boolean;
}

export function BarcodeScopeBar({ scope, onChange, locked, canOverride }: BarcodeScopeBarProps): JSX.Element {
  const changeKind = (kind: OperatorScopeKind): void => {
    onChange({
      kind,
      override: false,
      ...(kind === 'student-committee' ? { committee: BARCODE_COMMITTEE_OPTIONS[0]!.value } : {}),
      ...(kind === 'exam-committee' ? { examType: BARCODE_EXAM_TYPE_OPTIONS[0]!.value } : {}),
    });
  };

  return (
    <Card className="mb-4" variant="compact">
      <CardBody>
        <div className="flex flex-wrap items-end gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
            {locked ? <Lock size={14} strokeWidth={1.75} /> : <ShieldCheck size={14} strokeWidth={1.75} />}
            نطاق التشغيل
          </span>

          {locked ? (
            <Badge tone="accent">{SCOPE_KIND_LABEL[scope.kind]}</Badge>
          ) : (
            <Select
              aria-label="نطاق التشغيل"
              value={scope.kind}
              onChange={(e) => changeKind(e.target.value as OperatorScopeKind)}
              options={SCOPE_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              containerClassName="min-w-[12rem]"
            />
          )}

          {scope.kind === 'student-committee' && (
            <Select
              aria-label="اللجنة"
              value={scope.committee ?? ''}
              onChange={(e) => onChange({ ...scope, committee: e.target.value })}
              options={BARCODE_COMMITTEE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              containerClassName="min-w-[12rem]"
            />
          )}

          {scope.kind === 'exam-committee' && (
            <Select
              aria-label="نوع الاختبار"
              value={scope.examType ?? ''}
              onChange={(e) => onChange({ ...scope, examType: e.target.value })}
              options={BARCODE_EXAM_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              containerClassName="min-w-[12rem]"
            />
          )}

          {scopeHasSameDayGate(scope.kind) && (
            <div className="flex items-center pb-1">
              <Switch
                label="استثناء إداري (تجاوز قيد اليوم)"
                checked={scope.override}
                disabled={!canOverride}
                onCheckedChange={(v) => onChange({ ...scope, override: v })}
              />
            </div>
          )}
        </div>

        {scopeHasSameDayGate(scope.kind) && (
          <p className="mt-2 text-2xs text-ink-500">
            {scope.override
              ? 'تم تفعيل الاستثناء الإداري — تُعرض كل الحالات المؤهَّلة بصرف النظر عن موعد اليوم.'
              : 'الطباعة مقيّدة بالمتقدمين المؤهَّلين لاختبار اليوم فقط. يمكن لمدير النظام تفعيل استثناء.'}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
