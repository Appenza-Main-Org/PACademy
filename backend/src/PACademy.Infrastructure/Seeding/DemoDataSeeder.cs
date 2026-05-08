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
        ["القاهرة"] = "01", ["الإسكندرية"] = "02", ["بورسعيد"] = "03", ["السويس"] = "04",
        ["دمياط"] = "11", ["الدقهلية"] = "12", ["الشرقية"] = "13", ["القليوبية"] = "14",
        ["كفر الشيخ"] = "15", ["الغربية"] = "16", ["المنوفية"] = "17", ["البحيرة"] = "18",
        ["الإسماعيلية"] = "19", ["الجيزة"] = "21", ["بني سويف"] = "22", ["الفيوم"] = "23",
        ["المنيا"] = "24", ["أسيوط"] = "25", ["سوهاج"] = "26", ["قنا"] = "27",
        ["أسوان"] = "28", ["الأقصر"] = "29", ["البحر الأحمر"] = "31", ["الوادي الجديد"] = "32",
        ["مرسى مطروح"] = "33", ["شمال سيناء"] = "34", ["جنوب سيناء"] = "35",
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
        var cycles = new[]
        {
            ("دورة القبول 2024", CycleStatus.Closed),
            ("دورة القبول 2025", CycleStatus.Closed),
            ("دورة القبول 2026", CycleStatus.Active),
        };

        Guid activeCycleId = Guid.Empty;
        foreach (var (name, status) in cycles)
        {
            var cycle = Cycle.Create(name, createdBy, demoOrigin: true);
            if (status == CycleStatus.Active)
            {
                activeCycleId = cycle.Id;
            }

            db.Cycles.Add(cycle);
        }

        await db.SaveChangesAsync(ct);
        return activeCycleId;
    }

    private async Task SeedCategoriesAsync(Guid createdBy, CancellationToken ct)
    {
        string[] categoryData =
        [
            "الشرطة|police",
            "الأسلحة والذخيرة|arms",
            "إدارة السجون|prisons",
            "المرور|traffic",
            "الحماية المدنية|civil-defense",
            "الأمن الوطني|national-security",
            "الطب الشرعي|forensics",
        ];

        foreach (var data in categoryData)
        {
            var parts = data.Split('|');
            db.Categories.Add(Category.Create(parts[1], parts[0], createdBy, demoOrigin: true));
        }

        await db.SaveChangesAsync(ct);
    }

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
        foreach (var gov in Governorates)
        {
            var key = GovNidCodes.GetValueOrDefault(gov, "00");
            db.ReferenceDataEntries.Add(
                ReferenceDataEntry.Create("governorate", key, gov, demoOrigin: true));
        }

        await db.SaveChangesAsync(ct);
    }

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
