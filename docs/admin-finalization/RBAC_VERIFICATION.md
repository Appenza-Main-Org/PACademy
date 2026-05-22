# Admin RBAC Verification

Generated: 2026-05-22T16:58:27.865Z

## Accounts Created In Memory

| Role | Account id | Apps | Permissions |
|---|---:|---|---|
| `super_admin` | `RBAC-01` | admin, applicant, committee, board, investigations, medical, barcode, biometric, exams, architecture | * |
| `committee_admin` | `RBAC-02` | admin, committee, barcode, biometric | admin:view, reports:view, applicants:view, applicants:edit, applicants:transition, cycles:view, categories:view, lookups:view, applicant-grades:view, committees-exam-config:view, committees-exam-config:edit, committees:manage, barcode:print, biometric:verify, workflows:read, workflows:write, admission-setup:read |
| `committee_user` | `RBAC-03` | committee, barcode, biometric | applicants:view, barcode:print, biometric:verify |
| `medical_admin` | `RBAC-04` | medical, barcode, biometric | medical:manage, results:enter, biometric:verify |
| `medical_doctor` | `RBAC-05` | medical | medical:examine, results:enter |
| `investigator` | `RBAC-06` | investigations | investigations:view, investigations:edit |
| `board_admin` | `RBAC-07` | board | board:manage |
| `exams_admin` | `RBAC-08` | exams | exams:manage, questions:manage, results:view |
| `biometric_user` | `RBAC-09` | biometric | biometric:verify |
| `records_clerk` | `RBAC-10` | medical, exams | results:enter |
| `applicant` | `RBAC-11` | applicant | applicant:view, applicant:apply |

## Admin Route Access

| Route | Required permission | Allowed roles | Denied roles |
|---|---|---|---|
| `/admin` | `reports:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/reports` | `reports:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/applicants` | `applicants:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/applicants/new` | `applicants:edit` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/applicants/:id` | `applicants:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/applicants/:id/edit` | `applicants:edit` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/users` | `users:view` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/users/new` | `users:create` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/users/roles` | `roles:manage` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/users/:id` | `users:view` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/users/:id/edit` | `users:edit` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/notifications` | `notifications:view` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/payments` | `payments:review` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/audit` | `audit:view` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/settings` | `settings:manage` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/lookups` | `lookups:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/lookups/:tab` | `lookups:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/lookups/applicant-categories/:id` | `lookups:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/categories` | `categories:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/categories/:key` | `categories:edit` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles` | `cycles:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/new` | `cycles:create` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/:id` | `cycles:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/:id/edit` | `cycles:edit` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/committees-exam-config` | `committees-exam-config:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/workflows` | `workflows:view` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/workflows/new` | `workflows:create` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/workflows/:id` | `workflows:edit` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/applicant-grades` | `applicant-grades:view` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/applicant-grades/import` | `applicant-grades:import` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/applicant-grades/changes` | `applicant-grades:edit` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/admission-rules` | `admission-rules:manage` | `super_admin` | `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup/wizard/:stepKey` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup/application-settings` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup/application-settings-review` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup/application-status` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup/fees` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup/exams` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |
| `/admin/cycles/admission-setup/electronic-declaration` | `admission-setup:read` | `super_admin`, `committee_admin` | `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant` |

## Cloud Matrix Mapping

| Module | Action | Canonical permission |
|---|---|---|
| `dashboard` | `view` | `reports:view` |
| `dashboard` | `export` | `reports:export` |
| `cycles` | `view` | `cycles:view` |
| `cycles` | `edit` | `cycles:edit` |
| `cycles` | `create` | `cycles:create` |
| `cycles` | `delete` | `cycles:delete` |
| `cycles` | `manage` | `cycles:edit` |
| `cycles` | `transition` | `cycles:transition` |
| `cycles` | `approve` | `cycles:transition` |
| `cycles` | `export` | `cycles:view` |
| `cycles` | `toggle` | `cycles:transition` |
| `categories` | `view` | `categories:view` |
| `categories` | `edit` | `categories:edit` |
| `categories` | `delete` | `categories:delete` |
| `categories` | `manage` | `categories:edit` |
| `categories` | `approve` | `categories:edit` |
| `categories` | `export` | `categories:view` |
| `categories` | `toggle` | `categories:edit` |
| `application_setup` | `view` | `admission-setup:read` |
| `application_setup` | `edit` | `admission-setup:write` |
| `application_setup` | `manage` | `admission-setup:write` |
| `application_setup` | `approve` | `admission-setup:write` |
| `application_setup` | `toggle` | `admission-setup:write` |
| `admission_rules` | `view` | `admission-rules:view` |
| `admission_rules` | `edit` | `admission-rules:manage` |
| `admission_rules` | `manage` | `admission-rules:manage` |
| `admission_rules` | `approve` | `admission-rules:manage` |
| `lookups` | `view` | `lookups:view` |
| `lookups` | `edit` | `lookups:edit` |
| `lookups` | `create` | `lookups:create` |
| `lookups` | `delete` | `lookups:delete` |
| `lookups` | `manage` | `lookups:edit` |
| `lookups` | `transition` | `lookups:transition` |
| `lookups` | `export` | `lookups:view` |
| `lookups` | `toggle` | `lookups:edit` |
| `lookup_mappings` | `view` | `lookup-mappings:view` |
| `lookup_mappings` | `edit` | `lookup-mappings:edit` |
| `lookup_mappings` | `manage` | `lookup-mappings:edit` |
| `lookup_mappings` | `approve` | `lookup-mappings:edit` |
| `lookup_mappings` | `export` | `lookup-mappings:view` |
| `applicant_grades` | `view` | `applicant-grades:view` |
| `applicant_grades` | `edit` | `applicant-grades:edit` |
| `applicant_grades` | `delete` | `applicant-grades:edit` |
| `applicant_grades` | `manage` | `applicant-grades:edit` |
| `applicant_grades` | `approve` | `applicant-grades:edit` |
| `applicant_grades` | `export` | `applicant-grades:view` |
| `applicant_grades` | `toggle` | `applicant-grades:edit` |
| `applicant_grades` | `import` | `applicant-grades:import` |
| `committees_exam_config` | `view` | `committees-exam-config:view` |
| `committees_exam_config` | `edit` | `committees-exam-config:edit` |
| `committees_exam_config` | `create` | `committees-exam-config:create` |
| `committees_exam_config` | `delete` | `committees-exam-config:delete` |
| `committees_exam_config` | `manage` | `committees-exam-config:edit` |
| `committees_exam_config` | `transition` | `committees-exam-config:transfer` |
| `committees_exam_config` | `approve` | `committees-exam-config:edit` |
| `committees_exam_config` | `export` | `committees-exam-config:view` |
| `committees_exam_config` | `toggle` | `committees-exam-config:edit` |
| `committees_exam_config` | `sync` | `committees-exam-config:transfer` |
| `workflows` | `view` | `workflows:view` |
| `workflows` | `edit` | `workflows:edit` |
| `workflows` | `create` | `workflows:create` |
| `workflows` | `delete` | `workflows:delete` |
| `workflows` | `manage` | `workflows:edit` |
| `workflows` | `transition` | `workflows:edit` |
| `workflows` | `approve` | `workflows:edit` |
| `workflows` | `export` | `workflows:view` |
| `workflows` | `toggle` | `workflows:edit` |
| `users_roles` | `view` | `users:view` |
| `users_roles` | `edit` | `users:edit` |
| `users_roles` | `create` | `users:create` |
| `users_roles` | `delete` | `users:delete` |
| `users_roles` | `manage` | `roles:manage` |
| `users_roles` | `transition` | `users:edit` |
| `users_roles` | `export` | `users:view` |
| `users_roles` | `toggle` | `users:edit` |
| `users_roles` | `import` | `users:create` |
| `audit` | `view` | `audit:view` |
| `audit` | `export` | `audit:export` |
| `settings` | `view` | `settings:view` |
| `settings` | `edit` | `settings:manage` |
| `settings` | `manage` | `settings:manage` |
| `settings` | `approve` | `settings:manage` |
| `settings` | `toggle` | `settings:manage` |
| `notifications` | `view` | `notifications:view` |
| `notifications` | `edit` | `notifications:edit` |
| `notifications` | `create` | `notifications:create` |
| `notifications` | `delete` | `notifications:delete` |
| `notifications` | `manage` | `notifications:edit` |
| `notifications` | `transition` | `notifications:publish` |
| `notifications` | `approve` | `notifications:publish` |
| `notifications` | `export` | `notifications:view` |
| `notifications` | `toggle` | `notifications:publish` |
| `applicants` | `view` | `applicants:view` |
| `applicants` | `edit` | `applicants:edit` |
| `applicants` | `delete` | `applicants:delete` |
| `applicants` | `manage` | `applicants:edit` |
| `applicants` | `transition` | `applicants:transition` |
| `applicants` | `export` | `applicants:view` |
| `applicants` | `toggle` | `applicants:edit` |
| `applicant_content` | `view` | `applicant:view` |
| `applicant_content` | `edit` | `applicant:content` |
| `applicant_content` | `create` | `applicant:content` |
| `applicant_content` | `delete` | `applicant:content` |
| `applicant_content` | `manage` | `applicant:content` |
| `applicant_content` | `transition` | `applicant:content` |
| `applicant_content` | `approve` | `applicant:content` |
| `applicant_content` | `export` | `applicant:view` |
| `applicant_content` | `toggle` | `applicant:content` |
| `applicant_documents` | `view` | `applicant:documents` |
| `applicant_documents` | `edit` | `applicant:documents` |
| `applicant_documents` | `delete` | `applicant:documents` |
| `applicant_documents` | `export` | `applicant:documents` |
| `applicant_payments` | `view` | `payments:review` |
| `applicant_payments` | `edit` | `payments:approve` |
| `applicant_payments` | `manage` | `payments:approve` |
| `applicant_payments` | `approve` | `payments:approve` |
| `applicant_payments` | `export` | `payments:review` |
| `applicant_payments` | `toggle` | `payments:approve` |
| `applicant_payments` | `sync` | `payments:sync` |

## Backend Seed Coverage

- Staff roles with seed accounts: `super_admin`, `committee_admin`, `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`
- `applicant` is intentionally not a staff/admin user account; applicant auth is handled by the applicant surface.
- Extra backend role rows outside the 11-role frontend tuple: `finance_review`

## Result

PASS

## Admin-App Denial Baseline

The following roles must be redirected away from `/admin/*`: `committee_user`, `medical_admin`, `medical_doctor`, `investigator`, `board_admin`, `exams_admin`, `biometric_user`, `records_clerk`, `applicant`.

