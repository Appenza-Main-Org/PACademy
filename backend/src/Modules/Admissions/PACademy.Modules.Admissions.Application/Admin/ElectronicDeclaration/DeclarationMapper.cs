using PACademy.Modules.Admissions.Application.Dtos.AdmissionSetup;
using ElectronicDeclarationEntity = PACademy.Modules.Admissions.Domain.ElectronicDeclaration;

namespace PACademy.Modules.Admissions.Application.Admin.ElectronicDeclaration;

internal static class DeclarationMapper
{
    public static ElectronicDeclarationDto ToDto(ElectronicDeclarationEntity d)
        => new(d.Id, d.CycleId, d.BodyAr, d.Version, d.EffectiveFrom,
               d.PublishedAt, d.IsArchived, d.CreatedAt, d.CreatedBy,
               Convert.ToBase64String(d.RowVersion));
}
