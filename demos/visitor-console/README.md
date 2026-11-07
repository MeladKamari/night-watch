# Night Watch — Visitor Console

Standalone demo that installs **published** npm packages (not workspace links):

- `@thenightwatch/vanilla`
- `@thenightwatch/browser-sdk`

## Run

```bash
cd demos/visitor-console
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5177`).

## What it does

Calls `createNightWatchClient().identify()` and shows the visitor id plus SDK metadata.
