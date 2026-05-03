# POLISH_PLAN.md

> Two-pass polish across the entire app to flagship the 15 demo-path screens and bring the remaining ~55 to consistent quality. Owner: Appenza Studio · Engineering. Hard deadline: tender demo, 4 weeks.

## Status legend

- ✅ **DONE** — polished and committed
- 🔄 **WIP** — in progress, in this session
- ⏸ **NEXT** — queued, not started
- 🚫 **SKIPPED** — explicitly out of scope per timeline

---

## 1 · Audit findings — top 10 systemic issues (Phase 0.3)

These are the cross-cutting drift patterns surfaced by the read-only audit pass. They drive the **Phase 2 batch-fix sweep** (between flagship polish and per-screen polish). Every one is implementable in a single PR.

| # | Issue | Files | Fix |
|---|---|---|---|
| **S1** | **Per-app accent var(--accent-\*) underused** — only 4 of ~70 feature files consume `var(--accent-*)`; the rest hardcode `teal-500 / gold-500 / terra-500`. Per-app identity rail is therefore silent on most screens. (DESIGN_REVAMP §1.4 hit) | ~50 files | Codemod: detect when a feature page is owned by a per-app Layout, replace hardcoded brand colors with `var(--accent-*)` where the intent is "per-app". Most StatCard `iconBg`/`iconColor` and Button accent variant calls. |
| **S2** | **Two-phase signature visually inconsistent across Committee · Medical · Exams** — `قيد المراجعة` styling differs between apps. PRODUCT.md §4 now defines the canonical shape (dashed gold-300 border / solid gold-500 border + IconStamp / solid terra-500 border). | 6 files (CommitteeDetail, StationExam, Sprint7Pages, …) | Build a `<TwoPhaseSignature state="preliminary|final|rejected">` shared component, replace ad-hoc surfaces. |
| **S3** | **Sidebar active-rail too quiet** — current `before:w-0.5` (2px) on the start edge is invisible at desktop scale. DESIGN_REVAMP §1.4 explicitly identified this. | 1 file (Sidebar.tsx) | Bump to `before:w-1` (4px) per the v2 rail spec. |
| **S4** | **9 of 12 useQuery pages don't render an error branch** — only `isLoading` is handled; `isError` falls through silently. | 9 files | Wrap each `useQuery` consumer with `{q.isError ? <ErrorState onRetry={q.refetch} /> : ...}`. Mechanical. |
| **S5** | **8 raw `<table>` elements not migrated to `<DataTable>`** — kills sorting, density toggling, sticky-header, zebra, RTL pagination. | 8 files (BoardPages, AdminApplicants, Architecture HW table, BiometricPages, MedicalPages, ExamsPages, CommitteeSchedule, Stage6Payment) | Audit each — keep raw `<table>` only where sortable/paginated isn't needed; migrate the rest. |
| **S6** | **Hardcoded hex in 5 legacy "Pages" bundles** (BoardPages, ExamsPages, MedicalPages, CommitteeOverview, BiometricPages) — drift from token system. | 5 files, ~19 hex literals | Find/replace hex → token CSS var. |
| **S7** | **41 ad-hoc `rounded-md border ...` divs across feature pages** — should be `<Card variant="compact">` for consistent shadow + border + padding. | 41 instances | Codemod where the surface has just border + padding + bg-surface-card; leave inline where the surface has structural complexity (split borders, inset-shadow, etc.). |
| **S8** | **Inline `style={{}}` overuse in 5 pages** (medical, hub, biometric, architecture, public landing) — token bypass. Some are SVG/chart-justified; others are not. | 5 files (4–7 instances each) | Triage per file. Architecture page (4-layer SVG diagram) keeps inline; others migrate to Tailwind classes. |
| **S9** | **Tablet (≥768px) responsive unverified for staff apps** — PRODUCT.md just locked iPad as in-scope; we don't yet know which screens hold up. | sample 4 staff screens at 768px | Quick visual audit at iPad portrait (768×1024). Triage breakage. |
| **S10** | **3 print documents need a final ministerial-grade pass** — attendance card / medical certificate / board decision are in Pass 1 demo path. Look at typography density, seal placement, signature blocks, Hijri-date placement. | 3 files | Per-screen flagship polish in Phase 1. |

**Already verified clean (no fix needed):**
- Animation tokens: zero hardcoded `transition-duration` / `animation-duration` outside chart components ✓
- Logical properties: zero `pl-`/`pr-` in `src/` (verified earlier audit) ✓
- Icon-only `aria-label`: no missing labels found in audit sample ✓
- DataTable `EmptyState` fallback: every DataTable consumer provides one ✓
- Raw `<input>` outside `<Input>` component: zero ✓
- Custom modal / drawer JSX bypassing shared component: zero (false-positive on shared components themselves) ✓

---

## 2 · Pass 1 — Flagship polish (15 demo-path screens)

Per-screen flagship polish: shape brief → craft → screenshots → user-approval gate → commit → next.

| Order | Route | App | Status | Time est | Notes |
|---|---|---|---|---|---|
| 1 | `/hub` | Staff hub | ⏸ NEXT | 3 h | Compact greeting bar + 6-tile KPI hero already shipped; principles: tighten activity log, validate at iPad |
| 2 | `/applicant/print-card` (Stage 9 print) | Print | ⏸ NEXT | 2 h | Photo + 4-part name + barcode polished earlier; final pass on signature block + Khayameya footer |
| 3 | `/medical/certificate` | Print | ⏸ NEXT | 2 h | Color-coded verdict stamp + per-station table done; final pass on 3-col signature + seal placement |
| 4 | Board decision drawer (`/board/decisions` → drawer) | Print | ⏸ NEXT | 2 h | Hijri+Gregorian dates + formal Arabic prose + member signatures done; final pass on stamp typography |
| 5 | `/architecture` | Staff | ⏸ NEXT | 4 h | 4-layer diagram + 6 integrations + 11×9 RBAC + 500-unit hardware shipped; principle #2 visibility check |
| 6 | `/admin` (DashboardPage) | Admin | ⏸ NEXT | 4 h | KPI strip + heatmap + activity ticker shipped; principles: align two-phase sig styling with §4 |
| 7 | `/staff-login` | Public | ⏸ NEXT | 2 h | LoginArtPanel + RHF+zod + 1.5s MOIPASS sim done; final pass on form-pane density at iPad |
| 8 | `/` (PublicLandingPage) | **Brand** | ⏸ NEXT | 4 h | Brand register — only screen polished against brand laws (not product). Hero + 4 highlights + footer done; flagship pass. |
| 9 | `/applicant/profile/family` (Stage 7) | Applicant | ⏸ NEXT | 3 h | Section-grouped + role-tinted + ShieldCheck banner done; principle #4 styling for "preliminary" state |
| 10 | `/committee/:id` (results-entry) | Committee | ⏸ NEXT | 4 h | Two-phase explainer + live score preview done; **canonical signature treatment per S2** |
| 11 | `/medical/station/bmi` | Medical | ⏸ NEXT | 3 h | BMI gauge + ✓/✗ checklist done; principle #4 for verdict commit + cyan-teal accent (per app rail) |
| 12 | `/investigations/cases/CASE-00001` | Investigations | ⏸ NEXT | 4 h | Restricted banner + family tree + 6 named external checks done; tighten classification strip |
| 13 | `/board/sessions/:id/live` | Board | ⏸ NEXT | 3 h | Live indicator + quorum + tally bars done; principle #4 for vote-passed state |
| 14 | `/question-bank` | Exams | ⏸ NEXT | 3 h | 5-tile stats + category-tree sidebar done; principle #4 across draft/review/approved/live workflow |
| 15 | `/biometric/enroll` | Biometric | ⏸ NEXT | 3 h | 4-step wizard + capture state + quality badges done; final pass on micro-interactions |
| 16 | `/barcode` | Barcode | ⏸ NEXT | 3 h | Card-shaped preview + Khayameya stripe done; final pass on print preview density |

**Pass 1 total estimate:** ~49 hours of the 80-hour budget. Headroom: 31 h for batch fixes (Phase 2) + Pass 2 (Phase 3) + cohesion review (Phase 4).

---

## 3 · Phase 2 — Batch consistency fixes (after Pass 1)

Apply the 10 audit findings systemically, not screen-by-screen. Single-PR per fix where possible.

| # | Fix | Order | Time est | Status |
|---|---|---|---|---|
| B1 | Build `<TwoPhaseSignature>` shared component + wire into Committee · Medical · Exams (resolves S2) | 1 | 4 h | ⏸ |
| B2 | Bump sidebar rail `before:w-0.5` → `before:w-1` (resolves S3) | 2 | 30 min | ⏸ |
| B3 | Wrap all useQuery consumers in `{isError ? <ErrorState/> : ...}` (resolves S4) | 3 | 2 h | ⏸ |
| B4 | Migrate raw `<table>` → `<DataTable>` where sort/paginate matters; document keep-as-is decisions inline (resolves S5) | 4 | 4 h | ⏸ |
| B5 | Find/replace hex → CSS var in 5 legacy "Pages" bundles (resolves S6) | 5 | 2 h | ⏸ |
| B6 | Codemod ad-hoc bordered divs → `<Card variant="compact">` (resolves S7) | 6 | 3 h | ⏸ |
| B7 | Visual iPad audit + fixes for staff sidebar collapse / table overflow (resolves S9) | 7 | 3 h | ⏸ |
| B8 | Codemod feature pages to consume `var(--accent-*)` instead of hardcoded brand color (resolves S1) | **8** (last — biggest blast radius) | 6 h | ⏸ |

**Phase 2 total estimate:** ~24 hours.

---

## 4 · Pass 2 — Per-screen consistency polish (~52 screens)

Grouped by app, polished together so context stays warm. Per-screen 30–60 min — enforce the consistency checklist from the user's spec; do NOT introduce new design ideas.

**Consistency checklist (every Pass-2 screen):**
- [ ] Uses shared design system components (no rolled-own tables/modals)
- [ ] Uses tokens (no hardcoded colors or spacing)
- [ ] All five interactive states present (default / hover / active / focus / disabled)
- [ ] Loading + empty + error states wired
- [ ] Per-app accent applied via `data-app="<key>"` (now consumes `var(--accent-*)`)
- [ ] Arabic copy verbatim from karasa or `_legacy/`
- [ ] Keyboard navigation works
- [ ] Reduced-motion respected

### App: Admin (~7 screens, ~5 h)
| Route | Status |
|---|---|
| `/admin/applicants` | ⏸ |
| `/admin/applicants/:id` | ⏸ |
| `/admin/users` | ⏸ |
| `/admin/audit` | ⏸ |
| `/admin/settings` | ⏸ |
| `/admin/reports` | ⏸ |
| `/admin/reference-data` (8 sub-tabs — one polish for the layout, then verify each tab) | ⏸ |
| `/admin/cycles` + `/admin/cycles/:id` | ⏸ |
| `/admin/admission-rules` | ⏸ |

### App: Committees (~5 screens, ~3 h)
| Route | Status |
|---|---|
| `/committee` (overview) | ⏸ |
| `/committee/list` | ⏸ |
| `/committee/schedule` | ⏸ |
| `/committee/create` | ⏸ |

### App: Board (~5 screens, ~3 h)
| Route | Status |
|---|---|
| `/board` (overview) | ⏸ |
| `/board/sessions` (list) | ⏸ |
| `/board/decisions` (list) | ⏸ |
| `/board/sessions/create` | ⏸ |
| `/board/members` | ⏸ |

### App: Investigations (~5 screens, ~3 h)
| Route | Status |
|---|---|
| `/investigations` (cases list) | ⏸ |
| `/investigations/incoming` | ⏸ |
| `/investigations/outgoing` | ⏸ |
| `/investigations/create` | ⏸ |
| `/investigations/distribution` | ⏸ |

### App: Medical (~10 screens, ~6 h)
| Route | Status |
|---|---|
| `/medical` (overview) | ⏸ |
| `/medical/queue` | ⏸ |
| `/medical/results` | ⏸ |
| `/medical/station/eye / ent / internal / surgery / ortho / neuro / psychology` (7 stations sharing layout — polish layout, verify per-station copy) | ⏸ |

### App: Barcode (~5 screens, ~3 h)
| Route | Status |
|---|---|
| `/barcode/lookup` | ⏸ |
| `/barcode/batch` | ⏸ |
| `/barcode/scan` | ⏸ |
| `/barcode/replace` | ⏸ |
| `/barcode/scans` (history) | ⏸ |

### App: Biometric (~5 screens, ~3 h)
| Route | Status |
|---|---|
| `/biometric` (verify) | ⏸ |
| `/biometric/history` | ⏸ |
| `/biometric/verify-ops` | ⏸ |
| `/biometric/monitoring` | ⏸ |

### App: Exams (~6 screens, ~4 h)
| Route | Status |
|---|---|
| `/question-bank/manage` | ⏸ |
| `/question-bank/exams` (list) | ⏸ |
| `/question-bank/exams/create` | ⏸ |
| `/question-bank/exams/:id/take` | ⏸ |
| `/question-bank/exams/:id/proctor` | ⏸ |
| `/question-bank/results` | ⏸ |

### Cross-cutting / Applicant Portal stages outside flagship (~10 screens, ~6 h)
| Route | Status |
|---|---|
| `/applicant` (portal landing) | ⏸ |
| `/applicant/auth/step-1`, `/auth/step-2` | ⏸ |
| `/applicant/profile/personal` (Stage 3) | ⏸ |
| `/applicant/profile/education` (Stage 4) | ⏸ |
| `/applicant/profile/marital` (Stage 5) | ⏸ |
| `/applicant/payment` (Stage 6) | ⏸ |
| `/applicant/exam-schedule` (Stage 8) | ⏸ |
| `/applicant/follow-up` (Stage 10) | ⏸ |
| `/applicant/acquaintance-doc` (Stage 11) | ⏸ |
| `/profile`, `/help`, `/terms`, `/apply` | ⏸ |

**Pass 2 total estimate:** ~36 hours.

---

## 5 · Phase 4 — Final cohesion review (~3 h)

Click-through every route, identify residual inconsistencies, fix in one sweep. Demo-week-buffer.

---

## 6 · Time budget

| Phase | Estimate | Cumulative |
|---|---|---|
| Phase 0 (setup, audit, plan) | ~2 h | 2 h |
| Phase 1 (15 flagship screens) | ~49 h | 51 h |
| Phase 2 (8 batch fixes) | ~24 h | 75 h |
| Phase 3 (~52 consistency screens) | ~36 h | 111 h |
| Phase 4 (cohesion sweep) | ~3 h | 114 h |
| **Total against 80 h budget** | | **+34 h overflow** |

> **Budget honesty:** the full plan exceeds the 80 h budget by ~34 hours. Per the user's fallback rules:
> - **Week 1 checkpoint:** if behind on Pass 1, drop bottom 5 flagship → Pass 2.
> - **Week 2 checkpoint:** if Phase 2 incomplete, skip Phase 4. Pass 2 polish lightens (shared components + tokens only).
> - **Week 3 checkpoint:** if Pass 3 below 70%, polish ONE remaining app, leave others as-is + document gap.
> - **Week 4 (demo week):** no new polish, only cohesion review and demo-day fixes.

The fallback path lands the demo-path (Pass 1 + Phase 2 batch fixes) at ~73 hours, which fits the budget with a 7-hour buffer for Week 4 demo prep.

---

## 7 · Status updates

This file is the live tracker. After each approval gate, the status column updates and a short progress log appends below.

### Log

| Date | Phase | Action | Hours |
|---|---|---|---|
| 2026-05-03 | 0.1 | PRODUCT.md drafted from existing docs (CLAUDE.md, DESIGN_SYSTEM.md, KARASA_GAPS.md, DEMO_SCRIPT.md, DESIGN_REVAMP.md). User refinements applied. | 0.5 |
| 2026-05-03 | 0.2 | DESIGN.md → Tasks/DESIGN_SYSTEM.md symlink wired. Loader confirms both files load. | 0.1 |
| 2026-05-03 | 0.3 | Audit pass complete. 10 systemic issues surfaced (S1–S10). | 1 h |
| 2026-05-03 | 0.4 | POLISH_PLAN.md written. Awaiting Gate 2 approval. | 0.4 |
