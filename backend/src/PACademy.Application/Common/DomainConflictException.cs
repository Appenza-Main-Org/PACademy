namespace PACademy.Application.Common;

public sealed class DomainConflictException : Exception
{
    public string Code { get; }

    public DomainConflictException(string message, string code = "CONFLICT")
        : base(message)
    {
        Code = code;
    }
}
