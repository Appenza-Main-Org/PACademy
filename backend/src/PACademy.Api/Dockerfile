FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Copy the full backend tree so transitive ProjectReferences to
# Shared/* and Modules/* resolve during restore.
COPY . .
RUN dotnet restore "src/PACademy.Api/PACademy.Api.csproj"
RUN dotnet publish "src/PACademy.Api/PACademy.Api.csproj" \
    -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "PACademy.Api.dll"]
