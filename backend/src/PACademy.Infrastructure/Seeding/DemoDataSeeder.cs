using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PACademy.Domain.AdmissionRules;
using PACademy.Domain.Applicants;
using PACademy.Domain.Audit;
using PACademy.Domain.Categories;
using PACademy.Domain.Cycles;
using PACademy.Domain.ReferenceData;
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
        if (await db.Applicants.AnyAsync(a => a.DemoOrigin, ct))
        {
            logger.LogInformation("Demo data already seeded — skipping.");
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
        // Eight reference dictionaries — port of frontend mock-data/referenceData.ts.
        // Per-row extras (region, code, level, isoCode, …) ride in the Metadata
        // JSON column so the typed frontend rows round-trip cleanly.
        var sortOrder = 1;
        foreach (var (gov, code, region, nameEn) in GovernorateSeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "governorate", code, gov,
                nameEn: nameEn,
                metadata: SerializeJson(new { region }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        sortOrder = 1;
        foreach (var (key, nameAr, code, facultyType) in SpecializationSeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "specialization", key, nameAr,
                metadata: SerializeJson(new { code, facultyType }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        sortOrder = 1;
        foreach (var (key, nameAr, level, applicableTo) in RankSeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "rank", key, nameAr,
                metadata: SerializeJson(new { level, applicableTo }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        sortOrder = 1;
        foreach (var (key, nameAr, governorateId, type) in CollegeSeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "college", key, nameAr,
                metadata: SerializeJson(new { governorateId, type }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        sortOrder = 1;
        foreach (var (key, nameAr, level, facultyRequired) in QualificationSeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "qualification", key, nameAr,
                metadata: SerializeJson(new { level, facultyRequired }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        sortOrder = 1;
        foreach (var (iso, nameAr, nameEn) in NationalitySeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "nationality", iso.ToLowerInvariant(), nameAr,
                nameEn: nameEn,
                metadata: SerializeJson(new { isoCode = iso }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        sortOrder = 1;
        foreach (var (key, nameAr, degree, side) in RelationshipSeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "relationship", key, nameAr,
                metadata: SerializeJson(new { degree, side }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        sortOrder = 1;
        foreach (var (key, nameAr, severity, blocksApplication) in CaseTypeSeeds)
        {
            db.ReferenceDataEntries.Add(ReferenceDataEntry.Create(
                "case-type", key, nameAr,
                metadata: SerializeJson(new { severity, blocksApplication }),
                sortOrder: sortOrder++,
                demoOrigin: true));
        }

        await db.SaveChangesAsync(ct);
    }

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
}
