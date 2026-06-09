using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PACademy.Admin.Api.Modules.AdminRecords;

namespace PACademy.Admin.Api.Modules.OperationalRecords;

public sealed class OperationalRecordStore(IOperationalRecordsDbContext db)
{
    private const int DefaultBatchSize = 5000;

    public bool Supports(string module) => BucketFor(module) is not null;

    public async Task<IReadOnlyList<JsonObject>> ListAsync(string module, CancellationToken ct)
    {
        var rows = await Query(module)
            .AsNoTracking()
            .Where(x => x.Module == module)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        return rows.Select(ToJson).ToList();
    }

    public async Task<IReadOnlyList<JsonObject>> ListByPrefixAsync(string modulePrefix, CancellationToken ct)
    {
        var bucket = BucketFor(modulePrefix) ?? OperationalBucket.AdmissionSetup;
        var rows = await Query(bucket)
            .AsNoTracking()
            .Where(x => x.Module.StartsWith(modulePrefix))
            .OrderBy(x => x.Module)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);
        return rows.Select(ToJson).ToList();
    }

    public async Task<JsonObject?> GetAsync(string module, string id, CancellationToken ct)
    {
        var row = await FindAsync(module, id, tracking: false, ct);
        return row is null ? null : ToJson(row);
    }

    public async Task<JsonObject> UpsertAsync(string module, string id, JsonObject payload, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var row = await FindAsync(module, id, tracking: true, ct);
        var next = payload.DeepClone().AsObject();
        next["id"] ??= id;
        if (row is null)
        {
            Add(module, Create(module, id, next, now, now));
        }
        else
        {
            var current = ToJson(row);
            foreach (var item in payload)
            {
                current[item.Key] = item.Value?.DeepClone();
            }
            Apply(row, current, row.CreatedAt, now);
            next = current;
        }

        await db.SaveChangesAsync(ct);
        return next;
    }

    public async Task<int> InsertManyAsync(
        string module,
        IReadOnlyList<JsonObject> payloads,
        CancellationToken ct,
        int batchSize = DefaultBatchSize)
    {
        if (payloads.Count == 0) return 0;
        var written = 0;
        for (var offset = 0; offset < payloads.Count; offset += batchSize)
        {
            var count = Math.Min(batchSize, payloads.Count - offset);
            for (var index = offset; index < offset + count; index++)
            {
                var payload = payloads[index];
                var id = AdminRecordJson.StringProp(payload, "id")
                    ?? throw new InvalidOperationException("Operational payload is missing id.");
                await UpsertAsync(module, id, payload, ct);
                written++;
            }
        }
        return written;
    }

    public async Task<bool> DeleteAsync(string module, string id, CancellationToken ct)
    {
        var row = await FindAsync(module, id, tracking: true, ct);
        if (row is null) return false;
        Remove(row);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> DeleteModuleAsync(string module, CancellationToken ct)
    {
        var rows = await Query(module).Where(x => x.Module == module).ToListAsync(ct);
        if (rows.Count == 0) return 0;
        RemoveRange(rows);
        await db.SaveChangesAsync(ct);
        return rows.Count;
    }

    public async Task<int> DeleteManyAsync(string module, IReadOnlyCollection<string> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return 0;
        var rows = await Query(module)
            .Where(x => x.Module == module && ids.Contains(x.Id))
            .ToListAsync(ct);
        if (rows.Count == 0) return 0;
        RemoveRange(rows);
        await db.SaveChangesAsync(ct);
        return rows.Count;
    }

    public async Task<int> SoftDeleteManyAsync(
        string module,
        IReadOnlyCollection<string> ids,
        string? deletedBy,
        string? reason,
        CancellationToken ct)
    {
        if (ids.Count == 0) return 0;
        var rows = await Query(module)
            .Where(x => x.Module == module && ids.Contains(x.Id))
            .ToListAsync(ct);
        return await SoftDeleteRowsAsync(rows, deletedBy, reason, ct);
    }

    public async Task<int> SoftDeleteModuleAsync(
        string module,
        string? deletedBy,
        string? reason,
        CancellationToken ct)
    {
        var rows = await Query(module)
            .Where(x => x.Module == module)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        return await SoftDeleteRowsAsync(rows, deletedBy, reason, ct);
    }

    public async Task<int> DeleteFromArrayModulesAsync(
        string modulePrefix,
        string arrayName,
        string id,
        CancellationToken ct)
    {
        var rows = await Query(OperationalBucket.AdmissionSetup)
            .Where(x => x.Module.StartsWith(modulePrefix))
            .ToListAsync(ct);
        var removed = 0;
        foreach (var row in rows)
        {
            var payload = ToJson(row);
            if (payload[arrayName] is not JsonArray array) continue;
            var kept = new JsonArray();
            var rowRemoved = 0;
            foreach (var item in array.OfType<JsonObject>())
            {
                if (AdminRecordJson.StringProp(item, "id") == id)
                {
                    rowRemoved++;
                    continue;
                }
                kept.Add(item.DeepClone());
            }
            if (rowRemoved == 0) continue;
            removed += rowRemoved;
            payload[arrayName] = kept;
            Apply(row, payload, row.CreatedAt, DateTimeOffset.UtcNow);
        }
        if (removed > 0) await db.SaveChangesAsync(ct);
        return removed;
    }

    private async Task<int> SoftDeleteRowsAsync(
        IReadOnlyList<OperationalRecordEntity> rows,
        string? deletedBy,
        string? reason,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var deleted = 0;
        foreach (var row in rows)
        {
            var payload = ToJson(row);
            if (AdminRecordJson.IsSoftDeleted(payload)) continue;
            payload["deletedAt"] = now.ToString("O");
            payload["deletedBy"] = deletedBy ?? "system";
            if (!string.IsNullOrWhiteSpace(reason)) payload["deleteReason"] = reason;
            Apply(row, payload, row.CreatedAt, now);
            deleted++;
        }
        if (deleted > 0) await db.SaveChangesAsync(ct);
        return deleted;
    }

    private IQueryable<OperationalRecordEntity> Query(string module)
    {
        var bucket = BucketFor(module)
            ?? throw new InvalidOperationException($"No normalized operational table is registered for module '{module}'.");
        return Query(bucket);
    }

    private IQueryable<OperationalRecordEntity> Query(OperationalBucket bucket) =>
        bucket switch
        {
            OperationalBucket.Payments => db.PaymentRecords,
            OperationalBucket.Applicants => db.ApplicantManagementRecords,
            OperationalBucket.Grades => db.GradeOperationalRecords,
            OperationalBucket.Notifications => db.NotificationRecords,
            OperationalBucket.Workflow => db.WorkflowRecords,
            OperationalBucket.Committees => db.CommitteeRecords,
            OperationalBucket.Exams => db.ExamOperationalRecords,
            OperationalBucket.Biometric => db.BiometricRecords,
            OperationalBucket.AdmissionSetup => db.AdmissionSetupRecords,
            OperationalBucket.Reports => db.ReportSnapshotRecords,
            _ => throw new InvalidOperationException($"Unknown operational bucket '{bucket}'.")
        };

    private async Task<OperationalRecordEntity?> FindAsync(string module, string id, bool tracking, CancellationToken ct)
    {
        var query = Query(module).Where(x => x.Module == module && x.Id == id);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct);
    }

    private void Add(string module, OperationalRecordEntity row)
    {
        switch (BucketFor(module))
        {
            case OperationalBucket.Payments:
                db.PaymentRecords.Add((PaymentRecordEntity)row);
                break;
            case OperationalBucket.Applicants:
                db.ApplicantManagementRecords.Add((ApplicantManagementRecordEntity)row);
                break;
            case OperationalBucket.Grades:
                db.GradeOperationalRecords.Add((GradeOperationalRecordEntity)row);
                break;
            case OperationalBucket.Notifications:
                db.NotificationRecords.Add((NotificationRecordEntity)row);
                break;
            case OperationalBucket.Workflow:
                db.WorkflowRecords.Add((WorkflowRecordEntity)row);
                break;
            case OperationalBucket.Committees:
                db.CommitteeRecords.Add((CommitteeRecordEntity)row);
                break;
            case OperationalBucket.Exams:
                db.ExamOperationalRecords.Add((ExamOperationalRecordEntity)row);
                break;
            case OperationalBucket.Biometric:
                db.BiometricRecords.Add((BiometricRecordEntity)row);
                break;
            case OperationalBucket.AdmissionSetup:
                db.AdmissionSetupRecords.Add((AdmissionSetupRecordEntity)row);
                break;
            case OperationalBucket.Reports:
                db.ReportSnapshotRecords.Add((ReportSnapshotRecordEntity)row);
                break;
            default:
                throw new InvalidOperationException($"No normalized operational table is registered for module '{module}'.");
        }
    }

    private void Remove(OperationalRecordEntity row)
    {
        switch (row)
        {
            case PaymentRecordEntity entity:
                db.PaymentRecords.Remove(entity);
                break;
            case ApplicantManagementRecordEntity entity:
                db.ApplicantManagementRecords.Remove(entity);
                break;
            case GradeOperationalRecordEntity entity:
                db.GradeOperationalRecords.Remove(entity);
                break;
            case NotificationRecordEntity entity:
                db.NotificationRecords.Remove(entity);
                break;
            case WorkflowRecordEntity entity:
                db.WorkflowRecords.Remove(entity);
                break;
            case CommitteeRecordEntity entity:
                db.CommitteeRecords.Remove(entity);
                break;
            case ExamOperationalRecordEntity entity:
                db.ExamOperationalRecords.Remove(entity);
                break;
            case BiometricRecordEntity entity:
                db.BiometricRecords.Remove(entity);
                break;
            case AdmissionSetupRecordEntity entity:
                db.AdmissionSetupRecords.Remove(entity);
                break;
            case ReportSnapshotRecordEntity entity:
                db.ReportSnapshotRecords.Remove(entity);
                break;
        }
    }

    private void RemoveRange(IReadOnlyList<OperationalRecordEntity> rows)
    {
        foreach (var row in rows) Remove(row);
    }

    private static OperationalRecordEntity Create(
        string module,
        string id,
        JsonObject payload,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt)
    {
        var bucket = BucketFor(module)
            ?? throw new InvalidOperationException($"No normalized operational table is registered for module '{module}'.");
        OperationalRecordEntity row = bucket switch
        {
            OperationalBucket.Payments => new PaymentRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Applicants => new ApplicantManagementRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Grades => new GradeOperationalRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Notifications => new NotificationRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Workflow => new WorkflowRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Committees => new CommitteeRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Exams => new ExamOperationalRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Biometric => new BiometricRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.AdmissionSetup => new AdmissionSetupRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            OperationalBucket.Reports => new ReportSnapshotRecordEntity { Module = module, Id = id, PayloadJson = "{}" },
            _ => throw new InvalidOperationException($"Unknown operational bucket '{bucket}'.")
        };
        Apply(row, payload, createdAt, updatedAt);
        return row;
    }

    private static void Apply(
        OperationalRecordEntity row,
        JsonObject payload,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt)
    {
        payload["id"] ??= row.Id;
        row.PayloadJson = payload.ToJsonString(AdminRecordJson.Options);
        row.ApplicantId = FirstString(payload, "applicantId", "applicant_id", "id");
        row.NationalId = FirstString(payload, "nationalId", "national_id", "nid");
        row.CycleId = FirstString(payload, "cycleId", "admissionCycleId", "cycle_id");
        row.CommitteeId = FirstString(payload, "committeeId", "committee_id");
        row.CategoryKey = FirstString(payload, "categoryKey", "categoryId", "applicantCategory", "category");
        row.Department = FirstString(payload, "department", "module");
        row.Status = FirstString(payload, "status", "paymentStatus", "result", "phase");
        row.Kind = FirstString(payload, "kind", "type", "action");
        row.OccurredAt = FirstInstant(payload, "timestamp", "ts", "occurredAt", "createdAt", "registeredAt", "date", "examDate");
        row.CreatedAt = createdAt;
        row.UpdatedAt = updatedAt;
    }

    private static JsonObject ToJson(OperationalRecordEntity row)
    {
        var payload = AdminRecordJson.Parse(row.PayloadJson);
        payload["id"] ??= row.Id;
        payload["createdAt"] ??= row.CreatedAt;
        payload["updatedAt"] ??= row.UpdatedAt;
        return payload;
    }

    private static string? FirstString(JsonObject payload, params string[] keys)
    {
        foreach (var key in keys)
        {
            var value = AdminRecordJson.StringProp(payload, key);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }
        return null;
    }

    private static DateTimeOffset? FirstInstant(JsonObject payload, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (!payload.TryGetPropertyValue(key, out var node) || node is null) continue;
            if (node is JsonValue value)
            {
                if (value.TryGetValue<long>(out var ms) && ms > 0)
                {
                    try { return DateTimeOffset.FromUnixTimeMilliseconds(ms); }
                    catch (ArgumentOutOfRangeException) { }
                }
                if (value.TryGetValue<string>(out var text) && DateTimeOffset.TryParse(text, out var parsed))
                {
                    return parsed;
                }
            }
        }
        return null;
    }

    private static OperationalBucket? BucketFor(string module)
    {
        if (module.StartsWith("admissionSetup.", StringComparison.Ordinal)) return OperationalBucket.AdmissionSetup;
        return module switch
        {
            "payments" => OperationalBucket.Payments,
            "applicants" or "relatives" or "acquaintance" => OperationalBucket.Applicants,
            "grades" => OperationalBucket.Grades,
            "notifications" => OperationalBucket.Notifications,
            "workflows" or "workflowTransitions" or "applicantWorkflowProgress" => OperationalBucket.Workflow,
            "committees" or "committeeInstances" or "committeeResults" => OperationalBucket.Committees,
            "examPlans" or "examResults" or "exam-attempts" or "exam-live-sessions" or "exam-committee-users" or "exam-devices" or "exam-audit" => OperationalBucket.Exams,
            "biometric-enrollments" or "biometric-verifications" or "biometric-gate-logs" or "biometric-audit" or "biometric-config" => OperationalBucket.Biometric,
            "committeeBindings" => OperationalBucket.AdmissionSetup,
            "kpis" or "last14Days" => OperationalBucket.Reports,
            _ => null
        };
    }

    private enum OperationalBucket
    {
        Payments,
        Applicants,
        Grades,
        Notifications,
        Workflow,
        Committees,
        Exams,
        Biometric,
        AdmissionSetup,
        Reports
    }
}
