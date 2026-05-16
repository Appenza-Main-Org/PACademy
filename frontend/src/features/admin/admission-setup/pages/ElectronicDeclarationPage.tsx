/**
 * الإقرار الإلكتروني — dual-mode declaration editor.
 *
 * Admins author the declaration via either:
 *   • نص — rich-text body shown inline to applicants on Stage 9.
 *   • PDF — single uploaded PDF (≤10 MB) the applicant opens for review.
 *
 * Tabs persist whichever surface the admin is editing. The OTHER tab's
 * prior content survives the switch (service carries it forward) so the
 * admin can swap modes without losing work. Save bumps the version,
 * publish flips `publishedAt`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Save, Send, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  EmptyState,
  FileUpload,
  PageHeader,
  Tabs,
  Textarea,
  toast,
  type UploadFile,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell, useAdmissionSetupCanWrite } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  useElectronicDeclaration,
  usePublishDeclaration,
  useSetDeclaration,
} from '../api/admission-setup.queries';
import { admissionSetupService } from '../api/admission-setup.service';
import type { DeclarationDocument, DeclarationMode } from '../types';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function ElectronicDeclarationPage(): JSX.Element {
  const { cycle } = useAdmissionSetupCycle();
  const canWrite = useAdmissionSetupCanWrite();
  return (
    <AdmissionSetupShell>
      {!cycle ? <NoCycle /> : <Body cycle={cycle} canWrite={canWrite} />}
    </AdmissionSetupShell>
  );
}

function Body({ cycle, canWrite }: { cycle: AdmissionCycle; canWrite: boolean }): JSX.Element {
  const { data: current } = useElectronicDeclaration(cycle.id);
  const setMut = useSetDeclaration();
  const publishMut = usePublishDeclaration();

  const [activeMode, setActiveMode] = useState<DeclarationMode>(current?.mode ?? 'text');
  const [bodyAr, setBodyAr] = useState<string>(current?.bodyAr ?? '');
  const [pendingDoc, setPendingDoc] = useState<DeclarationDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState<Date | null>(
    current?.effectiveFrom ? new Date(current.effectiveFrom) : new Date(),
  );

  useEffect(() => {
    setActiveMode(current?.mode ?? 'text');
    setBodyAr(current?.bodyAr ?? '');
    setPendingDoc(null);
    setPendingFile(null);
    setUploadFiles([]);
    setEffectiveFrom(current?.effectiveFrom ? new Date(current.effectiveFrom) : new Date());
  }, [current?.id, current?.effectiveFrom, current?.mode, current?.bodyAr]);

  const displayDoc = pendingDoc ?? current?.document ?? null;

  const dirty = useMemo(() => {
    if (activeMode === 'text') {
      return (
        bodyAr.trim() !== (current?.bodyAr ?? '').trim() ||
        activeMode !== current?.mode ||
        (effectiveFrom?.toISOString() ?? '') !== (current?.effectiveFrom ?? '')
      );
    }
    if (pendingDoc) return true;
    if (!current) return false;
    return (
      activeMode !== current.mode ||
      (effectiveFrom?.toISOString() ?? '') !== current.effectiveFrom
    );
  }, [activeMode, bodyAr, current, effectiveFrom, pendingDoc]);

  const handleFilesChange = (next: UploadFile[]): void => {
    setUploadFiles(next);
    const picked = next[0];
    if (!picked || picked.status === 'error') {
      setPendingDoc(null);
      setPendingFile(null);
      return;
    }
    const file = picked.file;
    if (file.type && file.type !== 'application/pdf') {
      toast('يجب أن يكون الملف بصيغة PDF', 'danger');
      setPendingDoc(null);
      setPendingFile(null);
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast('حجم الملف يتجاوز 10 ميجابايت', 'danger');
      setPendingDoc(null);
      setPendingFile(null);
      return;
    }
    setPendingFile(file);
    setPendingDoc({
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      size: file.size,
    });
  };

  const handleRemoveDocument = (): void => {
    if (pendingDoc?.fileUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingDoc.fileUrl);
    }
    setPendingDoc(null);
    setPendingFile(null);
    setUploadFiles([]);
  };

  const handleSave = async (): Promise<void> => {
    if (!canWrite || !effectiveFrom) return;
    if (activeMode === 'text' && !bodyAr.trim()) {
      toast('يجب إدخال نص الإقرار قبل الحفظ', 'warning');
      return;
    }
    if (activeMode === 'pdf' && !pendingFile && !current?.document) {
      toast('يجب رفع مستند الإقرار قبل الحفظ', 'warning');
      return;
    }

    /* If we're in PDF mode with a newly-picked file, upload it first so
     * the backend has the actual bytes on disk. The setDeclaration call
     * then carries the server-issued URL (not the local blob URL). */
    let documentForSave: DeclarationDocument | null | undefined;
    if (activeMode === 'pdf') {
      if (pendingFile) {
        try {
          setIsUploading(true);
          const uploaded = await admissionSetupService.uploadDeclarationDocument(
            cycle.id,
            pendingFile,
          );
          documentForSave = {
            fileName: uploaded.fileName,
            fileUrl: uploaded.fileUrl,
            size: uploaded.size,
          };
        } catch (err) {
          toast((err as Error).message || 'تعذّر رفع المستند', 'danger');
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      } else {
        documentForSave = current?.document ?? null;
      }
    }

    setMut.mutate(
      {
        cycleId: cycle.id,
        mode: activeMode,
        bodyAr: activeMode === 'text' ? bodyAr.trim() : undefined,
        document: activeMode === 'pdf' ? documentForSave : undefined,
        effectiveFrom: effectiveFrom.toISOString(),
      },
      {
        onSuccess: (next) => {
          toast(`تم حفظ النسخة رقم ${toEasternArabicNumerals(next.version)}`, 'success');
          if (pendingDoc?.fileUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(pendingDoc.fileUrl);
          }
          setPendingDoc(null);
          setPendingFile(null);
          setUploadFiles([]);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  const handlePublish = (): void => {
    if (!canWrite || !current) return;
    publishMut.mutate({ id: current.id, rowVersion: current.rowVersion ?? '' }, {
      onSuccess: () => toast('تم نشر الإقرار للمتقدمين', 'success'),
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  const isPublished = Boolean(current?.publishedAt);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الإقرار الإلكتروني"
        subtitle={
          current
            ? `النسخة الحالية: ${toEasternArabicNumerals(current.version)} ${isPublished ? '— منشور' : '— مسودة'}`
            : 'لم يتم تعيين الإقرار بعد لهذه الدورة.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={() => void handleSave()}
              disabled={!canWrite || !dirty || isUploading}
              isLoading={setMut.isPending || isUploading}
            >
              {isUploading ? 'جارٍ رفع المستند…' : 'حفظ كنسخة جديدة'}
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Send size={14} strokeWidth={1.75} />}
              onClick={handlePublish}
              disabled={!canWrite || !current || isPublished || Boolean(pendingDoc) || dirty}
              isLoading={publishMut.isPending}
            >
              نشر
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-3">
            <Tabs
              value={activeMode}
              onValueChange={(v) => setActiveMode(v as DeclarationMode)}
            >
              <Tabs.List aria-label="وضع الإقرار">
                <Tabs.Tab value="text">نص</Tabs.Tab>
                <Tabs.Tab value="pdf">PDF</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="text" className="pt-3">
                <Textarea
                  value={bodyAr}
                  onChange={(e) => setBodyAr(e.currentTarget.value)}
                  disabled={!canWrite}
                  rows={12}
                  placeholder="اكتب نص الإقرار الذي سيوقّع عليه المتقدم…"
                  helper={
                    activeMode === 'text' && current?.mode === 'pdf'
                      ? 'الحفظ الآن سيبدّل وضع الإقرار إلى نص.'
                      : undefined
                  }
                />
              </Tabs.Panel>

              <Tabs.Panel value="pdf" className="pt-3">
                <FileUpload
                  accept="application/pdf,.pdf"
                  maxSize={MAX_PDF_BYTES}
                  files={uploadFiles}
                  onFilesChange={handleFilesChange}
                  title="اسحب مستند الإقرار (PDF) هنا أو انقر للاختيار"
                  helper="نوع مدعوم: PDF · الحد الأقصى للحجم: 10 ميجابايت"
                  disabled={!canWrite}
                />

                {displayDoc && (
                  <div className="mt-3 flex items-start gap-3 rounded-md border border-border-subtle bg-surface-card p-3">
                    <span
                      aria-hidden
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                      style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
                    >
                      <FileText size={18} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {displayDoc.fileName}
                      </p>
                      <p className="mt-0.5 text-2xs text-ink-500">
                        <span className="font-numeric tnum">{formatBytes(displayDoc.size)}</span>
                        {pendingDoc && (
                          <span className="ms-1 text-gold-700">· في انتظار الحفظ</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={displayDoc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-teal-700 hover:bg-teal-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
                      >
                        <ExternalLink size={12} strokeWidth={1.75} />
                        معاينة
                      </a>
                      {pendingDoc && canWrite && (
                        <button
                          type="button"
                          onClick={handleRemoveDocument}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-terra-700 hover:bg-terra-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
                          aria-label="إزالة المستند المرفوع"
                        >
                          <Trash2 size={12} strokeWidth={1.75} />
                          إزالة
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Tabs.Panel>
            </Tabs>
          </div>

          <div className="flex flex-col gap-2">
            <DatePicker
              label="تاريخ السريان"
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              disabled={!canWrite}
            />
            {current && (
              <div className="rounded-md border border-border-subtle bg-ink-50 p-3 text-2xs">
                <p className="text-ink-700">
                  <span className="font-medium">الوضع المنشور: </span>
                  {current.mode === 'text' ? 'نص' : 'PDF'}
                </p>
                <p className="mt-1 text-ink-700">
                  <span className="font-medium">آخر حفظ: </span>
                  {fmtDate(current.createdAt, 'full')}
                </p>
                {isPublished && (
                  <p className="mt-1 text-success">
                    <span className="font-medium">تاريخ النشر: </span>
                    {fmtDate(current.publishedAt!, 'full')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <header className="mb-3 flex items-center gap-2">
          <FileText size={16} strokeWidth={1.75} className="text-teal-600" />
          <h3 className="font-ar-display text-md font-bold text-ink-900">
            النسخة الحالية
          </h3>
          <Badge tone={isPublished ? 'success' : 'warning'}>
            {isPublished ? 'منشور' : 'مسودة'}
          </Badge>
          <Badge tone="neutral">{current?.mode === 'text' ? 'نص' : 'PDF'}</Badge>
        </header>
        {current?.mode === 'text' ? (
          current.bodyAr && current.bodyAr.trim().length > 0 ? (
            <div className="whitespace-pre-wrap rounded-md border border-border-subtle bg-surface-card p-4 text-sm leading-relaxed text-ink-900">
              {current.bodyAr}
            </div>
          ) : (
            <p className="text-2xs text-ink-500">— لم يتم إدخال نص بعد —</p>
          )
        ) : displayDoc ? (
          <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-card p-4 text-sm text-ink-900">
            <p>
              <span className="font-medium">اسم الملف: </span>
              <span className="text-ink-700">{displayDoc.fileName}</span>
            </p>
            <p>
              <span className="font-medium">الحجم: </span>
              <span className="font-numeric tnum text-ink-700">{formatBytes(displayDoc.size)}</span>
            </p>
            <a
              href={displayDoc.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 self-start text-2xs text-teal-700 hover:underline"
            >
              فتح المعاينة في تبويب جديد
              <ExternalLink size={12} strokeWidth={1.75} />
            </a>
          </div>
        ) : (
          <p className="text-2xs text-ink-500">— لم يتم رفع مستند بعد —</p>
        )}
      </Card>

      <Link to={ROUTES.applicant + '/print-card'} className="text-2xs text-teal-600 hover:underline">
        فتح صفحة طباعة البطاقة (المتقدم) →
      </Link>
    </div>
  );
}

function NoCycle(): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="يجب اختيار دورة قبول"
      action={
        <Link to={ROUTES.admin.cycleNew} className="inline-flex">
          <Button variant="primary">إنشاء دورة جديدة</Button>
        </Link>
      }
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 ب';
  const units = ['ب', 'ك.ب', 'م.ب', 'ج.ب'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i] ?? 'ب'}`;
}
