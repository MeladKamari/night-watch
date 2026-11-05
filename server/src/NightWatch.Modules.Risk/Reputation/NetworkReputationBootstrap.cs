using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NightWatch.Modules.Risk.Reputation;

/// <summary>
/// Seeds signed offline reputation bundles (lab + Iran production-shaped). No runtime SaaS fetch.
/// </summary>
public static class NetworkReputationBootstrap
{
    public static FeedImportResult SeedAll(AsnReputationStore store, string signingKey, DateTimeOffset now)
    {
        var lab = SeedBundle(store, signingKey, now, "lab_synthetic_v1", LabRecords(now));
        var ir = SeedBundle(store, signingKey, now, "offline_feed_v1", OfflineFeedRecords(now));
        return new FeedImportResult(
            lab.Accepted && ir.Accepted,
            ir.Accepted ? ir.Status : lab.Status,
            lab.RecordCount + ir.RecordCount,
            lab.Conflicts.Concat(ir.Conflicts).ToList());
    }

    public static FeedImportResult SeedLabBundle(AsnReputationStore store, string signingKey, DateTimeOffset now) =>
        SeedBundle(store, signingKey, now, "lab_synthetic_v1", LabRecords(now));

    private static FeedImportResult SeedBundle(
        AsnReputationStore store,
        string signingKey,
        DateTimeOffset now,
        string license,
        List<ReputationRecord> records)
    {
        var json = JsonSerializer.Serialize(records);
        var sig = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.UTF8.GetBytes(json)))
            .ToLowerInvariant();
        return store.ImportSignedBundle(json, sig, license, now);
    }

    private static List<ReputationRecord> LabRecords(DateTimeOffset now)
    {
        var expires = now.AddDays(30);
        return
        [
            new("ip:203.0.113.10", "vpn", "lab_vpn_exit", expires, "lab_synthetic_v1"),
            new("ip:198.51.100.20", "tor", "lab_tor_exit", expires, "lab_synthetic_v1"),
            new("ip:192.0.2.30", "proxy", "lab_open_proxy", expires, "lab_synthetic_v1"),
            new("ip:192.0.2.40", "dc", "lab_datacenter", expires, "lab_synthetic_v1"),
            new("ip:192.0.2.50", "abuse", "lab_blocklisted", expires, "lab_synthetic_v1"),
            new("ip:192.0.2.60", "country", "geo:zz-lab", expires, "lab_synthetic_v1"),
            new("asn:8075", "dc", "microsoft_azure_lab", expires, "lab_synthetic_v1"),
            new("asn:16509", "dc", "amazon_aws_lab", expires, "lab_synthetic_v1"),
            new("asn:12345", "ir_operator", "iran_operator_metadata_only", expires, "lab_synthetic_v1"),
            new("tag:tor", "tor", "tor_network_tag", expires, "lab_synthetic_v1")
        ];
    }

    private static List<ReputationRecord> OfflineFeedRecords(DateTimeOffset now)
    {
        var expires = now.AddDays(90);
        var list = new List<ReputationRecord>
        {
            // IR operators — metadata only (never guilt)
            new("asn:197207", "ir_operator", "mci_hamrah_aval", expires, "offline_feed_v1"),
            new("asn:44244", "ir_operator", "irancell", expires, "offline_feed_v1"),
            new("asn:58224", "ir_operator", "tci", expires, "offline_feed_v1"),
            new("asn:12880", "ir_operator", "itc", expires, "offline_feed_v1"),
            new("asn:39501", "ir_operator", "shatel", expires, "offline_feed_v1"),
            new("asn:50810", "ir_operator", "mobinnet", expires, "offline_feed_v1"),
            new("asn:56402", "ir_operator", "asiatech", expires, "offline_feed_v1"),
            new("asn:25124", "cellular", "ir_cellular_sample", expires, "offline_feed_v1"),
            // Coarse geo samples
            new("ip:5.52.0.1", "country", "geo:ir-tehran", expires, "offline_feed_v1"),
            new("ip:31.7.0.1", "country", "geo:ir-isfahan", expires, "offline_feed_v1"),
            new("ip:2.176.0.1", "country", "geo:ir-mashhad", expires, "offline_feed_v1"),
            new("ip:5.232.0.1", "country", "geo:ir-shiraz", expires, "offline_feed_v1"),
            new("ip:37.254.0.1", "country", "geo:ir-tabriz", expires, "offline_feed_v1"),
            new("ip:78.38.0.1", "country", "geo:ir-ahvaz", expires, "offline_feed_v1"),
            new("ip:91.98.0.1", "country", "geo:ir-karaj", expires, "offline_feed_v1"),
            // VPN / Tor / proxy / DC curated offline samples
            new("ip:185.220.101.1", "tor", "tor_exit_sample", expires, "offline_feed_v1"),
            new("ip:185.220.102.1", "tor", "tor_exit_sample_b", expires, "offline_feed_v1"),
            new("ip:45.9.148.1", "vpn", "vpn_exit_sample", expires, "offline_feed_v1"),
            new("ip:37.19.224.1", "vpn", "vpn_exit_sample_b", expires, "offline_feed_v1"),
            new("ip:89.187.160.1", "vpn", "vpn_exit_sample_c", expires, "offline_feed_v1"),
            new("ip:104.16.0.1", "dc", "cdn_edge_sample", expires, "offline_feed_v1"),
            new("ip:1.1.1.1", "dc", "public_resolver_dc_sample", expires, "offline_feed_v1"),
            new("ip:8.8.8.8", "dc", "public_resolver_dc_sample", expires, "offline_feed_v1"),
            new("ip:9.9.9.9", "dc", "public_resolver_dc_sample", expires, "offline_feed_v1"),
            new("ip:208.67.222.222", "dc", "public_resolver_dc_sample", expires, "offline_feed_v1"),
            new("ip:64.233.160.1", "dc", "google_dc_sample", expires, "offline_feed_v1"),
            new("ip:13.32.0.1", "dc", "aws_cloudfront_sample", expires, "offline_feed_v1"),
            new("ip:20.190.0.1", "dc", "azure_sample", expires, "offline_feed_v1"),
            new("ip:35.186.0.1", "dc", "gcp_sample", expires, "offline_feed_v1"),
            new("ip:45.33.0.1", "proxy", "linode_open_proxy_sample", expires, "offline_feed_v1"),
            // Abuse blocklist samples
            new("ip:198.51.100.99", "abuse", "spam_botnet_sample", expires, "offline_feed_v1"),
            new("ip:203.0.113.99", "abuse", "credential_stuffing_sample", expires, "offline_feed_v1"),
            new("ip:198.51.100.88", "abuse", "scanner_sample", expires, "offline_feed_v1"),
            new("ip:203.0.113.77", "abuse", "bruteforce_sample", expires, "offline_feed_v1"),
            new("asn:9009", "vpn", "m247_vpn_hosting_sample", expires, "offline_feed_v1"),
            new("asn:16276", "dc", "ovh_dc_sample", expires, "offline_feed_v1"),
            new("asn:24940", "dc", "hetzner_dc_sample", expires, "offline_feed_v1"),
            new("asn:14061", "dc", "digitalocean_dc_sample", expires, "offline_feed_v1"),
            new("asn:13335", "dc", "cloudflare_dc_sample", expires, "offline_feed_v1"),
            new("asn:15169", "dc", "google_dc_sample", expires, "offline_feed_v1"),
            new("asn:16509", "dc", "amazon_aws_sample", expires, "offline_feed_v1"),
            new("asn:8075", "dc", "microsoft_azure_sample", expires, "offline_feed_v1")
        };

        // Dense /24 documentation samples for lab replay (not live crawl).
        for (var i = 1; i <= 20; i++)
        {
            list.Add(new($"ip:203.0.113.{100 + i}", "abuse", $"abuse_lab_block_{i}", expires, "offline_feed_v1"));
            list.Add(new($"ip:198.51.100.{100 + i}", "vpn", $"vpn_lab_exit_{i}", expires, "offline_feed_v1"));
        }

        return list;
    }
}
