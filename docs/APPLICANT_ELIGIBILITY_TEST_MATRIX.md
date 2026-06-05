# Applicant Eligibility Test Matrix

Last checked against staging on 2026-06-06.

This document lists the applicant first-step NID/mobile samples and the configured eligibility conditions for the active cycle. Use it to verify category visibility from the applicant side and to compare it with the cycle/application-setting rules configured by admin.

## Active Cycle

| Field | Value |
|---|---|
| Cycle ID | `CYC-1780594636353` |
| Cycle name | `Test Rawaj 2026` |
| Cycle status | Active |
| Cycle application dates | `2026-01-01` to `2026-12-31` |

### Open Categories In The Cycle

| Category key | Arabic name | Cycle gender | Cycle category dates | Capacity |
|---|---|---|---|---:|
| `officers_general` | قسم الضباط (قسم عام) | Male | `2026-01-15` to `2026-03-31` | 2000 |
| `specialized_officers` | الضباط المتخصصون | Male + Female | `2026-02-01` to `2026-04-15` | 240 |
| `law_bachelor` | ليسانس حقوق | Male + Female | `2026-02-01` to `2026-04-15` | 120 |
| `physical_education_bachelor` | بكالوريوس تربية رياضية | Female only | `2026-02-01` to `2026-04-15` | 80 |

## Configured Eligibility Conditions

### قسم الضباط (قسم عام)

| Condition | Current value |
|---|---|
| Category key | `officers_general` |
| Required qualification | Thanaweya/pre-university |
| Category gender | Male |
| Graduation year | `2026` |
| Marital status | `MAR-01` |
| Age range | 17 to 22 |
| School categories | `SCH-05`, `SCH-06` |
| Application-setting dates | `2026-06-04` to `2026-06-06` |
| Age reference date | `2026-06-04` |
| Grade kind | `GRADES` |
| Minimum percentage | `0` |
| Expected applicant visibility | Male applicants only |

### بكالوريوس تربية رياضية

| Condition | Current value |
|---|---|
| Category key | `physical_education_bachelor` |
| Required qualification | Bachelor / physical education |
| Category gender | Female |
| Graduation year | `2026` |
| Marital status | `MAR-01`, `MAR-02` |
| Age range | 17 to 30 |
| Application-setting dates | `2026-06-04` to `2026-06-06` |
| Age reference date | `2026-06-04` |
| Grade kind | `TAGDIR` |
| Academic grade | `AGR-04` |
| Expected applicant visibility | Female applicants only |

### ليسانس حقوق

| Condition | Current value |
|---|---|
| Category key | `law_bachelor` |
| Required qualification | Bachelor of law |
| Category gender | Any |
| Cycle status | Open |
| Application settings year rows | Not configured in the current summary |
| Expected applicant visibility | Should stay unavailable until an active year rule exists |

### الضباط المتخصصون

| Condition | Current value |
|---|---|
| Category key | `specialized_officers` |
| Required qualification | Bachelor / selected faculty-specialization |
| Category gender | Any |
| Configured specializations | `acs-4` جراحة عامة, `acs-5` مسالك بولية, `acs-6` صدرية |
| Cycle status | Open |
| Application settings year rows | Not configured in the current summary |
| Current staging behavior | Male applicants aged 17 to 30 can still match the active cycle draft rule; `29202150167831` is rejected because age is 34 |

## How NID Is Linked With Mobile

There are two test paths:

| Path | Behavior |
|---|---|
| Seeded MOI record | NID must be entered with the exact mobile stored in the MOI mock. Wrong mobile should fail login/auth. |
| Derived/manual fallback | If MOI returns not found and the NID is syntactically valid, the applicant service derives DOB/gender/governorate from the NID and stores the mobile entered by the tester. Use these generated rows for edge cases when fallback is enabled. |

NID gender is derived from digit 13 of the national ID. Odd means male; even means female.

## Seeded First-Step Samples

Use these first because they are authoritative staging MOI records.

| Purpose | NID | Mobile | Gender | DOB | Expected first-step result | Expected category result |
|---|---:|---:|---|---|---|---|
| General officers full-cycle/resume | `30606060123451` | `01066000101` | Male | `2006-06-06` | Pass | Existing staging draft is already at `furthestStage: 8`, so login resumes at `كارت التردد` |
| PE positive | `30103150246828` | `01066000104` | Female | `2001-03-15` | Pass | `physical_education_bachelor` visible |
| Law seeded identity | `29809220145624` | `01066000103` | Female | `1998-09-22` | Pass | No Law category until active year rule is configured |
| Specialized seeded identity | `29202150167831` | `01066000102` | Male | `1992-02-15` | Pass | Auth succeeds, but no category is visible; specialized fails age check because max age is 30 and the applicant is 34 |
| Legacy general full-cycle/resume | `30412180103456` | `01012345678` | Male | `2004-12-18` | Pass | Existing staging draft is already at `furthestStage: 8`, so login resumes at `كارت التردد` |
| Legacy over-age negative | `28503150103456` | `01098765432` | Male | `1985-03-15` | Pass | Should fail age-limited categories |
| Legacy submitted demo | `30407010103456` | `01098765432` | Male | `2004-07-01` | Pass | Existing/submitted-flow demo |
| Legacy paid/resume | `30501010103456` | `01098765432` | Male | `2005-01-01` | Pass | Existing staging draft is at `furthestStage: 6`, so login resumes after payment |
| Fresh seeded general | `30501010203456` | `01098765433` | Male | `2005-01-01` | Pass | Current staging draft has `furthestStage: 0`; use this for a fresh general first-step test |
| Legacy specialized identity | `30502010103456` | `01098765434` | Male | `1990-02-15` | Pass | Specialized identity sample if settings are configured |
| Legacy law identity | `30503010103456` | `01098765435` | Male | `1988-09-22` | Pass | Law identity sample if settings are configured |
| MOI not-found/manual path | `30506210123451` | `01077000014` | Male from NID | `2005-06-21` | Pass through derived/manual fallback | Use to test unknown-MOI fallback; mobile is stored on first successful login |

## Generated Edge-Case Samples

These are syntactically valid NIDs for fallback/manual testing. Use any valid mobile format shown below. If the environment disables fallback and requires seeded MOI only, these will not pass first-step login.

| Case | NID | Mobile | Derived gender | DOB | Expected category behavior |
|---|---:|---:|---|---|---|
| General male in age | `30501010203456` | `01098765433` | Male | `2005-01-01` | `officers_general` visible from a fresh seeded draft |
| General female same age | `30606060123460` | `01077000001` | Female | `2006-06-06` | `officers_general` hidden by gender |
| General male under age | `31006060123451` | `01077000002` | Male | `2010-06-06` | `officers_general` hidden by age |
| General male over age | `30201010123451` | `01077000003` | Male | `2002-01-01` | `officers_general` hidden by age |
| PE female in age | `30103150246828` | `01066000104` | Female | `2001-03-15` | `physical_education_bachelor` visible |
| PE male same age | `30103150246817` | `01077000004` | Male | `2001-03-15` | `physical_education_bachelor` hidden by gender |
| PE female under age | `31001010123460` | `01077000005` | Female | `2010-01-01` | `physical_education_bachelor` hidden by age |
| PE female over age | `29401010123460` | `01077000006` | Female | `1994-01-01` | `physical_education_bachelor` hidden by age |
| Law female identity | `30102010123460` | `01077000007` | Female | `2001-02-01` | First step can pass through fallback; Law hidden until year rule is configured |
| Law male identity | `30102010123451` | `01077000008` | Male | `2001-02-01` | First step can pass through fallback; Law hidden until year rule is configured |
| Specialized female identity | `30104010123460` | `01077000009` | Female | `2001-04-01` | First step can pass through fallback; Specialized hidden by current male-only effective rule |
| Specialized male identity | `30104010123451` | `01077000010` | Male | `2001-04-01` | First step can pass through fallback; `specialized_officers` visible on current staging |
| Invalid NID format | `123` | `01077000011` | N/A | N/A | First step should reject format |
| Invalid future DOB | `33001010123451` | `01077000012` | Male | `2030-01-01` | Frontend field validation should reject future DOB; direct API auth currently accepts it, while admin eligibility rejects it |
| Invalid mobile format | `30606060123451` | `011` | Male | `2006-06-06` | First step should reject mobile |
| Seeded MOI wrong mobile | `30103150246828` | `01077000013` | Female | `2001-03-15` | First step should reject credentials because seeded mobile differs |

## Regression Assertions For The PE Bug

Use these after deploying the backend fix.

| Assertion | NID | Mobile | Expected |
|---|---:|---:|---|
| Female PE applicant | `30103150246828` | `01066000104` | PE is eligible/visible |
| Male general applicant | `30606060123451` | `01066000101` | PE is not eligible/not visible |
| Generated PE male | `30103150246817` | `01077000004` | PE is not eligible/not visible |
| Generated PE female | `30103150246828` | `01066000104` | PE is eligible/visible |

The backend eligibility rule must intersect rule gender with the category lookup gender. If the rule says male+female but the category says female-only, the effective allowed gender must be female-only.

## API Checks

Admin-side eligibility:

```bash
curl -sS "https://admin-staging-api.appenzademo.com/api/applicants/30103150246828/eligible-categories?cycleId=CYC-1780594636353"
curl -sS "https://admin-staging-api.appenzademo.com/api/applicants/30606060123451/eligible-categories?cycleId=CYC-1780594636353"
```

Applicant MOI identity check:

```bash
curl -sS "https://applicant-staging-api.appenzademo.com/applicant/moi/verify/30103150246828"
curl -sS "https://applicant-staging-api.appenzademo.com/applicant/moi/verify/30606060123451"
```
