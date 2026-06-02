# Biometric Scope Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the biometric scope gaps except the 200,000+ performance proof.

**Architecture:** Extend the existing biometric vertical slice instead of adding a parallel module. Backend writes stay in the normalized operational `biometric_records` table through `OperationalRecordsService`; frontend pages keep using `biometricService`.

**Tech Stack:** ASP.NET Core 10, EF normalized operational records, React 18, TypeScript, Vite, existing shared components.

---

### Task 1: Backend Contract

**Files:**
- Modify: `backend/admin/PACademy.Admin.Api/Modules/Biometric/BiometricService.cs`
- Modify: `backend/admin/PACademy.Admin.Api/Controllers/BiometricController.cs`
- Test: `backend/admin/PACademy.Admin.Api.Tests/BiometricServiceTests.cs`

- [ ] Add failing tests for barcode lookup, previous-year linking, station validation, visit counters, gate presence, and normalized table persistence.
- [ ] Add service methods for `link-previous`, `presence`, and expanded `reports`.
- [ ] Expand lookup/verify payloads with current exam date/result, visit counters, alert codes, and voice alert messages.
- [ ] Keep all writes through `records.UpsertAsync(...)` for biometric modules.

### Task 2: Frontend Service

**Files:**
- Modify: `frontend/src/features/biometric/api/biometric.service.ts`

- [ ] Expand types to include station, visit counters, alert codes, previous enrollment, presence, and role inquiry.
- [ ] Add backend calls for `linkPreviousEnrollment`, `presence`, and gate log workflows.
- [ ] Preserve deterministic mock fallback.

### Task 3: Screens And Routes

**Files:**
- Modify: `frontend/src/config/routes.ts`
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/features/biometric/index.ts`
- Modify: `frontend/src/features/biometric/BiometricLayout.tsx`
- Modify: `frontend/src/features/biometric/pages/BiometricPages.tsx`
- Modify: `frontend/src/features/biometric/pages/Sprint8Pages.tsx`

- [ ] Update inquiry/enrollment/verify/history/monitoring screens.
- [ ] Add `/biometric/gate`, `/biometric/attendance`, and `/biometric/role-inquiry`.
- [ ] Add voice alert trigger via browser speech synthesis where available, with visible fallback alerts.

### Task 4: Verification

- [ ] Run targeted backend biometric tests.
- [ ] Run frontend typecheck.
- [ ] Run production build if typecheck passes.
