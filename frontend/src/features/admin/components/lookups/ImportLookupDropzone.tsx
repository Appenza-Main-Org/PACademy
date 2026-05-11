/**
 * ImportLookupDropzone — file picker + rejection display for the import wizard.
 *
 * Wraps shared <FileUpload> with:
 *   - accept: .xlsx and .csv only
 *   - maxSize: 5 MB (FR-004)
 *   - Arabic rejection message when the whole file is rejected
 *   - Template download link
 *
 * Usage:
 *   <ImportLookupDropzone
 *     lookupKey="governorates"
 *     onFile={handleFile}
 *     rejection={null}
 *     onDownloadTemplate={handleDownload}
 *     disabled={false}
 *   />
 */

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, FileUpload, toast } from '@/shared/components';
import type { UploadFile } from '@/shared/components';
import type { ImportLookupKey, ImportRejection } from '../../api/lookup-import';
import { buildTemplate, downloadBlob } from '../../api/lookup-import';
import { LOOKUP_IMPORT_LABELS } from './import-lookup-labels';

const MAX_BYTES = 5 * 1024 * 1024;

interface ImportLookupDropzoneProps {
  lookupKey: ImportLookupKey;
  /** Called when the user selects a file (before parsing). */
  onFile: (file: File) => void;
  /** Non-null when the file was rejected before any preview is shown. */
  rejection: ImportRejection | null;
  disabled?: boolean;
}

/** File picker with template download + rejection banner. */
export function ImportLookupDropzone({
  lookupKey,
  onFile,
  rejection,
  disabled = false,
}: ImportLookupDropzoneProps): JSX.Element {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [downloading, setDownloading] = useState(false);

  const handleFilesChange = (files: UploadFile[]): void => {
    setUploadFiles(files);
    const latest = files.at(-1);
    if (latest?.file) {
      onFile(latest.file);
    }
  };

  const handleDownload = async (): Promise<void> => {
    setDownloading(true);
    try {
      const blob = await buildTemplate(lookupKey);
      const label = LOOKUP_IMPORT_LABELS[lookupKey] ?? lookupKey;
      downloadBlob(blob, `قالب-${label}.xlsx`);
    } catch {
      toast('تعذّر إنشاء القالب', 'danger');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FileUpload
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        maxSize={MAX_BYTES}
        files={uploadFiles}
        onFilesChange={handleFilesChange}
        title="اسحب ملف Excel أو CSV هنا"
        helper="يُقبل: .xlsx أو .csv · الحد الأقصى 5 ميجابايت"
        disabled={disabled}
      />

      {rejection && (
        <div
          role="alert"
          className="rounded-md border border-terra-200 bg-terra-50 px-4 py-3 text-sm text-terra-700"
        >
          <span className="font-medium">تعذّر قراءة الملف: </span>
          {rejection.messageAr}
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-card px-3 py-2">
        <p className="text-2xs text-ink-500">
          تنزيل القالب لمعرفة الأعمدة المطلوبة قبل الرفع
        </p>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Download size={13} strokeWidth={1.75} />}
          onClick={() => void handleDownload()}
          isLoading={downloading}
          disabled={disabled}
        >
          تنزيل القالب
        </Button>
      </div>
    </div>
  );
}
