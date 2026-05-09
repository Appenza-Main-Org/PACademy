using Microsoft.AspNetCore.Identity;

namespace PACademy.Modules.Identity.Domain;

/// <summary>
/// ASP.NET Core Identity user. UserName is set to NationalId (plan research §12)
/// so SignInManager.PasswordSignInAsync works without a custom UserStore.
/// </summary>
public sealed class SystemUser : IdentityUser<Guid>
{
    // FR-029 required profile fields
    public string NationalId
    {
        get => UserName ?? string.Empty;
        set => UserName = value;
    }

    public string OfficerCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    // Email is inherited from IdentityUser
    public bool IsActive { get; set; } = true;
    public DateTime IssueDate { get; set; }
    public string CardFactoryNumber { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? Unit { get; set; }

    // Soft-delete
    public bool Archived { get; set; }
    public DateTime? ArchivedAt { get; set; }

    // Permanent provenance — never updated after first seed/create
    public bool DemoOrigin { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
