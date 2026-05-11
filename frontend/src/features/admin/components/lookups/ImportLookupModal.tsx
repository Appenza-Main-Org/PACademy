/**
 * ImportLookupModal — wizard host for the full upload-preview-commit cycle.
 *
 * Phase machine: idle → parsing → preview → committing → done
 *                          (any phase) → cancelled
 *
 * The caller supplies pre-fetched existing rows so the modal can run the
 * collision pass synchronously on the parsed output without waiting for a
 * new fetch.
 *
 * Usage:
 *   <ImportLookupModal
 *     open={open}
 *     onClose={handleClose}
 *     lookupKey="governorates"
 *     lookupTitle="المحافظات"
 *     existingRows={existingRows}
 *     existingSortMax={existingSortMax}
 *     parentRows={parentRows}
 *   />
 */

import { useCallback, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Modal, toast } from '@/shared/components';
import {
  classifyImportRows,
  createImportRunner,
  parseImportFile,
} from '../../api/lookup-import';
import type {
  ActiveConflictResolution,
  ArchivedConflictResolution,
  ExistingRow,
  ImportLookupKey,
  ImportPhase,
  ImportRejection,
  ImportSession,
  ImportSummary,
  ParentLookup,
} from '../../api/lookup-import';
import { ImportLookupDropzone } from './ImportLookupDropzone';
import { ImportLookupPreview } from './ImportLookupPreview';
import { ImportLookupResult } from './ImportLookupResult';

interface ImportLookupModalProps {
  open: boolean;
  onClose: () => void;
  lookupKey: ImportLookupKey;
  lookupTitle: string;
  /** All existing rows (incl. archived) — used for collision detection. */
  existingRows: ExistingRow[];
  /** Max sortOrder of existing rows (defaults to 0). */
  existingSortMax?: number;
  /** For hierarchical lookups: the parent's existing rows. */
  parentRows?: ExistingRow[];
}

function makeSession(lookupKey: ImportLookupKey): ImportSession {
  return {
    id: crypto.randomUUID(),
    lookupKey,
    fileName: '',
    fileFormat: 'xlsx',
    fileSizeBytes: 0,
    phase: 'idle',
    rows: [],
    summary: null,
    startedAt: null,
    completedAt: null,
  };
}

/** Full-screen (lg) wizard modal hosting the import state machine. */
export function ImportLookupModal({
  open,
  onClose,
  lookupKey,
  lookupTitle,
  existingRows,
  existingSortMax = 0,
  parentRows,
}: ImportLookupModalProps): JSX.Element {
  const titleId = useId();
  const [session, setSession] = useState<ImportSession>(() => makeSession(lookupKey));
  const [rejection, setRejection] = useState<ImportRejection | null>(null);
  const [progressDone, setProgressDone] = useState(0);
  const runnerAbortRef = useRef<(() => void) | null>(null);

  /* Reset when modal closes. */
  const handleClose = (): void => {
    runnerAbortRef.current?.();
    setSession(makeSession(lookupKey));
    setRejection(null);
    setProgressDone(0);
    onClose();
  };

  /* Reset to idle (for "استيراد ملف آخر" button). */
  const handleReset = (): void => {
    runnerAbortRef.current?.();
    setSession(makeSession(lookupKey));
    setRejection(null);
    setProgressDone(0);
  };

  /* File selected → parse → classify → preview. */
  const handleFile = useCallback(
    async (file: File): Promise<void> => {
      setRejection(null);
      setSession((s) => ({
        ...s,
        phase: 'parsing' as ImportPhase,
        fileName: file.name,
        fileSizeBytes: file.size,
        fileFormat: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx',
      }));

      const parents: ParentLookup = parentRows
        ? {
            active: new Map(parentRows.filter((r) => !r.isArchived).map((r) => [r.collisionKey, r.id])),
            archived: new Map(parentRows.filter((r) => r.isArchived).map((r) => [r.collisionKey, r.id])),
          }
        : { active: new Map(), archived: new Map() };

      const { rows, rejection: rej } = await parseImportFile(file, lookupKey, existingSortMax, parents);

      if (rej) {
        setRejection(rej);
        setSession((s) => ({ ...s, phase: 'idle' as ImportPhase }));
        return;
      }

      const classified = classifyImportRows(rows, lookupKey, existingRows, parentRows);

      setSession((s) => ({
        ...s,
        phase: 'preview' as ImportPhase,
        rows: classified,
        startedAt: new Date().toISOString(),
      }));
    },
    [lookupKey, existingRows, existingSortMax, parentRows],
  );

  /* Per-row resolution change (from preview UI). */
  const handleResolutionChange = (
    rowIndex: number,
    resolution: ActiveConflictResolution | ArchivedConflictResolution,
  ): void => {
    setSession((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.index === rowIndex ? { ...r, resolution } : r)),
    }));
  };

  /* Commit — transition to 'committing', run, then 'done'. */
  const handleCommit = async (): Promise<void> => {
    const unresolvedConflicts = session.rows.filter(
      (r) =>
        (r.classification === 'active_collision' || r.classification === 'archived_collision') &&
        r.resolution === null,
    );
    if (unresolvedConflicts.length > 0) {
      toast(`يرجى تحديد الإجراء لـ ${unresolvedConflicts.length} صف متعارض قبل الاستمرار`, 'warning');
      return;
    }

    setProgressDone(0);
    const committingSession: ImportSession = { ...session, phase: 'committing' };
    setSession(committingSession);

    const runner = createImportRunner(
      committingSession,
      (rowIndex, outcome) => {
        setSession((s) => ({
          ...s,
          rows: s.rows.map((r) => (r.index === rowIndex ? { ...r, outcome } : r)),
        }));
        setProgressDone((n) => n + 1);
      },
    );
    runnerAbortRef.current = () => runner.abort();

    let summary: ImportSummary;
    try {
      summary = await runner.run();
    } catch {
      toast('حدث خطأ أثناء الاستيراد', 'danger');
      setSession((s) => ({ ...s, phase: 'preview' }));
      return;
    }

    setSession((s) => ({
      ...s,
      phase: 'done',
      summary,
      completedAt: new Date().toISOString(),
    }));
  };

  /* Abort in-progress commit. */
  const handleAbort = (): void => {
    runnerAbortRef.current?.();
    toast('تم إلغاء الاستيراد', 'warning');
    setSession((s) => ({ ...s, phase: 'preview' }));
  };

  const phase = session.phase;
  const hasUnresolvedAbort = session.rows.some((r) => r.resolution === 'abort');
  const totalEligible = session.rows.filter((r) => r.classification !== 'errored').length;

  const noop = (): void => { /* blocked while committing */ };

  return (
    <Modal
      open={open}
      onClose={phase === 'committing' ? noop : handleClose}
      title={`استيراد ${lookupTitle}`}
      size="lg"
      aria-labelledby={titleId}
    >
      <Modal.Body>
        {(phase === 'idle' || phase === 'parsing') && (
          <ImportLookupDropzone
            lookupKey={lookupKey}
            onFile={(f) => void handleFile(f)}
            rejection={rejection}
            disabled={phase === 'parsing'}
          />
        )}

        {phase === 'parsing' && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-ink-500">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-teal-300 border-t-teal-600"
              role="status"
              aria-label="جاري تحليل الملف"
            />
            جاري تحليل الملف…
          </div>
        )}

        {(phase === 'preview' || phase === 'committing') && (
          <ImportLookupPreview
            session={session}
            progressDone={progressDone}
            onResolutionChange={handleResolutionChange}
          />
        )}

        {phase === 'preview' && hasUnresolvedAbort && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-700"
          >
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span>
              اخترتَ &quot;إيقاف الكل&quot; لأحد الصفوف. سيُلغى الاستيراد بأكمله عند التنفيذ.
            </span>
          </div>
        )}

        {phase === 'done' && session.summary && (
          <ImportLookupResult
            summary={session.summary}
            onClose={handleClose}
            onImportAnother={handleReset}
          />
        )}
      </Modal.Body>

      {(phase === 'preview' || phase === 'committing') && (
        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={phase === 'committing' ? handleAbort : handleClose}
            disabled={false}
          >
            {phase === 'committing' ? 'إلغاء' : 'رجوع'}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleCommit()}
            isLoading={phase === 'committing'}
            disabled={phase === 'committing' || totalEligible === 0}
          >
            {hasUnresolvedAbort
              ? 'إلغاء الاستيراد'
              : `استيراد ${totalEligible.toLocaleString('en-US')} صف`}
          </Button>
        </Modal.Footer>
      )}

      {phase === 'idle' && (
        <Modal.Footer>
          <Button variant="ghost" onClick={handleClose}>
            إلغاء
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}
