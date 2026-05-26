# Backend Integration Handoff

> **Tag baseline:** `admin-gaps-verified` (`d989536`).
> **Frozen for handoff:** 2026-05-07.
> **Latest admin backend pass:** 2026-05-21 — see [ADMIN_BACKEND_INTEGRATION_STATUS.md](ADMIN_BACKEND_INTEGRATION_STATUS.md).
> **Backend implementation context:** two-service topology + seed-data rule ingested from attached handoff files — see [BACKEND_IMPLEMENTATION_CONTEXT.md](BACKEND_IMPLEMENTATION_CONTEXT.md).
> **Audience:** the backend team picking up after the admin gap closure.
>
> This is the single document the backend team should read end-to-end
> before opening a service file. It maps every frontend `*.service.ts`
> contract to its real REST endpoint, every typed error to its required
> response shape, every DB invariant to the service methods that mirror
> it, and the open questions that need product/ops decisions before
> implementation.

---

## §1 — Purpose

After the 13 admin gaps (A–M) shipped in `admin-gaps-complete` and
were verified in `admin-gaps-verified`, the frontend is contract-ready
for backend integration. Every `*.service.ts` carries an
`INTEGRATION CONTRACT` JSDoc header with the real REST endpoints the
backend must implement; every typed error code is documented in
`docs/DB_CONSTRAINTS.md`. This handoff is the index over both.

The frontend will **not** change to accommodate the backend — the
contracts in here are the integration test fixture. If the backend
needs a different shape, it goes through `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md`
as a documented amendment.

### 2026-05-21 admin integration update

The admin surface is no longer only a mock-service contract. A shared backend client now exists at `frontend/src/shared/lib/api-client.ts`, and admin-relevant services call real endpoints by default. `VITE_USE_MOCKS=true` is explicit local demo mode only; production builds throw if that flag is enabled. `VITE_API_BASE_URL` controls the backend origin and defaults to same-origin `/api/...` when empty.

Backend error envelopes are normalized into frontend typed errors:

| Backend condition | Frontend error |
|---|---|
| `code: "CONFLICT"` + `conflictCode` | `ConflictError` |
| `code: "DEPENDENCY_BLOCKED"` + `result` | `DependencyBlockedError` |
| `code: "ACCOUNT_INACTIVE"` | `AccountInactiveError` |
| `code: "NOT_FOUND"` or HTTP 404 | `NotFoundError` |
| `code: "VALIDATION_ERROR"` / `FIELD_VALIDATION` or HTTP 422 | `ValidationError` |

Field-level validation helpers live in `frontend/src/shared/lib/validation-errors.ts` and are wired into the high-risk admin forms. See [ADMIN_BACKEND_INTEGRATION_STATUS.md](ADMIN_BACKEND_INTEGRATION_STATUS.md) for the current list of wired services and UI mock-data cleanup.

Cross-references:
- [Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md](../Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md) — the original gap definitions, §8 closeout, §9 verification pass.
- [docs/VERIFICATION_REPORT.md](VERIFICATION_REPORT.md) — full audit results + tag history.
- [docs/DB_CONSTRAINTS.md](DB_CONSTRAINTS.md) — the 9 invariants + SQL Server expressions.
- [docs/BACKEND_IMPLEMENTATION_CONTEXT.md](BACKEND_IMPLEMENTATION_CONTEXT.md) — backend topology, seed-data rule, .NET/EF conventions, auth split, build order.
- [docs/ADMIN_BACKEND_INTEGRATION_STATUS.md](ADMIN_BACKEND_INTEGRATION_STATUS.md) — current admin backend integration status and env flags.
- [TODO.md](../TODO.md) — durable record of out-of-scope deferrals.

---

## §2 — Service inventory

Every `*.service.ts` under `src/features/*/api/`. Methods are listed
in declaration order; "Real endpoint" copies from each service's
`INTEGRATION CONTRACT` JSDoc header verbatim.

### authService — `src/features/auth/api/auth.service.ts`

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `login` | `POST /api/auth/login` | — | (legacy single-step; new code uses requestOtp+verifyOtp) |
| `requestOtp` | `POST /api/auth/login/request-otp` | lock-policy | rejects on `account_locked` |
| `verifyOtp` | `POST /api/auth/login/verify-otp` | lock-policy | code-mismatch counter → `account_locked` |
| `peekOtpCode` | (demo only — remove on integration) | — | — |
| `logout` | `POST /api/auth/logout` | — | — |
| `me` | `GET /api/auth/me` | — | — |
| `getLockPolicy` | `GET /api/auth/lock-policy` | — | — |
| `updateLockPolicy` | `PATCH /api/auth/lock-policy` | — | range validation 1–10 / 5–120 |
| `getLockedUsers` | `GET /api/auth/lock-policy/locked-users` | — | — |
| `unlockUser` | `POST /api/auth/lock-policy/unlock` | — | — |
| `lookupOfficer` | `GET /v1/officers/lookup?nid=…&code=…` | — | `NotFoundError` |

### applicantService — `src/features/applicants/api/applicant.service.ts`

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `list` | `GET /api/applicants?page=&search=&status=&governorate=&certType=` | — | — |
| `getById` | `GET /api/applicants/:id` | — | — |
| `getTimeline` | `GET /api/applicants/:id/timeline` | — | — |
| `getStats` | `GET /api/applicants/stats` | — | — |
| `create` | `POST /api/v1/applicants` | unique-applicant-per-(nid,cycle) | `ConflictError('NID_CYCLE_DUPLICATE')` (planned) |
| `update` | `PUT /api/v1/applicants/:id` | — | — |
| `getWorkflowProgress` | `GET /api/v1/applicants/:id/workflow-progress` | — | — |
| `transition` | `POST /api/v1/applicants/:id/transition` | workflow gate | — |
| `getAuditTrail` | `GET /api/v1/audit?entity=applicant&entityId=:id` | audit append-only | — |

### applicantPortal services — `src/features/applicant-portal/api/`

`applicantPortal.service.ts`:

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `initiateAuth` | `POST /applicant/auth/initiate` | — | — |
| `verifyOtp` | `POST /applicant/auth/verify` | — | — |
| `getDraft` | `GET /applicant/draft/:applicantId` | — | — |
| `patchDraft` | `PATCH /applicant/draft/:applicantId` | — | — |
| `validateStage` | `POST /applicant/stage/:applicantId/:stage` | — | — |
| `verifyCertificate` | `POST /applicant/verify-certificate` | — | — |
| `confirmPrePayment` | `POST /applicant/payment/confirm-identity` | applicant-identity-match (Stage 1 NID + phone) | `Error('بيانات الهوية غير مطابقة')` (planned, AF-2) |
| `initiatePayment` | `POST /applicant/payment/initiate` | fee-belongs-to-cycle | — |
| `verifyPayment` | `GET /applicant/payment/verify/:refNumber` | — | — |
| `getExamSlots` | `GET /applicant/exam-slots` | — | — |
| `reserveExamSlot` | `POST /applicant/exam-slots/:slotId/reserve` | committee-capacity | — |
| `getFollowUp` | `GET /applicant/follow-up/:applicantId` | — | — |
| `printAttendanceCard` | `POST /applicant/attendance-card/:applicantId` | — | — |
| `printAcquaintanceDoc` | `POST /applicant/acquaintance-doc/:applicantId` | — | — |

`applicant-portal/categories.service.ts`:

| Method | Real endpoint | Invariant deps |
|---|---|---|
| `listForCycle` | `GET /api/applicant/categories?cycleId=…` | category-in-one-cycle |
| `listActiveCycles` | `GET /api/applicant/cycles/active` | one-active-cycle |
| `checkEligibility` | `POST /api/applicant/eligibility` | — |

`applicant-portal/test-schedule.service.ts`:

| Method | Real endpoint |
|---|---|
| `listForApplicant` | `GET /api/applicant/{id}/tests` |
| `getCurrentForApplicant` | `GET /api/applicant/{id}/tests/current` |

### Admin services — `src/features/admin/api/`

`cycles.service.ts` (Gap F + soft-delete + extension):

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `list` | `GET /api/cycles` | soft-delete-default-filter | — |
| `getById` | `GET /api/cycles/:id` | — | — |
| `getActive` | `GET /api/cycles/active` | — | — |
| `create` | `POST /api/cycles` | — | — |
| `update` | `PATCH /api/cycles/:id` | — | — |
| `clone` | `POST /api/cycles/:id/clone` | — | — |
| `transition` | `POST /api/cycles/:id/transition` | — | — |
| `activate` | `POST /api/cycles/:id/activate` | one-active-cycle | `ConflictError('ACTIVE_CYCLE_EXISTS')` |
| `close` | `POST /api/cycles/:id/close` | — | — |
| `extend` | `POST /api/cycles/:id/extend` | one-active-cycle | range validation |
| `archive` | `POST /api/cycles/:id/archive` | — | — |
| `remove` | `DELETE /api/cycles/:id` | no-delete-with-children | (soft-delete preferred) |
| `softDelete` | `POST /api/cycles/:id/soft-delete` | dependency-protection | `DependencyBlockedError` |
| `restore` | `POST /api/cycles/:id/restore` | — | — |
| `getDependencies` | `GET /api/cycles/:id/dependencies` | — | — |
| `toggleCategory` | `PATCH /api/cycles/:id/categories/:key` | category-in-one-cycle | — |
| `updateCategoryOverride` | `PATCH /api/cycles/:id/categories/:key/conditions` | — | — |

`categories.service.ts` (Gap G):

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `list` | `GET /api/admin/categories` | soft-delete-default-filter | — |
| `getByKey` | `GET /api/admin/categories/:key` | — | — |
| `create` | `POST /api/admin/categories` | — | — |
| `update` | `PATCH /api/admin/categories/:key` | — | — |
| `remove` | `DELETE /api/admin/categories/:key` | spec-key protection | — |
| `softDelete` | `POST /api/admin/categories/:key/soft-delete` | dependency-protection | `DependencyBlockedError` |
| `restore` | `POST /api/admin/categories/:key/restore` | — | — |
| `getDependencies` | `GET /api/admin/categories/:key/dependencies` | — | — |
| `previewRuleChangeImpact` | `POST /api/admin/categories/:key/preview-rule-change` | — | — |
| `updateExpandedConditions` | `PATCH /api/admin/categories/:key/conditions` | — | super-admin override required when impact > 0 |

`workflows.service.ts`:

| Method | Real endpoint |
|---|---|
| `list` | `GET /api/v1/admin/workflows` |
| `getById` | `GET /api/v1/admin/workflows/{id}` |
| `create` | `POST /api/v1/admin/workflows` |
| `update` | `PUT /api/v1/admin/workflows/{id}` |
| `remove` | `DELETE /api/v1/admin/workflows/{id}` |
| `reorderStages` | `POST /api/v1/admin/workflows/{id}/reorder` |
| `applyToApplicants` | `POST /api/v1/admin/workflows/{id}/apply` |

`admissionRules.service.ts`:

| Method | Real endpoint |
|---|---|
| `listForCycle` | `GET /api/admission-rules?cycleId=` |
| `getCurrent` | `GET /api/admission-rules/:cycleId/current` |
| `createNewVersion` | `POST /api/admission-rules` |

`referenceData.service.ts` (Sprint-1 typed Refs):

| Method | Real endpoint | Invariant deps |
|---|---|---|
| `list` | `GET /api/reference-data/:tab` | soft-delete-default-filter |
| `create` | `POST /api/reference-data/:tab` | — |
| `update` | `PATCH /api/reference-data/:tab/:id` | — |
| `remove` | `DELETE /api/reference-data/:tab/:id` | — |
| `softDelete` | `POST /api/reference-data/:tab/:id/soft-delete` | — |
| `restore` | `POST /api/reference-data/:tab/:id/restore` | — |
| `getDependencies` | `GET /api/reference-data/:tab/:id/dependencies` | — |
| `bulkImport` | `POST /api/reference-data/:tab/bulk-import` | — |

`lookups.service.ts` (Gap I):

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `list` | `GET /api/lookups/:key` | soft-delete-default-filter | — |
| `create` | `POST /api/lookups/:key` | — | — |
| `update` | `PATCH /api/lookups/:key/:id` | — | — |
| `setActive` | `POST /api/lookups/:key/:id/(de)activate` | — | — |
| `reorder` | `POST /api/lookups/:key/reorder` | — | — |
| `getDependencies` | `GET /api/lookups/:key/:id/dependencies` | — | — |
| `softDelete` | `POST /api/lookups/:key/:id/soft-delete` | dependency-protection | `DependencyBlockedError`, system-row protection |
| `restore` | `POST /api/lookups/:key/:id/restore` | — | — |
| `bulkImport` | `POST /api/lookups/:key/bulk-import` | row-key uniqueness within lookup | `Error` (per-row outcomes) |
| (hard delete) | `DELETE /api/lookups/:key/:id` | only when deps = 0 | — |

`examPlans.service.ts` (Gap J):

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `listExams` | `GET /api/exams/academy` | — | — |
| `listForCycle` | `GET /api/cycles/:cycleId/exam-plans` | — | — |
| `getPlan` | `GET /api/cycles/:cycleId/categories/:categoryId/exam-plan` | — | — |
| `savePlan` | `PUT /api/cycles/:cycleId/categories/:categoryId/exam-plan` | exam-order-unique-per-(category,cycle) | `ConflictError('EXAM_ORDER_DUPLICATE')` |
| `copyConfig` | `POST /api/cycles/:targetCycleId/exam-plans/copy?from=:sourceCycleId` | — | — |
| `canEnterResult` | (helper, no endpoint — see results service) | exam-sequence-guard | — |
| `transitionResultStatus` | `POST /api/exams/results/:id/transition` | exam-result-state-machine | requires `exams:override` for downgrades |
| `manualEntry` | `POST /api/cycles/:cycleId/exams/:examId/results` | — | — |
| `bulkUpload` | `POST /api/cycles/:cycleId/exams/:examId/results/bulk-upload` | — | — |
| `deviceIntegration` | webhook receiver `/api/cycles/:cycleId/exams/:examId/device-callback` | — | — |

`committee.service.ts` (Gap H):

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `list` | `GET /api/committees` | soft-delete-default-filter | — |
| `getById` | `GET /api/committees/:id` | — | — |
| `create` | `POST /api/committees` | — | — |
| `update` | `PATCH /api/committees/:id` | — | — |
| `getApplicants` | `GET /api/committees/:id/applicants?date=` | — | — |
| `getDailyQueue` | `GET /api/committees/:id/queue?date=` | — | — |
| `scheduleSlot` | `POST /api/committees/:id/schedule` | committee-capacity | `ConflictError('COMMITTEE_AT_CAPACITY')` |
| `getEligibleOfficers` | `GET /api/committees/eligible-officers` | role-scoped | — |
| `enterResult` | `POST /api/committees/:id/results` | — | — |
| `approveResults` | `POST /api/committees/:id/results/approve` | — | — |
| `rejectResult` | `POST /api/committees/results/:resultId/reject` | — | — |
| `bulkUploadResults` | `POST /api/committees/:id/results/bulk-upload` | — | — |

`audit.service.ts` (Gap E):

| Method | Real endpoint | Invariant deps |
|---|---|---|
| `list` | `GET /api/audit?action=&entity=&entityType=&user=&role=&module=&since=&until=&limit=` | audit-append-only |
| `getById` | `GET /api/audit/:id` | — |
| `getDiff` | `GET /api/audit/:id/diff` | — |
| `getEntityTypes` | `GET /api/audit/entity-types` | — |
| `getModules` | `GET /api/audit/modules` | — |
| `getRoles` | `GET /api/audit/roles` | — |
| `getUsers` | `GET /api/audit/users` | — |
| `exportCsv` | `GET /api/audit/export?format=csv` | — |

`roles.service.ts` (Gap C):

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `list` | `GET /api/roles` | soft-delete-default-filter | — |
| `getById` | `GET /api/roles/:id` | — | — |
| `create` | `POST /api/roles` | — | rejects duplicate `key` |
| `update` | `PATCH /api/roles/:id` | system-row protection | system rows: only `scope` editable |
| `softDelete` | `POST /api/roles/:id/soft-delete` | dependency-protection (users) | system-row blocked |
| `restore` | `POST /api/roles/:id/restore` | — | — |
| `getDependencies` | `GET /api/roles/:id/dependencies` | — | — |

`users.service.ts` (extended by admin-create NID flow):

| Method | Real endpoint | Invariant deps | Typed errors |
|---|---|---|---|
| `list` | `GET /api/users` | — | — |
| `getById` | `GET /api/users/:id` | — | — |
| `create` | `POST /api/users` (NID-driven) | NID resolves in personnel directory; role conflict rules | `Error` (NID required, role conflict) |
| `update` | `PATCH /api/users/:id` | role conflict rules | `Error` (role conflict) |
| `setAccountStatus` | `POST /api/users/:id/status` | self-deactivation guard, last-active-super_admin guard | `StatusChangeBlockedError` |
| `deactivate` | `POST /api/users/:id/deactivate` (alias) | same as setAccountStatus | `StatusChangeBlockedError` |
| `reset2fa` | `POST /api/users/:id/reset-2fa` | — | — |
| `bulkAssign` | `POST /api/users/bulk-assign` | — | — |
| `bulkImport` | `POST /api/users/bulk-import` | NID uniqueness, officer-directory lookup | `Error` (per-row outcomes) |
| `createFromTemplate` | `POST /api/users/from-template` | NID uniqueness | `Error` (NID required) |
| `getActivity` | `GET /api/users/:id/activity` | — | — |
| `setStatus` | `POST /api/users/:id/status` (legacy 3-state) | — | — |

`nid-lookup.service.ts` (admin-create NID flow):

| Method | Real endpoint | Response shapes | Typed errors |
|---|---|---|---|
| `lookup` | `GET /v1/officers/lookup?nationalId={nid}` | `{ status: 'found', data: OfficerCandidate }` · 404 → `{ status: 'not_found' }` · 400 → `{ status: 'invalid', reason: 'format' \| 'checksum' }` | `NidLookupNotFoundError`, `InvalidNidError` |

`authService.login` / `authService.requestOtp` reject inactive accounts
with `AccountInactiveError` (`code: 'ACCOUNT_INACTIVE'`) before any
credential check or OTP dispatch.

`notifications.service.ts` (Gap L):

| Method | Real endpoint | Invariant deps |
|---|---|---|
| `list` | `GET /api/admin/notifications?status=` | soft-delete-default-filter |
| `getById` | `GET /api/admin/notifications/:id` | — |
| `create` | `POST /api/admin/notifications` | — |
| `update` | `PATCH /api/admin/notifications/:id` | — |
| `publish` | `POST /api/admin/notifications/:id/publish` | — |
| `unpublish` | `POST /api/admin/notifications/:id/unpublish` | — |
| `softDelete` | `POST /api/admin/notifications/:id/soft-delete` | — |
| `restore` | `POST /api/admin/notifications/:id/restore` | — |
| `listForApplicant` | `GET /api/applicants/:id/notifications` | published+non-expired filter |
| `computeStatus` | (pure helper, no endpoint) | — |

`payments.service.ts` (Gap K):

| Method | Real endpoint | Invariant deps |
|---|---|---|
| `list` | `GET /api/admin/payments?status=&search=` | — |
| `getByReference` | `GET /api/admin/payments/:reference` | — |
| `syncFawryStatus` | `POST /api/admin/payments/:reference/sync` (Fawry pull) | — |
| `setStatus` | `POST /api/admin/payments/:reference/status` | — |
| `listRefundEligible` | `GET /api/admin/payments/refund-eligible` | RFP §p.42 |

`reports.service.ts`: Internal aggregator over the seeded MOCK
collections; no `INTEGRATION CONTRACT` JSDoc — see "Missing
contracts" below.

### Operational features

`barcode.service.ts`:

| Method | Real endpoint |
|---|---|
| `generate` | `POST /api/barcode/generate/:applicantId` |
| `lookup` | `GET /api/barcode/lookup?code=` |
| `scan` | `POST /api/barcode/scan` |
| `listScans` | `GET /api/barcode/scans?applicantId=` |
| `replace` | `POST /api/barcode/replace/:applicantId` |

`biometric.service.ts`:

| Method | Real endpoint |
|---|---|
| `enroll` | `POST /api/biometric/enroll` |
| `verify` | `POST /api/biometric/verify` |
| `listVerifications` | `GET /api/biometric/verifications?station=&since=` |
| `monitoring` | `GET /api/biometric/monitoring` |

`board.service.ts`:

| Method | Real endpoint |
|---|---|
| `listMembers` | `GET /api/board/members` |
| `addMember` / `updateMember` / `removeMember` | `POST/PATCH/DELETE /api/board/members[/:id]` |
| `bulkImportMembers` | `POST /api/board/members/bulk-import` |
| `listSessions` | `GET /api/board/sessions?status=` |
| `getSession` | `GET /api/board/sessions/:id` |
| `createSession` | `POST /api/board/sessions` |
| `startSession` | `POST /api/board/sessions/:id/start` |
| `closeSession` | `POST /api/board/sessions/:id/close` |
| `recordVote` | `POST /api/board/sessions/:id/votes` |
| `listDecisions` | `GET /api/board/decisions?applicantId=` |
| `createDecision` | `POST /api/board/decisions` |
| `getCaseFile` | `GET /api/board/applicants/:id/case-file` |

`investigations.service.ts`:

| Method | Real endpoint |
|---|---|
| `list` | `GET /api/investigations?status=&priority=` |
| `getById` | `GET /api/investigations/:id` |
| `create` | `POST /api/investigations` |
| `update` | `PATCH /api/investigations/:id` |
| `listLetters` | `GET /api/investigations/letters?status=` |
| `createLetter` | `POST /api/investigations/letters` |
| `sendLetter` | `POST /api/investigations/letters/:id/send` |
| `autoBalance` | `POST /api/investigations/distribution/auto-balance` |
| `stats` | `GET /api/investigations/stats` |

`medical.service.ts`:

| Method | Real endpoint |
|---|---|
| `listStations` | `GET /api/medical/stations` |
| `getQueue` | `GET /api/medical/queue?stationId=` |
| `listResults` | `GET /api/medical/results?applicantId=&station=` |
| `enterResult` | `POST /api/medical/results` |
| `approveResult` | `POST /api/medical/results/:id/approve` |
| `getCertificate` | `GET /api/medical/certificate/:applicantId` |

`exams.service.ts`:

| Method | Real endpoint |
|---|---|
| `listQuestions` | `GET /api/questions?status=&category=` |
| `getQuestion` | `GET /api/questions/:id` |
| `createQuestion` | `POST /api/questions` |
| `createQuestionBatch` | `POST /api/questions/batch` |
| `updateQuestion` | `PATCH /api/questions/:id` |
| `publishQuestion` | `POST /api/questions/:id/publish` |
| `listExams` | `GET /api/exams` |
| `getExam` | `GET /api/exams/:id` |
| `createExam` | `POST /api/exams` |
| `publishExam` | `POST /api/exams/:id/publish` |
| `startAttempt` | `POST /api/exams/:id/take/start` |
| `submitAttempt` | `POST /api/exams/:id/take/submit` |
| `listAttempts` | `GET /api/exams/:id/attempts` |
| `listLiveSessions` | `GET /api/exams/:id/sessions/live` |
| `categoryCounts` | `GET /api/exams/categories` |

### admissionSetupService — `src/features/admin/admission-setup/api/admission-setup.service.ts`

Net-new entities for the 15-step Admission Setup section. Composed
steps (1–8, 12, 14) reuse `cyclesService`, `categoriesService`,
`committeeService`, `examPlansService`, and `notificationsService`
directly; only the four shapes below have no admin-gaps home today.

| Method | Endpoint |
|---|---|
| `listMergeSplitRules(cycleId)` | `GET /api/admission-setup/cycles/:cycleId/merge-split-rules` |
| `createMergeOrSplit(input)` | `POST /api/admission-setup/cycles/:cycleId/merge-split-rules` |
| `softDeleteMergeSplit(id, reason)` | `DELETE /api/admission-setup/merge-split-rules/:id` (soft delete) |
| `listScoreThresholds(cycleId)` | `GET /api/admission-setup/cycles/:cycleId/score-thresholds` |
| `setCommitteeScoreThresholds(input)` | `PUT /api/admission-setup/cycles/:cycleId/committees/:cid/score` |
| `getExamDateConfig(cycleId)` | `GET /api/admission-setup/cycles/:cycleId/exam-dates` |
| `setExamDateConfig(input)` | `PUT /api/admission-setup/cycles/:cycleId/exam-dates` |
| `listTotalScoreConfigs(cycleId)` | `GET /api/admission-setup/cycles/:cycleId/total-score` |
| `setTotalScoreConfig(input)` | `PUT /api/admission-setup/cycles/:cycleId/total-score/:stream` |
| `getDeclaration(cycleId)` | `GET /api/admission-setup/cycles/:cycleId/declaration` |
| `setDeclaration(input)` | `PUT /api/admission-setup/cycles/:cycleId/declaration` |
| `publishDeclaration(id)` | `POST /api/admission-setup/declarations/:id/publish` |

Invariants enforced frontend-side (mirror in backend):
- merge requires ≥2 source committees and exactly 1 target;
- split requires exactly 1 source and ≥2 targets;
- committee score thresholds: `0 ≤ min < max`;
- exam dates: `firstAvailableDate ≥ cycle.openDate`, every
  `bookableDays[i] ≥ firstAvailableDate`, `blackoutDates ⊆ bookableDays`;
- total-score components: weights 0..100 summing to exactly 100 per stream,
  `totalScoreOutOf > 0`;
- declaration: non-empty body, version auto-increments per save,
  `publishedAt` only set via the publish endpoint.

`setCommitteeScoreThresholds` writes through to `Committee.scoreCriteria.magmoo3`
on the existing `committeesService` so the threshold flows through every
Gap-H committee surface unchanged.

### Reports endpoints (2026-05-27 amendment)

The reports RFP scope is exposed through the admin backend under `/api/admin/reports`.

- `GET /api/admin/reports/applicants/aggregate` accepts the shared reports filters plus `groupBy` and returns `{ groupBy, rows, grandTotal, generatedAt }`.
- `GET /api/admin/reports/applicants/detail` accepts the same filters plus `page`, `pageSize`, `sort`, `search` and returns `{ data, total, page, pageSize, totalPages }`.
- `GET /api/admin/reports/stage-dropoff` accepts the same filters plus `stoppedAtStage` and `staleDays`, returning stuck-applicant rows plus an 11-stage funnel.
- `GET /api/admin/reports/data-availability` returns `{ ok, cycleId, cycleExists, cycleStatus, totals, missingReferences, appliedFiltersMatchCount, generatedAt }`.
- `POST /api/admin/reports/export` accepts `{ filters, format, report, title }` and returns a downloadable file.

`missingReferences` reports filter references and applicant-row references that cannot be resolved against the current reference data. Performance targets for the normalized SQL implementation: probe < 200ms p95, aggregate < 800ms p95, detail < 1.2s p95.

Open questions: cache strategy for the probe once the normalized applicant schema lands; exact audit detail level for export filter snapshots.

### Missing contracts

These services have public methods but no `INTEGRATION CONTRACT`
JSDoc header. Backend should align with frontend before exposing
endpoints:

- `examPlans.service.ts:canEnterResult` — pure helper used by the
  result-entry pipeline; depends on the result-storage endpoint shape.

---

## §3 — Invariant → service mapping

The 9 invariants from `docs/DB_CONSTRAINTS.md` and the service methods
that mirror them on the frontend. Backend MUST also enforce each.

| Invariant | Frontend services that mirror it | DB constraint expression |
|---|---|---|
| One active cycle only | `cyclesService.activate`, `cyclesService.extend` | `CREATE UNIQUE INDEX UX_AdmissionCycle_OnlyOneActive ON admission_cycles (status) WHERE status IN ('active', 'extended');` |
| Unique applicant per (nationalId, cycleId) | `applicantService.create` (Stage 1 phone-auth pre-check) | `ALTER TABLE applicants ADD CONSTRAINT UX_Applicant_Nid_Cycle UNIQUE (national_id, cycle_id);` |
| Category belongs to exactly one cycle | `cyclesService.toggleCategory` (writes into `openCategories`) | `ALTER TABLE cycle_open_categories ADD CONSTRAINT UX_CycleCategory UNIQUE (cycle_id, category_key);` |
| Fee belongs to its cycle | `CycleFees` shape (under `AdmissionCycle`) | `ALTER TABLE cycle_fees ALTER COLUMN cycle_id BIGINT NOT NULL;` plus FK |
| Exam order unique per (categoryId, cycleId) | `examPlansService.savePlan` | `ALTER TABLE cycle_category_exam_plan ADD CONSTRAINT UX_ExamPlan_Order UNIQUE (cycle_id, category_id, exam_order);` |
| Committee daily attendance ≤ capacity | `committeeService.scheduleSlot` (DAILY_COUNT in-memory; throws `ConflictError`) | trigger `tr_CommitteeSlot_CapacityGuard` (see DB_CONSTRAINTS §6) |
| Cannot delete parent with children | every entity's `softDelete` calls `getDependencies` first | FKs `ON DELETE NO ACTION` + soft-delete columns (see §7) |
| Soft-delete filters applied by default | every `list()` uses `filterDeleted` | stored-proc pattern with `@IncludeDeleted` flag |
| Audit append-only | `auditService` exposes only `list/getById/getDiff/exportCsv/getEntityTypes/getModules/getRoles/getUsers` — no mutations | `DENY UPDATE, DELETE ON audit_entries TO db_app_user;` + `INSTEAD OF UPDATE, DELETE` trigger |

---

## §4 — Typed error contract

Backend MUST return matching shapes or conflict-handling UX breaks
silently. The frontend's `ConflictError` carries a `conflictCode`
discriminator the UI catches; `DependencyBlockedError` carries a
typed `result` payload; `NotFoundError` carries a code-only marker.

| Error type | Triggering scenario | Required response shape | Frontend Arabic copy |
|---|---|---|---|
| `ConflictError('ACTIVE_CYCLE_EXISTS', { activeCycleId, activeCycleName })` | Activating a cycle while another is active/extended | `{ code: 'CONFLICT', conflictCode: 'ACTIVE_CYCLE_EXISTS', payload: { activeCycleId, activeCycleName }, message }` | "لا يمكن تفعيل هذه الدورة — دورة \"{activeCycleName}\" نشطة بالفعل. يجب إغلاقها أولاً." |
| `ConflictError('EXAM_ORDER_DUPLICATE', { cycleId, categoryId, order })` | Saving an exam plan with a duplicate `order` | same envelope; payload = `{ cycleId, categoryId, order }` | "الترتيب {order} مستخدم أكثر من مرة في خطة الاختبارات" |
| `ConflictError('COMMITTEE_AT_CAPACITY', { committeeId, dateIso, capacityPerDay, current })` | Scheduling a slot when the day's count = capacity | same envelope; payload as left | "لا يمكن جدولة هذا الموعد — الطاقة اليومية للجنة \"{name}\" مكتملة ({cap}/{cap})." |
| `ConflictError('NID_CYCLE_DUPLICATE', { nationalId, cycleId })` | Re-applying same applicant to same cycle | same envelope | (planned — Stage 1 pre-check; copy will land when wired) |
| `ConflictError('PUBLISH_NOT_ALLOWED', { … })` | (reserved — exam result publish gate) | same envelope | (no UI consumer yet — P2 UX gap) |
| `DependencyBlockedError` | Soft-delete blocked by child rows | `{ code: 'DEPENDENCY_BLOCKED', result: { counts: Record<string, number>, blocking: true }, message }` | "لا يمكن حذف {entityNoun} لارتباط{ها} بـ {n} {child}" — formatted via `formatDependencyMessage` |
| `NotFoundError` (officer lookup) | Unknown `(nationalId, officerCode)` pair | `{ code: 'NOT_FOUND', message }` | "لم يتم العثور على ضابط بهذا الرقم القومي ورمز الضابط" |
| (auth) `Error('بيانات الدخول مطلوبة')` | Empty creds at requestOtp | string error in `message` | "بيانات الدخول مطلوبة" |
| (auth) `Error('الحساب موقوف…')` | Login while user `lockedUsers.has(id)` | string error in `message` | "الحساب موقوف. تواصل مع إدارة المنظومة لإعادة التفعيل." |
| (auth) `Error('رمز التحقق غير صحيح')` | OTP mismatch | string error | "رمز التحقق غير صحيح" |
| (auth) `Error('انتهت صلاحية رمز التحقق…')` | OTP expired (5min default) | string error | "انتهت صلاحية رمز التحقق. أعد طلب رمز جديد." |
| (lookups) `Error('لا يمكن حذف سجل نظام…')` | Soft-deleting `isSystem: true` row | string error | "لا يمكن حذف سجل نظام (يمكن تعطيله بدلاً من ذلك)" |
| (categories) `Error('لا يمكن حذف فئات السبع…')` | Soft-deleting spec category | string error | "لا يمكن حذف فئات السبع المعتمدة من المواصفات" |
| (applicant-portal) `Error('الرقم القومي غير صحيح')` | `confirmPrePayment` malformed NID (AF-2) | string error | "الرقم القومي غير صحيح" |
| (applicant-portal) `Error('رقم الهاتف غير صحيح')` | `confirmPrePayment` malformed phone (AF-2) | string error | "رقم الهاتف غير صحيح" |
| (applicant-portal) `Error('بيانات الهوية غير مطابقة')` | `confirmPrePayment` mismatch with Stage 1 stored values (production strict — demo accepts any well-formed pair) | string error | "بيانات الهوية لا تتطابق مع البيانات المُسجَّلة في خطوة التحقق من الهاتف" (planned) |

### P2 UX gaps

These error codes are thrown (or reserved) but not yet caught with
custom Arabic UI copy. Default toast falls through to `err.message`
which the service sets verbatim — functional, but not first-class:

- `ConflictError('COMMITTEE_AT_CAPACITY', …)` — no UI consumer of
  `scheduleSlot` yet (page coming Sprint 10). Service throws, the
  generic catch path will render `err.message` once a consumer lands.
- `ConflictError('PUBLISH_NOT_ALLOWED', …)` — reserved; no thrower yet.
- `DependencyBlockedError` is currently surfaced via `<SoftDeleteDialog>`'s
  `<DependencyWarning>` rather than a free-standing toast — fine for
  the modal flow, but a toast fallback for non-modal callers would be
  nicer.

---

## §5 — Auth + RBAC contract

### Seeded roles

Source of truth: `MOCK.roleDefinitions` in
`src/shared/mock-data/roles.ts`. 12 rows, all `isSystem: true`:

| Key | Arabic label | Apps | Permissions |
|---|---|---|---|
| `super_admin` | مدير النظام الرئيسي | all 9 + architecture | `['*']` |
| `committee_admin` | مدير لجنة قبول | admin, committee, barcode, biometric | `applicants:view/edit/transition`, `committees:manage`, `barcode:print`, `biometric:verify`, `workflows:read/write` |
| `committee_user` | موظف لجنة قبول | committee, barcode, biometric | `applicants:view`, `barcode:print`, `biometric:verify` |
| `medical_admin` | مدير القومسيون الطبي | medical, barcode, biometric | `medical:manage`, `results:enter`, `biometric:verify` |
| `medical_doctor` | طبيب عيادة | medical | `medical:examine`, `results:enter` |
| `investigator` | محقق | investigations | `investigations:view/edit` |
| `board_admin` | أمين سر الهيئة | board | `board:manage` |
| `exams_admin` | مدير الاختبارات | exams | `exams:manage`, `questions:manage`, `results:view` |
| `biometric_user` | مستخدم بوابة الأمن | biometric | `biometric:verify` |
| `records_clerk` | مدخل نتائج | medical, exams | `results:enter` |
| `applicant` | متقدم | applicant | `applicant:view/apply` |
| `finance_review` | مراجع مالي | admin | `payments:review`, `payments:refund_eligibility`, `reports:view` |

System-row protection: `roles.service.update` allows editing only
`scope` on `isSystem: true` rows; label/permissions/apps are locked.
Custom roles (created via `POST /api/roles`) have full CRUD.

### OTP flow

```
[Browser]  →  POST /api/auth/login/request-otp  { username, password, role }
[Backend]  →  generates 6-digit code, stores it server-side keyed by pendingId,
              sends SMS to officer's mobile
[Backend]  ←  { pendingId, otpDevice }   /* otpDevice = masked phone-tail */

[Browser]  →  POST /api/auth/login/verify-otp   { pendingId, code }
[Backend]  →  validates code, increments failed-attempt counter on mismatch,
              flips actor to `locked` when ≥ maxFailedAttempts
[Backend]  ←  { token, user }            /* user.permissions populated from role */
```

Demo dev-bypass `000000` is hardcoded in
`src/features/auth/api/auth.service.ts:93` — **MUST be removed** by
the backend integration.

### Lock policy

State held in `auth.service.ts`:

```ts
const lockPolicy: LockPolicy = { maxFailedAttempts: 5, lockDurationMinutes: 30 };
const failedAttempts = new Map<string, number>();   /* by userId */
const lockedUsers   = new Map<string, LockedUser>(); /* by userId */
```

Backend storage: a `lock_policy` settings row + a `locked_users`
table (or computed view). `lockedUsers` row must carry
`{ userId, name, role, reason, lockedAt, unlocksAt }`.

Time-based auto-unlock is currently **NOT** simulated client-side
(see §9 of `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md`); backend should
poll/cron unlock when `unlocksAt` passes.

### Login response

`useAuthStore.setUser` stores `AuthUser`:

```ts
interface AuthUser {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  unit: string;
  apps: readonly AppKey[];
  permissions: readonly string[];   /* effective permissions array */
  token: string;
  loggedInAt: number;
}
```

`buildAuthUser` reads permissions from `MOCK.roleDefinitions` first
(post-Gap-C wiring; admin role edits propagate at next login),
falling back to the legacy static `ROLE_DEFINITIONS` table for
unknown keys. **Backend's login response must include the user's
effective permission array for this contract.** `hasPermission()`
in `features/auth/rbac.ts` handles `*` wildcard and `resource:*`
prefix matching.

---

## §6 — Mock-to-real switchover guide

For each service category, the migration is mechanical: keep the
typed shape, swap the body. Component / query / type contracts stay
unchanged — that's the entire point of the `INTEGRATION CONTRACT`
JSDoc discipline.

### auth (`features/auth/api/auth.service.ts`)

- **Mock today:** `simulateLatency` + in-memory `pendingOtps` /
  `lockedUsers` / `failedAttempts` maps.
- **Real impl:**
  - SMS provider integration for `requestOtp`.
  - Persist `pendingOtps` short-term (Redis with TTL).
  - Persist `lockedUsers` long-term (DB row).
  - Real JWT minting (replace `fakeJWT`).
  - Remove `peekOtpCode` and `DEV_BYPASS`.
- **Migration step (per method):**
  ```diff
  -  await simulateLatency(450, 750);
  -  /* in-memory mutation */
  +  return apiClient.post('/api/auth/login/request-otp', creds).then(r => r.data);
  ```

### cycles (`features/admin/api/cycles.service.ts`)

- **Mock today:** `STATE` array initialised from `MOCK.cycles`,
  `ACTIVE_ID` module-level cursor.
- **Real impl:**
  - Read all queries from DB.
  - Enforce one-active-cycle via the filtered unique index (DB-level)
    AND the `ConflictError('ACTIVE_CYCLE_EXISTS')` 409 response.
  - `getDependencies` joins applicant/category/committee tables.
  - Soft-delete via tombstone columns.
- **Migration step:** swap each method body to `apiClient.<verb>(...)`.

### categories (`features/admin/api/categories.service.ts`)

- **Mock today:** `STATE` array initialised from `MOCK.categories`;
  `previewRuleChangeImpact` matches against seeded applicants.
- **Real impl:**
  - `previewRuleChangeImpact` becomes a backend rule-engine call;
    pass new conditions, get back `{ impactedApplicants, conflicts[] }`.
  - System (spec) keys hard-coded set; backend should mirror.
  - Override emits `category_rules_changed_with_override` audit row.

### committees (`features/committees/api/committee.service.ts`)

- **Mock today:** `COMMITTEES_STATE` + `DAILY_COUNT` in-memory map.
- **Real impl:**
  - Daily attendance counter becomes a query
    (`SELECT COUNT(*) FROM committee_slots WHERE committee_id=… AND date=…`).
  - `getEligibleOfficers` filters `users WHERE role IN (…)`.
  - Capacity guard runs in transaction or via the AFTER INSERT trigger.

### lookups (`features/admin/api/lookups.service.ts`)

- **Mock today:** in-memory `STATE: Record<LookupKey, LookupRow[]>`.
- **Real impl:**
  - Per-key tables OR a generic `lookup_rows(key, …)` table.
  - Reorder via `UPDATE … SET sort_order = … WHERE id IN (…)` batch.
  - Hard delete only when `getDependencies` returns 0; otherwise
    soft-delete is the only path.

### exams + exam plans (`features/admin/api/examPlans.service.ts`,
  `features/exams/api/exams.service.ts`)

- **Mock today:** `PLANS` in-memory; `ensurePlan` lazily seeds
  defaults from `DEFAULT_EXAM_PLAN_ENTRIES`.
- **Real impl:**
  - `cycle_category_exam_plan` table with the `UX_ExamPlan_Order`
    constraint enforcing uniqueness.
  - `copyConfig` becomes a single transaction: DELETE target +
    INSERT cloned rows.
  - Result-entry stubs (`manualEntry` / `bulkUpload` /
    `deviceIntegration`) get real implementations + result-storage
    endpoints.

### payments (`features/admin/api/payments.service.ts`)

- **Mock today:** `STATE` derived from applicant payment status;
  `syncFawryStatus` only refreshes `lastSyncAt`.
- **Real impl:**
  - Vendor Fawry endpoint integration (URL is a placeholder
    in JSDoc — confirm with operations team).
  - `listRefundEligible` runs the §p.42 rule against archived
    cycles + paid status.
  - Status transitions emit `payment_status_changed` /
    `payment_refunded` audit.

### notifications (`features/admin/api/notifications.service.ts`)

- **Mock today:** `STATE` array; `computeStatus` recomputes from
  `now / publishAt / expireAt` on every read.
- **Real impl:**
  - Persisted notification rows with explicit `status` column.
  - Cron job flips `scheduled → published` and
    `published → expired` (mirrors `computeStatus`).
  - `listForApplicant` joins on the audience selector type.

### roles (`features/admin/api/roles.service.ts`)

- **Mock today:** `STATE` initialised from `MOCK.roleDefinitions`;
  system-row protection enforced in `update` and `softDelete`.
- **Real impl:**
  - `roles` table with `is_system` column; row-level update guard
    in stored proc OR application layer.
  - Permissions stored as a JSON column or a `role_permissions` join.
  - Login response inclues `roles.permissions` array.

### audit (`features/audit/api/audit.service.ts`)

- **Mock today:** `MOCK.audit` array; `emitAudit()` `unshift`s.
- **Real impl:**
  - `audit_entries` table with the append-only trigger from
    `DB_CONSTRAINTS §9`.
  - `getDiff` reads inline `before/after` JSON columns; the legacy
    `MOCK.auditDiffs` side-table is mock-only.
  - `exportCsv` streams a signed-URL file.

### applicants (`features/applicants/api/applicant.service.ts`)

- **Mock today:** `MOCK.applicants` (240 deterministic rows).
- **Real impl:**
  - Standard CRUD with the `(national_id, cycle_id)` unique
    constraint enforced server-side.
  - `getAuditTrail` is a filtered audit query.
  - `transition` validates against the DepartmentWorkflow's
    allowed-next-status gate.

### Migration step template (apply per method)

```diff
   async list(filters = {}): Promise<X[]> {
-    await simulateLatency();
-    let items = STATE;
-    /* in-memory filtering */
-    return items;
+    return apiClient.get('/api/x', { params: filters }).then(r => r.data);
   }
```

Audit emissions stay in the service (the backend is the source of
truth for the audit row, but the frontend optimistically emits via
`emitAudit` so the audit log refreshes without a round-trip).
**Decide with backend whether to keep the dual-emission or remove
the frontend `emitAudit` calls during integration.**

---

## §7 — Out of scope for backend integration

These items are deliberately not part of the integration handoff and
shouldn't surprise the backend team:

- **The two pre-existing `: any` flags** (`zod-resolver.ts`,
  `ApplicantForm.tsx`) listed in [TODO.md](../TODO.md). They'll be
  resolved during integration when the form schemas become typed
  (RHF + zod alignment), not as part of the auth wiring.
- **Radix component adoption work** (post-`d989536` commits:
  Accordion / AlertDialog / Dialog / DropdownMenu / Popover /
  SearchSelect / Sheet / Tabs / Tooltip + the `RADIX_ADOPTION_REPORT.md`
  + `/_dev/primitives` review route). This is a separate workstream
  driven by `CLAUDE.md §2.5` and is independent of backend
  integration. Backend integration may proceed without it landing
  or vice-versa.
- **Soft-delete `list()` filter spot-check across non-committee
  entities** beyond the ones shipped in this verification pass. The
  Gap H committee fix (`b085af0`) covered the missed entity from
  the admin gaps; further entities (board members, biometric,
  barcodes, etc.) should be addressed when those features get
  re-touched, not as a current admin backend-pass blocker.
- **The `peekOtpCode` demo helper** in `auth.service.ts`. Remove on
  integration; never surface in the real backend.
- **The `ensureDemoUser()` boot-strap** in `App.tsx`. Disable when
  the real auth flow lights up.

---

## §8 — Open questions

Surfaced during the service-walk; product/ops decisions needed
**before** wiring:

1. **Fawry integration model** — pull-only or webhook?
   - Frontend has `paymentsService.syncFawryStatus(reference)` as a
     pull. Backend may need a `POST /webhooks/fawry` receiver in
     addition. Confirm with the operations team / Fawry vendor.
2. **Audit retention policy** — frontend treats audit as
   append-only forever. Backend needs an explicit retention
   strategy (RFP §p.42 mentions audit but not retention — confirm).
3. **Officer-data API source** — federated identity service
   (e.g. MOIPASS) or internal HR table? Affects `lookupOfficer`
   shape and the auth-flow handshake.
4. **OTP transport** — SMS vs email vs both? Frontend masks a
   phone tail (`•••• 4521` placeholder); backend determines actual
   channel selection. Localization considerations on the SMS body.
5. **Permission wildcard convention** — `*` for super-admin and
   `resource:*` for full-resource. Confirm backend mirrors this
   (otherwise `hasPermission` returns false for legitimate access).
6. **`scope` semantics on system roles** — Gap C made `scope` the
   only editable field for system roles, but the matrix UI doesn't
   yet expose committee/department scope inputs (deferred). Backend
   should support storing the shape; UI catches up Sprint 10.
7. **Reports endpoint shape** — `reports.service.ts` lacks an
   `INTEGRATION CONTRACT` JSDoc. Decide between a single
   `GET /api/admin/reports/snapshot?cycleId=…` or per-section
   endpoints. Confirm with frontend before exposing.
8. **`canEnterResult` sequence guard** — the mock returns true;
   real impl reads applicant result history. Confirm the result
   storage shape (per-attempt rows? denormalised flags?) before
   building.
9. **Two-step login token semantics** — does `requestOtp` issue a
   short-lived bearer that `verifyOtp` exchanges, or does
   `verifyOtp` mint the session token from scratch? Frontend
   doesn't care (only stores the final `user.token`), but it
   affects backend session bookkeeping.
10. **`finance_review` user creation** — Gap C seeded the role but
    no SystemUser carries `role: 'finance_review'`. Decide whether
    backend seeds a sample row OR the operations team assigns it
    post-integration.
11. **Captcha provider for Stage 1 (AF-1)** — applicant Stage 1
    currently uses a client-side arithmetic challenge as a demo
    placeholder. Production needs a server-issued challenge that
    survives client tampering. Decide between hCaptcha, reCAPTCHA,
    or a homegrown challenge endpoint
    (`GET /applicant/auth/captcha → { id, prompt }`,
    `POST /applicant/auth/initiate { captchaId, captchaAnswer, … }`
    with server-side validation against the issued id).
12. **Admission-setup entity persistence model** — should the four
    net-new admission-setup entities (`ElectronicDeclaration`,
    `TotalScoreConfig`, `ExamDateConfig`, `CommitteeMergeSplitRule`)
    be backed by the cycle-as-aggregate-root model in SQL Server, or
    as separate tables with FK to cycle? Affects audit retention
    strategy: aggregate-rooted rows live or die with the cycle, while
    FK-only rows can outlive a soft-deleted cycle for forensic recall.
    Frontend doesn't care today — the services key everything by
    cycleId — but backend should pick once and not migrate.

13. **Bulk-import error retry strategy** (universal list-actions stack,
    `Tasks/LIST_ACTIONS_PROMPT.md §12`) — should the backend support
    partial commits with a retry token (so the user can re-upload only
    the failed rows after fixing them), or are bulk imports atomic
    (everything-or-nothing)? Today the frontend mirror commits valid
    rows individually and returns per-row failures via `ImportResult`.
    The "استيراد الصالح فقط" affordance on `ImportPreviewTable` only
    makes sense if backend semantics also allow partial commits.
    Decide before integration day; affects:
    - `usersService.bulkImport`, `lookupsService.bulkImport`,
      `boardService.bulkImportMembers`, `examsService.createQuestionBatch`
    - The Arabic error-report CSV download must include enough context
      to make the retry workflow ergonomic.

If you find more during implementation, append them here so future
sessions can see the full conversation.
