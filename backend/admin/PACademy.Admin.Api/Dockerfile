# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/PACademy.Admin.slnx backend/PACademy.Admin.slnx
COPY backend/shared/PACademy.Shared.Audit/PACademy.Shared.Audit.csproj backend/shared/PACademy.Shared.Audit/
COPY backend/shared/PACademy.Shared.Contracts/PACademy.Shared.Contracts.csproj backend/shared/PACademy.Shared.Contracts/
COPY backend/shared/PACademy.Shared.Domain/PACademy.Shared.Domain.csproj backend/shared/PACademy.Shared.Domain/
COPY backend/shared/PACademy.Shared.Persistence/PACademy.Shared.Persistence.csproj backend/shared/PACademy.Shared.Persistence/
COPY backend/shared/PACademy.Shared.Web/PACademy.Shared.Web.csproj backend/shared/PACademy.Shared.Web/
COPY backend/admin/Modules/LookupsAdmin/PACademy.Modules.LookupsAdmin.Application/PACademy.Modules.LookupsAdmin.Application.csproj backend/admin/Modules/LookupsAdmin/PACademy.Modules.LookupsAdmin.Application/
COPY backend/admin/Modules/LookupsAdmin/PACademy.Modules.LookupsAdmin.Infrastructure/PACademy.Modules.LookupsAdmin.Infrastructure.csproj backend/admin/Modules/LookupsAdmin/PACademy.Modules.LookupsAdmin.Infrastructure/
COPY backend/admin/Modules/ApplicantGradesAdmin/PACademy.Modules.ApplicantGradesAdmin.Application/PACademy.Modules.ApplicantGradesAdmin.Application.csproj backend/admin/Modules/ApplicantGradesAdmin/PACademy.Modules.ApplicantGradesAdmin.Application/
COPY backend/admin/Modules/ApplicantGradesAdmin/PACademy.Modules.ApplicantGradesAdmin.Infrastructure/PACademy.Modules.ApplicantGradesAdmin.Infrastructure.csproj backend/admin/Modules/ApplicantGradesAdmin/PACademy.Modules.ApplicantGradesAdmin.Infrastructure/
COPY backend/admin/Modules/IdentityApplicantAdmin/PACademy.Modules.IdentityApplicantAdmin.Infrastructure/PACademy.Modules.IdentityApplicantAdmin.Infrastructure.csproj backend/admin/Modules/IdentityApplicantAdmin/PACademy.Modules.IdentityApplicantAdmin.Infrastructure/
COPY backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj backend/admin/PACademy.Admin.Api/

RUN dotnet restore backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj

COPY backend backend
RUN dotnet publish backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

ENTRYPOINT ["sh", "-c", "dotnet PACademy.Admin.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
