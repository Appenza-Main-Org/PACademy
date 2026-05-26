using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace PACademy.Applicant.Api.Modules.ApplicantPortal;

/// <summary>
/// Seeds exam slots verbatim from the frontend mock:
/// frontend/src/shared/mock-data/applicantPortal.ts — EXAM_SLOTS.
/// 5 future days (no Fridays), capacity 200, three rotating locations.
/// Slot IDs are deterministic (SLT-{date}) so re-seeding is idempotent.
/// </summary>
public static class PortalSeeder
{
    private static readonly string[] Locations =
    [
        "أكاديمية الشرطة - المقر الرئيسي",
        "اللجنة الأولى",
        "اللجنة الثانية",
    ];

    public static async Task SeedExamSlotsAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();

        // Skip if already seeded.
        if (await db.ExamSlots.AnyAsync()) return;

        var slots = new List<ExamSlotEntity>();
        var start = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(1));
        var dayOffset = 0;
        var now = DateTimeOffset.UtcNow;

        while (slots.Count < 5)
        {
            var date = start.AddDays(dayOffset++);
            if ((int)date.DayOfWeek == 5) continue; // skip Friday

            var location = Locations[slots.Count % Locations.Length];
            slots.Add(new ExamSlotEntity
            {
                Id = $"SLT-{date:yyyy-MM-dd}",
                Date = date,
                Time = "08:00",
                Location = location,
                Capacity = 200,
                Reserved = 0,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        db.ExamSlots.AddRange(slots);
        await db.SaveChangesAsync();
    }
}
