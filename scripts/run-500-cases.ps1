# Night Watch — 500-case lab harness (identify + decisions)
param(
    [string]$BaseUrl = "http://127.0.0.1:5080",
    [int]$Count = 500
)

function New-Id([int]$Len = 12) {
    -join ((1..$Len) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
}

function New-Salt { [guid]::NewGuid().ToString("N").Substring(0, 16) }

function Invoke-JsonPost([string]$Path, $Body, [hashtable]$Headers = @{}) {
    $uri = "$BaseUrl$Path"
    $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 12 -Compress }
    $hdr = @{}
    foreach ($k in $Headers.Keys) { $hdr[$k] = [string]$Headers[$k] }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri $uri -Method Post -ContentType "application/json; charset=utf-8" `
            -Headers $hdr -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -UseBasicParsing -TimeoutSec 30
        $sw.Stop()
        $parsed = $null
        try { $parsed = $resp.Content | ConvertFrom-Json } catch {}
        return @{ ok = $true; status = [int]$resp.StatusCode; ms = $sw.ElapsedMilliseconds; body = $parsed; error = $null }
    }
    catch {
        $sw.Stop()
        $status = 0
        if ($_.Exception.Response) { try { $status = [int]$_.Exception.Response.StatusCode } catch {} }
        return @{ ok = $false; status = $status; ms = $sw.ElapsedMilliseconds; body = $null; error = $_.Exception.Message }
    }
}

function New-Device([string]$Variant = "common") {
    switch ($Variant) {
        "mac" {
            return @{
                platform = "MacIntel"; osFamily = "macOS"; browserFamily = "Safari"
                locale = "en-US"; screenWidth = 1440; screenHeight = 900; webGlRenderer = "Apple M1"
            }
        }
        "android" {
            return @{
                platform = "Linux armv8l"; osFamily = "Android"; browserFamily = "Chrome"
                locale = "fa-IR"; screenWidth = 412; screenHeight = 915; webGlRenderer = "Adreno"
            }
        }
        default {
            return @{
                platform = "Win32"; osFamily = "Windows"; browserFamily = "Chrome"
                locale = "fa-IR"; screenWidth = 1920; screenHeight = 1080; webGlRenderer = "ANGLE (NVIDIA)"
            }
        }
    }
}

function New-Fingerprint([string]$Salt) {
    $components = [ordered]@{
        audio    = @{ value = $Salt.Length; duration = 1 }
        canvas   = @{ value = "c-$Salt"; duration = 1 }
        fonts    = @{ value = @("Arial", $Salt); duration = 1 }
        platform = @{ value = $Salt; duration = 1 }
        timezone = @{ value = "Asia/Tehran"; duration = 1 }
    }
    $hashRes = Invoke-JsonPost "/v1/lab/hash-components" @{ components = $components }
    if (-not $hashRes.ok) { throw "hash-components failed: $($hashRes.status) $($hashRes.error)" }
    return @{
        salt = $Salt
        visitorId = [string]$hashRes.body.visitorId
        components = $components
        keys = @($components.Keys)
    }
}

function New-Challenge([string]$Tenant) {
    $r = Invoke-JsonPost "/v1/identify/challenge" @{ tenantId = $Tenant; projectId = "prj_case500" }
    if (-not $r.ok) { throw "challenge failed: $($r.status) $($r.error)" }
    return [string]$r.body.challengeNonce
}

function New-IdentifyBody($fp, $idem, $tenant, $device, $token = $null, $probes = $null) {
    $chal = New-Challenge $tenant
    $b = [ordered]@{
        schemaVersion = "night-watch-identify-v1"
        productCode = "night-watch"
        purpose = "fraud_prevention"
        consentStatus = "granted"
        collectedAt = (Get-Date).ToUniversalTime().ToString("o")
        idempotencyKey = $idem
        tenantId = $tenant
        projectId = "prj_case500"
        region = "ir-central"
        challengeNonce = $chal
        continuityLegalBasis = "legitimate_interest"
        clientDevice = $device
        legacyBrowser = @{
            visitorId = $fp.visitorId
            sourceManifestRevision = "default-v1"
            hashingRevision = "murmur3-x64-128-canonical-v1"
            componentKeys = @($fp.keys)
            components = $fp.components
        }
    }
    if ($token) { $b["continuityToken"] = $token }
    if ($probes) { $b["environmentProbes"] = $probes }
    return $b
}

$tenant = "ten_case500"
Write-Host "Warmup: calibration + rematch seeds..."
[void](Invoke-JsonPost "/v1/lab/calibration/run" @{ tenantId = $tenant; activate = $true })

$rematchPool = New-Object System.Collections.Generic.List[object]
$variants = @("common", "mac", "android")
for ($i = 0; $i -lt 40; $i++) {
    $fp = New-Fingerprint (New-Salt)
    $idem = "seed-" + (New-Id)
    $dev = New-Device $variants[$i % 3]
    $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $fp $idem $tenant $dev) @{ "Idempotency-Key" = $idem }
    if ($r.ok -and $r.body) {
        $rematchPool.Add([pscustomobject]@{
            fp = $fp; visitorId = [string]$r.body.visitorId; device = $dev; token = [string]$r.body.continuity.token
        }) | Out-Null
    }
}
if ($rematchPool.Count -lt 5) { throw "rematch seed failed: $($rematchPool.Count)" }

# Warm rare-device population
for ($w = 0; $w -lt 25; $w++) {
    [void](Invoke-JsonPost "/v1/decisions/evaluate" @{
        tenantId = "$tenant-pop"; businessAction = "view"; eventId = "warm-$w"; nonce = "nw-" + (New-Id 10); suspectScore = 0
        environmentProbes = @{
            probeCollected = $true; userAgent = "Mozilla/5.0"
            deviceAttrs = @{ deviceMemory = 8; hardwareConcurrency = 8; platform = "Win32" }
        }
    } @{ "X-Tenant-Id" = "$tenant-pop" })
}

$botProbes = @(
    @{ probeCollected = $true; userAgent = "Mozilla/5.0 HeadlessChrome/120.0.0.0"; navigatorWebdriver = $true; headlessUa = $true; automationArtifacts = @("navigator.webdriver") },
    @{ probeCollected = $true; userAgent = "Mozilla/5.0"; navigatorWebdriver = $true; cdpSideEffect = $true; chromeRuntimeMissing = $true; clientHintBrands = @("Not_A Brand", "Chromium") },
    @{ probeCollected = $true; userAgent = "Mozilla/5.0 (compatible; Googlebot/2.1)"; automationArtifacts = @("bot_ua") },
    @{ probeCollected = $true; userAgent = "Mozilla/5.0"; webGlRenderer = "SwiftShader"; vmSuspected = $true }
)
$netHdrs = @(
    @{ "X-Client-Ip" = "45.9.148.1"; "X-Client-Asn" = "9009" },
    @{ "X-Client-Ip" = "185.220.101.1" },
    @{ "X-Client-Ip" = "1.1.1.1"; "X-Client-Asn" = "13335" },
    @{ "X-Forwarded-For" = "198.51.100.105" },
    @{ "X-Client-Ip" = "5.52.0.1"; "X-Client-Asn" = "197207" }
)
$lookupKeys = @(
    "asn:197207","asn:44244","asn:58224","asn:9009","asn:13335","asn:16509",
    "ip:198.51.100.105","ip:203.0.113.99","ip:8.8.8.8","ip:104.16.0.1",
    "asn:24940","asn:14061","ip:37.19.224.1","ip:89.187.160.1","ip:20.190.0.1","asn:15169"
)

$plan = @(
    @{ cat = "identify_create_clean"; n = 80 }
    @{ cat = "identify_exact_rematch"; n = 60 }
    @{ cat = "identify_continuity_rematch"; n = 40 }
    @{ cat = "identify_soft_link"; n = 40 }
    @{ cat = "identify_bot_probes"; n = 40 }
    @{ cat = "identify_network_edge"; n = 30 }
    @{ cat = "decisions_clean"; n = 50 }
    @{ cat = "decisions_bot"; n = 40 }
    @{ cat = "decisions_proximity"; n = 30 }
    @{ cat = "decisions_rare"; n = 30 }
    @{ cat = "decisions_mitm"; n = 20 }
    @{ cat = "decisions_velocity"; n = 20 }
    @{ cat = "network_lookup"; n = 20 }
)
$planned = ($plan | ForEach-Object { [int]$_.n } | Measure-Object -Sum).Sum
if ($planned -ne $Count) {
    $delta = $Count - $planned
    $plan[0].n = [int]$plan[0].n + $delta
}

function Run-Case([string]$Cat, [int]$Idx) {
    switch ($Cat) {
        "identify_create_clean" {
            $idem = "c-" + (New-Id)
            $dev = New-Device $variants[$Idx % 3]
            $fp = New-Fingerprint (New-Salt)
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $fp $idem $tenant $dev) @{ "Idempotency-Key" = $idem }
            $pass = $r.ok -and $r.body -and $r.body.identityAlgorithmVersion -eq "night-watch-identity-v4" -and ($r.body.matchType -in @("created","matched"))
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "created_or_matched_v4"
                gotMatch = $r.body.matchType; confidenceStatus = $r.body.confidenceStatus; confidence = $r.body.confidence
                algo = $r.body.identityAlgorithmVersion; enrichment = $r.body.enrichmentStatus
            }
        }
        "identify_exact_rematch" {
            $seed = $rematchPool[$Idx % $rematchPool.Count]
            $idem = "r-" + (New-Id)
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $seed.fp $idem $tenant $seed.device) @{ "Idempotency-Key" = $idem }
            $same = [string]$r.body.visitorId -eq $seed.visitorId
            $pass = $r.ok -and $r.body.matchType -eq "matched" -and $same
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "matched_same_visitor"
                gotMatch = $r.body.matchType; visitorSame = $same; confidenceStatus = $r.body.confidenceStatus
                confidence = $r.body.confidence; algo = $r.body.identityAlgorithmVersion
            }
        }
        "identify_continuity_rematch" {
            $seed = $rematchPool[$Idx % $rematchPool.Count]
            $idem = "t-" + (New-Id)
            $fp = New-Fingerprint (New-Salt)
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $fp $idem $tenant $seed.device $seed.token) @{ "Idempotency-Key" = $idem }
            $same = [string]$r.body.visitorId -eq $seed.visitorId
            $pass = $r.ok -and $r.body.matchType -eq "matched" -and $same
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "continuity_matched"
                gotMatch = $r.body.matchType; visitorSame = $same; confidenceStatus = $r.body.confidenceStatus
            }
        }
        "identify_soft_link" {
            $idem = "s-" + (New-Id)
            $dev = New-Device "common"
            $fp = New-Fingerprint (New-Salt)
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $fp $idem $tenant $dev) @{ "Idempotency-Key" = $idem }
            $pass = $r.ok -and $r.body -and ($r.body.matchType -in @("created","matched"))
            return @{ pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "identify_ok"; gotMatch = $r.body.matchType }
        }
        "identify_bot_probes" {
            $idem = "b-" + (New-Id)
            $fp = New-Fingerprint (New-Salt)
            $probes = $botProbes[$Idx % $botProbes.Count]
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $fp $idem $tenant (New-Device) $null $probes) @{ "Idempotency-Key" = $idem }
            $pass = $r.ok -and $r.body.enrichmentStatus -eq "completed" -and $r.body.smartSignals
            return @{ pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "enrichment_completed"; enrichment = $r.body.enrichmentStatus }
        }
        "identify_network_edge" {
            $idem = "n-" + (New-Id)
            $fp = New-Fingerprint (New-Salt)
            $hdr = @{ "Idempotency-Key" = $idem }
            $extra = $netHdrs[$Idx % $netHdrs.Count]
            foreach ($k in $extra.Keys) { $hdr[$k] = $extra[$k] }
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $fp $idem $tenant (New-Device)) $hdr
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "identify_network_ok" }
        }
        "decisions_clean" {
            $r = Invoke-JsonPost "/v1/decisions/evaluate" @{
                tenantId = $tenant; businessAction = "login"; eventId = "ev-c-" + (New-Id)
                nonce = "nd-" + (New-Id 10); suspectScore = 0
                environmentProbes = @{ probeCollected = $true; userAgent = "Mozilla/5.0"; navigatorWebdriver = $false; automationArtifacts = @() }
            } @{ "X-Tenant-Id" = $tenant }
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "decision_ok"; action = $r.body.action }
        }
        "decisions_bot" {
            $probes = $botProbes[$Idx % $botProbes.Count]
            $r = Invoke-JsonPost "/v1/decisions/evaluate" @{
                tenantId = $tenant; businessAction = "signup"; eventId = "ev-b-" + (New-Id)
                nonce = "nb-" + (New-Id 10); suspectScore = 0; environmentProbes = $probes
            } @{ "X-Tenant-Id" = $tenant }
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "decision_bot"; action = $r.body.action }
        }
        "decisions_proximity" {
            $r = Invoke-JsonPost "/v1/decisions/evaluate" @{
                tenantId = $tenant; businessAction = "checkout"; eventId = "ev-p-" + (New-Id)
                nonce = "np-" + (New-Id 10); suspectScore = 0
                environmentProbes = @{
                    probeCollected = $true; userAgent = "Mozilla/5.0"; proximityConsent = $true
                    geo = @{ lat = 35.7; lon = 51.4; accuracyM = 50 }
                }
            } @{ "X-Tenant-Id" = $tenant }
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "decision_proximity" }
        }
        "decisions_rare" {
            $r = Invoke-JsonPost "/v1/decisions/evaluate" @{
                tenantId = "$tenant-pop"; businessAction = "view"; eventId = "ev-rare-" + (New-Id)
                nonce = "nr-" + (New-Id 10); suspectScore = 0
                environmentProbes = @{
                    probeCollected = $true; userAgent = "Mozilla/5.0"
                    deviceAttrs = @{ deviceMemory = 0.5; hardwareConcurrency = 1; platform = "rare-$Idx" }
                }
            } @{ "X-Tenant-Id" = "$tenant-pop" }
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "decision_rare" }
        }
        "decisions_mitm" {
            $r = Invoke-JsonPost "/v1/decisions/evaluate" @{
                tenantId = $tenant; businessAction = "pay"; eventId = "ev-m-" + (New-Id)
                nonce = "nm-" + (New-Id 10); suspectScore = 0
                environmentProbes = @{ probeCollected = $true; userAgent = "Mozilla/5.0" }
            } @{ "X-Tenant-Id" = $tenant; "X-Forwarded-Tls-Fingerprint" = "mitm-lab" }
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "decision_mitm" }
        }
        "decisions_velocity" {
            $r = Invoke-JsonPost "/v1/decisions/evaluate" @{
                tenantId = $tenant; businessAction = "login"; eventId = "ev-v-" + (New-Id)
                nonce = "nv-" + (New-Id 10); suspectScore = 0
                environmentProbes = @{ probeCollected = $true; userAgent = "Mozilla/5.0"; eventsLastHour = 80 }
            } @{ "X-Tenant-Id" = $tenant }
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "decision_velocity" }
        }
        "network_lookup" {
            $key = $lookupKeys[$Idx % $lookupKeys.Count]
            $r = Invoke-JsonPost "/v1/lab/network/lookup" @{ key = $key }
            $pass = [bool]$r.ok
            return @{ pass = $pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "lookup_ok"; key = $key }
        }
        default { return @{ pass = $false; ok = $false; status = 0; ms = 0; expect = "unknown_cat" } }
    }
}

$results = New-Object System.Collections.Generic.List[object]
$caseIdx = 0
foreach ($p in $plan) {
    for ($i = 0; $i -lt [int]$p.n; $i++) {
        $caseIdx++
        $row = Run-Case $p.cat $i
        $row.cat = $p.cat
        $row.idx = $caseIdx
        $results.Add([pscustomobject]$row) | Out-Null
        if (($caseIdx % 50) -eq 0) { Write-Host "… $caseIdx / $Count" }
    }
}

$passed = @($results | Where-Object { $_.pass }).Count
$failed = $Count - $passed
Write-Host "DONE: pass=$passed fail=$failed total=$Count"
if ($failed -gt 0) {
    $results | Where-Object { -not $_.pass } | Select-Object -First 20 | Format-Table cat, status, expect, gotMatch -AutoSize
    exit 1
}
exit 0
