# Database Schema — `DB_PAcademy_Prod`

> Generated from the live database on 2026-06-10. `DB_PAcademy_Staging` mirrors this schema.

**46 tables.**

---

## Admin Data Map

> **⚠️ STALE (as of 2026-06-15): the tables below describe the schema BEFORE the 2026-06-10 normalization migrations, which have since SHIPPED** (see [CLAUDE.md](../CLAUDE.md) §11, "normalization wave 2"). The 13 buckets listed here are now typed Shape-A tables. Regenerate this doc (`backups/gen-schema-md.sh`) against the live DB before relying on exact table shapes.
>
> **Normalization (2026-06-10, now deployed).** Five migrations
> (`NormalizeCommitteeInstances` → `NormalizeWorkflowsCommittees`) convert 13 master-data
> JSON buckets into typed Shape-A tables: `committee_instances`, `payment_ledger`,
> `exam_committee_users`, `exam_devices`, `exam_results`, `exam_attempt_results`,
> `biometric_enrollments`, `notifications_master` (+`notification_audience`),
> `exam_plans` (+`exam_plan_exams`), `committee_results` (+`committee_result_scores`),
> `workflows` (+`workflow_stages`, `workflow_stage_tests`), `applicant_workflow_progress`
> (+`applicant_workflow_test_results`), `committees`. Each keeps a `payload_json` mirror
> so API shapes are unchanged. Kept as JSON by design: audit/log/cache buckets,
> `admissionSetup.*`, `biometric-config` (freeform k/v), and `applicant_portal_records`.
> The tables below describe the live DB **before** these migrations are applied —
> regenerate this doc (`backups/gen-schema-md.sh`) after deploy.

How the admin application's data is laid out across the database. Admin data uses **four storage shapes**:

| Shape | Pattern | Used for |
|---|---|---|
| **A — Normalized domain table** | one row per entity, typed columns | stable, queryable master data (cycles, categories, users, exams, grades, lookups…) |
| **B — JSON record-bucket table** | composite PK `(module, id)`, a `payload_json` blob, plus denormalized index columns (`applicant_id`, `national_id`, `cycle_id`, `committee_id`, `category_key`, `department`, `status`, `kind`, `occurred_at`) | operational / document-shaped records routed by a `module` **bucket discriminator** |
| **C — Applicant-portal JSON store** | `applicant_portal_records`, PK `(type, record_id)` | applicant-portal state the admin owns/reads |
| **D — Singleton** | exactly one row | global settings |

> **Shape B routing.** The `module` column is the bucket name. `OperationalRecordStore.BucketFor(module)` (backend) routes each bucket to a physical table; anything unrouted falls back to the legacy `admin_records` store. The catalogue below lists every routed bucket.

### Admin feature → tables

| Admin area | Tables | Shape |
|---|---|---|
| **Identity & RBAC** (`/admin/users`, roles) | `users`, `roles`, `officer_directory` | A |
| **Cycles & Categories** (`/admin/cycles`, `/admin/categories`) | `admission_cycles`, `applicant_categories` | A |
| **Admission Setup wizard** (`/admin/admission-setup`) | `admission_rules`, `application_settings_category_configs`, `application_settings_category_specializations`, `application_settings_graduation_years`, `exam_slots`; + `admission_setup_records` | A + B |
| **Lookups** (`/admin/lookups`) | `lookup_rows` | A |
| **Applicants management** (`/admin/applicants`) | `applicants`, `applicant_portal_records`, `applicant_acquaintance_docs`, `applicant_acquaintance_doc_sections`, `applicant_acquaintance_doc_revisions`; + `applicant_management_records` | A + B + C |
| **Applicant Grades** (`/admin/applicant-grades`) | `applicant_grades`, `applicant_grade_adjustments`, `grade_import_batches`, `grade_import_rows`; + `grade_operational_records` | A + B |
| **Committees** (`/admin/committee*`, exam-config) | `committee_records` | B |
| **Question Bank & Exams** (`/question-bank`, `/exams`) | `exams`, `exam_questions`, `exam_question_options`, `exam_question_matching_pairs`, `exam_rules`, `exam_question_links`, `exam_assignments`; + `exam_operational_records` | A + B |
| **Biometric** | `biometric_records` | B |
| **Workflows** (`/admin/workflows`) | `workflow_records` | B |
| **Payments** (`/admin/payments`) | `payments` | B |
| **Notifications** (`/admin/notifications`) | `notifications` | B |
| **Reports** (`/admin/reports`) | `report_snapshots` | B |
| **Audit** (`/admin/audit`) | `audit_entries` | A |
| **Settings** (`/admin/settings`) | `general_settings`, `acquaintance_doc_settings` | D + A |
| **Migration history** (EF Core) | `__EFMigrationsHistory_AdminApi`, `__EFMigrationsHistory_ApplicantGradesAdmin`, `__EFMigrationsHistory_IdentityApplicant`, `__EFMigrationsHistory_LookupsAdmin` | — |
| **Legacy / migration-only** | `admin_records` | B |

### JSON record-bucket catalogue (Shape B)

Every `module` discriminator value and the physical table it routes to. Source of truth: `OperationalRecordStore.BucketFor` + `AdminDbContext.ConfigureOperationalRecord`.

| Physical table | `module` bucket value(s) | Holds |
|---|---|---|
| `payments` | `payments` | payment intents / ledger entries |
| `applicant_management_records` | `applicants`, `relatives`, `acquaintance` | admin-side applicant operational records, relatives, acquaintance data |
| `grade_operational_records` | `grades` | per-cycle grade operational rows |
| `notifications` | `notifications` | notification feed entries |
| `workflow_records` | `workflows`, `workflowTransitions`, `applicantWorkflowProgress` | workflow definitions, transition log, per-applicant progress |
| `committee_records` | `committees`, `committeeInstances`, `committeeResults` | committees, per-day exam-config instances, committee results |
| `exam_operational_records` | `examPlans`, `examResults`, `exam-attempts`, `exam-live-sessions`, `exam-committee-users`, `exam-devices`, `exam-audit` | exam plans, results, attempts, live proctor sessions, committee users, authorized devices, exam audit |
| `biometric_records` | `biometric-enrollments`, `biometric-verifications`, `biometric-gate-logs`, `biometric-audit`, `biometric-config` | biometric enroll/verify records, gate logs, audit, device config |
| `admission_setup_records` | `committeeBindings`, `admissionSetup.*` (prefix) | committee bindings + per-step admission-setup drafts |
| `report_snapshots` | `kpis`, `last14Days` | cached report KPIs + 14-day timeseries |
| `admin_records` | _(legacy — unrouted buckets only)_ | migration-only historical rows; `[Obsolete]`, no new write paths |

### Applicant-portal JSON store (Shape C)

`applicant_portal_records`, PK `(type, record_id)` — admin owns the schema, the applicant backend reads/writes through its own context.

| `type` discriminator | `record_id` is | Holds |
|---|---|---|
| `draft` | National ID | applicant draft (one per applicant) |
| `payment` | payment ref number | payment attempts (many per applicant) |
| `exam_reservation` | National ID | exam-slot reservation |
| `family` | National ID | family / relatives data |

## Tables

| Table | Rows |
|---|---|
| [`__EFMigrationsHistory_AdminApi`](#--efmigrationshistory-adminapi) | 11 |
| [`__EFMigrationsHistory_ApplicantGradesAdmin`](#--efmigrationshistory-applicantgradesadmin) | 3 |
| [`__EFMigrationsHistory_IdentityApplicant`](#--efmigrationshistory-identityapplicant) | 1 |
| [`__EFMigrationsHistory_LookupsAdmin`](#--efmigrationshistory-lookupsadmin) | 1 |
| [`acquaintance_doc_settings`](#acquaintance-doc-settings) | 0 |
| [`admin_records`](#admin-records) | 55 |
| [`admission_cycles`](#admission-cycles) | 5 |
| [`admission_rules`](#admission-rules) | 0 |
| [`admission_setup_records`](#admission-setup-records) | 4 |
| [`applicant_acquaintance_doc_revisions`](#applicant-acquaintance-doc-revisions) | 0 |
| [`applicant_acquaintance_doc_sections`](#applicant-acquaintance-doc-sections) | 0 |
| [`applicant_acquaintance_docs`](#applicant-acquaintance-docs) | 0 |
| [`applicant_categories`](#applicant-categories) | 4 |
| [`applicant_grade_adjustments`](#applicant-grade-adjustments) | 0 |
| [`applicant_grades`](#applicant-grades) | 10,001 |
| [`applicant_management_records`](#applicant-management-records) | 9 |
| [`applicant_portal_records`](#applicant-portal-records) | 19 |
| [`applicants`](#applicants) | 47 |
| [`application_settings_category_configs`](#application-settings-category-configs) | 6 |
| [`application_settings_category_specializations`](#application-settings-category-specializations) | 6 |
| [`application_settings_graduation_years`](#application-settings-graduation-years) | 0 |
| [`audit_entries`](#audit-entries) | 365 |
| [`biometric_records`](#biometric-records) | 0 |
| [`committee_records`](#committee-records) | 78 |
| [`exam_assignments`](#exam-assignments) | 0 |
| [`exam_operational_records`](#exam-operational-records) | 4 |
| [`exam_question_links`](#exam-question-links) | 70 |
| [`exam_question_matching_pairs`](#exam-question-matching-pairs) | 3 |
| [`exam_question_options`](#exam-question-options) | 205 |
| [`exam_questions`](#exam-questions) | 52 |
| [`exam_rules`](#exam-rules) | 4 |
| [`exam_slots`](#exam-slots) | 5 |
| [`exams`](#exams) | 2 |
| [`faculties`](#faculties) | 19 |
| [`general_settings`](#general-settings) | 1 |
| [`grade_import_batches`](#grade-import-batches) | 0 |
| [`grade_import_rows`](#grade-import-rows) | 0 |
| [`grade_operational_records`](#grade-operational-records) | 0 |
| [`lookup_rows`](#lookup-rows) | 431 |
| [`notifications`](#notifications) | 0 |
| [`officer_directory`](#officer-directory) | 1 |
| [`payments`](#payments) | 0 |
| [`report_snapshots`](#report-snapshots) | 0 |
| [`roles`](#roles) | 8 |
| [`users`](#users) | 1 |
| [`workflow_records`](#workflow-records) | 0 |

---

## __EFMigrationsHistory_AdminApi

_11 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `MigrationId` | nvarchar(150) | NOT NULL | PK |  |  |
| `ProductVersion` | nvarchar(32) | NOT NULL |  |  |  |

## __EFMigrationsHistory_ApplicantGradesAdmin

_3 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `MigrationId` | nvarchar(150) | NOT NULL | PK |  |  |
| `ProductVersion` | nvarchar(32) | NOT NULL |  |  |  |

## __EFMigrationsHistory_IdentityApplicant

_1 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `MigrationId` | nvarchar(150) | NOT NULL | PK |  |  |
| `ProductVersion` | nvarchar(32) | NOT NULL |  |  |  |

## __EFMigrationsHistory_LookupsAdmin

_1 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `MigrationId` | nvarchar(150) | NOT NULL | PK |  |  |
| `ProductVersion` | nvarchar(32) | NOT NULL |  |  |  |

## acquaintance_doc_settings

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `cycle_id` | nvarchar(96) | NOT NULL | FK |  | `admission_cycles.id` |
| `opening_test_key` | nvarchar(96) | NOT NULL |  |  |  |
| `opening_required_outcome` | nvarchar(32) | NOT NULL |  |  |  |
| `closing_test_key` | nvarchar(96) | NOT NULL |  |  |  |
| `closing_mode` | nvarchar(48) | NOT NULL |  |  |  |
| `closing_at` | datetimeoffset |  |  |  |  |
| `is_enabled` | bit | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## admin_records

_55 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(96) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## admission_cycles

_5 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `name_ar` | nvarchar(256) | NOT NULL |  |  |  |
| `year` | int | NOT NULL |  |  |  |
| `status` | nvarchar(48) | NOT NULL |  |  |  |
| `is_active` | bit | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## admission_rules

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `cycle_id` | nvarchar(96) | NOT NULL |  |  |  |
| `version` | int | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## admission_setup_records

_4 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## applicant_acquaintance_doc_revisions

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `acquaintance_doc_id` | nvarchar(96) | NOT NULL | FK |  | `applicant_acquaintance_docs.id` |
| `version` | int | NOT NULL |  |  |  |
| `change_kind` | nvarchar(32) | NOT NULL |  |  |  |
| `changed_section_keys_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |

## applicant_acquaintance_doc_sections

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `acquaintance_doc_id` | nvarchar(96) | NOT NULL | FK |  | `applicant_acquaintance_docs.id` |
| `section_key` | nvarchar(64) | NOT NULL |  |  |  |
| `data_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## applicant_acquaintance_docs

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `cycle_id` | nvarchar(96) | NOT NULL | FK |  | `admission_cycles.id` |
| `applicant_id` | nvarchar(128) | NOT NULL |  |  |  |
| `status` | nvarchar(32) | NOT NULL |  |  |  |
| `opened_at` | datetimeoffset |  |  |  |  |
| `closed_at` | datetimeoffset |  |  |  |  |
| `last_autosaved_at` | datetimeoffset |  |  |  |  |
| `version` | int | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## applicant_categories

_4 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `key` | nvarchar(96) | NOT NULL | PK |  |  |
| `label_ar` | nvarchar(256) | NOT NULL |  |  |  |
| `is_open` | bit | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## applicant_grade_adjustments

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | uniqueidentifier | NOT NULL | PK |  |  |
| `applicant_grade_id` | uniqueidentifier | NOT NULL | FK |  | `applicant_grades.id` |
| `reason` | nvarchar(64) | NOT NULL |  |  |  |
| `reason_label` | nvarchar(120) | NOT NULL |  |  |  |
| `note` | nvarchar(500) | NOT NULL |  |  |  |
| `amount` | decimal(7,2) | NOT NULL |  |  |  |
| `by` | nvarchar(120) | NOT NULL |  |  |  |
| `when_label` | nvarchar(64) | NOT NULL |  |  |  |
| `is_active` | bit | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## applicant_grades

_10,001 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | uniqueidentifier | NOT NULL | PK |  |  |
| `seat` | int | NOT NULL |  |  |  |
| `seating_number` | nvarchar(32) |  |  |  |  |
| `nid` | nvarchar(14) | NOT NULL |  |  |  |
| `name` | nvarchar(200) | NOT NULL |  |  |  |
| `kind` | nvarchar(16) | NOT NULL |  |  |  |
| `gender` | nvarchar(16) | NOT NULL |  |  |  |
| `branch` | nvarchar(200) | NOT NULL |  |  |  |
| `graduation_year` | int |  |  |  |  |
| `school_category_code` | nvarchar(32) |  |  |  |  |
| `school` | nvarchar(200) | NOT NULL |  |  |  |
| `region` | nvarchar(120) | NOT NULL |  |  |  |
| `exam_round` | nvarchar(64) |  |  |  |  |
| `total` | decimal(7,2) | NOT NULL |  |  |  |
| `import_max` | decimal(7,2) | NOT NULL |  |  |  |
| `override_max` | decimal(7,2) |  |  |  |  |
| `last_edited_at` | nvarchar(64) |  |  |  |  |
| `last_edited_by` | nvarchar(120) |  |  |  |  |
| `grade_changed_at` | datetimeoffset |  |  |  |  |
| `previous_grade` | decimal(7,2) |  |  |  |  |
| `status` | nvarchar(64) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `admin_record_id` | nvarchar(128) |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  | `(N'{}')` |  |

## applicant_management_records

_9 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## applicant_portal_records

_19 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `type` | nvarchar(64) | NOT NULL | PK |  |  |
| `record_id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## applicants

_47 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | uniqueidentifier | NOT NULL | PK |  |  |
| `national_id` | nvarchar(14) | NOT NULL |  |  |  |
| `phone_number` | nvarchar(11) | NOT NULL |  |  |  |
| `full_name` | nvarchar(200) |  |  |  |  |
| `email` | nvarchar(200) |  |  |  |  |
| `gender` | nvarchar(16) |  |  |  |  |
| `religion` | nvarchar(16) |  |  |  |  |
| `date_of_birth` | date |  |  |  |  |
| `birth_governorate` | nvarchar(120) |  |  |  |  |
| `birth_district` | nvarchar(120) |  |  |  |  |
| `source` | nvarchar(16) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## application_settings_category_configs

_6 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `category_id` | nvarchar(96) | NOT NULL |  |  |  |
| `is_active` | bit | NOT NULL |  |  |  |
| `sort_order` | int | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## application_settings_category_specializations

_6 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `config_id` | nvarchar(96) | NOT NULL |  |  |  |
| `specialization_id` | nvarchar(96) | NOT NULL |  |  |  |
| `is_active` | bit | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## application_settings_graduation_years

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `category_specialization_id` | nvarchar(96) | NOT NULL |  |  |  |
| `graduation_years_json` | nvarchar(max) | NOT NULL |  |  |  |
| `gender_types_json` | nvarchar(max) | NOT NULL |  |  |  |
| `marital_status_codes_json` | nvarchar(max) | NOT NULL |  |  |  |
| `age_min` | int |  |  |  |  |
| `max_age` | int |  |  |  |  |
| `division_codes_json` | nvarchar(max) | NOT NULL |  |  |  |
| `school_category_codes_json` | nvarchar(max) | NOT NULL |  |  |  |
| `application_start_date` | date | NOT NULL |  |  |  |
| `application_end_date` | date | NOT NULL |  |  |  |
| `age_reference_date` | date | NOT NULL |  |  |  |
| `is_active` | bit | NOT NULL |  |  |  |
| `grade_kind` | nvarchar(16) | NOT NULL |  |  |  |
| `min_percentage` | decimal(5,2) |  |  |  |  |
| `academic_grade_id` | nvarchar(96) |  |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## audit_entries

_365 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `module` | nvarchar(96) | NOT NULL |  |  |  |
| `action` | nvarchar(96) | NOT NULL |  |  |  |
| `entity` | nvarchar(128) | NOT NULL |  |  |  |
| `entity_id` | nvarchar(128) | NOT NULL |  |  |  |
| `actor_user_id` | nvarchar(128) | NOT NULL |  |  |  |
| `actor_name` | nvarchar(256) | NOT NULL |  |  |  |
| `details` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## biometric_records

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## committee_records

_78 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## exam_assignments

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `exam_id` | nvarchar(128) | NOT NULL | PK FK |  | `exams.id` |
| `assignment_kind` | nvarchar(64) | NOT NULL | PK |  |  |
| `assignment_order` | int | NOT NULL | PK |  |  |
| `value` | nvarchar(256) | NOT NULL |  |  |  |

## exam_operational_records

_4 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## exam_question_links

_70 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `exam_id` | nvarchar(128) | NOT NULL | PK FK |  | `exams.id` |
| `question_order` | int | NOT NULL | PK |  |  |
| `question_id` | nvarchar(128) | NOT NULL |  |  |  |

## exam_question_matching_pairs

_3 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `question_id` | nvarchar(128) | NOT NULL | PK FK |  | `exam_questions.id` |
| `pair_order` | int | NOT NULL | PK |  |  |
| `prompt` | nvarchar(max) | NOT NULL |  |  |  |
| `match_text` | nvarchar(max) | NOT NULL |  |  |  |

## exam_question_options

_205 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `question_id` | nvarchar(128) | NOT NULL | PK FK |  | `exam_questions.id` |
| `option_order` | int | NOT NULL | PK |  |  |
| `option_text` | nvarchar(max) | NOT NULL |  |  |  |

## exam_questions

_52 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `category` | nvarchar(128) | NOT NULL |  |  |  |
| `classification` | nvarchar(128) |  |  |  |  |
| `difficulty` | int | NOT NULL |  |  |  |
| `type` | nvarchar(48) | NOT NULL |  |  |  |
| `text` | nvarchar(max) | NOT NULL |  |  |  |
| `correct_index` | int | NOT NULL |  |  |  |
| `time_limit_seconds` | int | NOT NULL |  |  |  |
| `notes` | nvarchar(max) |  |  |  |  |
| `status` | nvarchar(48) | NOT NULL |  |  |  |
| `version` | int | NOT NULL |  |  |  |
| `image_url` | nvarchar(1024) |  |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## exam_rules

_4 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `exam_id` | nvarchar(128) | NOT NULL | PK FK |  | `exams.id` |
| `rule_order` | int | NOT NULL | PK |  |  |
| `category` | nvarchar(128) | NOT NULL |  |  |  |
| `difficulty_min` | int | NOT NULL |  |  |  |
| `difficulty_max` | int | NOT NULL |  |  |  |
| `question_count` | int | NOT NULL |  |  |  |
| `minutes` | int | NOT NULL |  |  |  |

## exam_slots

_5 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(64) | NOT NULL | PK |  |  |
| `date` | date | NOT NULL |  |  |  |
| `time` | nvarchar(16) | NOT NULL |  |  |  |
| `location` | nvarchar(512) | NOT NULL |  |  |  |
| `capacity` | int | NOT NULL |  |  |  |
| `reserved` | int | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## exams

_2 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `name_ar` | nvarchar(256) | NOT NULL |  |  |  |
| `cycle_id` | nvarchar(96) | NOT NULL |  |  |  |
| `cycle_name` | nvarchar(256) |  |  |  |  |
| `scheduled_for` | nvarchar(64) |  |  |  |  |
| `access_start_at` | nvarchar(64) |  |  |  |  |
| `access_end_at` | nvarchar(64) |  |  |  |  |
| `duration_minutes` | int |  |  |  |  |
| `question_count` | int |  |  |  |  |
| `random_selection` | bit |  |  |  |  |
| `random_question_order` | bit |  |  |  |  |
| `display_mode` | nvarchar(48) |  |  |  |  |
| `status` | nvarchar(48) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## faculties

_19 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `code` | nvarchar(16) | NOT NULL | PK |  |  |
| `name` | nvarchar(120) | NOT NULL |  |  |  |
| `is_active` | bit | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## general_settings

_1 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(64) | NOT NULL | PK |  |  |
| `exam_days_per_applicant` | int | NOT NULL |  |  |  |
| `exam_slot_selection_window_days` | int | NOT NULL |  |  |  |
| `primary_relatives_entry_responsible_test_code` | nvarchar(96) |  |  |  |  |
| `acquaintance_documents_entry_responsible_test_code` | nvarchar(96) |  |  |  |  |
| `acquaintance_documents_print_responsible_test_code` | nvarchar(96) |  |  |  |  |
| `acquaintance_documents_mutation_lock_timing` | nvarchar(48) |  |  |  |  |
| `primary_relatives_visibility_responsible_test_code` | nvarchar(96) |  |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `acquaintance_documents_open_timing` | nvarchar(48) |  |  |  |  |
| `acquaintance_documents_open_offset_value` | int |  |  |  |  |
| `acquaintance_documents_open_offset_unit` | nvarchar(16) |  |  |  |  |
| `acquaintance_documents_close_responsible_test_code` | nvarchar(96) |  |  |  |  |
| `acquaintance_documents_close_timing` | nvarchar(48) |  |  |  |  |
| `acquaintance_documents_close_offset_value` | int |  |  |  |  |
| `acquaintance_documents_close_offset_unit` | nvarchar(16) |  |  |  |  |

## grade_import_batches

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | uniqueidentifier | NOT NULL | PK |  |  |
| `source_format` | nvarchar(32) | NOT NULL |  |  |  |
| `status` | nvarchar(32) | NOT NULL |  |  |  |
| `graduation_year` | int |  |  |  |  |
| `selected_school_categories_json` | nvarchar(max) | NOT NULL |  |  |  |
| `max_grade_by_category_json` | nvarchar(max) | NOT NULL |  |  |  |
| `total_rows` | int | NOT NULL |  |  |  |
| `valid_rows` | int | NOT NULL |  |  |  |
| `invalid_rows` | int | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## grade_import_rows

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | uniqueidentifier | NOT NULL | PK |  |  |
| `grade_import_batch_id` | uniqueidentifier | NOT NULL | FK |  | `grade_import_batches.id` |
| `source_row_index` | int | NOT NULL |  |  |  |
| `national_id` | nvarchar(14) | NOT NULL |  |  |  |
| `is_valid` | bit | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `errors_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## grade_operational_records

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## lookup_rows

_431 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `lookup_key` | nvarchar(96) | NOT NULL | PK |  |  |
| `code` | nvarchar(96) | NOT NULL | PK |  |  |
| `name` | nvarchar(512) | NOT NULL |  |  |  |
| `is_active` | bit | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |
| `checksum` | nvarchar(64) |  |  |  |  |
| `last_modified_by` | nvarchar(128) |  |  |  |  |
| `source_system` | nvarchar(64) | NOT NULL |  | `(N'appenza-admin')` |  |

## notifications

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## officer_directory

_1 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `national_id` | nvarchar(32) | NOT NULL | PK |  |  |
| `full_arabic_name` | nvarchar(256) | NOT NULL |  |  |  |
| `officer_code` | nvarchar(64) | NOT NULL |  |  |  |
| `mobile_number` | nvarchar(32) | NOT NULL |  |  |  |
| `user_type` | nvarchar(64) | NOT NULL |  |  |  |

## payments

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## report_snapshots

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## roles

_8 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `key` | nvarchar(96) | NOT NULL |  |  |  |
| `label_ar` | nvarchar(256) | NOT NULL |  |  |  |
| `is_system` | bit | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## users

_1 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `id` | nvarchar(96) | NOT NULL | PK |  |  |
| `national_id` | nvarchar(32) | NOT NULL |  |  |  |
| `full_arabic_name` | nvarchar(256) | NOT NULL |  |  |  |
| `role` | nvarchar(96) | NOT NULL |  |  |  |
| `account_status` | nvarchar(48) | NOT NULL |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

## workflow_records

_0 rows · schema `dbo`_

| Column | Type | Null | Key | Default | References |
|---|---|---|---|---|---|
| `module` | nvarchar(128) | NOT NULL | PK |  |  |
| `id` | nvarchar(128) | NOT NULL | PK |  |  |
| `applicant_id` | nvarchar(128) |  |  |  |  |
| `national_id` | nvarchar(32) |  |  |  |  |
| `cycle_id` | nvarchar(96) |  |  |  |  |
| `committee_id` | nvarchar(128) |  |  |  |  |
| `category_key` | nvarchar(128) |  |  |  |  |
| `department` | nvarchar(128) |  |  |  |  |
| `status` | nvarchar(96) |  |  |  |  |
| `kind` | nvarchar(96) |  |  |  |  |
| `occurred_at` | datetimeoffset |  |  |  |  |
| `payload_json` | nvarchar(max) | NOT NULL |  |  |  |
| `created_at` | datetimeoffset | NOT NULL |  |  |  |
| `updated_at` | datetimeoffset | NOT NULL |  |  |  |
| `row_version` | timestamp | NOT NULL |  |  |  |

