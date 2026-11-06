# NightWatch.Blazor

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/MeladKamari/night-watch@v1.0.0/branding/derived/night-watch-icon-192.png" alt="Night Watch" width="72" />
</p>

Blazor / .NET package for **Night Watch** visitor identification.

## Install (NuGet)

```bash
dotnet add package NightWatch.Blazor
```

> The JS helpers under `packages/blazor` are build/internal only. **Do not** use the npm package `@thenightwatch/blazor` for app installs — use this NuGet package.

## Usage

1. Load the Night Watch interop script (bundle `packages/blazor/dist/interop.js` after `pnpm build`, or serve `@thenightwatch/browser-sdk` IIFE + call `installNightWatchBlazorGlobal()`).
2. Inject `NightWatchJs` and call `IdentifyAsync()`.

```csharp
@inject NightWatch.Blazor.NightWatchJs NightWatch

var result = await NightWatch.IdentifyAsync();
@result.VisitorId
```

Part of **Night Watch** — see the [root README](../../README.md) and [branding kit](../../branding/).
