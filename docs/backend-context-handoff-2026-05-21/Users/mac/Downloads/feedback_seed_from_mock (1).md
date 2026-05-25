---
name: seed-from-mock-verbatim
description: "Every backend table seed must mirror the full frontend mock dataset verbatim — never subset, never invent rows. Client approved the mock as real data."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e639e5bb-74cf-4637-ac3f-38173c0e477f
---

**Rule** (2026-05-20): Every backend table I seed must carry the *full*
mock dataset that exists in the frontend, copied row-for-row. No subsets.
No invented rows. No placeholder names like "Test Faculty".

**Why:** The client reviewed and approved the frontend mock data as the
real production-day data. The mock is the source of truth — partial or
invented seeds break data integrity and the demo narrative.

**How to apply:**

1. **Before writing any seeder**, locate the corresponding mock data in
   the frontend. Primary sources:
   - `frontend/src/features/lookups/mock/lookups.mock.ts` — 24 lookups
     (faculties, specializations, universities, governorates, jobs, etc.)
   - `frontend/src/shared/mock-data/index.ts` + helpers — applicants,
     cycles, payments, categories
   - `frontend/src/features/applicant-portal/lib/moi-session.mock.ts` —
     MOI verification mock + 4 demo NIDs
   - `frontend/src/shared/mock-data/applicantPortal.ts` — draft, exam
     slots, payment transactions

2. **Copy every row verbatim** into the seeder. Use the same Arabic
   names, the same codes, the same FK structure, the same ordering.

3. **When the remote DB already has a table matching what we're
   building** (orphan from a wiped branch) → **drop it** and recreate
   with our new schema + full mock seed. Don't try to migrate the old
   data; the schemas differ and the source of truth is the mock.

4. **Never POST throwaway test rows against the live DB** during smoke
   testing — instead delete them immediately or only test against a
   local SQLite/InMemory instance.

5. **In code reviews**, refuse seeders that contain fewer rows than the
   mock or invented Arabic names. The seeder file should be a 1:1
   transcription.

This rule applies to every table the backend will build — lookups, cycles,
categories, applicants, payments, grades, committees. Holds for the
entire backend implementation phase.
