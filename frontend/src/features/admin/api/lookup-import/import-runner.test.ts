/**
 * import-runner.test.ts — unit tests for createImportRunner.
 *
 * apiClient is spied on directly (not via MSW) since the runner is a pure
 * orchestrator and we want to test its routing logic, not the HTTP transport.
 *
 * Covers:
 *   - happy path (all valid → all created)
 *   - partial failure (one HTTP 500 → that row errored, others proceed)
 *   - active_collision update path
 *   - archived_collision restore+update path
 *   - skip resolution (no HTTP call)
 *   - abort before any writes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { createImportRunner } from './import-runner';
import type { ImportSession, ParsedRow } from './types';
import * as apiModule from '@/shared/api';

/* ── helpers ─────────────────────────────────────────────────────────────── */

function makeSession(rows: ParsedRow[]): ImportSession {
  return {
    id: 'test-session',
    lookupKey: 'educationTypes',
    fileName: 'test.xlsx',
    fileFormat: 'xlsx',
    fileSizeBytes: 1024,
    phase: 'committing',
    rows,
    summary: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function makeValidRow(index: number, key: string): ParsedRow {
  return {
    index,
    arabicValues: { 'المفتاح': key },
    payload: { key, labelAr: `label_${key}`, isActive: true, sortOrder: 10 + index * 10 },
    classification: 'valid',
    conflict: null,
    resolution: null,
    outcome: null,
    error: null,
  };
}

/* ── setup ───────────────────────────────────────────────────────────────── */

let postSpy: Mock;
let patchSpy: Mock;

beforeEach(() => {
  postSpy = vi.spyOn(apiModule.apiClient, 'post') as unknown as Mock;
  postSpy.mockResolvedValue({ data: { id: 'new-id' }, status: 201 });
  patchSpy = vi.spyOn(apiModule.apiClient, 'patch') as unknown as Mock;
  patchSpy.mockResolvedValue({ data: {}, status: 200 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── happy path ──────────────────────────────────────────────────────────── */

describe('createImportRunner — happy path', () => {
  it('creates all valid rows and returns correct summary', async () => {
    const rows = [makeValidRow(0, 'k1'), makeValidRow(1, 'k2'), makeValidRow(2, 'k3')];
    const session = makeSession(rows);
    const progress: [number, string][] = [];
    const runner = createImportRunner(session, (i, o) => progress.push([i, o]));

    const summary = await runner.run();

    expect(summary.created).toBe(3);
    expect(summary.errored).toBe(0);
    expect(summary.total).toBe(3);
    expect(progress).toHaveLength(3);
    expect(postSpy).toHaveBeenCalledTimes(3);
  });
});

/* ── partial failure ─────────────────────────────────────────────────────── */

describe('createImportRunner — partial failure', () => {
  it('marks failing row as errored but continues with others', async () => {
    let callCount = 0;
    postSpy.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.reject({ response: { status: 500 } });
      return Promise.resolve({ data: { id: 'ok' }, status: 201 });
    });

    const rows = [makeValidRow(0, 'k1'), makeValidRow(1, 'k2'), makeValidRow(2, 'k3')];
    const session = makeSession(rows);
    const runner = createImportRunner(session, () => {});

    const summary = await runner.run();
    expect(summary.created).toBe(2);
    expect(summary.errored).toBe(1);
  });
});

/* ── skip resolution ─────────────────────────────────────────────────────── */

describe('createImportRunner — skip resolution', () => {
  it('skips rows with resolution = skip and makes no HTTP call', async () => {
    const row: ParsedRow = {
      ...makeValidRow(0, 'k1'),
      classification: 'archived_collision',
      conflict: { type: 'archived_collision', existingId: 'ex-id', existingValues: {} },
      resolution: 'skip',
    };
    const session = makeSession([row]);
    const runner = createImportRunner(session, () => {});
    const summary = await runner.run();

    expect(postSpy).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });
});

/* ── active_collision update ─────────────────────────────────────────────── */

describe('createImportRunner — active_collision update', () => {
  it('PATCHes mutable fields for update resolution', async () => {
    const row: ParsedRow = {
      ...makeValidRow(0, 'k1'),
      classification: 'active_collision',
      conflict: { type: 'active_collision', existingId: 'existing-id', existingValues: {} },
      resolution: 'update',
    };
    const session = makeSession([row]);
    const runner = createImportRunner(session, () => {});
    const summary = await runner.run();

    expect(patchSpy).toHaveBeenCalledWith('/admin/education-types/existing-id', expect.any(Object));
    expect(summary.updated).toBe(1);
  });

  it('excludes key and isSystem from PATCH payload', async () => {
    const row: ParsedRow = {
      ...makeValidRow(0, 'k1'),
      payload: { key: 'k1', isSystem: true, labelAr: 'test', sortOrder: 10, isActive: true },
      classification: 'active_collision',
      conflict: { type: 'active_collision', existingId: 'ex-id', existingValues: {} },
      resolution: 'update',
    };
    const session = makeSession([row]);
    await createImportRunner(session, () => {}).run();

    const patchArg = patchSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patchArg['key']).toBeUndefined();
    expect(patchArg['isSystem']).toBeUndefined();
    expect(patchArg['labelAr']).toBe('test');
  });
});

/* ── archived_collision restore+update ───────────────────────────────────── */

describe('createImportRunner — archived restore_update', () => {
  it('POSTs restore then PATCHes for restore_update resolution', async () => {
    const row: ParsedRow = {
      ...makeValidRow(0, 'k1'),
      classification: 'archived_collision',
      conflict: { type: 'archived_collision', existingId: 'arch-id', existingValues: {} },
      resolution: 'restore_update',
    };
    const session = makeSession([row]);
    const runner = createImportRunner(session, () => {});
    const summary = await runner.run();

    expect(postSpy).toHaveBeenCalledWith('/admin/education-types/arch-id/restore');
    expect(patchSpy).toHaveBeenCalledWith('/admin/education-types/arch-id', expect.any(Object));
    expect(summary.restored).toBe(1);
  });
});

/* ── abort ───────────────────────────────────────────────────────────────── */

describe('createImportRunner — abort', () => {
  it('cancels the session before any writes when a row has resolution=abort', async () => {
    const rows: ParsedRow[] = [
      {
        ...makeValidRow(0, 'k1'),
        classification: 'active_collision',
        conflict: { type: 'active_collision', existingId: 'id', existingValues: {} },
        resolution: 'abort',
      },
      makeValidRow(1, 'k2'),
    ];
    const session = makeSession(rows);
    const runner = createImportRunner(session, () => {});
    const summary = await runner.run();

    expect(postSpy).not.toHaveBeenCalled();
    expect(session.phase).toBe('cancelled');
    expect(summary.total).toBe(2);
  });
});
