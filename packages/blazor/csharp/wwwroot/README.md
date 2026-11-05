# Night Watch Blazor static assets

Ship the published JS from `@night-watch/blazor` (or the IIFE from
`@night-watch/browser-sdk`) on your host, then call
`installNightWatchBlazorGlobal()` before using `NightWatchJs`.

Example in `index.html` / `App.razor`:

```html
<script type="module">
  import { installNightWatchBlazorGlobal } from '/_content/NightWatch.Blazor/night-watch-interop.js'
  installNightWatchBlazorGlobal()
</script>
```

Copy `packages/blazor/dist/interop.js` (after `pnpm build`) to
`wwwroot/night-watch-interop.js` in your RCL publish step, or serve the npm
package from your static files pipeline.
