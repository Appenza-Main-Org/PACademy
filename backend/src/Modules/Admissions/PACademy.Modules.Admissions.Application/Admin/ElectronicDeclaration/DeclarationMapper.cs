using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using PACademy.Modules.Admissions.Domain;
using ElectronicDeclarationEntity = PACademy.Modules.Admissions.Domain.ElectronicDeclaration;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

internal static class DeclarationMapper
{
    public static ElectronicDeclarationDto ToDto(ElectronicDeclarationEntity d)
    {
        var doc = d.DocumentRelativeUrl is null
            ? null
            : new DeclarationDocumentDto(
                d.DocumentFileName ?? string.Empty,
                d.DocumentRelativeUrl,
                d.DocumentSize ?? 0);
        return new(
            d.Id, d.CycleId,
            d.Mode.ToString().ToLowerInvariant(),
            d.BodyAr, doc,
            d.Version, d.EffectiveFrom,
            d.PublishedAt, d.IsArchived, d.CreatedAt, d.CreatedBy,
            Convert.ToBase64String(d.RowVersion));
    }

    public static DeclarationMode ParseMode(string raw)
        => raw.ToLowerInvariant() switch
        {
            "text" => DeclarationMode.Text,
            "pdf" => DeclarationMode.Pdf,
            _ => throw new ArgumentException($"Unknown declaration mode: {raw}"),
        };
}
