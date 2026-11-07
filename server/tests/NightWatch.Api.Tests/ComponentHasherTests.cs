using System.Text.Json;
using NightWatch.BuildingBlocks.Hashing;

namespace NightWatch.Api.Tests;

public class ComponentHasherTests
{
    [Theory]
    [InlineData("", 0, "00000000000000000000000000000000")]
    [InlineData("hello", 0, "cbd8a7b341bd9b025b1e906a48ae1d19")]
    [InlineData("Hello", 0, "35b974ff55d4c41ca000eacf29125544")]
    [InlineData("hello", 1, "a78ddff5adae8d10128900ef20900135")]
    [InlineData("fa-IR", 0, "899d6b72fda82524f7296a27c75aa181")]
    [InlineData("Asia/Tehran", 0, "4463cd6b2354f11aaa1f9e22a699dbea")]
    public void Murmur_matches_golden_vectors(string input, int seed, string expected)
    {
        Assert.Equal(expected, MurmurHash3X64.Hash128(input, seed));
    }

    [Fact]
    public void Components_sample_matches_golden_hash()
    {
        using var doc = JsonDocument.Parse("""
            {"a":{"value":"x","duration":1},"b":{"value":1,"duration":2}}
            """);
        Assert.Equal("a:\"x\"|b:1", ComponentHasher.ComponentsToCanonicalString(doc.RootElement));
        Assert.Equal("b0a3ed33df2bfd9f8ead1eebe9d2cf99", ComponentHasher.HashComponents(doc.RootElement));
    }

    [Fact]
    public void Components_error_null_matches_golden_hash()
    {
        using var doc = JsonDocument.Parse("""
            {"a":{"value":null,"duration":0},"z":{"error":{"message":"e"},"duration":1}}
            """);
        Assert.Equal("a:null|z:error", ComponentHasher.ComponentsToCanonicalString(doc.RootElement));
        Assert.Equal("16fed7428df994fb38b63c173b7b39f9", ComponentHasher.HashComponents(doc.RootElement));
    }
}
