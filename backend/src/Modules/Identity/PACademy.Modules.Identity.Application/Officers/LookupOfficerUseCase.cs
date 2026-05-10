using PACademy.Shared.Audit.Domain;
using PACademy.Shared.Audit.Public;

namespace PACademy.Modules.Identity.Application.Officers;

public sealed class LookupOfficerUseCase(IOfficerLookup officerLookup, IAuditApi audit)
{
    public async Task<(OfficerRecord? Record, bool Unavailable)> ExecuteAsync(
        string nationalId, string officerCode, Guid actorId, CancellationToken ct = default)
    {
        var targetLabel = $"{nationalId}/{officerCode}";

        try
        {
            var record = await officerLookup.LookupAsync(nationalId, officerCode, ct);

            var outcome = record is not null ? AuditOutcome.Success : AuditOutcome.NotFound;
            await audit.RecordAsync(
                AuditAction.OfficerLookedUp, "officer", actorId, targetLabel,
                outcome, ct: ct);

            return (record, false);
        }
        catch (OfficerLookupUnavailableException)
        {
            await audit.RecordAsync(
                AuditAction.OfficerLookedUp, "officer", actorId, targetLabel,
                AuditOutcome.Failure, ct: ct);
            return (null, true);
        }
    }
}
