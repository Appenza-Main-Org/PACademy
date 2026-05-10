using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PACademy.Domain.AdmissionRules;
using PACademy.Domain.Applicants;
using PACademy.Domain.Audit;
using PACademy.Domain.Categories;
using PACademy.Domain.Cycles;
using PACademy.Domain.Lookups;
using PACademy.Domain.Workflows;
using PACademy.Infrastructure.Identity;
using PACademy.Infrastructure.Persistence;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace PACademy.Infrastructure.Seeding;

/// <summary>
/// Deterministic demo data seeder — C# port of the frontend LCG (seed=42).
/// All rows carry DemoOrigin=true (FR-017 permanent provenance).
/// </summary>
public sealed class DemoDataSeeder(
    PaDbContext db,
    UserManager<SystemUser> userManager,
    IConfiguration configuration,
    ILogger<DemoDataSeeder> logger)
{
    // LCG state — matches frontend seed.ts exactly
    private int _seed = 42;

    private double Rng()
    {
        _seed = unchecked((_seed * 1103515245 + 12345) & 0x7fffffff);
        return _seed / (double)0x7fffffff;
    }

    private T Pick<T>(T[] arr) => arr[(int)(Rng() * arr.Length)];

    private static readonly string[] ArabicFirstNames =
    [
        "محمد", "أحمد", "علي", "عمر", "إبراهيم", "خالد", "مصطفى", "حسن", "يوسف", "عبدالله",
        "فاطمة", "مريم", "نور", "سارة", "هنا", "رنا", "دينا", "أمل", "نادية", "منى",
    ];

    private static readonly string[] ArabicLastNames =
    [
        "الشرقاوي", "السيد", "إبراهيم", "محمود", "عبدالرحمن", "الجوهري", "البيلي", "الحسيني",
        "سليمان", "مصطفى", "الزيات", "علي", "حمدي", "صالح", "قاسم", "خليل", "حسن", "عثمان",
    ];

    private static readonly string[] Governorates =
    [
        "القاهرة", "الإسكندرية", "الجيزة", "الدقهلية", "الشرقية",
        "الغربية", "المنوفية", "البحيرة", "القليوبية", "كفر الشيخ",
        "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "المنيا",
        "أسيوط", "سوهاج", "قنا", "أسوان", "الأقصر",
        "الفيوم", "بني سويف", "مرسى مطروح", "البحر الأحمر",
        "شمال سيناء", "جنوب سيناء", "الوادي الجديد",
    ];

    private static readonly Dictionary<string, string> GovNidCodes = new()
    {
        ["القاهرة"] = "01",
        ["الإسكندرية"] = "02",
        ["بورسعيد"] = "03",
        ["السويس"] = "04",
        ["دمياط"] = "11",
        ["الدقهلية"] = "12",
        ["الشرقية"] = "13",
        ["القليوبية"] = "14",
        ["كفر الشيخ"] = "15",
        ["الغربية"] = "16",
        ["المنوفية"] = "17",
        ["البحيرة"] = "18",
        ["الإسماعيلية"] = "19",
        ["الجيزة"] = "21",
        ["بني سويف"] = "22",
        ["الفيوم"] = "23",
        ["المنيا"] = "24",
        ["أسيوط"] = "25",
        ["سوهاج"] = "26",
        ["قنا"] = "27",
        ["أسوان"] = "28",
        ["الأقصر"] = "29",
        ["البحر الأحمر"] = "31",
        ["الوادي الجديد"] = "32",
        ["مرسى مطروح"] = "33",
        ["شمال سيناء"] = "34",
        ["جنوب سيناء"] = "35",
    };

    private static readonly (string Role, string FullName, string Unit)[] RoleUsers =
    [
        ("super_admin", "الإدارة العليا للنظام", "قيادة الأكاديمية"),
        ("committee_admin", "رئيس لجنة القبول", "لجنة القبول"),
        ("committee_user", "موظف لجنة القبول", "لجنة القبول"),
        ("medical_admin", "رئيس القومسيون الطبي", "القومسيون الطبي"),
        ("medical_doctor", "طبيب عيادة القلب", "القومسيون الطبي"),
        ("investigator", "ضابط التحقيقات", "إدارة التحقيقات"),
        ("board_admin", "أمين سر الهيئة", "هيئة التأديب"),
        ("exams_admin", "مدير الاختبارات", "إدارة الاختبارات"),
        ("biometric_user", "مشغل بوابة الأمن", "بوابة الدخول"),
        ("records_clerk", "مدخل النتائج", "إدارة السجلات"),
        ("applicant", "متقدم نموذجي", "—"),
    ];

    private string GenerateNationalId(int index)
    {
        // Century 3 = 2000s, born 2005-2008 (applicant age 17-21 for 2026 cycle)
        var year = 2005 + (index % 4);
        var month = 1 + (index % 12);
        var day = 1 + (index % 28);
        var govCode = GovNidCodes[Governorates[index % Governorates.Length]];
        var serial = (100 + (index * 7) % 900).ToString().PadLeft(3, '0');
        var genderDigit = (index % 2 == 0) ? "2" : "1"; // even=female, odd=male (13th digit)
        var yr = (year % 100).ToString().PadLeft(2, '0');
        var mo = month.ToString().PadLeft(2, '0');
        var dy = day.ToString().PadLeft(2, '0');
        return $"3{yr}{mo}{dy}{govCode}{serial}{genderDigit}0";
    }

    private string GenerateSystemUserNationalId(int index)
    {
        // Staff users born 1970-1980
        var year = 1970 + (index % 11);
        var month = 1 + (index % 12);
        var day = 1 + (index % 28);
        var govCode = GovNidCodes[Governorates[index % 5]]; // Use first 5 governorates for staff
        var serial = (500 + index * 13).ToString().PadLeft(3, '0');
        var genderDigit = "1"; // all staff male for determinism
        var yr = (year % 100).ToString().PadLeft(2, '0');
        var mo = month.ToString().PadLeft(2, '0');
        var dy = day.ToString().PadLeft(2, '0');
        return $"2{yr}{mo}{dy}{govCode}{serial}{genderDigit}0";
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        // Idempotent top-up for the Gap I lookup catalogue runs every time so
        // existing dev databases pick up newly-defined categories without a wipe.
        await TopUpLookupsAsync(ct);

        if (await db.Applicants.AnyAsync(a => a.DemoOrigin, ct))
        {
            logger.LogInformation("Demo data already seeded — skipping main seed.");
            return;
        }

        logger.LogInformation("Seeding demo data (seed=42)…");
        _seed = 42; // Reset LCG

        var systemUserId = await SeedSystemUsersAsync(ct);
        var activeCycleId = await SeedCyclesAsync(systemUserId, ct);
        await SeedCategoriesAsync(systemUserId, ct);
        await SeedWorkflowsAsync(systemUserId, ct);
        await SeedAdmissionRulesAsync(systemUserId, ct);
        await SeedReferenceDataAsync(ct);
        await SeedApplicantsAsync(activeCycleId, systemUserId, ct);
        await SeedAuditEntriesAsync(systemUserId, ct);

        logger.LogInformation("Demo data seeded successfully.");
    }

    private async Task<Guid> SeedSystemUsersAsync(CancellationToken ct)
    {
        var passwords = configuration.GetSection("DemoPasswords");
        Guid superAdminId = Guid.Empty;

        for (var i = 0; i < RoleUsers.Length; i++)
        {
            var (role, fullName, unit) = RoleUsers[i];
            var nid = GenerateSystemUserNationalId(i);
            var password = passwords[role] ?? "Demo@12345!";
            var officerCode = $"OC{(i + 1) * 1000:D5}";
            var email = $"{role.Replace('_', '.')}@pac.demo";
            var mobile = $"010{(10000000 + i * 1111111):D8}";
            var cardFactory = $"CF{(i + 1) * 100:D6}";

            var existing = await userManager.FindByNameAsync(nid);
            if (existing is not null)
            {
                if (role == "super_admin") superAdminId = existing.Id;
                continue;
            }

            var user = new SystemUser
            {
                Id = Guid.NewGuid(),
                NationalId = nid,
                OfficerCode = officerCode,
                FullName = fullName,
                Mobile = mobile,
                Email = email,
                IssueDate = new DateTime(2020, 1, 1 + i),
                CardFactoryNumber = cardFactory,
                Role = role,
                Unit = unit,
                IsActive = true,
                DemoOrigin = true,
                CreatedAt = DateTime.UtcNow,
            };

            var result = await userManager.CreateAsync(user, password);
            if (!result.Succeeded)
            {
                var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                logger.LogWarning("Failed to create demo user {Role}: {Errors}", role, errors);
            }
            else if (role == "super_admin")
            {
                superAdminId = user.Id;
            }
        }

        return superAdminId;
    }

    private async Task<Guid> SeedCyclesAsync(Guid createdBy, CancellationToken ct)
    {
        var cycleSpecs = new[]
        {
            ("دورة القبول الذكور 2024", 2024, "male",  new DateTime(2024, 3, 1),  new DateTime(2024, 8, 31),  CycleStatus.Closed),
            ("دورة القبول الإناث 2024", 2024, "female", new DateTime(2024, 3, 1),  new DateTime(2024, 8, 31),  CycleStatus.Closed),
            ("دورة القبول الذكور 2025", 2025, "male",  new DateTime(2025, 3, 1),  new DateTime(2025, 8, 31),  CycleStatus.Closed),
            ("دورة القبول الذكور 2026", 2026, "male",  new DateTime(2026, 3, 1),  new DateTime(2026, 9, 30),  CycleStatus.Active),
        };

        Guid activeCycleId = Guid.Empty;
        foreach (var (nameAr, year, cohort, openDate, closeDate, status) in cycleSpecs)
        {
            var cycle = Cycle.Create(
                nameAr, year, cohort,
                expectedCapacity: 500,
                openDate: openDate,
                closeDate: closeDate,
                createdBy: createdBy,
                status: status,
                demoOrigin: true);

            if (status == CycleStatus.Active)
                activeCycleId = cycle.Id;

            db.Cycles.Add(cycle);
        }

        await db.SaveChangesAsync(ct);
        return activeCycleId;
    }

    private async Task SeedCategoriesAsync(Guid createdBy, CancellationToken ct)
    {
        // 7 RFP spec categories — keys are immutable (FR-K01).
        // Conditions/RequiredTests/Procedures mirror frontend mock-data/categories.ts.
        var seeds = new[]
        {
            new CategorySeed(
                "officers_general",
                "قسم الضباط (القسم العام)",
                "General Officers Department",
                "الالتحاق بكلية الشرطة عبر القسم العام لخريجي الثانوية العامة",
                BaseConditions(c => {
                    c["requiredQualification"] = "thanaweya_amma";
                    c["gender"] = "male";
                    c["minHeightCm"] = 170;
                    c["medicalRequired"] = true;
                    c["maritalStatus"] = "single";
                    c["conductCheck"] = true;
                    c["egyptianNationalityRequired"] = true;
                    c["freeText"] = new[] { "مجموع مناسب في الثانوية العامة" };
                }),
                RequiredTests(("aptitude", ""), ("posture", ""), ("medical", ""), ("physical", ""), ("psychological", ""), ("interview", ""), ("drug", "")),
                Array.Empty<string>()),
            new CategorySeed(
                "officers_specialized",
                "قسم الضباط المتخصصين",
                "Specialized Officers Department",
                "الالتحاق لخريجي الجامعات في تخصصات حقوق وطب وهندسة وإعلام وغيرها",
                BaseConditions(c => {
                    c["requiredQualification"] = "bachelor";
                    c["ageMax"] = 28;
                    c["medicalRequired"] = true;
                    c["conductCheck"] = true;
                    c["freeText"] = new[]
                    {
                        "مؤهل عالي (حقوق / طب / هندسة / إعلام…)",
                        "تقدير مناسب (جيد على الأقل)",
                        "حسن السمعة",
                    };
                }),
                RequiredTests(("posture", ""), ("medical", ""), ("physical", ""), ("psychological", ""), ("interview", ""), ("drug", "")),
                Array.Empty<string>()),
            new CategorySeed(
                "postgraduate",
                "الدراسات العليا",
                "Postgraduate Studies",
                "برامج الدراسات العليا لخريجي كلية الشرطة والجهات المرتبطة",
                BaseConditions(c => {
                    c["requiredQualification"] = "police_academy_grad";
                    c["employerApprovalRequired"] = true;
                    c["freeText"] = new[]
                    {
                        "خريج كلية الشرطة أو جهة مرتبطة",
                        "موافقة جهة العمل",
                        "تقدير مناسب",
                    };
                }),
                Array.Empty<RequiredTestSeed>(),
                new[] { "تقديم الأوراق", "مقابلة شخصية (أحياناً)", "مراجعة أمنية" }),
            new CategorySeed(
                "institute_officers_training",
                "معهد تدريب الضباط",
                "Officers Training Institute",
                "برامج تدريبية متخصصة لضباط الشرطة (بالترشيح)",
                BaseConditions(c => {
                    c["requiredQualification"] = "serving_officer";
                    c["nominationOnly"] = true;
                    c["freeText"] = new[] { "أن يكون ضابط شرطة" };
                }),
                Array.Empty<RequiredTestSeed>(),
                new[] { "ترشيح", "برامج تدريبية" }),
            new CategorySeed(
                "institute_traffic",
                "معهد المرور",
                "Traffic Institute",
                "دورات تخصصية في إدارة المرور (بالترشيح)",
                BaseConditions(c => {
                    c["requiredQualification"] = "serving_officer";
                    c["nominationOnly"] = true;
                    c["freeText"] = new[] { "ضباط شرطة" };
                }),
                Array.Empty<RequiredTestSeed>(),
                new[] { "ترشيح", "دورات تخصصية" }),
            new CategorySeed(
                "institute_guarding",
                "معهد الحراسات والتأمين",
                "Guarding & Security Institute",
                "تأهيل ضباط الشرطة في الحراسات والتأمين (بالترشيح)",
                BaseConditions(c => {
                    c["requiredQualification"] = "serving_officer";
                    c["nominationOnly"] = true;
                    c["freeText"] = new[] { "ضباط شرطة" };
                }),
                RequiredTests(("aptitude", "اختبارات لياقة"), ("security_training", "تدريب على التأمين")),
                Array.Empty<string>()),
            new CategorySeed(
                "special_units",
                "الوحدات الخاصة",
                "Special Units",
                "تأهيل ضباط الوحدات الخاصة بمستوى بدني وذهني عالي (بالترشيح)",
                BaseConditions(c => {
                    c["requiredQualification"] = "serving_officer";
                    c["nominationOnly"] = true;
                    c["freeText"] = new[] { "ضباط بمستوى بدني عالي" };
                }),
                RequiredTests(("physical", "اختبارات بدنية قوية"), ("psychological", "تحمل نفسي"), ("tactical_training", "تدريب تكتيكي")),
                Array.Empty<string>()),
        };

        var sortOrder = 1;
        foreach (var seed in seeds)
        {
            db.Categories.Add(Category.Create(
                seed.Key, seed.NameAr, createdBy,
                nameEn: seed.NameEn,
                description: seed.Description,
                conditionsJson: SerializeJson(seed.Conditions),
                requiredTestsJson: SerializeJson(seed.RequiredTests),
                proceduresJson: SerializeJson(seed.Procedures),
                sortOrder: sortOrder++,
                isSpec: true,
                demoOrigin: true));
        }

        await db.SaveChangesAsync(ct);
    }

    private sealed record CategorySeed(
        string Key,
        string NameAr,
        string NameEn,
        string Description,
        Dictionary<string, object> Conditions,
        RequiredTestSeed[] RequiredTests,
        string[] Procedures);

    private sealed record RequiredTestSeed(string kind, int order, string passingCriteria);

    private static Dictionary<string, object> BaseConditions(Action<Dictionary<string, object>> overrides)
    {
        var c = new Dictionary<string, object>
        {
            ["ageMin"] = (object?)null!,
            ["ageMax"] = (object?)null!,
            ["minScorePercent"] = (object?)null!,
            ["requiredQualification"] = "any",
            ["gender"] = "any",
            ["minHeightCm"] = (object?)null!,
            ["medicalRequired"] = false,
            ["maritalStatus"] = "any",
            ["conductCheck"] = false,
            ["egyptianNationalityRequired"] = false,
            ["employerApprovalRequired"] = false,
            ["nominationOnly"] = false,
            ["freeText"] = Array.Empty<string>(),
        };
        overrides(c);
        return c;
    }

    private static RequiredTestSeed[] RequiredTests(params (string Kind, string PassingCriteria)[] items)
        => items.Select((it, i) => new RequiredTestSeed(it.Kind, i + 1, it.PassingCriteria)).ToArray();

    private static readonly JsonSerializerOptions JsonOptsForSeed = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static string SerializeJson<T>(T value) => JsonSerializer.Serialize(value, JsonOptsForSeed);

    private async Task SeedWorkflowsAsync(Guid createdBy, CancellationToken ct)
    {
        string[] workflowNames =
        [
            "سير قبول الشرطة المدنية",
            "سير قبول الضباط",
            "سير القبول الطبي",
            "سير قبول الأمن",
            "سير قبول التحقيقات",
            "سير قبول الدعم الإداري",
        ];

        foreach (var name in workflowNames)
        {
            db.Workflows.Add(Workflow.Create(name, createdBy, demoOrigin: true));
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task SeedAdmissionRulesAsync(Guid createdBy, CancellationToken ct)
    {
        db.AdmissionRules.Add(AdmissionRule.Create("قواعد القبول العامة 2026", createdBy, demoOrigin: true));
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedReferenceDataAsync(CancellationToken ct)
    {
        // Sprint 1 — 8 dedicated typed lookup tables. Idempotent per-table:
        // skip if any row already exists.

        if (!await db.Governorates.AnyAsync(ct))
        {
            var sortOrder = 1;
            var govIdByCode = new Dictionary<string, Guid>();
            foreach (var (gov, code, region, nameEn) in GovernorateSeeds)
            {
                var entity = Governorate.Create(code, gov, nameEn, ParseEnum<GovernorateRegion>(region),
                    sortOrder: sortOrder++, demoOrigin: true);
                db.Governorates.Add(entity);
                govIdByCode[code] = entity.Id;
            }
            await db.SaveChangesAsync(ct);

            // Colleges depend on governorates; insert after parent IDs are stable.
            sortOrder = 1;
            foreach (var (key, nameAr, governorateCode, type) in CollegeSeeds)
            {
                if (!govIdByCode.TryGetValue(governorateCode, out var govId)) continue;
                db.Colleges.Add(College.Create(key, nameAr, govId, ParseEnum<CollegeType>(type),
                    sortOrder: sortOrder++, demoOrigin: true));
            }
        }

        if (!await db.Specializations.AnyAsync(ct))
        {
            var sortOrder = 1;
            foreach (var (key, nameAr, code, facultyType) in SpecializationSeeds)
                db.Specializations.Add(Specialization.Create(key, nameAr, code,
                    ParseEnum<FacultyType>(facultyType), sortOrder: sortOrder++, demoOrigin: true));
        }

        if (!await db.Ranks.AnyAsync(ct))
        {
            var sortOrder = 1;
            foreach (var (key, nameAr, level, applicableTo) in RankSeeds)
                db.Ranks.Add(Rank.Create(key, nameAr, level, ParseEnum<ApplicableTo>(applicableTo),
                    sortOrder: sortOrder++, demoOrigin: true));
        }

        if (!await db.Qualifications.AnyAsync(ct))
        {
            var sortOrder = 1;
            foreach (var (key, nameAr, level, facultyRequired) in QualificationSeeds)
                db.Qualifications.Add(Qualification.Create(key, nameAr,
                    ParseEnum<QualificationLevel>(level), facultyRequired,
                    sortOrder: sortOrder++, demoOrigin: true));
        }

        if (!await db.Nationalities.AnyAsync(ct))
        {
            var sortOrder = 1;
            foreach (var (iso, nameAr, nameEn) in NationalitySeeds)
                db.Nationalities.Add(Nationality.Create(iso.ToLowerInvariant(), nameAr, nameEn, iso,
                    sortOrder: sortOrder++, demoOrigin: true));
        }

        if (!await db.Relationships.AnyAsync(ct))
        {
            var sortOrder = 1;
            foreach (var (key, nameAr, degree, side) in RelationshipSeeds)
                db.Relationships.Add(Relationship.Create(key, nameAr, degree,
                    ParseEnum<RelationshipSide>(side), sortOrder: sortOrder++, demoOrigin: true));
        }

        if (!await db.CaseTypes.AnyAsync(ct))
        {
            var sortOrder = 1;
            foreach (var (key, nameAr, severity, blocksApplication) in CaseTypeSeeds)
                db.CaseTypes.Add(CaseType.Create(key, nameAr, ParseEnum<CaseSeverity>(severity),
                    blocksApplication, sortOrder: sortOrder++, demoOrigin: true));
        }

        await db.SaveChangesAsync(ct);
    }

    private static T ParseEnum<T>(string value) where T : struct, Enum
        => Enum.TryParse<T>(value, ignoreCase: true, out var result) ? result
            : throw new InvalidOperationException($"Cannot parse '{value}' as {typeof(T).Name}.");

    // ── Reference-data seed lists (mirror frontend mock-data/referenceData.ts) ──

    private static readonly (string Gov, string Code, string Region, string NameEn)[] GovernorateSeeds =
    [
        ("القاهرة",          "01", "cairo",    "Cairo"),
        ("الجيزة",           "21", "cairo",    "Giza"),
        ("الإسكندرية",       "02", "delta",    "Alexandria"),
        ("الدقهلية",          "12", "delta",    "Dakahlia"),
        ("الشرقية",          "13", "delta",    "Sharqia"),
        ("المنوفية",         "17", "delta",    "Monufia"),
        ("القليوبية",         "14", "cairo",    "Qaliubiya"),
        ("بني سويف",         "22", "upper",    "Beni Suef"),
        ("الفيوم",            "23", "upper",    "Fayoum"),
        ("المنيا",            "24", "upper",    "Minya"),
        ("أسيوط",            "25", "upper",    "Asyut"),
        ("سوهاج",            "26", "upper",    "Sohag"),
        ("قنا",               "27", "upper",    "Qena"),
        ("أسوان",             "28", "upper",    "Aswan"),
        ("البحر الأحمر",     "31", "frontier", "Red Sea"),
        ("الوادي الجديد",    "32", "frontier", "New Valley"),
        ("مرسى مطروح",       "33", "frontier", "Matrouh"),
        ("شمال سيناء",       "34", "frontier", "North Sinai"),
        ("جنوب سيناء",       "35", "frontier", "South Sinai"),
        ("بورسعيد",          "03", "canal",    "Port Said"),
        ("دمياط",             "11", "delta",    "Damietta"),
        ("كفر الشيخ",         "15", "delta",    "Kafr El Sheikh"),
        ("الغربية",          "16", "delta",    "Gharbia"),
        ("الإسماعيلية",      "19", "canal",    "Ismailia"),
        ("السويس",           "04", "canal",    "Suez"),
        ("الأقصر",            "29", "upper",    "Luxor"),
        ("البحيرة",           "18", "delta",    "Beheira"),
    ];

    private static readonly (string Key, string NameAr, string Code, string FacultyType)[] SpecializationSeeds =
    [
        ("pol-sci",   "علوم شرطة",          "POL-SCI",  "military"),
        ("pub-sec",   "الأمن العام",         "PUB-SEC",  "military"),
        ("cen-sec",   "الأمن المركزي",      "CEN-SEC",  "military"),
        ("cyb-sec",   "الأمن الإلكتروني",    "CYB-SEC",  "sciences"),
        ("narc",      "مكافحة المخدرات",     "NARC",     "military"),
        ("morals",    "حماية الآداب",        "MORALS",   "military"),
        ("traffic",   "المرور",             "TRAFFIC",  "military"),
        ("passport",  "الجوازات والهجرة",    "PASSPORT", "civil"),
        ("civil",     "الأحوال المدنية",     "CIVIL",    "civil"),
        ("admin",     "الإدارة العامة",      "ADMIN",    "civil"),
        ("law",       "القانون",            "LAW",      "sciences"),
        ("crim-psy",  "علم النفس الجنائي",   "CRIM-PSY", "sciences"),
    ];

    private static readonly (string Key, string NameAr, int Level, string ApplicableTo)[] RankSeeds =
    [
        ("musaaid",      "مساعد",          1, "enlisted"),
        ("mulazim",      "ملازم",           2, "officer"),
        ("mulazim-awal", "ملازم أول",       3, "officer"),
        ("naqib",        "نقيب",           4, "officer"),
        ("raid",         "رائد",           5, "officer"),
        ("muqaddam",     "مقدم",            6, "officer"),
        ("aqid",         "عقيد",           7, "officer"),
        ("amid",         "عميد",           8, "officer"),
        ("liwa",         "لواء",           9, "officer"),
        ("madani",       "مدني",           0, "civilian"),
    ];

    private static readonly (string Key, string NameAr, string GovernorateId, string Type)[] CollegeSeeds =
    [
        ("police-academy",    "كلية الشرطة",                     "21", "public"),
        ("cairo-univ",        "جامعة القاهرة",                   "01", "public"),
        ("alexandria-univ",   "جامعة الإسكندرية",                "02", "public"),
        ("ain-shams-univ",    "جامعة عين شمس",                  "01", "public"),
        ("azhar-univ",        "جامعة الأزهر",                    "01", "azhar"),
        ("mansoura-univ",     "جامعة المنصورة",                  "12", "public"),
        ("zagazig-univ",      "جامعة الزقازيق",                  "13", "public"),
        ("minya-univ",        "جامعة المنيا",                    "24", "public"),
        ("assiut-univ",       "جامعة أسيوط",                     "25", "public"),
        ("auc",               "الجامعة الأمريكية بالقاهرة",      "01", "private"),
    ];

    private static readonly (string Key, string NameAr, string Level, bool FacultyRequired)[] QualificationSeeds =
    [
        ("thanaweya-amma-sci",  "ثانوية عامة (علمي)", "diploma",  false),
        ("thanaweya-amma-arts", "ثانوية عامة (أدبي)",  "diploma",  false),
        ("thanaweya-azhar",     "ثانوية أزهرية",       "diploma",  false),
        ("technical-diploma",   "دبلوم فني",           "diploma",  false),
        ("bachelor",            "بكالوريوس",           "bachelor", true),
        ("license",             "ليسانس",             "bachelor", true),
        ("master",              "ماجستير",            "master",   true),
        ("phd",                 "دكتوراه",             "phd",      true),
    ];

    private static readonly (string Iso, string NameAr, string NameEn)[] NationalitySeeds =
    [
        ("EG", "مصري",         "Egyptian"),
        ("SA", "سعودي",        "Saudi"),
        ("AE", "إماراتي",      "Emirati"),
        ("KW", "كويتي",        "Kuwaiti"),
        ("QA", "قطري",          "Qatari"),
        ("BH", "بحريني",       "Bahraini"),
        ("OM", "عماني",        "Omani"),
        ("JO", "أردني",        "Jordanian"),
        ("PS", "فلسطيني",      "Palestinian"),
        ("SY", "سوري",          "Syrian"),
        ("LB", "لبناني",       "Lebanese"),
        ("IQ", "عراقي",        "Iraqi"),
        ("LY", "ليبي",          "Libyan"),
        ("SD", "سوداني",       "Sudanese"),
    ];

    private static readonly (string Key, string NameAr, int Degree, string Side)[] RelationshipSeeds =
    [
        ("father",              "الأب",             1, "paternal"),
        ("mother",              "الأم",             1, "maternal"),
        ("brother",             "الأخ الشقيق",      1, "self"),
        ("sister",              "الأخت الشقيقة",   1, "self"),
        ("paternal-grandfather","الجد لأب",          2, "paternal"),
        ("paternal-grandmother","الجدة لأب",         2, "paternal"),
        ("maternal-grandfather","الجد لأم",          2, "maternal"),
        ("maternal-grandmother","الجدة لأم",         2, "maternal"),
        ("uncle-paternal",      "العم",             3, "paternal"),
        ("aunt-paternal",       "العمة",             3, "paternal"),
        ("uncle-maternal",      "الخال",             3, "maternal"),
        ("aunt-maternal",       "الخالة",            3, "maternal"),
        ("spouse",              "الزوج/الزوجة",     1, "spouse"),
        ("nephew-niece",        "ابن الأخ/الأخت",  4, "self"),
    ];

    private static readonly (string Key, string NameAr, string Severity, bool BlocksApplication)[] CaseTypeSeeds =
    [
        ("misdemeanor",      "قضية جنحة",          "low",    false),
        ("civil",            "قضية مدنية",         "low",    false),
        ("personal-status",  "قضية أحوال شخصية",   "low",    false),
        ("financial",        "قضية مالية",         "medium", false),
        ("narcotics",        "قضية مخدرات (متهم)", "high",   true),
        ("state-security",   "قضية أمن دولة",       "high",   true),
        ("terrorism",        "قضية إرهاب",         "high",   true),
        ("admin-corruption", "قضية فساد إداري",    "high",   true),
        ("traffic",          "مخالفة مرورية",      "low",    false),
        ("labor",            "قضية عمالية",         "medium", false),
    ];

    private async Task SeedApplicantsAsync(Guid cycleId, Guid systemUserId, CancellationToken ct)
    {
        const int count = 240;
        var applicants = new List<Applicant>(count);

        for (var i = 0; i < count; i++)
        {
            var firstName = Pick(ArabicFirstNames);
            var lastName = Pick(ArabicLastNames);
            var fullName = $"{firstName} {lastName}";
            var nid = GenerateNationalId(i);
            var gov = Pick(Governorates);

            var applicant = Applicant.Create(nid, fullName, cycleId, systemUserId, demoOrigin: true);
            applicants.Add(applicant);
        }

        db.Applicants.AddRange(applicants);
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedAuditEntriesAsync(Guid systemUserId, CancellationToken ct)
    {
        var applicantIds = await db.Applicants
            .Where(a => a.DemoOrigin)
            .Select(a => new { a.Id, a.FullName })
            .Take(80)
            .ToListAsync(ct);

        for (var i = 0; i < 80; i++)
        {
            var target = applicantIds[i % applicantIds.Count];
            var action = (AuditAction)(1 + (i % 5));
            var outcome = i % 10 == 0 ? AuditOutcome.Failure : AuditOutcome.Success;

            var entry = AuditEntry.Create(
                actorId: systemUserId,
                actorName: "مدير النظام التجريبي",
                actorIp: "127.0.0.1",
                action: action,
                targetType: nameof(Applicant),
                targetId: target.Id,
                targetLabel: target.FullName,
                outcome: outcome,
                demoOrigin: true);

            db.AuditEntries.Add(entry);
        }

        await db.SaveChangesAsync(ct);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gap I — platform-wide lookup catalogue (13 categories)
    //
    // Idempotent per-category top-up: every time the API starts, any lookup
    // category that's missing from the DB gets seeded. Adding a new category
    // here picks it up automatically without a wipe.
    // ─────────────────────────────────────────────────────────────────────────

    private async Task TopUpLookupsAsync(CancellationToken ct)
    {
        var anyAdded = false;

        if (!await db.EducationTypes.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, isActive) in LookupSeeds["educationTypes"])
            {
                var e = EducationType.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true);
                if (!isActive) e.Update(null, null, null, false);
                db.EducationTypes.Add(e);
            }
            anyAdded = true;
        }

        if (!await db.MaritalStatuses.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, isActive) in LookupSeeds["maritalStatuses"])
            {
                var e = MaritalStatus.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true);
                if (!isActive) e.Update(null, null, null, false);
                db.MaritalStatuses.Add(e);
            }
            anyAdded = true;
        }

        // Universities must be saved before faculties so the FK lookup resolves.
        var uniIdByKey = new Dictionary<string, Guid>();
        if (!await db.Universities.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["universities"])
            {
                var e = University.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true);
                db.Universities.Add(e);
                uniIdByKey[key] = e.Id;
            }
            await db.SaveChangesAsync(ct);
            anyAdded = true;
        }

        if (!await db.Faculties.AnyAsync(ct))
        {
            // If universities pre-existed (uniIdByKey empty), fetch them.
            if (uniIdByKey.Count == 0)
                uniIdByKey = (await db.Universities.AsNoTracking().ToListAsync(ct))
                    .ToDictionary(u => u.Key, u => u.Id);

            foreach (var (key, labelAr, sortOrder, parentKey, _, _) in LookupSeeds["faculties"])
            {
                if (parentKey is null || !uniIdByKey.TryGetValue(parentKey, out var uniId)) continue;
                db.Faculties.Add(Faculty.Create(key, labelAr, uniId, null, sortOrder, isSystem: true, demoOrigin: true));
            }
            anyAdded = true;
        }

        // SpecialtyTypes before Specialties.
        var stIdByKey = new Dictionary<string, Guid>();
        if (!await db.SpecialtyTypes.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["specialtyTypes"])
            {
                var e = SpecialtyType.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true);
                db.SpecialtyTypes.Add(e);
                stIdByKey[key] = e.Id;
            }
            await db.SaveChangesAsync(ct);
            anyAdded = true;
        }

        if (!await db.Specialties.AnyAsync(ct))
        {
            if (stIdByKey.Count == 0)
                stIdByKey = (await db.SpecialtyTypes.AsNoTracking().ToListAsync(ct))
                    .ToDictionary(s => s.Key, s => s.Id);

            foreach (var (key, labelAr, sortOrder, parentKey, gender, _) in LookupSeeds["specialties"])
            {
                if (parentKey is null || !stIdByKey.TryGetValue(parentKey, out var stId)) continue;
                SpecialtyGender? g = gender is null ? null
                    : Enum.TryParse<SpecialtyGender>(gender, ignoreCase: true, out var pg) ? pg : null;
                db.Specialties.Add(Specialty.Create(key, labelAr, stId, g, null, sortOrder, isSystem: true, demoOrigin: true));
            }
            anyAdded = true;
        }

        if (!await db.DegreeTypes.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["degreeTypes"])
                db.DegreeTypes.Add(DegreeType.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true));
            anyAdded = true;
        }

        if (!await db.Jobs.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["jobs"])
                db.Jobs.Add(Job.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true));
            anyAdded = true;
        }

        if (!await db.ExamTypes.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["examTypes"])
                db.ExamTypes.Add(ExamType.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true));
            anyAdded = true;
        }

        if (!await db.ExamGroups.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["examGroups"])
                db.ExamGroups.Add(ExamGroup.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true));
            anyAdded = true;
        }

        if (!await db.CommitteeTypes.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["committeeTypes"])
                db.CommitteeTypes.Add(CommitteeType.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true));
            anyAdded = true;
        }

        if (!await db.RejectionReasons.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["rejectionReasons"])
                db.RejectionReasons.Add(RejectionReason.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true));
            anyAdded = true;
        }

        if (!await db.NotificationDepartments.AnyAsync(ct))
        {
            foreach (var (key, labelAr, sortOrder, _, _, _) in LookupSeeds["notificationDepartments"])
                db.NotificationDepartments.Add(NotificationDepartment.Create(key, labelAr, null, sortOrder, isSystem: true, demoOrigin: true));
            anyAdded = true;
        }

        if (anyAdded)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Lookup top-up: missing categories seeded into dedicated tables.");
        }
    }

    // (key, labelAr, sortOrder, parentKey, gender, isActive)
    private static readonly System.Collections.Generic.Dictionary<
        string,
        (string Key, string LabelAr, int SortOrder, string? ParentKey, string? Gender, bool IsActive)[]> LookupSeeds = new()
    {
        ["educationTypes"] = new[]
        {
            ("thanaweya_amma", "ثانوية عامة", 10, (string?)null, (string?)null, true),
            ("azhar", "أزهر", 20, null, null, true),
            ("sports_education", "تربية رياضية", 30, null, null, true),
            ("law", "حقوق", 40, null, null, true),
            ("bachelor", "بكالوريوس", 50, null, null, true),
            ("master", "ماجستير", 60, null, null, true),
            ("phd", "دكتوراه", 70, null, null, true),
            ("foreign_certificates", "شهادات أجنبية", 80, null, null, true),
            ("ig", "IG", 81, null, null, true),
            ("american_diploma", "الدبلوم الأمريكي", 82, null, null, true),
        },
        ["maritalStatuses"] = new[]
        {
            ("single", "أعزب", 10, (string?)null, (string?)null, true),
            ("married", "متزوج", 20, null, null, true),
            ("divorced", "مطلق", 30, null, null, false),
            ("widowed", "أرمل", 40, null, null, false),
        },
        ["universities"] = new[]
        {
            ("cairo", "جامعة القاهرة", 10, (string?)null, (string?)null, true),
            ("ain_shams", "جامعة عين شمس", 20, null, null, true),
            ("alexandria", "جامعة الإسكندرية", 30, null, null, true),
            ("mansoura", "جامعة المنصورة", 40, null, null, true),
            ("assiut", "جامعة أسيوط", 50, null, null, true),
            ("helwan", "جامعة حلوان", 60, null, null, true),
            ("zagazig", "جامعة الزقازيق", 70, null, null, true),
            ("police_academy", "أكاديمية الشرطة", 80, null, null, true),
        },
        ["faculties"] = new[]
        {
            ("engineering_cu", "كلية الهندسة", 10, (string?)"cairo", (string?)null, true),
            ("law_cu", "كلية الحقوق", 20, "cairo", null, true),
            ("commerce_cu", "كلية التجارة", 30, "cairo", null, true),
            ("medicine_as", "كلية الطب", 10, "ain_shams", null, true),
            ("engineering_as", "كلية الهندسة", 20, "ain_shams", null, true),
            ("police_pa", "كلية الشرطة", 10, "police_academy", null, true),
        },
        ["specialtyTypes"] = new[]
        {
            ("engineering", "هندسة", 10, (string?)null, (string?)null, true),
            ("accounting", "محاسبة", 20, null, null, true),
            ("law", "قانون", 30, null, null, true),
            ("medicine", "طب", 40, null, null, true),
            ("computer_science", "علوم الحاسب", 50, null, null, true),
            ("business", "إدارة الأعمال", 60, null, null, true),
        },
        ["specialties"] = new[]
        {
            ("civil_engineering", "هندسة مدنية", 10, (string?)"engineering", (string?)null, true),
            ("electrical_engineering", "هندسة كهربائية", 20, "engineering", null, true),
            ("mechanical_engineering", "هندسة ميكانيكية", 30, "engineering", null, true),
            ("financial_accounting", "محاسبة مالية", 10, "accounting", null, true),
            ("cost_accounting", "محاسبة تكاليف", 20, "accounting", null, true),
        },
        ["degreeTypes"] = new[]
        {
            ("bachelor", "بكالوريوس", 10, (string?)null, (string?)null, true),
            ("master", "ماجستير", 20, null, null, true),
            ("phd", "دكتوراه", 30, null, null, true),
            ("higher_diploma", "دبلوم عالٍ", 40, null, null, true),
        },
        ["jobs"] = new[]
        {
            ("teacher", "مدرّس", 10, (string?)null, (string?)null, true),
            ("engineer", "مهندس", 20, null, null, true),
            ("doctor", "طبيب", 30, null, null, true),
            ("lawyer", "محامٍ", 40, null, null, true),
            ("accountant", "محاسب", 50, null, null, true),
            ("officer", "ضابط شرطة", 60, null, null, true),
            ("officer_armed_forces", "ضابط قوات مسلحة", 70, null, null, true),
            ("public_employee", "موظف حكومي", 80, null, null, true),
            ("private_employee", "موظف قطاع خاص", 90, null, null, true),
            ("businessman", "رجل أعمال", 100, null, null, true),
            ("housewife", "ربة منزل", 110, null, null, true),
            ("retired", "متقاعد", 120, null, null, true),
        },
        ["examTypes"] = new[]
        {
            ("aptitude", "القدرات", 10, (string?)null, (string?)null, true),
            ("height", "الطول", 20, null, null, true),
            ("appearance_external", "السمات الخارجي", 30, null, null, true),
            ("appearance_internal", "السمات الداخلي", 40, null, null, true),
            ("physical", "الرياضي", 50, null, null, true),
            ("physical_retake", "إعادة الرياضي", 60, null, null, true),
            ("posture", "الهيئة", 70, null, null, true),
            ("build", "القوام", 80, null, null, true),
            ("build_retake", "إعادة القوام", 90, null, null, true),
            ("medical", "الطبي", 100, null, null, true),
            ("medical_retake", "إعادة الطبي", 110, null, null, true),
            ("psychology", "الاتزان النفسي", 120, null, null, true),
            ("medical_advanced", "الطبي المتقدم", 130, null, null, true),
        },
        ["examGroups"] = new[]
        {
            ("preliminary", "الاختبارات الأولية", 10, (string?)null, (string?)null, true),
            ("committees_capacity_traits", "لجان القدرات والسمات", 20, null, null, true),
            ("physical_group", "الاختبارات الرياضية", 30, null, null, true),
            ("medical_group", "الاختبارات الطبية", 40, null, null, true),
            ("psychology_group", "الاختبارات النفسية", 50, null, null, true),
            ("faculty_exams", "اختبارات الكلية", 60, null, null, true),
        },
        ["committeeTypes"] = new[]
        {
            ("capacities", "لجنة القدرات", 10, (string?)null, (string?)null, true),
            ("traits", "لجنة السمات", 20, null, null, true),
            ("sports", "لجنة الرياضة", 30, null, null, true),
            ("interview", "لجنة المقابلة", 40, null, null, true),
        },
        ["rejectionReasons"] = new[]
        {
            ("age_out_of_range", "السن خارج المسموح به", 10, (string?)null, (string?)null, true),
            ("gender_mismatch", "لا يطابق متطلبات النوع", 20, null, null, true),
            ("score_below_min", "المجموع أقل من المطلوب", 30, null, null, true),
            ("qualification_mismatch", "المؤهل لا يطابق", 40, null, null, true),
            ("height_below_min", "الطول أقل من المطلوب", 50, null, null, true),
            ("marital_status_mismatch", "الحالة الاجتماعية غير مطابقة", 60, null, null, true),
            ("failed_medical", "لم يجتز الكشف الطبي", 70, null, null, true),
            ("failed_physical", "لم يجتز الكشف الرياضي", 80, null, null, true),
            ("failed_committee", "لم يجتز لجنة القبول", 90, null, null, true),
            ("failed_investigation", "تحريات غير مرضية", 100, null, null, true),
            ("withdrawal", "انسحاب من المتقدم", 110, null, null, true),
            ("absent_from_test", "تخلّف عن اختبار", 120, null, null, true),
        },
        ["notificationDepartments"] = new[]
        {
            ("admissions", "إدارة القبول", 10, (string?)null, (string?)null, true),
            ("investigations", "إدارة التحريات", 20, null, null, true),
            ("medical", "القومسيون الطبي", 30, null, null, true),
            ("exams", "إدارة الاختبارات", 40, null, null, true),
            ("finance", "الإدارة المالية", 50, null, null, true),
            ("it", "إدارة التكنولوجيا", 60, null, null, true),
        },
    };
}
