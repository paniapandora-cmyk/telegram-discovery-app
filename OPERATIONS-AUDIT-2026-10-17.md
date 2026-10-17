# Discovery operational review — 2026-10-17 UTC

## Incident and verified recovery

25 public sources were enabled; 17 had no successful sync within a day. Hoviat and Body Language last succeeded on September 14. The scheduler ordered by discovery_priority first with a LIMIT 4 every two minutes. Eight high-priority sources continually consumed capacity, starving the rest.

Applied migration 20261017234651 to production: oldest last sync/request first; priority is only a tie-breaker. A dispatch timestamp makes failed requests rotate too. Pending requests, active leases and recent running jobs are excluded; row locks use SKIP LOCKED. Four-request cap, cron interval and one-use request tokens remain unchanged. Public/client execute permission remains denied.

After deployment, cron successfully synced hoviateman and Body_Language2 at 23:48 UTC, and piping_Bpv at 23:46 UTC. Other stale sources are recovering through the normal queue. A successful preview sync does not mean full Telegram history or private video is accessible.

## Creator Center

Production logs in the preceding 24 hours: channels/claims/analytics/content-performance requests returned HTTP 200 (2/2/5/5 requests). Database analytics and content functions returned rows for all three named channels. Records/ownership were not deleted or reassigned. Actual UI rendering in the user's authenticated Telegram session still requires confirmation.

The live frontend still serves index-DuY2zbka.js, an earlier version. This incident's database fixes take effect without a Cloudflare promotion. Previous frontend fixes are not all live.

## Security and other findings

The advisor found get_personalized_feed_v9 callable directly by anon/authenticated with caller-chosen user UUID, despite intended access through the identity-validating backend. Migration 20261017234857 restricts execute to service_role. Verified client denial, backend execute permission, and a nonempty feed result.

Remaining advisor warnings: pg_trgm and pg_net are installed in public. Moving extensions may affect dependent queries and was not mixed into the outage fix. 55 RLS-enabled tables have no client policies; these informational findings are not evidence of an outage and require per-table access review, not blanket grants.

The embedding cron is disabled; it was not automatically enabled because provider credentials, cost and the intended search configuration need separate validation. Public preview syncing is active.

## Validation

Worker TypeScript and frontend TypeScript checks passed. Frontend build passed. All nine existing frontend .mjs tests passed after fixing two test browser stubs missing window.location.origin. Feed contract and exploration pagination tests added to Quality Gates so those tests no longer silently fall outside CI.

No claim of exhaustive line-by-line security certification: this review covers operational data ingestion, Creator Center routes/functions/permissions, production deployment state, database advisors and the existing automated suites.
