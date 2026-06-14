using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using PACademy.Applicant.Api.Modules.ApplicantPortal;

namespace PACademy.Admin.Api.Tests;

public sealed class ApplicantPortalPersistenceTests
{
    [Fact]
    public async Task SavingStartedDraftMirrorsApplicantManagementRecord()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        const string applicantId = "5d4f19bc-6b75-41da-bfe2-3374ecde9a4f";

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = "officers_general",
            ["furthestStage"] = 1,
            ["auth"] = new JsonObject
            {
                ["nationalId"] = "30412180103456",
                ["phoneNumber"] = "01012345678"
            }
        }, TestContext.Current.CancellationToken);

        var mirror = await db.ApplicantManagementRecords.SingleAsync(
            row => row.Module == "applicants" && row.Id == applicantId,
            TestContext.Current.CancellationToken);
        var payload = JsonNode.Parse(mirror.PayloadJson)!.AsObject();

        Assert.Equal(applicantId, mirror.ApplicantId);
        Assert.Equal("30412180103456", mirror.NationalId);
        Assert.Equal("CYC-2026-M", mirror.CycleId);
        Assert.Equal("officers_general", mirror.CategoryKey);
        Assert.Equal("pending", mirror.Status);
        Assert.Equal(1, payload["stage"]?.GetValue<int>());
        Assert.Equal("تسجيل أولي", payload["stageLabel"]?.GetValue<string>());
        Assert.Equal("pending", payload["status"]?.GetValue<string>());
        Assert.Equal("applicant-portal", payload["source"]?.GetValue<string>());
    }

    /* The client always suggests CMT-12 (the officers_general committee) —
     * the booking flow must keep it only for officers_general and re-resolve
     * a category-matching committee for everyone else. */
    [Theory]
    [InlineData("officers_general", "30601010103451", "01011111111", "CMT-12", "اللجنة الأولى قسم عام")]
    [InlineData("law_bachelor", "30602020103452", "01022222222", "CMT-11", "اللجنة الثانية ليسانس حقوق")]
    [InlineData("physical_education_bachelor", "30603030103453", "01033333333", "CMT-09", "اللجنة الأولى بكالوريوس تربية رياضية (طالبات)")]
    [InlineData("specialized_officers", "30604040103454", "01044444444", "CMT-05", "اللجنة الخامسة قسم خاص")]
    public async Task ApplicantJourneyAcrossCategoriesProgressivelyUpdatesManagementRecord(
        string categoryKey,
        string nationalId,
        string phoneNumber,
        string expectedCommitteeId,
        string expectedCommitteeName)
    {
        await using var db = CreateDb();
        await SeedCommitteeSchedule(db, "2026-07-15");
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = categoryKey,
            ["auth"] = new JsonObject
            {
                ["nationalId"] = nationalId,
                ["phoneNumber"] = phoneNumber
            },
            ["profile"] = new JsonObject
            {
                ["fullName"] = $"متقدم اختبار {categoryKey}",
                ["nationalId"] = nationalId,
                ["mobile"] = phoneNumber,
                ["email"] = $"{categoryKey}@uat.example.eg",
                ["dateOfBirth"] = "2006-01-01",
                ["gender"] = "male",
                ["birthGovernorate"] = "القاهرة",
                ["birthDistrict"] = "مدينة نصر",
                ["religion"] = "مسلم"
            }
        }, TestContext.Current.CancellationToken);

        var started = await db.ApplicantManagementRecords.SingleAsync(
            row => row.Module == "applicants" && row.Id == applicantId,
            TestContext.Current.CancellationToken);
        var startedPayload = JsonNode.Parse(started.PayloadJson)!.AsObject();

        Assert.Equal("pending", started.Status);
        Assert.Equal("pending", startedPayload["status"]?.GetValue<string>());
        Assert.Equal(1, startedPayload["stage"]?.GetValue<int>());
        Assert.Equal("تسجيل أولي", startedPayload["stageLabel"]?.GetValue<string>());
        Assert.Equal(categoryKey, started.CategoryKey);
        Assert.Equal(nationalId, started.NationalId);
        Assert.Equal("CYC-2026-M", started.CycleId);

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["furthestStage"] = 6,
            ["payment"] = new JsonObject
            {
                ["method"] = "fawry-code",
                ["refNumber"] = $"PAY-{nationalId[^4..]}",
                ["paidAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            }
        }, TestContext.Current.CancellationToken);

        await service.PickExamDateAsync(
            applicantId,
            "2026-07-15",
            new PickedCommittee("CMT-12", "اللجنة الأولى قسم عام"),
            TestContext.Current.CancellationToken);

        var scheduled = await db.ApplicantManagementRecords.SingleAsync(
            row => row.Module == "applicants" && row.Id == applicantId,
            TestContext.Current.CancellationToken);
        var scheduledPayload = JsonNode.Parse(scheduled.PayloadJson)!.AsObject();

        Assert.Equal("under-review", scheduled.Status);
        Assert.Equal("under-review", scheduledPayload["status"]?.GetValue<string>());
        Assert.Equal("paid", scheduledPayload["paymentStatus"]?.GetValue<string>());
        Assert.Equal(8, scheduledPayload["stage"]?.GetValue<int>());
        Assert.Equal("حجز الاختبارات", scheduledPayload["stageLabel"]?.GetValue<string>());
        Assert.Equal("2026-07-15", scheduledPayload["firstExamDate"]?.GetValue<string>());
        Assert.Equal(expectedCommitteeId, scheduledPayload["assignedCommitteeId"]?.GetValue<string>());
        Assert.Equal(expectedCommitteeName, scheduledPayload["assignedCommitteeName"]?.GetValue<string>());
        Assert.Equal(expectedCommitteeId, scheduledPayload["examSlot"]?["committeeId"]?.GetValue<string>());
        Assert.Equal(expectedCommitteeName, scheduledPayload["examSlot"]?["committeeName"]?.GetValue<string>());
        Assert.Equal(expectedCommitteeId, scheduled.CommitteeId);
        Assert.Equal(categoryKey, scheduled.CategoryKey);
        Assert.Equal(nationalId, scheduled.NationalId);
    }

    [Fact]
    public async Task PickExamDateRejectsDateWithNoCommitteeForCategory()
    {
        await using var db = CreateDb();
        await SeedCommitteeSchedule(db, "2026-07-15");
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = "law_bachelor",
        }, TestContext.Current.CancellationToken);

        var ex = await Assert.ThrowsAsync<PACademy.Shared.Contracts.ConflictException>(() =>
            service.PickExamDateAsync(applicantId, "2026-07-16", null, TestContext.Current.CancellationToken));

        Assert.Equal("EXAM_DATE_NOT_AVAILABLE_FOR_CATEGORY", ex.ConflictCode);
    }

    [Fact]
    public async Task ChangingCategoryClearsBookedCommitteeAndExamSlot()
    {
        await using var db = CreateDb();
        await SeedCommitteeSchedule(db, "2026-07-15");
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = "law_bachelor",
        }, TestContext.Current.CancellationToken);
        await service.PickExamDateAsync(applicantId, "2026-07-15", null, TestContext.Current.CancellationToken);

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["categoryKey"] = "officers_general",
        }, TestContext.Current.CancellationToken);

        var draft = await service.GetOrCreateDraftAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.Null(draft["examSlot"]);
        Assert.Null(draft["assignedCommitteeId"]);
        Assert.Null(draft["assignedCommitteeName"]);
        Assert.Null(draft["firstExamDate"]);
    }

    private static async Task SeedCommitteeSchedule(PortalDbContext db, string isoDate)
    {
        var date = DateOnly.Parse(isoDate);
        var committees = new (string Code, string Name, string CategoryKey)[]
        {
            ("CMT-12", "اللجنة الأولى قسم عام", "officers_general"),
            ("CMT-10", "اللجنة الأولى ليسانس حقوق (طالبات)", "law_bachelor"),
            ("CMT-11", "اللجنة الثانية ليسانس حقوق", "law_bachelor"),
            ("CMT-09", "اللجنة الأولى بكالوريوس تربية رياضية (طالبات)", "physical_education_bachelor"),
            ("CMT-01", "اللجنة الأولى قسم خاص (طالبات)", "specialized_officers"),
            ("CMT-05", "اللجنة الخامسة قسم خاص", "specialized_officers"),
        };
        foreach (var committee in committees)
        {
            db.CommitteeLookups.Add(new CommitteeLookupReadEntity
            {
                LookupKey = "committees",
                Code = committee.Code,
                Name = committee.Name,
                IsActive = true,
            });
            db.CommitteeInstances.Add(new CommitteeInstanceReadEntity
            {
                Id = $"CI-{committee.Code}-{isoDate}",
                DefinitionCode = committee.Code,
                CycleId = "CYC-2026-M",
                CategoryKey = committee.CategoryKey,
                Date = date,
            });
        }
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task PickExamDateRejectsExpiredDate()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");
        var expiredDate = DateOnly
            .FromDateTime(DateTime.UtcNow.AddDays(-1))
            .ToString("yyyy-MM-dd");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PickExamDateAsync(applicantId, expiredDate, null, TestContext.Current.CancellationToken));

        Assert.Equal("هذا الموعد لم يعد متاحاً للحجز", ex.Message);
        var draft = await service.GetOrCreateDraftAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.Null(draft["examSlot"]);
    }

    [Fact]
    public async Task AcquaintanceDocLifecycleOpensAutosavesAndClosesFromConfiguredRules()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");

        db.AcquaintanceDocSettings.Add(new AcquaintanceDocSettingsEntity
        {
            Id = "ads-CYC-2026-M",
            CycleId = "CYC-2026-M",
            OpeningTestKey = "physical",
            OpeningRequiredOutcome = "passed",
            ClosingTestKey = "medical",
            ClosingMode = "after_test_passed",
            IsEnabled = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = "officers_general",
            ["profile"] = new JsonObject
            {
                ["fullName"] = "متقدم وثيقة تعارف",
                ["nationalId"] = "30605050103455",
                ["mobile"] = "01055555555",
                ["dateOfBirth"] = "2006-05-05",
                ["birthGovernorate"] = "القاهرة",
                ["birthDistrict"] = "مدينة نصر",
                ["religion"] = "مسلم",
                ["certificateName"] = "الثانوية العامة"
            },
            ["followUp"] = new JsonObject
            {
                ["sports"] = "passed"
            }
        }, TestContext.Current.CancellationToken);

        var openStatus = await service.GetAcquaintanceDocStatusAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.True(openStatus["isOpen"]?.GetValue<bool>());
        Assert.True(openStatus["canEdit"]?.GetValue<bool>());
        Assert.False(openStatus["canPrint"]?.GetValue<bool>());

        var openedDoc = await service.GetOrCreateAcquaintanceDocAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.NotNull(openedDoc["document"]);
        Assert.Equal(1, await db.AcquaintanceDocs.CountAsync(TestContext.Current.CancellationToken));
        Assert.Equal(8, await db.AcquaintanceDocSections.CountAsync(TestContext.Current.CancellationToken));

        var savedDoc = await service.SaveAcquaintanceDocAsync(applicantId, new JsonObject
        {
            ["personal"] = new JsonObject
            {
                ["personal"] = new JsonObject
                {
                    ["fullName"] = "متقدم وثيقة تعارف - محدث",
                    ["nationalId"] = "30605050103455"
                }
            }
        }, TestContext.Current.CancellationToken);
        Assert.True(savedDoc["status"]?["canEdit"]?.GetValue<bool>());
        Assert.True(savedDoc["version"]?.GetValue<int>() > 1);

        await service.SaveFollowUpAsync(applicantId, new JsonObject
        {
            ["medical"] = "passed"
        }, TestContext.Current.CancellationToken);

        var closedStatus = await service.GetAcquaintanceDocStatusAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.Equal("closed", closedStatus["status"]?.GetValue<string>());
        Assert.False(closedStatus["canEdit"]?.GetValue<bool>());
        Assert.True(closedStatus["canPrint"]?.GetValue<bool>());

        var printable = await service.GetPrintableAcquaintanceDocAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.NotNull(printable["document"]);
    }

    [Fact]
    public async Task AcquaintanceDocDoesNotCloseOnFirstExamDateWhenClosingTestHasNotStarted()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");
        const string cycleId = "CYC-2026-M";

        db.AcquaintanceDocSettings.Add(new AcquaintanceDocSettingsEntity
        {
            Id = $"ads-{cycleId}",
            CycleId = cycleId,
            OpeningTestKey = "TST-01",
            OpeningRequiredOutcome = "passed",
            ClosingTestKey = "TST-04",
            ClosingMode = "on_test_time",
            IsEnabled = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        db.AcquaintanceDocs.Add(new ApplicantAcquaintanceDocEntity
        {
            Id = "adoc-premature",
            CycleId = cycleId,
            ApplicantId = applicantId,
            Status = "closed",
            OpenedAt = DateTimeOffset.UtcNow.AddHours(-2),
            ClosedAt = DateTimeOffset.UtcNow.AddHours(-1),
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-2),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1),
            Version = 1,
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = cycleId,
            ["categoryKey"] = "officers_general",
            ["profile"] = new JsonObject
            {
                ["fullName"] = "متقدم سمات خارجية",
                ["nationalId"] = "30412180103456",
                ["mobile"] = "01012345678",
                ["dateOfBirth"] = "2004-12-18",
                ["birthGovernorate"] = "القاهرة",
                ["birthDistrict"] = "مدينة نصر",
                ["religion"] = "مسلم",
                ["certificateName"] = "الثانوية العامة"
            },
            ["examSlot"] = new JsonObject
            {
                ["slotId"] = "SLT-first",
                ["date"] = "2026-01-01",
                ["time"] = "08:00",
                ["location"] = "اللجنة الثانية"
            },
            ["followUp"] = new JsonObject
            {
                ["TST-01"] = "passed",
                ["TST-04"] = "pending"
            }
        }, TestContext.Current.CancellationToken);

        var status = await service.GetAcquaintanceDocStatusAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.Equal("open", status["status"]?.GetValue<string>());
        Assert.True(status["canEdit"]?.GetValue<bool>());
        Assert.False(status["canPrint"]?.GetValue<bool>());

        var doc = await db.AcquaintanceDocs.SingleAsync(x => x.ApplicantId == applicantId, TestContext.Current.CancellationToken);
        Assert.Equal("open", doc.Status);
        Assert.Null(doc.ClosedAt);
    }

    [Fact]
    public async Task AcquaintanceDocOpensWhenAptitudePassIsStoredUnderLegacyPipelineKey()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");
        const string cycleId = "CYC-2026-M";

        // Regression: aptitude may be configured as AX-01 while imported/admin results
        // still carry the older follow-up bucket.
        db.AcquaintanceDocSettings.Add(new AcquaintanceDocSettingsEntity
        {
            Id = $"ads-{cycleId}",
            CycleId = cycleId,
            OpeningTestKey = "AX-01",
            OpeningRequiredOutcome = "passed",
            ClosingTestKey = "medical",
            ClosingMode = "after_test_passed",
            IsEnabled = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = cycleId,
            ["categoryKey"] = "officers_general",
            ["followUp"] = new JsonObject
            {
                ["capacities"] = "passed"
            }
        }, TestContext.Current.CancellationToken);

        var status = await service.GetAcquaintanceDocStatusAsync(applicantId, TestContext.Current.CancellationToken);

        Assert.Equal("open", status["status"]?.GetValue<string>());
        Assert.True(status["canEdit"]?.GetValue<bool>());
        Assert.Equal("AX-01", status["openingTestKey"]?.GetValue<string>());
    }

    [Fact]
    public async Task BarcodeIsGeneratedOnExamBookingInCorrectFormatAndIsImmutable()
    {
        await using var db = CreateDb();
        await SeedCommitteeSchedule(db, "2026-07-15");
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");

        // Paid officers_general applicant born 2006-07-13, male, committee CMT-12.
        await SeedPaidApplicant(service, applicantId, "30607130103451", "2006-07-13", "male");
        await service.PickExamDateAsync(applicantId, "2026-07-15",
            new PickedCommittee("CMT-12", "اللجنة الأولى قسم عام"), TestContext.Current.CancellationToken);

        var draft = await service.GetOrCreateDraftAsync(applicantId, TestContext.Current.CancellationToken);
        var barcode = draft["barcode"]?.GetValue<string>();

        // YY=26 BYY=06 MM=07 DD=13 G=1(male) CC=12(CMT-12) SSSSS=00001.
        Assert.Equal("26" + "06" + "07" + "13" + "1" + "12" + "00001", barcode);
        Assert.Matches("^[0-9]{16}$", barcode!);
        Assert.False(draft["barcodeRetry"]?.GetValue<bool>() ?? false);

        // Re-picking the same date keeps the identical barcode (immutable; no new
        // sequence consumed).
        await service.PickExamDateAsync(applicantId, "2026-07-15",
            new PickedCommittee("CMT-12", "اللجنة الأولى قسم عام"), TestContext.Current.CancellationToken);
        var redrawn = await service.GetOrCreateDraftAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.Equal(barcode, redrawn["barcode"]?.GetValue<string>());
    }

    [Fact]
    public async Task BarcodeSequenceIncrementsPerCommittee()
    {
        await using var db = CreateDb();
        await SeedCommitteeSchedule(db, "2026-07-15");
        var service = CreateService(db);

        var first = await BookOfficersGeneralAndGetBarcode(service, "30607130103451", "2006-07-13");
        var second = await BookOfficersGeneralAndGetBarcode(service, "30607130103452", "2007-03-04");

        // Both resolve to CMT-12 → committee code 12; the sequence advances 1 → 2.
        Assert.EndsWith("1200001", first);
        Assert.EndsWith("1200002", second);
    }

    [Fact]
    public async Task BarcodeIsNotGeneratedWhenPaymentMissing()
    {
        await using var db = CreateDb();
        await SeedCommitteeSchedule(db, "2026-07-15");
        var service = CreateService(db);
        var applicantId = Guid.NewGuid().ToString("D");

        await service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = "officers_general",
            ["profile"] = new JsonObject
            {
                ["dateOfBirth"] = "2006-07-13",
                ["gender"] = "male",
            },
        }, TestContext.Current.CancellationToken);
        await service.PickExamDateAsync(applicantId, "2026-07-15",
            new PickedCommittee("CMT-12", "اللجنة الأولى قسم عام"), TestContext.Current.CancellationToken);

        var draft = await service.GetOrCreateDraftAsync(applicantId, TestContext.Current.CancellationToken);
        Assert.Null(draft["barcode"]);
    }

    private static async Task<string> BookOfficersGeneralAndGetBarcode(
        PortalService service, string nationalId, string dateOfBirth)
    {
        var applicantId = Guid.NewGuid().ToString("D");
        await SeedPaidApplicant(service, applicantId, nationalId, dateOfBirth, "male");
        await service.PickExamDateAsync(applicantId, "2026-07-15",
            new PickedCommittee("CMT-12", "اللجنة الأولى قسم عام"), TestContext.Current.CancellationToken);
        var draft = await service.GetOrCreateDraftAsync(applicantId, TestContext.Current.CancellationToken);
        return draft["barcode"]!.GetValue<string>();
    }

    private static Task SeedPaidApplicant(
        PortalService service, string applicantId, string nationalId, string dateOfBirth, string gender) =>
        service.SaveDraftAsync(applicantId, new JsonObject
        {
            ["cycleId"] = "CYC-2026-M",
            ["categoryKey"] = "officers_general",
            ["furthestStage"] = 6,
            ["profile"] = new JsonObject
            {
                ["fullName"] = "متقدم باركود",
                ["nationalId"] = nationalId,
                ["dateOfBirth"] = dateOfBirth,
                ["gender"] = gender,
            },
            ["payment"] = new JsonObject
            {
                ["method"] = "fawry-code",
                ["refNumber"] = $"PAY-{nationalId[^4..]}",
                ["paidAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            },
        }, TestContext.Current.CancellationToken);

    private static PortalService CreateService(PortalDbContext db) =>
        new(db, NullLogger<PortalService>.Instance);

    private static PortalDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<PortalDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Schema"] = "dbo",
            })
            .Build();
        return new PortalDbContext(options, config);
    }
}
