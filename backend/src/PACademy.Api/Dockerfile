FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/PACademy.Api/PACademy.Api.csproj", "src/PACademy.Api/"]
COPY ["src/PACademy.Application/PACademy.Application.csproj", "src/PACademy.Application/"]
COPY ["src/PACademy.Domain/PACademy.Domain.csproj", "src/PACademy.Domain/"]
COPY ["src/PACademy.Infrastructure/PACademy.Infrastructure.csproj", "src/PACademy.Infrastructure/"]
COPY ["src/PACademy.Contracts/PACademy.Contracts.csproj", "src/PACademy.Contracts/"]
RUN dotnet restore "src/PACademy.Api/PACademy.Api.csproj"
COPY . .
WORKDIR "/src/src/PACademy.Api"
RUN dotnet build "PACademy.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "PACademy.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "PACademy.Api.dll"]
