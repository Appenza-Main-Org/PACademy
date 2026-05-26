# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/PACademy.Applicant.slnx backend/PACademy.Applicant.slnx
COPY backend/shared/PACademy.Shared.Audit/PACademy.Shared.Audit.csproj backend/shared/PACademy.Shared.Audit/
COPY backend/shared/PACademy.Shared.Contracts/PACademy.Shared.Contracts.csproj backend/shared/PACademy.Shared.Contracts/
COPY backend/shared/PACademy.Shared.Domain/PACademy.Shared.Domain.csproj backend/shared/PACademy.Shared.Domain/
COPY backend/shared/PACademy.Shared.Persistence/PACademy.Shared.Persistence.csproj backend/shared/PACademy.Shared.Persistence/
COPY backend/shared/PACademy.Shared.Web/PACademy.Shared.Web.csproj backend/shared/PACademy.Shared.Web/
COPY backend/applicant/Modules/LookupsRead/PACademy.Modules.LookupsRead.Application/PACademy.Modules.LookupsRead.Application.csproj backend/applicant/Modules/LookupsRead/PACademy.Modules.LookupsRead.Application/
COPY backend/applicant/Modules/LookupsRead/PACademy.Modules.LookupsRead.Infrastructure/PACademy.Modules.LookupsRead.Infrastructure.csproj backend/applicant/Modules/LookupsRead/PACademy.Modules.LookupsRead.Infrastructure/
COPY backend/applicant/Modules/GradesRead/PACademy.Modules.GradesRead.Application/PACademy.Modules.GradesRead.Application.csproj backend/applicant/Modules/GradesRead/PACademy.Modules.GradesRead.Application/
COPY backend/applicant/Modules/GradesRead/PACademy.Modules.GradesRead.Infrastructure/PACademy.Modules.GradesRead.Infrastructure.csproj backend/applicant/Modules/GradesRead/PACademy.Modules.GradesRead.Infrastructure/
COPY backend/applicant/Modules/IdentityApplicant/PACademy.Modules.IdentityApplicant.Application/PACademy.Modules.IdentityApplicant.Application.csproj backend/applicant/Modules/IdentityApplicant/PACademy.Modules.IdentityApplicant.Application/
COPY backend/applicant/Modules/IdentityApplicant/PACademy.Modules.IdentityApplicant.Infrastructure/PACademy.Modules.IdentityApplicant.Infrastructure.csproj backend/applicant/Modules/IdentityApplicant/PACademy.Modules.IdentityApplicant.Infrastructure/
COPY backend/applicant/PACademy.Applicant.Api/PACademy.Applicant.Api.csproj backend/applicant/PACademy.Applicant.Api/

RUN dotnet restore backend/applicant/PACademy.Applicant.Api/PACademy.Applicant.Api.csproj

COPY backend backend
RUN dotnet publish backend/applicant/PACademy.Applicant.Api/PACademy.Applicant.Api.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

ENTRYPOINT ["sh", "-c", "dotnet PACademy.Applicant.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
