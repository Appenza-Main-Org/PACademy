using System.Reflection;
using FluentAssertions;
using PACademy.Contracts.Admin.Cycles;

namespace PACademy.Api.Tests.Audit;

/// <summary>
/// Spec 009 T099 — asserts that every field exposed on the cycle read DTOs has
/// a write path on AdminCyclesController (or is explicitly allow-listed as
/// system-managed / computed).
///
/// Fails if a new read property is added to <see cref="CycleDetailDto"/> or
/// <see cref="CycleListItemDto"/> without a matching write path. Forces the
/// next contributor to either wire the field into a request DTO or document
/// it as read-only via the allow-list.
///
/// This is a pure-reflection test — no DB / HTTP / hosting required.
/// </summary>
public sealed class CycleEndpointsCoverageTests
{
    /// <summary>
    /// Read-only / system-managed properties that intentionally have no write
    /// path. Adding to this list requires a justification comment.
    /// </summary>
    private static readonly HashSet<string> CycleDetailReadOnlyAllowList = new(StringComparer.Ordinal)
    {
        "Id",              // immutable primary key
        "ApplicantCount",  // computed from joined applicant rows
        "CreatedAt",       // system timestamp set on Create
        "ArchivedAt",      // system timestamp set by /status transition to Archived
        "RowVersion",      // SQL Server rowversion; auto-managed, surfaced for optimistic-locking only
    };

    private static readonly HashSet<string> CycleListReadOnlyAllowList = new(StringComparer.Ordinal)
    {
        "Id",
        "ApplicantCount",
        "RowVersion",      // SQL Server rowversion
    };

    /// <summary>
    /// Aliases that bridge a read-DTO property name to a differently-named
    /// write-DTO property. Status on the read side maps to NewStatus on
    /// <see cref="TransitionCycleStatusRequest"/>.
    /// </summary>
    private static readonly Dictionary<string, string> WriteAliases = new(StringComparer.Ordinal)
    {
        ["Status"] = "NewStatus",
    };

    [Fact]
    public void CycleDetailDto_EveryReadPropertyHasWritePathOrIsAllowListed()
    {
        var readProps = PropertyNames(typeof(CycleDetailDto));
        var writeProps = WritePropertyNames();

        var uncovered = readProps
            .Where(name => !CycleDetailReadOnlyAllowList.Contains(name))
            .Where(name => !writeProps.Contains(ResolveWriteName(name)))
            .ToList();

        uncovered.Should().BeEmpty(
            "every CycleDetailDto property must either have a write path on " +
            "AdminCyclesController or be explicitly allow-listed as read-only");
    }

    [Fact]
    public void CycleListItemDto_EveryReadPropertyHasWritePathOrIsAllowListed()
    {
        var readProps = PropertyNames(typeof(CycleListItemDto));
        var writeProps = WritePropertyNames();

        var uncovered = readProps
            .Where(name => !CycleListReadOnlyAllowList.Contains(name))
            .Where(name => !writeProps.Contains(ResolveWriteName(name)))
            .ToList();

        uncovered.Should().BeEmpty(
            "every CycleListItemDto property must either have a write path on " +
            "AdminCyclesController or be explicitly allow-listed as read-only");
    }

    [Fact]
    public void CycleDetailReadOnlyAllowList_AllNamesExistOnDetailDto()
    {
        var actual = PropertyNames(typeof(CycleDetailDto));
        var stale = CycleDetailReadOnlyAllowList.Except(actual).ToList();

        stale.Should().BeEmpty(
            "allow-list entries must point at real CycleDetailDto properties; " +
            "remove stale entries when the underlying property is renamed or deleted");
    }

    [Fact]
    public void CycleListReadOnlyAllowList_AllNamesExistOnListDto()
    {
        var actual = PropertyNames(typeof(CycleListItemDto));
        var stale = CycleListReadOnlyAllowList.Except(actual).ToList();

        stale.Should().BeEmpty(
            "allow-list entries must point at real CycleListItemDto properties");
    }

    private static string ResolveWriteName(string readName) =>
        WriteAliases.TryGetValue(readName, out var aliased) ? aliased : readName;

    private static HashSet<string> WritePropertyNames() => new(
        PropertyNames(typeof(CreateCycleRequest))
            .Concat(PropertyNames(typeof(UpdateCycleRequest)))
            .Concat(PropertyNames(typeof(TransitionCycleStatusRequest))),
        StringComparer.Ordinal);

    private static IEnumerable<string> PropertyNames(Type t) =>
        t.GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(p => p.Name);
}
