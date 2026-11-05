#Requires -Version 5.1
param(
    [string]$BaseUrl = "http://127.0.0.1:5080",
    [int]$Count = 500,
    [string]$OutDir = "artifacts/case500"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$resultsPath = Join-Path $OutDir "results-$stamp.jsonl"
$summaryPath = Join-Path $OutDir "summary-$stamp.json"

function New-Id([int]$n = 8) { ([guid]::NewGuid().ToString("N")).Substring(0, [Math]::Min($n, 32)) }
function New-Hash { [guid]::NewGuid().ToString("N") }

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
                locale = "fa-IR"; screenWidth = 412; screenHeight = 915; webGlRenderer = "Adreno (TM) 640"
            }
        }
        "rare" {
            return @{
                platform = "Win32"; osFamily = "Windows"; browserFamily = "Firefox"
                locale = "fa-IR"; screenWidth = 800; screenHeight = 600; webGlRenderer = "SwiftShader"
                deviceMemory = 0.5; hardwareConcurrency = 1; maxTouchPoints = 0
            }
        }
        default {
            return @{
                platform = "Win32"; osFamily = "Windows"; browserFamily = "Chrome"
                locale = "fa-IR"; screenWidth = 1920; screenHeight = 1080
                webGlRenderer = "ANGLE (NVIDIA GeForce GTX 1660)"
            }
        }
    }
}

function New-IdentifyBody($hash, $idem, $tenant, $device, $token = $null, $probes = $null) {
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
        continuityLegalBasis = "legitimate_interest"
        clientDevice = $device
        legacyBrowser = @{
            visitorId = $hash
            sourceManifestRevision = "default-v1"
            componentKeys = @("canvas", "fonts", "audio", "timezone", "platform")
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
    $h = New-Hash
    $idem = "seed-" + (New-Id)
    $dev = New-Device $variants[$i % 3]
    $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $h $idem $tenant $dev) @{ "Idempotency-Key" = $idem }
    if ($r.ok -and $r.body) {
        $rematchPool.Add([pscustomobject]@{
            hash = $h; visitorId = [string]$r.body.visitorId; device = $dev; token = [string]$r.body.continuity.token
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
    "ip:5.52.0.1","ip:45.9.148.1","ip:185.220.101.1","ip:1.1.1.1",
    "ip:198.51.100.105","ip:203.0.113.99","ip:8.8.8.8","ip:104.16.0.1",
    "asn:24940","asn:14061","ip:37.19.224.1","ip:89.187.160.1","ip:20.190.0.1","asn:15169"
)

# Spec plan totaling 500
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
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody (New-Hash) $idem $tenant $dev) @{ "Idempotency-Key" = $idem }
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
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody $seed.hash $idem $tenant $seed.device) @{ "Idempotency-Key" = $idem }
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
            $idem = "ct-" + (New-Id)
            $hdr = @{ "Idempotency-Key" = $idem }
            if ($seed.token) { $hdr["X-Continuity-Token"] = $seed.token }
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody (New-Hash) $idem $tenant $seed.device $seed.token) $hdr
            $same = [string]$r.body.visitorId -eq $seed.visitorId
            $pass = $r.ok -and $r.body.matchType -eq "matched" -and $same
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "matched_via_continuity"
                gotMatch = $r.body.matchType; visitorSame = $same; confidenceStatus = $r.body.confidenceStatus
                confidence = $r.body.confidence; continuityStatus = $r.body.continuity.status
            }
        }
        "identify_soft_link" {
            $dev = New-Device "common"
            $idem1 = "s1-" + (New-Id); $idem2 = "s2-" + (New-Id)
            $a = Invoke-JsonPost "/v1/identify" (New-IdentifyBody (New-Hash) $idem1 $tenant $dev) @{ "Idempotency-Key" = $idem1 }
            $b = Invoke-JsonPost "/v1/identify" (New-IdentifyBody (New-Hash) $idem2 $tenant $dev) @{ "Idempotency-Key" = $idem2 }
            $soft = $false
            try { $soft = [bool]$b.body.matchInsights.softLinked } catch {}
            $distinct = [string]$a.body.visitorId -ne [string]$b.body.visitorId
            $pass = $a.ok -and $b.ok -and $distinct -and $soft -and $b.body.matchType -eq "created"
            return @{
                pass = [bool]$pass; ok = [bool]($a.ok -and $b.ok); status = $b.status; ms = ($a.ms + $b.ms)
                expect = "created_soft_linked_not_merged"; gotMatch = $b.body.matchType; softLinked = $soft
                distinctVisitors = $distinct; confidenceStatus = $b.body.confidenceStatus
            }
        }
        "identify_bot_probes" {
            $p = $botProbes[$Idx % $botProbes.Count]
            $idem = "bot-" + (New-Id)
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody (New-Hash) $idem $tenant (New-Device "common") $null $p) @{ "Idempotency-Key" = $idem }
            $score = $null; $decision = $null; $detected = 0
            try {
                $score = $r.body.scoreReceipt.score
                $decision = $r.body.scoreReceipt.decision
                if ($r.body.smartSignals) {
                    $detected = @($r.body.smartSignals | Where-Object { $_.status -eq "detected" }).Count
                }
            } catch {}
            $enriched = $r.body.enrichmentStatus -eq "completed"
            $pass = $r.ok -and $enriched
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "enrichment_completed"
                gotMatch = $r.body.matchType; enrichment = $r.body.enrichmentStatus; score = $score
                decision = $decision; detectedSignals = $detected
            }
        }
        "identify_network_edge" {
            $nh = $netHdrs[$Idx % $netHdrs.Count]
            $idem = "net-" + (New-Id)
            $hdr = @{ "Idempotency-Key" = $idem }
            foreach ($k in $nh.Keys) { $hdr[$k] = $nh[$k] }
            $probes = @{ probeCollected = $true; userAgent = "Mozilla/5.0" }
            $r = Invoke-JsonPost "/v1/identify" (New-IdentifyBody (New-Hash) $idem $tenant (New-Device "common") $null $probes) $hdr
            $pass = $r.ok -and ($r.body.matchType -in @("created","matched"))
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms
                expect = "identify_ok_network"; gotMatch = $r.body.matchType; enrichment = $r.body.enrichmentStatus
                algo = $r.body.identityAlgorithmVersion
            }
        }
        "decisions_clean" {
            $body = @{
                tenantId = $tenant; businessAction = "login"; eventId = "ev-" + (New-Id); nonce = "n-" + (New-Id 12)
                suspectScore = 0
                environmentProbes = @{
                    probeCollected = $true; userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
                    deviceAttrs = @{ deviceMemory = 8; hardwareConcurrency = 8; platform = "Win32" }
                }
            }
            $r = Invoke-JsonPost "/v1/decisions/evaluate" $body @{ "X-Tenant-Id" = $tenant }
            $score = 0
            try { $score = [int]$r.body.scoreReceipt.usedScore } catch {}
            $pass = $r.ok -and $score -lt 40
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "allow_low_score"
                action = $r.body.action; score = $score; decision = $r.body.scoreReceipt.decision
            }
        }
        "decisions_bot" {
            $p = $botProbes[$Idx % $botProbes.Count]
            $body = @{
                tenantId = $tenant; businessAction = "checkout"; eventId = "ev-" + (New-Id); nonce = "n-" + (New-Id 12)
                suspectScore = 0; environmentProbes = $p
            }
            $r = Invoke-JsonPost "/v1/decisions/evaluate" $body @{ "X-Tenant-Id" = $tenant }
            $score = 0; $detected = 0
            try {
                $score = [int]$r.body.scoreReceipt.usedScore
                $detected = @($r.body.scoreReceipt.contributions | Where-Object { $_.appliedPoints -gt 0 }).Count
            } catch {}
            $pass = $r.ok -and $score -gt 0 -and $detected -ge 1
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "elevated_score"
                action = $r.body.action; score = $score; detectedSignals = $detected; decision = $r.body.scoreReceipt.decision
            }
        }
        "decisions_proximity" {
            $km = @(900, 1600, 3200, 4500, 800)[$Idx % 5]
            $body = @{
                tenantId = $tenant; businessAction = "login"; eventId = "ev-" + (New-Id); nonce = "n-" + (New-Id 12)
                suspectScore = 0; proximityConsent = $true
                priorLocationLabel = "ir-tehran"; currentLocationLabel = "de-frankfurt"; locationDistanceKm = $km
                environmentProbes = @{ probeCollected = $true; userAgent = "Mozilla/5.0" }
            }
            $r = Invoke-JsonPost "/v1/decisions/evaluate" $body @{ "X-Tenant-Id" = $tenant }
            $pts = 0
            try {
                $prox = @($r.body.scoreReceipt.contributions | Where-Object { $_.signalId -eq "proximity_detection" }) | Select-Object -First 1
                if ($prox) { $pts = [double]$prox.appliedPoints }
            } catch {}
            $pass = $r.ok -and $pts -gt 0
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "proximity_points"
                distanceKm = $km; proximityPoints = $pts; score = $r.body.scoreReceipt.usedScore
            }
        }
        "decisions_rare" {
            $mem = @(0.5, 0.25, 1)[$Idx % 3]
            $hc = @(1, 1, 2)[$Idx % 3]
            $body = @{
                tenantId = "$tenant-pop"; businessAction = "checkout"; eventId = "ev-" + (New-Id); nonce = "n-" + (New-Id 12)
                suspectScore = 0
                environmentProbes = @{
                    probeCollected = $true; userAgent = "Mozilla/5.0"
                    deviceAttrs = @{ deviceMemory = $mem; hardwareConcurrency = $hc; platform = "Win32"; maxTouchPoints = 0; uniq = (New-Id 6) }
                }
            }
            $r = Invoke-JsonPost "/v1/decisions/evaluate" $body @{ "X-Tenant-Id" = "$tenant-pop" }
            $pts = 0
            try {
                $rare = @($r.body.scoreReceipt.contributions | Where-Object { $_.signalId -eq "rare_device_detection" }) | Select-Object -First 1
                if ($rare) { $pts = [double]$rare.appliedPoints }
            } catch {}
            $pass = $r.ok -and $pts -gt 0
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "rare_points"
                rarePoints = $pts; score = $r.body.scoreReceipt.usedScore
            }
        }
        "decisions_mitm" {
            $body = @{
                tenantId = $tenant; businessAction = "login"; eventId = "ev-" + (New-Id); nonce = "n-" + (New-Id 12)
                suspectScore = 0
                environmentProbes = @{ probeCollected = $true; userAgent = "Mozilla/5.0"; mitmSuspected = $true }
            }
            $hdr = @{ "X-Tenant-Id" = $tenant; "X-Mitm-Suspected" = "true" }
            if (($Idx % 2) -eq 1) {
                $hdr = @{
                    "X-Tenant-Id" = $tenant
                    "X-TLS-Fingerprint" = "abc123"
                    "X-Expected-TLS-Fingerprint" = "xyz999"
                }
                $body.environmentProbes = @{ probeCollected = $true; userAgent = "Mozilla/5.0" }
            }
            $r = Invoke-JsonPost "/v1/decisions/evaluate" $body $hdr
            $pts = 0
            try {
                $mitm = @($r.body.scoreReceipt.contributions | Where-Object { $_.signalId -eq "mitm_attack_detection" }) | Select-Object -First 1
                if ($mitm) { $pts = [double]$mitm.appliedPoints }
            } catch {}
            $pass = $r.ok -and $pts -gt 0
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "mitm_points"
                mitmPoints = $pts; score = $r.body.scoreReceipt.usedScore
            }
        }
        "decisions_velocity" {
            $ip = "203.0.113." + (40 + ($Idx % 20))
            $body = @{
                tenantId = $tenant; businessAction = "login"; eventId = "ev-" + (New-Id); nonce = "n-" + (New-Id 12)
                suspectScore = 0
                environmentProbes = @{ probeCollected = $true; userAgent = "Mozilla/5.0" }
            }
            $last = $null
            for ($b = 0; $b -lt 12; $b++) {
                $body.eventId = "ev-" + (New-Id)
                $body.nonce = "n-" + (New-Id 12)
                $last = Invoke-JsonPost "/v1/decisions/evaluate" $body @{ "X-Tenant-Id" = $tenant; "X-Client-Ip" = $ip; "X-Forwarded-For" = $ip }
            }
            $vel = 0
            try { $vel = [int]$last.body.scoreReceipt.eventsLastHour } catch {}
            $pass = $last.ok -and $vel -ge 8
            return @{
                pass = [bool]$pass; ok = [bool]$last.ok; status = $last.status; ms = $last.ms; expect = "velocity_counted"
                eventsLastHour = $vel; score = $last.body.scoreReceipt.usedScore
            }
        }
        "network_lookup" {
            $key = $lookupKeys[$Idx % $lookupKeys.Count]
            $r = Invoke-JsonPost "/v1/lab/network/lookup" @{ key = $key }
            $kind = $null
            try { $kind = [string]$r.body.kind } catch {}
            $pass = $r.ok -and $kind -and $kind -ne "unknown" -and $kind.Length -gt 0
            return @{
                pass = [bool]$pass; ok = [bool]$r.ok; status = $r.status; ms = $r.ms; expect = "known_feed_hit"
                key = $key; kind = $kind
            }
        }
        default { return @{ pass = $false; ok = $false; status = 0; ms = 0; expect = "unknown_cat"; error = $Cat } }
    }
}

Write-Host "Running $Count cases against $BaseUrl ..."
$all = New-Object System.Collections.Generic.List[object]
$i = 0
foreach ($p in $plan) {
    for ($j = 0; $j -lt $p.n; $j++) {
        $i++
        $cat = $p.cat
        $name = "{0}_{1}" -f $cat, $j
        try {
            $outcome = Run-Case $cat $j
            $row = [ordered]@{
                i = $i; category = $cat; name = $name
                pass = [bool]$outcome.pass; ok = [bool]$outcome.ok; status = $outcome.status; ms = $outcome.ms
                expect = $outcome.expect; detail = $outcome
            }
        }
        catch {
            $row = [ordered]@{
                i = $i; category = $cat; name = $name; pass = $false; ok = $false; status = 0; ms = 0
                expect = "exception"; detail = @{ error = $_.Exception.Message }
            }
        }
        ($row | ConvertTo-Json -Depth 8 -Compress) | Add-Content -Path $resultsPath -Encoding UTF8
        $all.Add([pscustomobject]$row) | Out-Null
        if ($i % 50 -eq 0) {
            $passed = @($all | Where-Object { $_.pass }).Count
            Write-Host ("  [{0}/{1}] pass={2} fail={3}" -f $i, $Count, $passed, ($i - $passed))
        }
    }
}

$byCat = $all | Group-Object category | ForEach-Object {
    $p = @($_.Group | Where-Object { $_.pass }).Count
    [pscustomobject]@{
        category = $_.Name
        total = $_.Count
        pass = $p
        fail = $_.Count - $p
        passRate = [math]::Round(100.0 * $p / $_.Count, 1)
        avgMs = [math]::Round((($_.Group | Measure-Object ms -Average).Average), 1)
    }
} | Sort-Object category

$matchDist = @{}
$confDist = @{}
$scoreBuckets = [ordered]@{ "0-9" = 0; "10-39" = 0; "40-69" = 0; "70-100" = 0 }
foreach ($r in $all) {
    $d = $r.detail
    if ($d.gotMatch) {
        $m = [string]$d.gotMatch
        if (-not $matchDist.ContainsKey($m)) { $matchDist[$m] = 0 }
        $matchDist[$m]++
    }
    if ($d.confidenceStatus) {
        $cs = [string]$d.confidenceStatus
        if (-not $confDist.ContainsKey($cs)) { $confDist[$cs] = 0 }
        $confDist[$cs]++
    }
    if ($null -ne $d.score -and "$($d.score)" -ne "") {
        $s = [int]$d.score
        if ($s -lt 10) { $scoreBuckets["0-9"]++ }
        elseif ($s -lt 40) { $scoreBuckets["10-39"]++ }
        elseif ($s -lt 70) { $scoreBuckets["40-69"]++ }
        else { $scoreBuckets["70-100"]++ }
    }
}

$passCount = @($all | Where-Object { $_.pass }).Count
$sortedMs = @($all | Sort-Object ms | ForEach-Object { $_.ms })
$p95 = $sortedMs[[Math]::Min($sortedMs.Count - 1, [Math]::Floor($sortedMs.Count * 0.95))]

$summary = [ordered]@{
    at = (Get-Date).ToUniversalTime().ToString("o")
    baseUrl = $BaseUrl
    total = $all.Count
    pass = $passCount
    fail = $all.Count - $passCount
    passRate = [math]::Round(100.0 * $passCount / $all.Count, 2)
    avgMs = [math]::Round((($all | Measure-Object ms -Average).Average), 1)
    p95Ms = $p95
    byCategory = @($byCat)
    matchTypeDistribution = $matchDist
    confidenceStatusDistribution = $confDist
    scoreBuckets = $scoreBuckets
    resultsFile = $resultsPath
}

$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "==== SUMMARY ===="
Write-Host ("Total={0} Pass={1} Fail={2} Rate={3}%" -f $summary.total, $summary.pass, $summary.fail, $summary.passRate)
Write-Host ("avgMs={0} p95Ms={1}" -f $summary.avgMs, $summary.p95Ms)
$byCat | Format-Table -AutoSize | Out-String | Write-Host
Write-Host "Match types:" ($matchDist | ConvertTo-Json -Compress)
Write-Host "Confidence:" ($confDist | ConvertTo-Json -Compress)
Write-Host "Scores:" ($scoreBuckets | ConvertTo-Json -Compress)
Write-Host "Wrote $summaryPath"
Write-Output "SUMMARY_JSON=$summaryPath"
