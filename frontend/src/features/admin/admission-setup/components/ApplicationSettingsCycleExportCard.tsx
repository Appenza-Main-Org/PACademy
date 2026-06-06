/**
 * ApplicationSettingsCycleExportCard — exports the configured cycle
 * application settings (شروط التخصص) to Excel, with every authored detail
 * flattened to one row per rule.
 *
 * Embeddable: rendered on the Data-Exchange hub (`/admin/data-exchange`)
 * so admins can pull a full, human-readable snapshot of the active (or any
 * selected) cycle's specialization conditions. Self-contained — it resolves
 * the cycle, the draft/committed settings, and the lookup labels itself.
 *
 * Source precedence mirrors the wizard review step: the per-cycle wizard
 * draft (`local` ⊕ `approved`) when present, otherwise the committed
 * app-settings tree. Reads the draft directly (no store mutation) so it has
 * no side effects on the admission-setup wizard.
 */

import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Select,
  toast,
} from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { emitAudit } from '@/shared/lib/audit';
import { downloadBlob } from '@/shared/lib/download';
import {
  applicationSettingsQueryOptions,
  useCategoryConfigs,
} from '../api/applicationSettings.queries';
import {
  applicationSettingsService,
  type ApplicationSettingsCycleDraftPayload,
} from '../api/applicationSettings.service';
import { readApplicationSettingsCycleDraft } from '../lib/application-settings-cycle-draft';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import type {
  GeneralRulesHeader,
  LocalGeneralRuleRow,
} from '../store/wizardSharedState';
import {
  buildApplicationSettingsDraftRows,
  buildApplicationSettingsSummaryRows,
  buildApplicationSettingsWorkbookBlob,
  type ApplicationSettingsCategoryMeta,
  type ApplicationSettingsLabelMaps,
} from '../lib/applicationSettingsExport';

interface ResolvedDraft {
  headers: Record<string, GeneralRulesHeader>;
  local: LocalGeneralRuleRow[];
  approved: LocalGeneralRuleRow[];
}

/** Merge the local (localStorage) + remote cycle drafts, preferring the
 *  newer by `updatedAt` — same precedence the wizard hydration uses, but
 *  without writing back into the shared wizard store. */
async function resolveCycleDraft(cycleId: string): Promise<ResolvedDraft> {
  const localDraft = readApplicationSettingsCycleDraft(cycleId);

  let remote: ApplicationSettingsCycleDraftPayload | null = null;
  try {
    remote = await applicationSettingsService.getCycleDraft(cycleId);
  } catch {
    remote = null;
  }
  const remoteValid =
    remote && Array.isArray(remote.local) && Array.isArray(remote.approved)
      ? remote
      : null;

  const preferRemote =
    remoteValid !== null &&
    (!localDraft ||
      Date.parse(remoteValid.updatedAt ?? '') > Date.parse(localDraft.updatedAt));

  if (preferRemote && remoteValid) {
    return {
      headers: remoteValid.headers as Record<string, GeneralRulesHeader>,
      local: remoteValid.local as LocalGeneralRuleRow[],
      approved: remoteValid.approved as LocalGeneralRuleRow[],
    };
  }
  if (localDraft) {
    return {
      headers: localDraft.headers,
      local: localDraft.local,
      approved: localDraft.approved,
    };
  }
  return { headers: {}, local: [], approved: [] };
}

export function ApplicationSettingsCycleExportCard(): JSX.Element {
  const { cycle, setCycle, availableCycles, isLoading: cyclesLoading } =
    useAdmissionSetupCycle();
  const configsQuery = useCategoryConfigs(true, cycle?.id ?? null);
  const maritalQuery = useLookup('marital-statuses', applicationSettingsQueryOptions);
  const academicGradesQuery = useLookup('academic-grades', applicationSettingsQueryOptions);
  const academicDegreesQuery = useLookup('academic-degrees', applicationSettingsQueryOptions);
  const committeesQuery = useLookup('committees', applicationSettingsQueryOptions);
  const examRoundsQuery = useLookup('exam-rounds', applicationSettingsQueryOptions);
  const schoolCategoriesQuery = useLookup('school-categories', applicationSettingsQueryOptions);

  const [exporting, setExporting] = useState(false);

  const labels = useMemo<ApplicationSettingsLabelMaps>(
    () => ({
      marital: new Map((maritalQuery.data ?? []).map((r) => [r.code, r.name])),
      academicGrade: new Map((academicGradesQuery.data ?? []).map((r) => [r.code, r.name])),
      academicDegree: new Map((academicDegreesQuery.data ?? []).map((r) => [r.code, r.name])),
      committee: new Map((committeesQuery.data ?? []).map((r) => [r.code, r.name])),
      examRound: new Map((examRoundsQuery.data ?? []).map((r) => [r.code, r.name])),
      schoolCategory: new Map((schoolCategoriesQuery.data ?? []).map((r) => [r.code, r.name])),
    }),
    [
      maritalQuery.data,
      academicGradesQuery.data,
      academicDegreesQuery.data,
      committeesQuery.data,
      examRoundsQuery.data,
      schoolCategoriesQuery.data,
    ],
  );

  const categoryMeta = useMemo<Map<string, ApplicationSettingsCategoryMeta>>(
    () =>
      new Map(
        (configsQuery.data ?? []).map((c) => [
          c.categoryCode,
          {
            nameAr: c.categoryNameAr,
            type: c.categoryType === 'pre_university' ? 'pre_university' : 'university',
          } satisfies ApplicationSettingsCategoryMeta,
        ]),
      ),
    [configsQuery.data],
  );

  const cycleOptions = useMemo(
    () =>
      availableCycles.map((c) => ({
        value: c.id,
        label: `${c.nameAr} (${c.year})${c.isActive ? ' — نشطة' : ''}`,
      })),
    [availableCycles],
  );

  const labelsLoading =
    maritalQuery.isLoading ||
    academicGradesQuery.isLoading ||
    academicDegreesQuery.isLoading ||
    committeesQuery.isLoading ||
    examRoundsQuery.isLoading ||
    schoolCategoriesQuery.isLoading ||
    configsQuery.isLoading;

  async function handleExport(): Promise<void> {
    if (!cycle) {
      toast('اختر دورة لتصدير شروط التخصص الخاصة بها.', 'warning');
      return;
    }
    const cycleName = `${cycle.nameAr} (${cycle.year})`;
    setExporting(true);
    try {
      const draft = await resolveCycleDraft(cycle.id);
      const hasDraftRows = draft.local.length > 0 || draft.approved.length > 0;

      let rows: string[][];
      if (hasDraftRows) {
        rows = buildApplicationSettingsDraftRows({
          cycleName,
          headers: draft.headers,
          approved: draft.approved,
          local: draft.local,
          categoryMeta,
          labels,
        });
      } else {
        const summary = await applicationSettingsService.getApplicationSettingsSummary();
        rows = buildApplicationSettingsSummaryRows({ cycleName, summary, labels });
      }

      if (rows.length === 0) {
        toast('لا توجد شروط تخصص مُعدّة لهذه الدورة بعد.', 'warning');
        return;
      }

      const blob = await buildApplicationSettingsWorkbookBlob(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `application-settings-${cycle.cohort}-${cycle.year}-${stamp}.xlsx`);

      emitAudit({
        action: 'entity_exported',
        module: 'admin',
        entityType: 'application-settings',
        entityLabel: 'شروط التخصص',
        entityId: `app-settings-${cycle.id}`,
        details: `تصدير ${rows.length} شرط تخصص لدورة ${cycleName}`,
      });
      toast(`تم تصدير ${rows.length} شرط تخصص.`, 'success');
    } catch {
      toast('تعذّر تصدير شروط التخصص.', 'danger');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <FileSpreadsheet size={18} /> تصدير شروط التخصص للدورة
          </span>
        }
        subtitle="تصدير الإعدادات المُعدّة لدورة القبول كاملةً إلى Excel — صف لكل شرط مع كل تفاصيله (الفئة، التخصص، النوع، الحالة الاجتماعية، السن، التقدير/الدرجة، اللجنة، سنوات التخرج)."
        actions={<Badge tone="accent">شروط التخصص</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
          <Select
            label="دورة القبول"
            value={cycle?.id ?? ''}
            options={cycleOptions}
            disabled={cyclesLoading || cycleOptions.length === 0}
            onChange={(e) => setCycle(e.target.value || null)}
          />
          <p className="text-xs leading-6 text-ink-500">
            يُؤخذ المحتوى من إعدادات «شروط التخصص» المحفوظة للدورة المختارة. تشمل النسخة الشروط
            المعتمدة وأي شروط قيد التحرير.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
          <p className="text-xs leading-6 text-ink-500">
            ملف Excel واحد بترويسة عربية واتجاه من اليمين لليسار، يضم كل فئات الدورة وشروطها في ورقة واحدة.
          </p>
          <Button
            variant="primary"
            isLoading={exporting}
            disabled={labelsLoading || !cycle}
            onClick={() => void handleExport()}
          >
            <FileSpreadsheet size={16} className="me-1" />
            تصدير شروط التخصص
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
