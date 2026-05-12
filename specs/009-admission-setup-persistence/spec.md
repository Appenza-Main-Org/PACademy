# Feature Specification: Admission-Setup Wizard Persistence

> **⚠ Amendment 001 active (2026-05-12)** — wizard step count reduced from 15 to 13 after merging `origin/main`. Step 1 (`application_settings`) is now owned by **spec 011**. See [`AMENDMENT-001-wizard-step-count.md`](AMENDMENT-001-wizard-step-count.md) for the full delta.

**Feature Branch**: `009-admission-setup-persistence`
**Created**: 2026-05-11
**Last amended**: 2026-05-12
**Status**: Draft
**Input**: User description: "Wire all 13 admission-setup wizard pages to the database (step 1 — `application_settings` — is owned by spec 011 and is excluded from spec 009's scope; see AMENDMENT-001-wizard-step-count.md)"

## Clarifications

### Session 2026-05-11

- Q: When two admins edit the same wizard step concurrently, what should the system do? → A: **Optimistic locking via rowVersion/ETag.** Every persisted row carries a server-issued version stamp. A save that supplies a stale version is rejected with a 409-style conflict response and an Arabic "تم التعديل من قبل مستخدم آخر — يرجى تحديث الصفحة" message; the admin must reload to see the latest state before re-saving. No data is ever silently overwritten.
- Q: Is cross-cycle wizard import (copy last year's setup into a new cycle) in scope for spec 009? → A: **Yes — included as User Story 4 (P4).** An admin can clone the wizard configuration of any prior cycle into a new draft cycle as a starting point, then edit. The clone covers all 13 steps' data; step 1 (`application_settings`) is cloned via the spec 011 path. Identity-bound fields (cycle name, year, application dates) are reset, and references to other entities (committee ids, exam ids, lookup keys) are remapped where the target cycle's catalogue allows or flagged as broken where it doesn't.
- Q: How do committee merge/split rules execute on their effective date? → A: **Manual "Apply" action by an admin.** The merge/split rule is a *planned* configuration with an informational `effectiveAt` date. No background job auto-executes it. On or after `effectiveAt`, an admin reviews an impact preview (which applicants move where, capacity changes, downstream side-effects) and clicks "Apply" to commit. The rule's lifecycle is `planned → applied → cancelled` (admins can cancel a planned rule before apply; an applied rule is immutable for audit).
- Q: How is each wizard step's status pill (complete / in_progress / not_started) determined? → A: **Admin explicitly marks each step complete.** The pill defaults to `not_started` for an empty step and flips to `in_progress` automatically the first time any data is saved for the step, but only the admin clicking a "إكمال الخطوة" (Mark step complete) button promotes it to `complete`. This is auditable (action: `wizard_step_completed`) and reversible (admin can re-open a step by editing any field, dropping it back to `in_progress`).

## User Scenarios & Testing *(mandatory)*

The admission-setup wizard is the operator's command surface for configuring a
cycle end-to-end: cycle dates, applicant categories, age and marital rules,
fees, exam plan, committees, merge/split rules, score thresholds, exam dates,
date-committee bindings, total-score weights, notifications, and the electronic
declaration shown to the applicant before printing. Today, the wizard is
visually complete but its 13 steps are backed by two storage strategies on
this branch — in-memory mocks for the existing service layers (steps 2, 3,
4, 5, 6, 10, 12) and brand-new in-memory shapes that don't exist on the
backend at all (steps 7, 8, 9, 11, 13). Step 1 (`application_settings`)
is owned by spec 011 (Application Settings Persistence) and is out of scope
for spec 009. The practical effect today is that an operator can configure
the wizard front-to-back, close the tab, and lose ~60% of the work; the
other 40% may or may not survive depending on which step. This feature
closes that gap so every wizard step in spec 009's scope reads from and
writes to the database.

### User Story 1 — The 5 wizard steps with no backend today get full persistence (Priority: P1)

A super-admin opens any of the five steps that have zero database backing
today — committee merge/split rules (step 9), committee score thresholds
(step 10), admission exam date config (step 11), total-score weights per
applicant stream (step 13), and the electronic declaration (step 15) —
edits the configuration, saves, closes the browser, opens the wizard again
the next day from a different machine, and sees exactly the saved state. A
second admin opening the same cycle's wizard sees the same data, not their
own private in-memory copy.

**Why this priority**: These five steps are 100% non-functional for
production use today. They render and accept input, but everything written
to them is lost the moment the browser tab closes or another admin opens
the page. Until these five persist, the operator cannot finish setting up a
cycle. This is the highest user-visible gap and must work end-to-end first.

**Independent Test**: An admin configures one of the five steps for a draft
cycle, closes the browser, signs back in on a different machine, and
verifies the configuration is intact. A second admin opens the same cycle
and sees the same saved state.

**Acceptance Scenarios**:

1. **Given** an admin has configured a committee merge rule (two source
   committees, one target, an effective date), **When** they refresh the
   browser or sign in from another device, **Then** the merge rule appears
   in the list with the same data.
2. **Given** an admin sets a score threshold (min 60, max 100) for a
   committee, **When** the cycle reaches its admission decision phase,
   **Then** the same threshold values are visible to the committee
   secretary and feed the decision UI without ever being re-entered.
3. **Given** an admin publishes an electronic declaration version,
   **When** an applicant later reaches the print-card stage of the
   applicant portal, **Then** the declaration body the applicant sees is
   the published version's text, not a hard-coded fallback.
4. **Given** an admin saves total-score weights for the "general" stream
   (40% written, 30% physical, 30% interview), **When** the same cycle's
   results pipeline computes applicant totals, **Then** the weights used
   match what was saved, and a second admin viewing the wizard sees the
   same numbers.
5. **Given** an admin sets bookable exam dates and a list of blackout
   dates, **When** an applicant reaches the exam-scheduling stage of the
   applicant portal, **Then** the available slots match the saved
   `bookableDays` minus `blackoutDates`.

---

### User Story 2 — The 4 wizard steps with mock-only services get DB persistence (Priority: P2)

The wizard steps that compose over existing services — exam-plan editor
(step 7), committee management (step 8), date-committee binding (step 12),
and notification authoring (step 14) — currently read from and write to
in-memory service-layer mocks rather than the database. An admin
configuring these steps loses their work on page reload, and a second
admin sees a different in-memory state. The same edit-save-reload
round-trip must succeed for these four steps.

**Why this priority**: These four steps appear to work in the demo because
in-memory state survives within one session. The breakage only surfaces on
page refresh or when two admins coordinate. Lower priority than P1 because
the entities involved (committees, exam plans, notifications) are well-
defined and reused elsewhere — their backing model is clearer, the work is
mostly wiring rather than greenfield. Higher priority than P3 because the
gap is total, not partial.

**Independent Test**: For each of the four services, an admin edits a
representative entity (e.g., adds a committee, reorders an exam,
publishes a notification), reloads the page, and sees the change.

**Acceptance Scenarios**:

1. **Given** an admin reorders the cycle's exam plan and toggles one exam
   from optional to required, **When** they refresh the wizard, **Then**
   the new order and required flag persist.
2. **Given** an admin creates a new committee with a chair, members, and a
   daily capacity, **When** they leave and return to the wizard,
   **Then** the committee appears with the same fields, and the
   committees view in the standalone admin app shows the same row.
3. **Given** an admin binds a committee to a specific exam date with a
   custom daily capacity, **When** an applicant attempts to book that
   date for that committee, **Then** the system respects the bound
   capacity rather than defaulting to the committee's overall capacity.
4. **Given** an admin authors a notification template ("send when
   applicant pays the fee") and publishes it, **When** the trigger event
   fires for an applicant, **Then** the saved template body is what gets
   sent.

---

### User Story 3 — The 6 partially-wired wizard steps finish their persistence story (Priority: P3)

The first six wizard steps — cycle metadata, application settings,
application status, age rules, marital-status rules, and fees — already
have partial backend wiring through the cycles and categories services.
Some endpoints persist, some don't. An admin should not have to know
which fields stick and which don't; every field on every step must
read and write through the API.

**Why this priority**: Some functionality already works here, so the
break is partial — an admin can save metadata but maybe not fees, or
save category conditions but not status transitions, depending on which
endpoints are wired. P3 because there's no full-feature outage; this is
finishing a partially-done job rather than rescuing something broken.

**Independent Test**: For each of the six steps, identify any field that
the user can edit, modify it, refresh, and verify it persists. No field
on these steps may rely on in-memory state.

**Acceptance Scenarios**:

1. **Given** an admin edits the cycle's name, year, application open/close
   dates, and reference age date, **When** they refresh, **Then** all
   five fields persist.
2. **Given** an admin defines fee tiers in the fees step (base fee + late
   surcharge) and enables the Fawry payment integration,
   **When** they refresh, **Then** the fee schedule and Fawry config are
   intact.
3. **Given** an admin transitions a cycle from draft to active,
   **When** they reload the wizard, **Then** the cycle status reads
   "active" without manual re-set.
4. **Given** an admin sets the minimum and maximum age for the "general"
   applicant category with the reference age date computed from the
   cycle, **When** they re-open the category condition builder,
   **Then** the constraints survive.
5. **Given** an admin lists allowed marital statuses for a category
   ("single", "married"), **When** an applicant attempts to register
   with a status outside that list, **Then** the system rejects the
   registration with the persisted rule, not a default rule.

---

### User Story 4 — Copy wizard configuration from a prior cycle (Priority: P4)

Each year, most of the prior cycle's wizard configuration (categories,
age rules, fee tiers, exam plan, committee structure, score thresholds,
total-score weights, declaration body) is reused with minor edits.
Rebuilding from scratch each year is wasted effort. An admin creating
a new draft cycle can pick any prior cycle and clone its full wizard
configuration into the new cycle as a starting point, then edit only
what's different (typically dates, fee amounts, and a small set of
threshold tweaks).

**Why this priority**: This is a strong productivity win but not a
correctness gap. Without it, the wizard still works end-to-end; admins
just spend hours re-entering the same configuration each year. P4
because it depends on P1–P3 landing first (cloning depends on the data
existing in the durable store) and the cycle-setup season runs once
per year — the urgency is bounded.

**Independent Test**: An admin creates a draft cycle for the next year,
opens the wizard, picks "نسخ من دورة سابقة" (copy from prior cycle)
and selects an archived cycle. After the copy completes, every wizard
step shows the prior cycle's data, except identity-bound fields (name,
year, application dates) which are reset to draft defaults. The admin
edits a few thresholds and saves; the new cycle's wizard reflects only
those edits, and the source cycle's data is untouched.

**Acceptance Scenarios**:

1. **Given** an admin has a draft cycle with no wizard data and selects
   a prior cycle as the copy source, **When** they confirm the copy,
   **Then** all 13 steps populate with the prior cycle's data (step 1
   `application_settings` is global per spec 011 — not cloned; only the
   target cycle's pill is marked `in_progress`), the
   cycle name / year / application-dates fields are blank (the admin
   fills them in), and an audit entry records the copy operation with
   source and target cycle ids.
2. **Given** the source cycle references entities that don't exist in
   the target context (e.g., a committee with a specific chair user
   who has since left the organisation), **When** the copy resolves
   references, **Then** valid references are copied as-is and unresolvable
   references are flagged with a broken-reference indicator in the
   target wizard, asking the admin to remap before completing the step.
3. **Given** an admin runs a copy on a cycle that already has wizard
   data saved, **When** they confirm the copy, **Then** the system
   either refuses (the target cycle must be empty) or asks for explicit
   "Replace all existing data?" confirmation before proceeding.
4. **Given** an admin copies from a prior cycle and then immediately
   archives the source cycle, **When** they later open the target
   cycle's wizard, **Then** the copied data is intact and independent;
   archiving the source has no effect on the copy.

---

### Edge Cases

- **Cycle archived mid-edit**: If the cycle the wizard targets is archived
  (status change made by another admin) while a write is in flight, the
  write must be rejected with a clear, Arabic, user-actionable error
  rather than silently failing or corrupting state.
- **Referenced row deleted**: If a wizard configuration references another
  row (e.g., a merge rule names two committees, a notification template
  targets a committee type), and that referenced row is soft-deleted by
  another admin, the wizard must still load and clearly flag the broken
  reference rather than crashing.
- **Concurrent edits**: Two admins editing the same step of the same
  cycle must not silently overwrite each other. The system must detect
  the conflict and surface it (last-write-wins with a visible warning is
  acceptable; silent overwrite is not).
- **Step interdependencies**: Some steps depend on data from earlier
  steps — e.g., score thresholds reference committees from step 8;
  total-score weights reference exams from step 7. If an admin removes
  a committee or exam that's referenced by a later step, the dependent
  step must reflect the change (broken link flagged, or cascading
  cleanup, but never a silent stale read).
- **Empty cycle / first save**: For a brand-new draft cycle with no
  wizard data, the read endpoints must return a defined "empty" state
  (empty arrays, sensible defaults) rather than 404s or null cascades
  that break the UI.
- **Wizard step partially saved**: If a step's save fails mid-way (e.g.,
  network drop after saving the merge rule but before saving the
  effective date), the system must either commit the whole step
  atomically or leave the prior state untouched. Partial state across
  fields of one step is not acceptable.
- **Browser-local draft state**: Today the wizard's `wizard-draft.ts`
  library autosaves to local storage as the admin types. After this
  feature lands, drafts must reconcile with server state on reload
  rather than overwriting it with stale local data.
- **Optimistic-lock conflict during a save**: When the server rejects a
  save due to a stale `rowVersion`, the form must not lose the admin's
  in-flight edits silently. The conflict response must surface a
  diff-style preview ("here's what you wrote vs. what the server has")
  so the admin can decide which fields to re-apply after refresh.
- **Applying a merge/split rule with broken references**: If a planned
  rule references committees that have since been soft-deleted or
  archived, the "Apply" action must be blocked and the impact preview
  must clearly flag the broken reference. The admin must resolve the
  reference (restore the committee or cancel the rule) before applying.
- **Cross-cycle copy of cycle-specific identifiers**: When cloning,
  references whose identifiers are tied to the source cycle (e.g., a
  committee id, an exam id, a category id) must be remapped to the
  target cycle's equivalents where they exist by key/name match, or
  flagged as broken where no match exists. Identifiers are never
  copied verbatim into the target cycle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All data entered into any of the 15 wizard steps MUST persist
  to a durable store such that closing the browser, signing out, or
  signing in from a different machine returns the same state.
- **FR-002**: All wizard data MUST be scoped to a specific cycle; the same
  step type for two different cycles MUST not collide or share state.
- **FR-003**: Every mutation through any wizard step MUST generate an
  audit-log entry with actor, action, entity, before/after snapshot
  (where applicable), and timestamp, consistent with the existing audit
  surface.
- **FR-004**: Every wizard mutation MUST be permission-gated; only users
  with the appropriate write permission for the surface MUST be able to
  save changes. Read access MUST be similarly gated.
- **FR-005**: When a user without write permission views the wizard, the
  page MUST render in a read-only mode rather than silently failing
  saves.
- **FR-006**: When the cycle's status is "archived" or "closed", wizard
  writes MUST be rejected with a clear Arabic error message; reads MUST
  still succeed so admins can audit prior decisions.
- **FR-007**: Each wizard step MUST be independently saveable; one step's
  save failure MUST NOT block another step's save.
- **FR-008**: Server-side validation MUST enforce all data rules
  independently of client-side validation — required fields, allowed
  enum values, foreign-key existence, and per-step invariants (e.g.,
  total-score weights summing to 100 per stream).
- **FR-009**: Foreign-key references between wizard data and other
  entities (committees, exams, lookup rows) MUST be enforced; deleted
  or archived referents MUST be surfaced in the wizard with a clear
  broken-reference indicator rather than silently rendering as blank.
- **FR-010**: The 5 wizard-owned entities (committee merge/split rules,
  committee score thresholds, exam-date config, total-score config,
  electronic declaration) MUST support soft-delete with a
  super-admin-only restore path, consistent with the platform's
  existing soft-delete pattern.
- **FR-011**: For each entity, the system MUST expose endpoints to list,
  read, create, update, archive, and (where applicable) restore;
  bulk-import is out of scope for this feature.
- **FR-012**: Concurrent edits to the same row MUST be detected via
  optimistic locking. Every persisted entity carries a server-issued
  `rowVersion` (or equivalent ETag). A save that supplies a stale
  version MUST be rejected with a 409-style conflict response and an
  Arabic message: "تم التعديل من قبل مستخدم آخر — يرجى تحديث الصفحة";
  no data is ever silently overwritten.
- **FR-013**: The wizard's existing browser-local draft autosave MUST
  reconcile with server state on reload — server state wins on
  conflict, but the admin MUST be notified rather than have local edits
  silently dropped.
- **FR-014**: The wizard step-status pills MUST follow this lifecycle:
  `not_started` (no data saved for the step) → `in_progress` (any data
  saved, automatic transition) → `complete` (admin clicks "إكمال الخطوة"
  to promote). Editing any field of a `complete` step MUST drop it back
  to `in_progress`. Status promotion to `complete` MUST emit an audit
  entry (action: `wizard_step_completed`) and MUST be reversible.
- **FR-015**: When a cycle is closed or archived, its wizard data MUST be
  retained indefinitely for audit. [NEEDS CLARIFICATION: is there a
  retention/purge window after which closed-cycle wizard data is
  archived to cold storage or hard-deleted?]
- **FR-016**: The electronic declaration MUST track a monotonically
  increasing version number per cycle; admins MUST be able to publish a
  version and see which version is currently in effect.
- **FR-017**: Total-score weights across all components MUST sum to 100
  per applicant stream; the system MUST reject a save that violates
  this invariant.
- **FR-018**: A committee merge rule MUST require at least two source
  committees and exactly one target; a split rule MUST require exactly
  one source and at least two targets. The system MUST reject saves
  that violate these shape invariants.
- **FR-018a**: Merge/split rules have a lifecycle of
  `planned → applied → cancelled`. `planned` rules are editable and
  cancellable. The "Apply" action moves the rule to `applied`, executes
  the committee restructuring (moves applicants, reallocates capacity)
  in a single atomic transaction, and locks the rule from further
  edits. `applied` rules MUST be immutable for audit. An admin MAY
  cancel a `planned` rule before it is applied; cancellation emits an
  audit entry and transitions the rule to `cancelled` (also immutable).
- **FR-018b**: Before the "Apply" action commits, the system MUST show
  an impact preview: which applicants will be moved, which committees
  gain or lose capacity, and which downstream artefacts (bookings,
  audit entries) will be affected. The admin MUST explicitly confirm
  the preview before the transaction runs.
- **FR-019**: Score thresholds MUST satisfy `min <= max` and both MUST be
  within the cycle's allowed score range; the system MUST reject saves
  that violate this.
- **FR-020**: Exam-date config MUST require `firstAvailableDate <=` every
  date in `bookableDays`; `blackoutDates` MUST be a subset of
  `bookableDays`; the system MUST reject saves that violate this.
- **FR-021**: Wizard data for one cycle MUST be cloneable from another
  cycle as a starting point (in scope for this feature). The clone
  operation MUST:
  - Copy every step's data (1 through 15) into the target cycle.
  - Reset identity-bound fields on the target: cycle name, year,
    application open/close dates, reference age date. The admin fills
    those in for the new cycle.
  - Remap cross-entity references where the referenced row exists in
    the target context; flag unresolvable references with a broken-
    reference indicator on the target wizard rather than failing the
    clone.
  - Require the target cycle to be empty, or require explicit
    "Replace all existing data?" confirmation if it isn't.
  - Emit one summary audit entry recording source and target cycle ids
    plus per-step row counts.
- **FR-022**: The clone operation MUST be atomic with respect to the
  target cycle. A failure mid-clone MUST leave the target cycle in its
  pre-clone state (typically empty) rather than partially populated.

### Key Entities

The five wizard-owned entities have no backend home today and must be
created:

- **CommitteeMergeSplitRule** (step 9) — a planned merge or split
  operation against named source/target committees, with an
  informational `effectiveAt` date and a lifecycle of
  `planned → applied → cancelled`. The "Apply" action is admin-driven,
  not scheduled; once applied, the rule is immutable. Belongs to one
  cycle.
- **CommitteeScoreThreshold** (step 10) — the inclusive min/max
  acceptance scores for one committee within one cycle. One row per
  (cycle, committee) pair.
- **ExamDateConfig** (step 11) — the bookable-days, blackout-dates, and
  earliest-available-date for the cycle's admission exams. One row per
  cycle.
- **TotalScoreConfig** (step 13) — the per-applicant-stream component
  weights and total-out-of denominator. One row per
  (cycle, applicant-stream) pair, with an embedded list of components
  referencing exams from the cycle's exam plan.
- **ElectronicDeclaration** (step 15) — the versioned, publishable
  Arabic declaration text shown to applicants before they print their
  exam card. Multiple draft versions per cycle; one published version
  active at a time.

The other ten steps compose over entities that already exist in the
domain model (Cycle, Category, AdmissionRule, Committee, Exam,
NotificationTemplate). Those entities already have backend persistence
or partial backend persistence; this feature finishes the wiring rather
than introducing new shapes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can configure all 15 wizard steps for a new cycle,
  close the browser, sign in 24 hours later from a different device, and
  see 100% of the data they entered. No field is in-memory-only.
- **SC-002**: Two admins simultaneously editing different steps of the
  same cycle can both save successfully; neither sees the other's edits
  reverted. When two admins edit the same row of the same step, the
  second save MUST be rejected with a 409-style conflict response and
  an actionable Arabic message; the second admin reloads to see the
  latest state before re-saving. No silent overwrites.
- **SC-003**: 100% of admission-setup wizard mutations appear in the
  audit log within 1 second of save, with full actor, before, and after
  snapshots where applicable.
- **SC-004**: When the applicant portal renders the print-card stage,
  the electronic-declaration text it shows matches the
  currently-published version from the cycle's wizard data; no
  hard-coded fallback string is visible on a configured cycle.
- **SC-005**: For a cycle in "draft" status, all 15 wizard steps allow
  reads and writes by admins with write permission. For a cycle in
  "active" or "closed" status, reads succeed and writes are rejected
  with a clear Arabic message.
- **SC-006**: The wizard's step-status pills on the index landing
  correctly reflect persisted state and admin actions: `not_started`
  when no rows exist for the step, `in_progress` once any data is
  saved, and `complete` only after an admin explicitly marks the step
  complete. Editing any field of a completed step demotes it back to
  `in_progress` on the next save.
- **SC-007**: Page load time for any wizard step MUST stay under 2
  seconds on a mid-tier laptop with 100ms simulated network latency.
- **SC-008**: A re-opened wizard step displays its persisted data within
  500ms of mount on the same connection (perceived as instantaneous).
- **SC-009**: Soft-deleting a referenced row (e.g., a committee named in
  a merge rule) does NOT crash any wizard step; the broken reference
  surfaces with a visible warning indicator and an actionable path to
  resolve it.
- **SC-010**: Applying a committee merge or split rule moves the
  affected applicants and reallocates capacity atomically — either
  every change commits or none does. The applied rule is immutable
  thereafter, the impact preview shown before apply matches what
  actually happened, and the audit log records the full transition.
- **SC-011**: An admin cloning a prior cycle's wizard configuration
  into a new draft cycle sees the new cycle's wizard fully populated
  within 5 seconds (excluding network), with broken references (rows
  the target catalogue does not contain) clearly flagged. The source
  cycle's data is unchanged.
