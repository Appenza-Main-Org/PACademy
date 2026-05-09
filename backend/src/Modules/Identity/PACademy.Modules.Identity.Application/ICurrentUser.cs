namespace PACademy.Modules.Identity.Application;

public interface ICurrentUser
{
    Guid Id { get; }
    string Name { get; }
    string IpAddress { get; }
    string Role { get; }
    IReadOnlyList<string> Apps { get; }
    bool IsAuthenticated { get; }
}
