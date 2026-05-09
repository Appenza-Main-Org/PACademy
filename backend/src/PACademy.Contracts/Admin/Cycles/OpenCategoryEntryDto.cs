namespace PACademy.Contracts.Admin.Cycles;

public sealed record OpenCategoryEntryDto(bool IsOpen, int? Capacity, string? Notes);
