namespace PACademy.Shared.Contracts;

/// <summary>Minimal current-actor surface used by the audit module — no dependency on Identity.</summary>
public interface ICurrentActor
{
    Guid Id { get; }
    string Name { get; }
    string IpAddress { get; }
}
