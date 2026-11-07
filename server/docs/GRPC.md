# Night Watch gRPC

Same backend as HTTP (`/v1/identify*`, `/v1/sealed/unseal`). Other services (e.g. Hermes) can call either transport.

## Endpoint

- Default lab: `http://127.0.0.1:5221` (HTTP/1.1 + HTTP/2 cleartext)
- Service: `nightwatch.v1.NightWatchIdentity`
- Proto: [`../src/NightWatch.Api/Protos/night_watch_v1.proto`](../src/NightWatch.Api/Protos/night_watch_v1.proto)

| RPC | HTTP twin |
|---|---|
| `Health` | `GET /health/live` |
| `GetMeta` | `GET /v1/meta` |
| `Challenge` | `POST /v1/identify/challenge` |
| `Identify` | `POST /v1/identify` |
| `Unseal` | `POST /v1/sealed/unseal` |
| `HashComponents` | `POST /v1/lab/hash-components` |

## .NET client (minimal)

```csharp
using Grpc.Net.Client;
using NightWatch.Api.Grpc.V1; // generated from night_watch_v1.proto

var channel = GrpcChannel.ForAddress("http://127.0.0.1:5221");
var client = new NightWatchIdentity.NightWatchIdentityClient(channel);

var chal = await client.ChallengeAsync(new ChallengeRequest
{
    TenantId = "ten_demo",
    ProjectId = "prj_demo"
});

var id = await client.IdentifyAsync(new IdentifyRequest
{
    SchemaVersion = "night-watch-identify-v1",
    ProductCode = "night-watch",
    Purpose = "fraud_prevention",
    ConsentStatus = "granted",
    CollectedAt = DateTimeOffset.UtcNow.ToString("O"),
    IdempotencyKey = Guid.NewGuid().ToString("N"),
    TenantId = "ten_demo",
    ProjectId = "prj_demo",
    ChallengeNonce = chal.ChallengeNonce,
    SealAudience = "customer-backend",
    LegacyBrowser = new LegacyBrowser
    {
        VisitorId = visitorIdFromSdk,
        SourceManifestRevision = "default-v1",
        HashingRevision = "murmur3-x64-128-canonical-v1",
        ComponentsJson = componentsJsonFromSdk // same JSON object as HTTP
    }
});
// id.SealedEnvelope → verify with Unseal on your backend
```

**Preferred for .NET consumers:** reference project `NightWatch.Grpc.Contracts` (client stub already generated).

Or copy the `.proto` into the consumer and generate a client (`GrpcServices="Client"`).

## Notes

- Identify still requires challenge + real `components` + `visitorId == hashComponents(components)`.
- `Unseal` consumes the envelope nonce by default; set `skip_consume=true` only for lab re-reads.
- Trust boundary unchanged: sealed envelope proves Night Watch issued the result — not absolute browser honesty.
- Development enables gRPC reflection (`grpc_cli` / BloomRPC / Postman).
