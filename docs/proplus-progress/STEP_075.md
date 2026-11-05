# STEP 075 — Rules DSL and no-code policy evaluation

**Date:** 2026-11-04
**Status:** **IMPLEMENTED/VALIDATED** (RulesDslTests Passed 2).

## Changed files
- `server/src/NightWatch.Modules.Risk/Rules/RulesDsl.cs`
- `server/tests/NightWatch.Api.Tests/RulesDslTests.cs`
- `server/src/NightWatch.Modules.Risk/RiskModule.cs`

## Implemented
- Typed AST (AND/OR/NOT/CMP); no eval
- Actions: allow/log/observe/challenge/manual_review/deny; dry-run + simulate
- Field allow-list; injection blocked; priority; scope; rollback

## Tests
```
dotnet test --filter FullyQualifiedName~RulesDslTests
# Passed 2
```

## Next
STEP 076
