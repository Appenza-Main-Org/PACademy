/**
 * import-runner.ts — parallelism-capped commit orchestrator.
 *
 * Routes each accepted row to the correct REST call:
 *   valid              → POST   /admin/<lookup>
 *   update (active)    → PATCH  /admin/<lookup>/{id}
 *   restore_update     → POST   /admin/<lookup>/{id}/restore
 *                         + PATCH /admin/<lookup>/{id}
 *   skip / errored     → no HTTP; outcome recorded immediately
 *
 * Concurrency is capped at DEFAULT_CONCURRENCY (4) to avoid thundering
 * herd on the dev API.
 *
 * Per-row audit entries come "for free" via the backend's audit middleware
 * on each POST/PATCH call. The runner adds one summary audit entry at the
 * end via emitAudit (FR-012).
 */

import { emitAudit } from '@/shared/lib/audit';
import { apiClient } from '@/shared/api';
import { IMPORT_LOOKUP_PATH } from './types';
import type {
  ImportSession,
  ImportSummary,
  ParsedRow,
  RowOutcome,
} from './types';

const DEFAULT_CONCURRENCY = 4;

export interface ImportRunner {
  run(): Promise<ImportSummary>;
  abort(): void;
}

/**
 * Creates a runner for the given session.
 *
 * @param session     Full import session with all `resolution` values set.
 * @param onProgress  Called after each row completes (drives the progress bar).
 * @param concurrency Optional override for the parallelism cap.
 */
export function createImportRunner(
  session: ImportSession,
  onProgress: (rowIndex: number, outcome: RowOutcome) => void,
  concurrency = DEFAULT_CONCURRENCY,
): ImportRunner {
  let aborted = false;
  const basePath = IMPORT_LOOKUP_PATH[session.lookupKey];

  async function commitRow(row: ParsedRow): Promise<RowOutcome> {
    const { classification, resolution, payload, conflict } = row;

    // Errored rows are never sent — mark skipped.
    if (classification === 'errored' || !payload) return 'skipped';

    // Explicit skip resolutions.
    if (resolution === 'skip') return 'skipped';

    // Abort is handled at the runner level before this is called.
    if (resolution === 'abort') return 'skipped';

    try {
      if (classification === 'valid') {
        await apiClient.post(basePath, payload);
        return 'created';
      }

      if (classification === 'active_collision' && resolution === 'update' && conflict) {
        // Patch only mutable fields (skip key/isSystem).
        const { key: _key, isSystem: _sys, ...mutableFields } = payload as Record<string, unknown>;
        await apiClient.patch(`${basePath}/${conflict.existingId}`, mutableFields);
        return 'updated';
      }

      if (classification === 'archived_collision' && resolution === 'restore_update' && conflict) {
        await apiClient.post(`${basePath}/${conflict.existingId}/restore`);
        const { key: _key, isSystem: _sys, ...mutableFields } = payload as Record<string, unknown>;
        await apiClient.patch(`${basePath}/${conflict.existingId}`, mutableFields);
        return 'restored';
      }

      // Rename-required: if payload has a fresh key, treat as new create.
      if (resolution === 'rename_required') {
        await apiClient.post(basePath, payload);
        return 'created';
      }

      return 'skipped';
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status ?? null;
      row.error = {
        code: 'http_failure',
        column: null,
        messageAr: `فشل الإرسال (HTTP ${status ?? '?'})`,
        httpStatus: status ?? undefined,
      };
      return 'errored';
    }
  }

  return {
    async run(): Promise<ImportSummary> {
      const startMs = Date.now();
      const eligible = session.rows.filter(
        (r) => r.classification !== 'errored' && r.payload !== null,
      );

      // Detect global abort before any writes.
      if (session.rows.some((r) => r.resolution === 'abort')) {
        session.phase = 'cancelled';
        return buildSummary(session.rows, 0);
      }

      // Parallelism-capped runner.
      let idx = 0;
      const workers = Array.from({ length: Math.min(concurrency, eligible.length) }, async () => {
        while (idx < eligible.length) {
          if (aborted) break;
          const row = eligible[idx++];
          if (!row) break;
          const outcome = await commitRow(row);
          row.outcome = outcome;
          onProgress(row.index, outcome);
        }
      });
      await Promise.all(workers);

      // Mark skipped rows that were never reached.
      for (const row of session.rows) {
        if (row.outcome === null) {
          row.outcome = row.classification === 'errored' ? 'errored' : 'skipped';
          onProgress(row.index, row.outcome);
        }
      }

      const durationMs = Date.now() - startMs;
      const summary = buildSummary(session.rows, durationMs);

      // Summary audit entry — only when at least one mutation occurred.
      if (summary.created + summary.updated + summary.restored > 0) {
        emitAudit({
          action: 'import_completed',
          module: 'lookups',
          entityType: session.lookupKey,
          entityLabel: session.fileName,
          entityId: session.id,
          details: [
            summary.created > 0 ? `${summary.created} سجل جديد` : '',
            summary.updated > 0 ? `${summary.updated} سجل محدَّث` : '',
            summary.restored > 0 ? `${summary.restored} سجل مُستعاد` : '',
            summary.skipped > 0 ? `${summary.skipped} تم تخطيه` : '',
            summary.errored > 0 ? `${summary.errored} فشل` : '',
          ].filter(Boolean).join(' · '),
        });
      }

      return summary;
    },

    abort() {
      aborted = true;
      session.phase = 'cancelled';
    },
  };
}

function buildSummary(rows: ParsedRow[], durationMs: number): ImportSummary {
  const counts = { created: 0, updated: 0, restored: 0, skipped: 0, errored: 0 };
  const errors: ParsedRow[] = [];
  for (const row of rows) {
    const o = row.outcome ?? 'skipped';
    if (o in counts) (counts as Record<string, number>)[o]++;
    if (o === 'errored') errors.push(row);
  }
  return {
    total: rows.length,
    ...counts,
    errors,
    durationMs,
  };
}
