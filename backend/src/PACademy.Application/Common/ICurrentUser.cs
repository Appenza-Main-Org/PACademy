namespace PACademy.Application.Common;

public interface ICurrentUser
{
    Guid Id { get; }
    string Name { get; }
    string IpAddress { get; }
    bool IsAuthenticated { get; }
}
