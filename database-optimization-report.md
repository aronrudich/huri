# Huri database optimization — October 23, 2026

## Measured running costs

Recording window: October 9–22 inclusive (14 complete UTC dates). These are **requested credits**, not a cash-payment or deduction statement; usage recording can lag activity.

| Rank | Category | Requested credits | Measured quantity |
|---|---|---:|---|
| 1 | Database compute | 31.9236 | 259.05 Pico instance-hours + 70.77 Small instance-hours |
| 2 | Data transfer | 17.7018 | 38.7309 GB ordinary + 1.8194 GB cached |
| 3 | AI/audio generation | 1.7350 | Resource quantities unavailable; includes explainer creation activity |
| 4 | Server work | 1.5081 | 148 worker-days + 18,722 worker requests |
| 5 | Live updates | 0.9446 | 75,567 messages |
| 6 | File storage | 0.0200 | 139.197 GB-hours |

Total running usage: **53.8330 requested credits**. Separate building/chat/monitoring usage: **218.2430 credits**, not app running usage. No database-storage usage item was returned; its billed quantity is unknown, not assumed zero.

Small's current continuous-running quote is **4.0248 credits/day / 120.744 credits per 30 days**, before allowances. Faster searches do not reduce this hourly price. No verified dollar conversion or allowance is applied in this report.

## What the database is doing

Query statistics are cumulative over an unspecified statistics window; they are not attributed to the financial recording window above.

- Live-update processing: 294,396 calls, 5.901 ms mean, 1,737.2 seconds cumulative database time. Required for live accuracy; untouched.
- Main full-car read: 5,339 calls, 32.529 ms mean, 173.7 seconds cumulative. Current foreground/reconnect refreshes preserve accuracy after phones miss updates; untouched.
- Retired message read: 3,284 historical calls, 37.372 ms mean. Current source already removed its screen consumers; cumulative counts do not prove continued current traffic. No new messaging work added.
- Storage object lookup: 83,472 calls, 0.877 ms mean. These statistics cannot establish how many bytes photos or the video transferred.
- Historical lot snapshot: 342 calls, 167.152 ms mean in the API query statistics. An ordered index was missing.
- Request history replay: 203 calls, 110.771 ms mean for the recorded all-history query shape. Per-vehicle custody lookbacks lacked a matching company/RO/date index.

## Changes applied

Two additive indexes now support historical lot snapshots and company-scoped request histories. Records, security policies, settings, scoring logic, screen reads, live updates, and all recovery refreshes are unchanged. Short lock and statement timeouts bounded the migration's wait and execution.

### Same-workload checks

| Query | Before | After | Result verification |
|---|---:|---:|---|
| Historical lot snapshot at October 22, 13:30 UTC | 24.412 ms | 6.913 ms | Identical 2,175 rows and content checksum |
| Three-RO company-scoped custody lookback | 1.611 ms | 0.211 ms | Identical 3 rows and content checksum |

The first query now uses the ordered snapshot index instead of sorting a full-table scan. The second uses an index-only scan instead of scanning all requests. These are single-run comparisons, not production latency guarantees; cache conditions and write overhead affect timings. They are direct read-plan checks, not an authenticated UI benchmark.

All 26 existing location, service-hours, pickup-window, eligibility and custody tests pass. The preview build reported OK after the database migration. Both new indexes were confirmed in the database.

## Scheduled work and storage

Existing jobs: pickup archive every minute; reminder every minute; stale-car check twice daily; technical job-log cleanup daily. No jobs were added, removed or slowed. Notification and archive delivery timing is unchanged.

Database health at the start: 34% memory, 22/90 connections, 23% disk, no restarts or recent exhaustion alerts. Database size 121.2 MB. Technical job-run history still occupies about 92 MB despite its cleanup; deleted-row space can remain allocated. No compaction, retention change or deletion was attempted. Vehicle photos and all operational/audit history remain intact.

## Savings and remaining limits

These indexes reduce measured search work and provide growth headroom; **no immediate Run-credit reduction is established**. The database's fixed Small hourly rate is unchanged, and returning identical rows does not reduce transfer bytes.

Meaningful transfer savings require identifying proven duplicate or oversized requests under the published workload. Existing photo previews and removal of messaging are already present in source; they were not counted as new savings. No service-worker app-shell caching, reduced freshness, lower database tier, removed photos, security changes or data limits were introduced.

Compare recorded transfer GB and expensive query-call deltas over representative busy days after reporting catches up. Ordinary transfer currently quotes 0.45 credits/GB; cached transfer quotes 0.15 credits/GB. A confirmed 1 GB reduction in ordinary transfer would avoid 0.45 requested credits, but a quantity reduction has not been measured here.

Nothing was published. Database indexes apply independently of website publishing. Capacity email alerts were not part of this database optimization implementation and remain unconfigured by this task.