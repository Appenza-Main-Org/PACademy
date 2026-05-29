# BRD TestSprite Scope

Source BRD: [police_academy_detailed_brd_scope_md.md](/Users/mac/Projects/PACademy/PACademy/docs/police_academy_detailed_brd_scope_md.md)

This scope maps the BRD's admin and applicant requirements to the TestSprite frontend plan. Test execution should use Playwright against the local Vite app running with staging backend and database configuration.

## Test Environment

- Local app: `http://localhost:5173`
- Backend mode: staging API, mocks disabled for admin services
- Admin API base: `https://admin-staging-api.appenzademo.com`
- Test runner for browser verification: Playwright
- TestSprite plan file: [testsprite_frontend_test_plan.json](/Users/mac/Projects/PACademy/PACademy/testsprite_tests/testsprite_frontend_test_plan.json)

## Admin Test Data

| Field | Value |
| --- | --- |
| National ID | `28705260103619` |
| Mobile | `01119441198` |
| Role | Super Admin |

## Applicant Test Data

| Scenario | National ID | Mobile | Name |
| --- | --- | --- | --- |
| Eligible normal flow | `30412180103456` | `01012345678` | أحمد محمد إبراهيم سعد |
| Over age / ineligible | `28503150103456` | `01098765432` | خالد عبد الرحمن سامي مصطفى |
| Submitted / paid applicant | `30407010103456` | `01098765432` | يوسف عمر فاروق منصور |
| وثيقة تعارف fillable | `30501010103456` | `01098765432` | كريم محمود فؤاد العقّاد |
| وثيقة تعارف expired edit window | `30501010203456` | `01098765433` | كريم محمود فؤاد العقّاد |
| الضباط المتخصصون | `30502010103456` | `01098765434` | محمود فؤاد عبد الرحمن العقّاد |
| ليسانس حقوق | `30503010103456` | `01098765435` | يوسف عمر محمد فاروق |
| Manual entry / MOI not found | `30506200103456` | `01011112222` | Created during testing |

## BRD Coverage Map

| BRD area | Required coverage | TestSprite cases |
| --- | --- | --- |
| Site administrator authentication and system access | Super Admin can sign in, reach admin workspace, and stay authorized | TC001, TC002, TC003, TC010, TC027 |
| System administrators management | NID/mobile-based staff creation, role assignment, and permission matrix review | TC027 |
| Admission rules and application window management | Admin can open admission setup, review application settings, and persist cycle draft data | TC014, TC015, TC016, TC024, TC028 |
| Reference data management | Admin can browse, add, edit, activate, reorder, and protect referenced lookup rows | TC017, TC018, TC019, TC020, TC021, TC022, TC023, TC026, TC029 |
| Applicant inquiry screens | Admin can search/filter applicant records by BRD-relevant identity data and open progress details | TC005, TC009, TC011, TC012, TC013, TC025, TC030 |
| Reports and statistics | Admin can review KPI cards, funnel analytics, operational status, and export/report actions | TC006, TC007, TC031 |
| Data exchange and education results | Admin can open applicant grades import and change-management screens | TC032 |
| Payment monitoring | Admin can review electronic payment monitoring and transaction status | TC033 |
| Audit trail | Admin can review operational audit events and details | TC034 |
| Applicant first and second authentication | Applicant logs in with National ID and mobile and is routed by MOI verdict | TC035, TC036, TC037, TC038, TC039, TC040, TC041, TC042 |
| Applicant eligibility and category selection | Eligible, over-age, category-specific, and manual MOI-not-found branches are covered | TC035, TC036, TC040, TC041, TC042 |
| Applicant wizard stages and payment/post-submit routing | Submitted/paid applicant lands in post-submission portal context | TC037 |
| First exam appointment, admission card, follow-up | Paid/submitted applicant exposes post-submission tabs or actions | TC037 |
| Acquaintance document workflow | Fillable, expired edit window, specialized officers, and law bachelor variants are covered | TC038, TC039, TC040, TC041 |

## Playwright Checkpoints

- Admin: login at `/staff-login` with the Super Admin test data, then verify `/admin/reports`, `/admin/users`, `/admin/cycles/admission-setup/wizard/application_settings`, `/admin/lookups`, `/admin/applicant-grades`, `/admin/payments`, and `/admin/audit` load without auth denial.
- Applicant: run each supplied National ID/mobile pair through `/applicant-login` and verify the expected route:
  - Eligible normal flow -> `/applicant/start`
  - Over age -> `/applicant/ineligible`
  - Submitted / paid -> `/applicant`
  - وثيقة تعارف fillable -> `/applicant/acquaintance-doc`
  - وثيقة تعارف expired -> `/applicant/acquaintance-doc` with read-only/expired edit affordance
  - الضباط المتخصصون -> `/applicant/acquaintance-doc` with spouse/children sections available
  - ليسانس حقوق -> `/applicant/acquaintance-doc` with spouse/children sections available
  - Manual entry / MOI not found -> `/applicant/start`

