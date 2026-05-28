FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY DResume.Api.csproj ./
RUN dotnet restore DResume.Api.csproj
COPY . .
RUN dotnet publish DResume.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
RUN mkdir -p /root/.aspnet/DataProtection-Keys
ENV ASPNETCORE_URLS=http://+:5267
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5267
HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:5267/api/billing/plans || exit 1
ENTRYPOINT ["dotnet", "DResume.Api.dll"]
