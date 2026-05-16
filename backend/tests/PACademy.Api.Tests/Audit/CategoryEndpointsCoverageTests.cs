using System.Reflection;
using FluentAssertions;
using PACademy.Contracts.Admin.Categories;

namespace PACademy.Api.Tests.Audit;

/// <summary>
/// Spec 009 T100 — asserts that every field exposed on the category read DTOs
/// has a write path on AdminCategoriesController (or is explicitly allow-
/// listed as system-managed / computed).
///
/// Fails if a new read property is added to <see cref="CategoryDetailDto"/>
/// or <see cref="CategoryListItemDto"/> without a matching write path. Forces
/// the next contributor to either wire the field into a request DTO or
/// document it as read-only via the allow-list.
///
/// Pure-reflection test — no DB / HTTP / hosting required.
/// </summary>
public sealed class CategoryEndpointsCoverageTests
{
    /// <summary>
    /// Read-only / system-managed properties that intentionally have no write
    /// path. Adding to this list requires a justification comment.
    /// </summary>
    private static readonly HashSet<string> CategoryDetailReadOnlyAllowList = new(StringComparer.Ordinal)
    {
        "Id",          // immutable primary key
        "CreatedAt",   // system timestamp set on Create
        "UpdatedAt",   // system timestamp set on Update
        "IsSpec",      // system flag set during seed; locks delete + labelAr edit
        "DemoOrigin",  // system flag set by the demo seeder, never user-writable
        "RowVersion",  // SQL Server rowversion; auto-managed, surfaced for optimistic-locking only
    };

    private static readonly HashSet<string> CategoryListReadOnlyAllowList = new(StringComparer.Ordinal)
    {
        "Id",
        "IsSpec",
        "RowVersion",  // SQL Server rowversion
    };

    [Fact]
    public void CategoryDetailDto_EveryReadPropertyHasWritePathOrIsAllowListed()
    {
        var readProps = PropertyNames(typeof(CategoryDetailDto));
        var writeProps = WritePropertyNames();

        var uncovered = readProps
            .Where(name => !CategoryDetailReadOnlyAllowList.Contains(name))
            .Where(name => !writeProps.Contains(name))
            .ToList();

        uncovered.Should().BeEmpty(
            "every CategoryDetailDto property must either have a write path on " +
            "AdminCategoriesController or be explicitly allow-listed as read-only");
    }

    [Fact]
    public void CategoryListItemDto_EveryReadPropertyHasWritePathOrIsAllowListed()
    {
        var readProps = PropertyNames(typeof(CategoryListItemDto));
        var writeProps = WritePropertyNames();

        var uncovered = readProps
            .Where(name => !CategoryListReadOnlyAllowList.Contains(name))
            .Where(name => !writeProps.Contains(name))
            .ToList();

        uncovered.Should().BeEmpty(
            "every CategoryListItemDto property must either have a write path " +
            "on AdminCategoriesController or be explicitly allow-listed as read-only");
    }

    [Fact]
    public void CategoryDetailReadOnlyAllowList_AllNamesExistOnDetailDto()
    {
        var actual = PropertyNames(typeof(CategoryDetailDto));
        var stale = CategoryDetailReadOnlyAllowList.Except(actual).ToList();

        stale.Should().BeEmpty(
            "allow-list entries must point at real CategoryDetailDto properties");
    }

    [Fact]
    public void CategoryListReadOnlyAllowList_AllNamesExistOnListDto()
    {
        var actual = PropertyNames(typeof(CategoryListItemDto));
        var stale = CategoryListReadOnlyAllowList.Except(actual).ToList();

        stale.Should().BeEmpty(
            "allow-list entries must point at real CategoryListItemDto properties");
    }

    private static HashSet<string> WritePropertyNames() => new(
        PropertyNames(typeof(CreateCategoryRequest))
            .Concat(PropertyNames(typeof(UpdateCategoryRequest))),
        StringComparer.Ordinal);

    private static IEnumerable<string> PropertyNames(Type t) =>
        t.GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(p => p.Name);
}
