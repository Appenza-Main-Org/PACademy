# Exam Room Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let exams admins publish a real student exam as a shareable exam-room URL restricted to specific IP addresses and a time window.

**Architecture:** Add focused exam-publish helpers for URL/token/IP handling, extend `ExamConfig` with publish metadata, update the exams service mock/backend contract, add staff publish/copy controls, and expose a public `/exam-room/:token` route that renders the existing student exam experience without staff auth.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, existing shared UI components, Node ESM helper test.

---

### Task 1: Publish Helper Tests

**Files:**
- Create: `frontend/src/features/exams/lib/exam-publishing.ts`
- Create: `frontend/scripts/test-exam-publishing.mjs`

- [ ] Add a pure helper module that can derive publish tokens, build same-origin/public URLs, parse IP allowlists, and check whether an IP is allowed.
- [ ] Add a Node script that asserts token stability, URL construction, IP parsing, wildcard matching, and empty allowlist denial.
- [ ] Run `node frontend/scripts/test-exam-publishing.mjs` and verify it fails before implementation is complete, then passes after the helper exists.

### Task 2: Service And Types

**Files:**
- Modify: `frontend/src/shared/types/domain.ts`
- Modify: `frontend/src/features/exams/api/exams.service.ts`

- [ ] Extend `ExamConfig` with `publishToken`, `publishedUrl`, and `allowedIps`.
- [ ] Change `publishExam` to accept optional publish settings: `allowedIps`, `accessStartAt`, `accessEndAt`, `publishedUrl`.
- [ ] Update mock `validateAccess` to require a published exam, valid time window, and an allowed IP from the exam allowlist.
- [ ] Update the integration contract comment so backend implementers know the publish endpoint receives URL/IP/window settings.

### Task 3: Staff Publish UI

**Files:**
- Modify: `frontend/src/features/exams/pages/Sprint7Pages.tsx`

- [ ] Add a publish dialog on the exams list for draft/stopped exams.
- [ ] Let admins edit allowed IPs and access window before publishing.
- [ ] Show published URL, allowed IP count, copy link, monitor, and stop actions for published exams.
- [ ] Add equivalent publish/copy metadata to the exam detail page.

### Task 4: Public Exam Room Route

**Files:**
- Modify: `frontend/src/config/routes.ts`
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/features/exams/index.ts`
- Modify: `frontend/src/features/exams/pages/Sprint7Pages.tsx`

- [ ] Add `ROUTES.examRoom(token)`.
- [ ] Register `/exam-room/:token` outside the `/question-bank` staff guard.
- [ ] Add `PublishedExamRoomPage` that resolves the token to an exam and renders the existing student exam flow.
- [ ] Ensure exam-room access validation sends the resolved exam id and uses IP/device fields exactly like the student station would.

### Task 5: Verification

**Files:**
- Verify: `frontend/scripts/test-exam-publishing.mjs`
- Verify: `frontend/src/**/*.ts`
- Verify: `frontend/src/**/*.tsx`

- [ ] Run `node frontend/scripts/test-exam-publishing.mjs`.
- [ ] Run `npm --prefix frontend run typecheck`.
- [ ] Run `npm --prefix frontend run build`.
