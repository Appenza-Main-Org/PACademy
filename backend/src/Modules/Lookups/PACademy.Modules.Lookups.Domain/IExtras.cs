namespace PACademy.Modules.Lookups.Domain;

/// <summary>
/// Marker for per-type-code extras POCOs serialized into the lookup_items.extras
/// JSON column. Each LookupKey has a corresponding implementation
/// (e.g., RelationshipExtras, GovernorateExtras) in LookupItemExtras/.
/// </summary>
public interface IExtras
{
}
