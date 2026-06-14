# Testing Guide — Police Academy Admissions Platform

> **Audience:** QA / testing team writing bug reports and test cases.
> **Purpose:** the single entry point for "where do I start, what's the expected behavior, what data do I use." This doc *routes* to the authoritative source files — it does not duplicate them. When a linked doc and the running app disagree, the **app is the truth** and that's a bug worth filing.
> **Last updated:** 2026-06-15.

---

## 1. Start here

Read in this order:
1. This file (environment + credentials + how to file a good bug).
2. [PRODUCT_GUIDE.md](PRODUCT_GUIDE.md) — what the product is *supposed* to do (the spec, by surface).
3. The flow + matrix docs in §4 below for the area you're testing.

The product is a single React SPA with **3 surfaces** — PUBLIC, APPLICANT, STAFF — **11 RBAC roles**, and ~110 routes, fully RTL Arabic. The surface/route map and role list live in [CLAUDE.md](../CLAUDE.md) §4 (routes) and §5 (RBAC). For a QA-altitude version of the same, see [PRODUCT_GUIDE.md](PRODUCT_GUIDE.md).

---

## 2. Environments

| Environment | App URL | Notes |
|---|---|---|
| **Production** | https://admin-prod.appenzademo.com | Vercel project `pa-cademy-external`. Real data — do not create junk test rows here. |
| **Staging** | https://admin-staging.appenzademo.com | Primary test target. Backend mocks disabled. |
| **Local** | http://localhost:5173 | `npm --prefix frontend run dev`. Use against the staging API for integration tests. |

The bare `appenzademo.com` apex and the old `pa-cademy.vercel.app` URL are **dead** — don't test against them.

Backend is enabled by default; admin/applicant services hit the real API. Mock mode (`VITE_USE_MOCKS=true`) is **local-only** and production builds refuse to start with it on — so if staging/prod behaves like mock data, that's a bug.

---

## 3. Test accounts & data

> Full, maintained sample sets live in [BRD_TESTSPRITE_SCOPE.md](BRD_TESTSPRITE_SCOPE.md) (admin + applicant scenarios, BRD→case map) and [APPLICANT_ELIGIBILITY_TEST_MATRIX.md](APPLICANT_ELIGIBILITY_TEST_MATRIX.md) (40+ NID samples with expected eligibility per category). The tables below are the quick-start subset — prefer the source docs for breadth.

### Staff login (`/staff-login`)
Staff auth is **National ID + mobile**, not username/password. Super-admin:

| Field | Value |
|---|---|
| National ID | `28705260103619` |
| Mobile | `01119441198` |
| Role | Super Admin |

Other cloud roles (admissions_manager, applicants_officer, setup_admin, payments_officer, auditor, exams_admin) are created via `/admin/users/new` and log in through the same screen — see [CLAUDE.md](../CLAUDE.md) §5 for the role→app→permission mapping.

### Applicant login (`/applicant-login`)
Applicant auth is **National ID + mobile**, then an SMS OTP (`123456` on simulated MOI mode). Representative scenarios:

| Scenario | National ID | Mobile | Expected landing |
|---|---|---|---|
| Eligible, fresh | `30501010203456` | `01098765433` | `/applicant/start` with `officers_general` visible |
| Over age / ineligible | `28503150103456` | `01098765432` | `/applicant/ineligible` |
| Submitted / paid (resume) | `30407010103456` | `01098765432` | `/applicant` (post-submission portal) |
| وثيقة تعارف fillable | `30501010103456` | `01098765432` | `/applicant/acquaintance-doc` |
| الضباط المتخصصون | `30502010103456` | `01098765434` | category-specific path |
| MOI not found / manual | `30506210123451` | `01077000014` | derived-identity fallback → `/applicant/start` |

NID gender is digit 13 (odd = male, even = female). Wrong mobile on a seeded MOI record **must** fail login — that's an assertion, not a bug. The active staging cycle is `CYC-1780594636353` ("Test Rawaj 2026") with 4 open categories; the configured eligibility conditions per category are in [APPLICANT_ELIGIBILITY_TEST_MATRIX.md](APPLICANT_ELIGIBILITY_TEST_MATRIX.md).

---

## 4. Expected-behavior sources (what to test against)

| Area | Authoritative doc |
|---|---|
| End-to-end admin + applicant happy paths | [FRONTEND_FLOW_CLOSURE.md](FRONTEND_FLOW_CLOSURE.md) |
| Applicant 11-stage wizard (per MOI reference) | [APPLICANT_FLOW_ALIGNMENT_REPORT.md](APPLICANT_FLOW_ALIGNMENT_REPORT.md) + `references/applicant-flow-moi-portal.pdf` |
| Applicant eligibility per category (NID samples) | [APPLICANT_ELIGIBILITY_TEST_MATRIX.md](APPLICANT_ELIGIBILITY_TEST_MATRIX.md) |
| BRD requirement → test case map | [BRD_TESTSPRITE_SCOPE.md](BRD_TESTSPRITE_SCOPE.md) |
| Full functional spec (the "should") | [police_academy_detailed_brd_scope_md.md](police_academy_detailed_brd_scope_md.md) |
| Demo narrative / customer-facing walkthrough | [DEMO_SCRIPT.md](DEMO_SCRIPT.md) |
| Data-exchange round-trip (import/export) | [DATA_EXCHANGE_ROUNDTRIP_FIXES_TEST_BRIEF.md](DATA_EXCHANGE_ROUNDTRIP_FIXES_TEST_BRIEF.md) |
| Legacy demo (visual/data spec for any screen) | `frontend/_legacy/` — recreate, don't reinvent |

---

## 5. Negative testing — the invariant catalog

[DB_CONSTRAINTS.md](DB_CONSTRAINTS.md) is the goldmine for negative cases: every business rule the system **must reject** is listed with its typed conflict code and an Arabic-facing error. If an action that should hit one of these codes silently succeeds, that's a bug. High-value codes to probe:

| Code | Try to trigger it by… |
|---|---|
| `ACTIVE_CYCLE_EXISTS` | activating a second cycle while one is already active |
| `NID_CYCLE_DUPLICATE` | applying twice with the same NID in one cycle |
| `OVERLAPPING_PERIOD` | two admission rules overlapping on grade range × grad-year × condition |
| `COMMITTEE_AT_CAPACITY` | booking an exam slot past committee capacity |
| `COMMITTEE_CATEGORY_MISMATCH` / `COMMITTEE_WRONG_CATEGORY` | pairing a committee with a category that isn't its own |
| `GRADE_MODE_MISMATCH` | mixing percentage vs تقدير grade modes in one category |
| `DUPLICATE_DATE` / `DAY_NOT_WORKING` | adding two exam days on one date, or a Friday |
| `PARENT_HAS_CHILDREN` / `IN_USE` | deleting a lookup row that other rows depend on |
| `CATEGORY_FACULTY_GENDER_CONFLICT` | same faculty/spec across categories for one gender |

The full list (≈38 codes) with SQL expressions is in [DB_CONSTRAINTS.md](DB_CONSTRAINTS.md).

---

## 6. Things that are *intentionally* limited (don't file these)

These are **known seams**, not bugs — see the gap docs for context:
- **Applicant OTP is `123456`** and payment auto-succeeds in simulated mode (`Moi:Mode=simulated`). Real SMS/payment gateway wiring is dormant behind config flags.
- **On-prem apps** (committees, board, investigations, medical, biometric, barcode) deploy on the Ministry cluster with a **separate RBAC plane** — cloud roles cannot reach them, and their permissions are absent from the cloud matrix by design.
- **Medical / board report sections** render empty on the cloud reports page (on-prem owns that data).
- **"PDF/Word" exports** are styled HTML in some flows — flagged in [BRD_GAP_ANALYSIS.md](BRD_GAP_ANALYSIS.md).

When unsure whether something is a gap or a bug, check [BRD_GAP_ANALYSIS.md](BRD_GAP_ANALYSIS.md) (admin/applicant/biometric/exams) and [FULL_SCOPE_GAP_ANALYSIS.md](FULL_SCOPE_GAP_ANALYSIS.md) (9-app coverage). **Caveat:** those are dated 2026-05-29 — several listed gaps (MOI SSO, biometric backend, QB backend) have since shipped (see [CLAUDE.md](../CLAUDE.md) §11). Treat the gap docs as "intent," not current state.

---

## 7. Writing a good bug report

Include:
1. **Surface + route** (e.g. `STAFF · /admin/committees-exam-config`) and **role** used.
2. **Environment** (staging/prod/local) + **test NID/mobile** used.
3. **Steps**, **expected** (cite the source doc + section), **actual**.
4. For data/validation bugs: the **expected conflict code** from [DB_CONSTRAINTS.md](DB_CONSTRAINTS.md), if any.
5. Whether it reproduces on a fresh login (auth/session-scoped?) and on both staging and prod.
6. RTL/Arabic rendering issues: note the exact screen and copy — Arabic strings are exact-match from the spec, paraphrased copy is a bug.

---

## 8. Smoke check

`npm --prefix frontend run test:routes:prod` confirms all ~74 routes resolve (SPA rewrite). Run it after any deploy before deep testing — if a route 404s here, stop and file that first.
