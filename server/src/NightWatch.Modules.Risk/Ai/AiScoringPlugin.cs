using System.Diagnostics;

namespace NightWatch.Modules.Risk.Ai;

public sealed record ModelContract(
    string ModelId,
    string Version,
    IReadOnlyList<string> FeatureNames,
    string Runtime); // mock | onnx_local | python_sidecar

public sealed record InferenceRequest(
    string TenantId,
    string ModelId,
    IReadOnlyDictionary<string, double> Features);

public sealed record InferenceResult(
    string Status, // scored | unavailable | unsupported | fallback
    double? Score,
    string ModelVersion,
    long LatencyMs,
    string? DriftFlag,
    string? BiasFlag,
    string Kind); // mock_baseline | never_claims_parity

public interface IInferenceBackend
{
    string Runtime { get; }
    InferenceResult Infer(ModelContract contract, IReadOnlyDictionary<string, double> features);
}

public sealed class MockInferenceBackend : IInferenceBackend
{
    public string Runtime => "mock";

    public InferenceResult Infer(ModelContract contract, IReadOnlyDictionary<string, double> features)
    {
        var sw = Stopwatch.StartNew();
        // Deterministic mock: average of present features clipped 0..1 — no GPU required
        double sum = 0;
        var n = 0;
        foreach (var name in contract.FeatureNames)
        {
            if (features.TryGetValue(name, out var v))
            {
                sum += Math.Clamp(v, 0, 1);
                n++;
            }
        }

        sw.Stop();
        if (n == 0)
        {
            return new InferenceResult("unavailable", null, contract.Version, sw.ElapsedMilliseconds, null, null, "mock_baseline");
        }

        return new InferenceResult("scored", sum / n, contract.Version, sw.ElapsedMilliseconds, DriftFlag: n < contract.FeatureNames.Count ? "partial_features" : null, BiasFlag: null, "mock_baseline");
    }
}

public sealed class AiScoringPluginHost
{
    private readonly Dictionary<string, (ModelContract Contract, IInferenceBackend Backend)> _models = new(StringComparer.Ordinal);
    private readonly IInferenceBackend _fallback;

    public AiScoringPluginHost(IInferenceBackend? fallback = null)
    {
        _fallback = fallback ?? new MockInferenceBackend();
        Register(new ModelContract("mock-risk", "mock-v1", ["bot", "velocity", "tamper"], "mock"), _fallback);
    }

    public void Register(ModelContract contract, IInferenceBackend backend) =>
        _models[contract.ModelId] = (contract, backend);

    public InferenceResult Score(InferenceRequest request)
    {
        if (!_models.TryGetValue(request.ModelId, out var entry))
        {
            return new InferenceResult("unsupported", null, "none", 0, null, null, "mock_baseline");
        }

        try
        {
            var result = entry.Backend.Infer(entry.Contract, request.Features);
            if (result.Status == "unavailable")
            {
                return _fallback.Infer(entry.Contract, request.Features) with { Status = "fallback", Kind = "mock_baseline" };
            }

            return result;
        }
        catch
        {
            return _fallback.Infer(entry.Contract, request.Features) with { Status = "fallback", Kind = "mock_baseline" };
        }
    }
}
