# Scope Gap Analysis — Question Bank & Biometric

> Source of truth: `Police_Academy_Consolidated_BRD_TestSprite.md` (BRD §5 Biometric, §6 Question Bank, §7 Global, §8 Out of Scope).
> Date: 2026-05-30 · Branch: `staging`.

This document maps every BRD line item for the two **internal** apps in scope to its frontend status, backend status, and the action taken in this work. It is both the deliverable and the checklist the implementation satisfies.

---

## §6 — Question Bank & Electronic Examinations

The frontend was already feature-complete and **fully wired to `apiClient`** for every service method (`frontend/src/features/exams/api/exams.service.ts`). The backend (`ExamsController` + `ExamsService`) implemented ~70% of the contract; the rest 404'd when the backend was enabled. This work fills the server-side gaps — **no frontend changes were needed for QB**.

| BRD item | Frontend | Backend (before) | Backend (after) |
|---|---|---|---|
| User management (committee users) | ✅ UI + service | ❌ no route | ✅ `GET/POST/PATCH /api/exams/committee-users` — password hashed via `IdentityCredentials`, returned masked |
| Question bank (CRUD) | ✅ | ✅ | ✅ (unchanged) |
| Question import (bulk ≤1000 → draft) | ✅ | ✅ | ✅ (unchanged) |
| Exam creation | ✅ | ✅ | ✅ (unchanged) |
| Exam assignment (category/type/gender/spec) | ✅ | ✅ | ✅ (unchanged) |
| Exam execution (start/submit attempts) | ✅ | ✅ | ✅ (unchanged) |
| Exam stop | ✅ | ❌ no route | ✅ `POST /api/exams/{id}/stop` |
| Reopen attempt (6-month override) | ✅ | ❌ no route | ✅ `POST /api/exams/{id}/attempts/open` |
| Pre-exam access validation (7-point gate) | ✅ | ❌ no route | ✅ `POST /api/exams/access/validate` — applicant / today / assignment / suspension / device / window / duplicate |
| Authorized devices | ✅ | ❌ no route | ✅ `GET/POST/PATCH /api/exams/devices` |
| Auto scoring | ✅ | ✅ | ✅ (unchanged — MCQ/true-false by `correctIndex`, matching by pairs) |
| Reports — electronic results approve/publish | ✅ | ❌ no route | ✅ `GET /api/exams/results`, `POST .../{id}/approve`, `POST .../{id}/publish` (preliminary → approved → published) |
| Reports — audit trail | ✅ | mock only | ✅ `GET /api/exams/audit` — real rows appended by exam/result mutations |

New persistence buckets (AdminRecords JSON document store, no migration): `exam-committee-users`, `exam-devices`, `exam-results`, `exam-audit`. Seeded verbatim from the frontend mock state in `SeedData/exams.seed.json` (idempotent — only fills empty buckets).

Files: `Modules/Exams/ExamsService.cs`, `Controllers/ExamsController.cs`, `Modules/Exams/ExamsSeeder.cs`, `SeedData/exams.seed.json`.

---

## §5 — Biometric Registration & Inquiry

The frontend was feature-complete (8 pages) but the service read `MOCK` directly via `simulateLatency()` — **never touched `apiClient`**, and there was **no backend module**. This work builds the module + the device-simulation seam and rewires the frontend service.

| BRD item | Frontend (before) | Backend (before) | After |
|---|---|---|---|
| Applicant search | ✅ UI, mock-only | ❌ none | ✅ `GET /api/biometric/applicants/search` + `/lookup` — joins live `applicants` bucket |
| Fingerprint registration | ✅ UI, mock-only | ❌ none | ✅ `POST /api/biometric/enroll` → device `CaptureAsync('fingerprint')` |
| Face registration | ✅ UI, mock-only | ❌ none | ✅ `POST /api/biometric/enroll` → device `CaptureAsync('face')` |
| Identity verification | ✅ UI, mock-only | ❌ none | ✅ `POST /api/biometric/verify` → device `MatchAsync` → match / no_match / manual_review / not_enrolled |
| Security-gate verification | ✅ UI, mock-only | ❌ none | ✅ `POST /api/biometric/gate-log` |
| Verification history | ✅ UI, mock-only | ❌ none | ✅ `GET /api/biometric/verifications`, `/gate-logs`, `/audit` |
| Reports | ✅ UI, mock-only | ❌ none | ✅ `GET /api/biometric/reports`, `/monitoring` |

Frontend rewired to `if (isBackendEnabled()) apiClient...` with the existing mock body retained as the `VITE_USE_MOCKS` fallback — service signatures unchanged, so no page/component edits.

Persistence buckets (AdminRecords JSON document store, no migration): `biometric-enrollments`, `biometric-verifications`, `biometric-gate-logs`, `biometric-audit`. Seeded by `BiometricSeeder` (deterministic RNG, time-windowed, idempotent).

Files: `Modules/Biometric/*`, `Controllers/BiometricController.cs`, `appsettings.json` (`Biometric` section), `Program.cs`, `frontend/src/features/biometric/api/biometric.service.ts`.

### Device simulation seam (BRD §8 — physical device out of scope)

The physical biometric device is explicitly out of scope, so the **device seam** is simulated behind a config flag — the same pattern as the MOI auth gateway (`Moi:Mode`).

- `IBiometricDeviceGateway` — `CaptureAsync` (enroll a modality → template ref + quality) and `MatchAsync` (1:1 verify → isMatch + confidence). Carries **capture payloads** (template refs / capture tokens), so the real device drops in unchanged.
- `SimulatedBiometricDeviceGateway` — deterministic: capture quality and match score derived from an FNV-1a hash of `(applicantId|modality)`. No hardware, no randomness.
- `RealBiometricDeviceGateway` — `HttpClient`-based, reads `Biometric:BaseUrl`/`CapturePath`/`MatchPath`; dormant until `Biometric:Mode=real`.
- `BiometricModule.AddBiometricModule` selects the implementation on `Biometric:Mode` (`simulated` default → `AddScoped`; `real` → `AddHttpClient`).

**Migration path:** set `Biometric:Mode=real` + `Biometric:BaseUrl` → the real device plugs in with **zero changes** to `BiometricService` or any consumer. At that point the demo seed rows in `BiometricSeeder` can be dropped; live data flows through the gateway.

---

## §7 — Global requirements (touched here)

| Item | Status |
|---|---|
| Audit trail | ✅ Exam + biometric mutations append audit rows; exposed via `/api/exams/audit` and `/api/biometric/audit` |
| PDF / Excel / Word export | Frontend `exportReport` stub unchanged (file-generation is a later cross-cutting workstream) |

## §8 — Out of scope (respected)

Hardware, **biometric devices**, barcode devices, servers, network. The biometric device is simulated behind the gateway flag rather than integrated — matching the out-of-scope boundary while leaving a one-flag path to the real device.
