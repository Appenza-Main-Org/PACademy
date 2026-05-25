FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src
COPY global.json ./
COPY backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj backend/admin/PACademy.Admin.Api/
COPY backend/shared/PACademy.Shared.Contracts/PACademy.Shared.Contracts.csproj backend/shared/PACademy.Shared.Contracts/
COPY backend/shared/PACademy.Shared.Audit/PACademy.Shared.Audit.csproj backend/shared/PACademy.Shared.Audit/
RUN dotnet restore backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj

COPY backend backend
RUN dotnet publish backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "PACademy.Admin.Api.dll"]
