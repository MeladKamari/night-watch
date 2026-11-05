# syntax=docker/dockerfile:1.7
# Night Watch API — multi-stage, pinned base digests preferred over floating tags in prod.
ARG DOTNET_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY NuGet.config ./
COPY NightWatch.sln ./
COPY src/ ./src/
COPY tests/ ./tests/
RUN dotnet restore NightWatch.sln
RUN dotnet publish src/NightWatch.Api/NightWatch.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_EnableDiagnostics=0
RUN useradd --create-home --uid 10001 appuser
COPY --from=build /app/publish .
USER 10001
EXPOSE 8080
ENTRYPOINT ["dotnet", "NightWatch.Api.dll"]
