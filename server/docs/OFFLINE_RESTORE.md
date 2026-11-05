# Offline / air-gapped `dotnet restore` for Night Watch server

## Online machine (once)

```powershell
cd server
dotnet restore NightWatch.sln --packages ./.nuget/packages
# optional: pack a zip of ./.nuget/packages + NuGet.config
```

## Air-gapped machine

```powershell
cd server
dotnet restore NightWatch.sln --source ./.nuget/packages --disable-parallel
dotnet build NightWatch.sln -c Release --no-restore
dotnet test NightWatch.sln -c Release --no-build
```

Use a `NuGet.config` that lists **only** the local folder (no nuget.org) on air-gapped hosts.

Runtime has **no** dependency on Fingerprint CDN/SaaS. Do not add package sources that pull vendor telemetry SDKs.
