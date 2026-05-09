# Phase 1 — Data Model: Admin Lookups CRUD

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `004-lookups-crud` | **Date**: 2026-05-09

> Captures the schema deltas across five aggregates and the JSON shapes that ride inside them. All five deltas land in a single migration `004_LookupsCrudExtensions` per Constitution V (one logical change per migration).

---

## Existing entity inventory

All five aggregates already exist in `backend/src/PACademy.Domain/`. This spec extends them; it does not introduce new top-level aggregates.

| Aggregate | File | Pre-spec status |
|---|---|---|
| `ReferenceDataEntry` | `Domain/ReferenceData/ReferenceDataEntry.cs` | Configured + migration applied. Only `governorate` category seeded. |
| `Cycle` | `Domain/Cycles/Cycle.cs` + `CycleStatus.cs` | Configured + migration applied. Demo seeder populates cycles. |
| `Category` | `Domain/Categories/Category.cs` | Configured + migration applied. Schema is flat — no condition/test/procedure structure yet. |
| `AdmissionRule` | `Domain/AdmissionRules/AdmissionRule.cs` | Single-row entity per cycle. No version column, no immutability guard. |
| `Workflow` | `Domain/Workflows/Workflow.cs` | Name + cycle FK only. No status column, no stage modelling. |

---

## Schema deltas (all in migration `004_LookupsCrudExtensions`)

### 1. AdmissionRule → versioned

```sql
ALTER TABLE admission_rules ADD Version INT NOT NULL DEFAULT 1;
ALTER TABLE admission_rules ADD EffectiveAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
ALTER TABLE admission_rules ADD ChangedById UNIQUEIDENTIFIER NULL;
CREATE UNIQUE INDEX IX_admission_rules_cycle_version ON admission_rules (CycleId, Version);
```

EF Core configuration adds `[Index(nameof(CycleId), nameof(Version), IsUnique = true)]`. `ChangedById` FK to `system_users(Id)`, nullable to permit demo-seeded rules without an attributed user.

**Invariants**:
- `Version >= 1`, monotonically increasing per `(CycleId)`.
- Existing versions are immutable — enforced in the application layer (R0.1).

### 2. Workflow → status + per-(category, cycle) uniqueness

```sql
ALTER TABLE workflows ADD Status INT NOT NULL DEFAULT 1;  -- 1=Draft, 2=Published, 3=Archived

CREATE UNIQUE INDEX IX_workflows_categorykey_cycleid_published
  ON workflows (CategoryKey, CycleId)
  WHERE Status = 2;
```

**Invariants** (FR-W02 clarification):
- At most one workflow with `Status = Published` per `(CategoryKey, CycleId)` pair. Enforced by the unique partial index.
- Different cycles can ship different `Published` workflows for the same category.
- Publishing a new workflow auto-archives the prior `Published` workflow scoped to the same `(CategoryKey, CycleId)` in a single Serializable transaction (T276).

### 3. WorkflowStage → new child entity

```sql
CREATE TABLE workflow_stages (
  Id              UNIQUEIDENTIFIER PRIMARY KEY,
  WorkflowId      UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES workflows(Id) ON DELETE CASCADE,
  [Order]         INT NOT NULL,
  Kind            NVARCHAR(64) NOT NULL,
  PassingCriteria NVARCHAR(500) NOT NULL,
  RowVersion      ROWVERSION
);
CREATE UNIQUE INDEX IX_workflow_stages_workflow_order ON workflow_stages (WorkflowId, [Order]);
```

**Invariants** (FR-W03, FR-W04):
- `Kind` ∈ canonical `RequiredTestKind` enum: `aptitude, posture, medical, physical, psychological, interview, drug, security_review, tactical_training, security_training, specialized_courses`.
- `Order` is 1-based, contiguous (no gaps), unique within a workflow.
- `RowVersion` defends against the stage-reorder race documented in [plan.md §Risks](./plan.md#risks) — concurrent PATCHes return 409 via `DomainConflictException`.

### 4. Category → JSON-encoded condition + tests + procedures

```sql
ALTER TABLE categories ADD Conditions     NVARCHAR(MAX) NOT NULL DEFAULT '{}';
ALTER TABLE categories ADD RequiredTests  NVARCHAR(MAX) NOT NULL DEFAULT '[]';
ALTER TABLE categories ADD Procedures     NVARCHAR(MAX) NOT NULL DEFAULT '[]';
```

JSON serialization happens inside the aggregate; use cases never see raw strings (R0.3).

**Invariants** (FR-K01, FR-K05):
- `CategoryKey` ∈ the seven RFP-defined keys: `officers_general, officers_specialized, postgraduate, institute_officers_training, institute_traffic, institute_guarding, special_units`. No new keys may be created.
- Each `RequiredTests[i].kind` ∈ `RequiredTestKind` enum.

#### `Conditions` JSON shape (`CategoryCondition`)

```jsonc
{
  "ageMin": 19,
  "ageMax": 22,
  "gender": "male",                  // "male" | "female" | "any"
  "minScorePercent": 80,
  "requiredQualification": "thanaweya_amma",
  "heightCm": { "min": 170, "max": 200 },
  "maritalStatus": ["single"],       // subset of {"single","married","divorced","widowed"}
  "noCriminalRecord": true,
  "nationality": ["EG"],
  "employerApprovalRequired": false,
  "nominationOnly": false,
  "freeText": []                     // string[] of additional criteria
}
```

#### `RequiredTests` JSON shape (`RequiredTest[]`)

```jsonc
[
  { "kind": "aptitude",   "order": 1, "passingCriteria": "≥ 60%" },
  { "kind": "medical",    "order": 2, "passingCriteria": "fit" },
  { "kind": "physical",   "order": 3, "passingCriteria": "≥ 70%" }
]
```

`order` here is per-category guidance and SHOULD match the published workflow's stage order; the workflow is the source of truth at runtime.

#### `Procedures` JSON shape (`Procedure[]`)

```jsonc
[
  { "step": 1, "labelAr": "تقديم النموذج" },
  { "step": 2, "labelAr": "اختبار القدرات" }
]
```

### 5. Cycle → JSON-encoded category map + overrides + active uniqueness

```sql
ALTER TABLE cycles ADD OpenCategories     NVARCHAR(MAX) NOT NULL DEFAULT '{}';
ALTER TABLE cycles ADD ConditionOverrides NVARCHAR(MAX) NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IX_cycles_year_cohort_active
  ON cycles (Year, Cohort)
  WHERE Status = 2;  -- 2=Active
```

**Invariants** (FR-Y01, FR-Y02 clarification):
- Status enum: `Draft = 1`, `Active = 2`, `Closed = 3`, `Archived = 4`.
- Transitions: `Draft → Active`, `Active → Closed`, `Closed → Archived`. No skips, no reverses.
- At most one `Active` cycle per `(Year, Cohort)` pair, enforced by the unique partial index. Concurrent transitions resolve to exactly one Active under `IsolationLevel.Serializable` (SC-Y01).

#### `OpenCategories` JSON shape

```jsonc
{
  "officers_general":            { "isOpen": true,  "capacity": 600, "notes": "" },
  "officers_specialized":        { "isOpen": true,  "capacity": 120, "notes": "" },
  "postgraduate":                { "isOpen": false, "capacity": null, "notes": "تأجيل لدورة 2026-F" },
  "institute_officers_training": { "isOpen": true,  "capacity": 200, "notes": "" }
  // Missing keys are treated as { "isOpen": false }.
}
```

#### `ConditionOverrides` JSON shape

```jsonc
{
  "officers_general": {
    // Partial CategoryCondition — only the fields to override.
    "minScorePercent": 85,
    "heightCm": { "min": 172, "max": 200 }
  }
  // Eligibility merges category.conditions with cycle.conditionOverrides[categoryKey];
  // override wins on conflict.
}
```

---

## Relationship summary (post-spec)

```
Cycle ──< AdmissionRule (versioned, immutable per row)
   │
   ├──< Workflow ──< WorkflowStage
   │       (one Published per (CategoryKey, CycleId))
   │
   └─[json: OpenCategories]─→ Category (by key)
       └─[json: ConditionOverrides]─→ Category.Conditions (merged)

ReferenceDataEntry  (8 categories: governorate, specialization, rank, college,
                                   qualification, nationality, relationship, case-type)
   │
   └─< (FK targets across applicants, admission rules, workflow stages — see FR-L05)
```

`ReferenceDataEntry` is referenced by other aggregates by FK; archive is blocked when any FK exists (`REFERENCE_IN_USE`). Renames propagate cosmetically (FR-L05 clarification) — the old `nameAr` is preserved only in the audit before/after diff.

---

## Demo seeder additions (T208–T210)

| Seeder method | Adds |
|---|---|
| `SeedReferenceDataAsync` | The seven currently-missing categories (`specialization`, `rank`, `college`, `qualification`, `nationality`, `relationship`, `case-type`), ported from `frontend/src/shared/mock-data/referenceData.ts`. |
| `SeedCyclesAsync` | Populates `OpenCategories` (all 7 categories open in the active 2026-male cycle; female cycle gets the categories that admit women) and seeds an empty `ConditionOverrides` map. |
| `SeedCategoriesAsync` | Populates `Conditions`, `RequiredTests`, `Procedures` from the frontend mock category definitions. Verify all 7 categories seed cleanly. |

---

## Migration discipline

Five aggregate-level deltas, **one** migration file. Justified in [plan.md §Complexity Tracking row 1](./plan.md#complexity-tracking) — atomic schema change is preferable to a partial Phase 4. Reviewed by lead before merge.
