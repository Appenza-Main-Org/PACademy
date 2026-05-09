namespace PACademy.Modules.Admissions.Application.Dtos;

public sealed record OpenCategoryEntryDto(bool IsOpen, int? Capacity, string? Notes);
