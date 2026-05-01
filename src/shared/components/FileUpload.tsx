/**
 * FileUpload — drag-drop zone with state machine.
 * Source: Tasks/DESIGN_SYSTEM.md §4.11.
 *
 * States: idle · dragover · uploading · success · error.
 * Default zone 200×120, dashed border-strong.
 *
 * NB: this primitive is a controlled UI shell — actual upload happens in
 * the consumer via TanStack Query mutations. The component reports file
 * selection events and exposes `progress`/`status` props for parent control.
 *
 * Usage:
 *   <FileUpload accept="image/jpeg,image/png" maxSize={2 * 1024 * 1024}
 *               files={files} onFilesChange={setFiles} status={status}
 *               progress={progress} />
 */

import { useCallback, useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { File as FileIcon, RotateCcw, Upload, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export type UploadStatus = 'idle' | 'dragover' | 'uploading' | 'success' | 'error';

export interface UploadFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress?: number; // 0..100
  errorMessage?: string;
}

interface FileUploadProps {
  files?: readonly UploadFile[];
  onFilesChange?: (files: UploadFile[]) => void;
  /** Comma-separated MIME or extension list. */
  accept?: string;
  /** Bytes. Defaults to 10 MB. */
  maxSize?: number;
  multiple?: boolean;
  /** Title shown inside the drop zone. */
  title?: string;
  /** Helper line under the title. */
  helper?: string;
  /** Override the rendered children inside the zone. */
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function FileUpload({
  files: filesProp,
  onFilesChange,
  accept,
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  title = 'اسحب الملف هنا أو انقر للاختيار',
  helper,
  children,
  className,
  disabled,
  onRetry,
  onRemove,
}: FileUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const [internal, setInternal] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const files = filesProp ?? internal;
  const isControlled = filesProp !== undefined;

  const updateFiles = useCallback(
    (next: UploadFile[]) => {
      if (!isControlled) setInternal(next);
      onFilesChange?.(next);
    },
    [isControlled, onFilesChange],
  );

  const acceptList = accept?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];

  const validate = (file: File): string | null => {
    if (file.size > maxSize) return `حجم الملف يتجاوز الحد المسموح (${formatBytes(maxSize)}).`;
    if (acceptList.length > 0) {
      const ok = acceptList.some((rule) =>
        rule.startsWith('.') ? file.name.toLowerCase().endsWith(rule.toLowerCase()) : file.type === rule,
      );
      if (!ok) return 'نوع الملف غير مدعوم.';
    }
    return null;
  };

  const ingest = (incoming: File[]): void => {
    const next: UploadFile[] = multiple ? [...files] : [];
    for (const file of incoming) {
      const err = validate(file);
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        status: err ? 'error' : 'idle',
        errorMessage: err ?? undefined,
        progress: 0,
      });
    }
    updateFiles(multiple ? next : next.slice(-1));
  };

  const handleSelect = (event: ChangeEvent<HTMLInputElement>): void => {
    const list = event.target.files;
    if (!list) return;
    ingest(Array.from(list));
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const list = event.dataTransfer?.files;
    if (!list) return;
    ingest(Array.from(list));
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (disabled) return;
    setDragOver(true);
  };

  const handleDragLeave = (): void => setDragOver(false);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors duration-fast ease-standard',
          'border-border-strong bg-surface-card text-ink-500 hover:border-teal-500 hover:bg-teal-50/40',
          dragOver && 'border-teal-500 bg-teal-50',
          disabled && 'cursor-not-allowed opacity-50 hover:border-border-strong hover:bg-surface-card',
        )}
        style={{ minWidth: '200px' }}
      >
        {children ?? (
          <>
            <Upload size={20} strokeWidth={1.75} aria-hidden />
            <span className="text-sm font-medium text-ink-700">{title}</span>
            {helper && <span className="text-xs text-ink-500">{helper}</span>}
          </>
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={handleSelect}
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className={cn(
                'flex items-center gap-3 rounded-md border px-3 py-2',
                f.status === 'error' && 'border-terra-300 bg-terra-50',
                f.status === 'success' && 'border-success bg-success-bg',
                (f.status === 'idle' || f.status === 'uploading') && 'border-border-subtle bg-surface-card',
              )}
            >
              <FileIcon size={18} strokeWidth={1.75} className="text-ink-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{f.file.name}</p>
                <p className="text-xs text-ink-500">
                  <span className="font-numeric tnum">{formatBytes(f.file.size)}</span>
                  {f.errorMessage && <span className="text-terra-700"> · {f.errorMessage}</span>}
                </p>
                {f.status === 'uploading' && typeof f.progress === 'number' && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all duration-base ease-standard"
                      style={{ width: `${Math.max(0, Math.min(100, f.progress))}%` }}
                    />
                  </div>
                )}
              </div>
              {f.status === 'error' && onRetry && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(f.id);
                  }}
                  className="rounded-md p-1 text-ink-500 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
                  aria-label="إعادة المحاولة"
                >
                  <RotateCcw size={16} strokeWidth={1.75} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.(f.id);
                  updateFiles(files.filter((x) => x.id !== f.id));
                }}
                className="rounded-md p-1 text-ink-500 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
                aria-label="إزالة"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 ب';
  const units = ['ب', 'ك.ب', 'م.ب', 'ج.ب'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i] ?? 'ب'}`;
}
