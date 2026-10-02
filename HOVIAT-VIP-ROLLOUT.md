# Hoviat membership and three-invite VIP

Implemented, not deployed. Depends on the AI route fixes in PR #2.

## Product policy

- Membership of `@hoviateman` is required at private bot start and Mini App entry.
- Feed, explore, search and saves have no referral quota.
- New accounts get 5 AI requests per Tehran calendar day; 1/2/3 qualified invites raise this to 10/15/30.
- Three verified invites grant VIP without expiry. VIP still requires channel membership and has the 30/day AI cap.
- Accounts recorded before migration activation retain 30/day without being falsely labelled VIP.
- Only a new user's first server-recorded bot start can attribute an invite. Qualification requires membership confirmation in the Mini App within seven days. No retroactive credits, self-credit, repeated credit or switching inviters. Credits remain earned if an invitee later leaves; that invitee loses app access on the next membership check.
- A submitted provider request consumes quota, including provider failures. Pre-authentication or failed membership checks do not. Counters increment transactionally; refreshing the page does not reset them.
- Positive Telegram membership results are cached server-side for at most 60 seconds to avoid per-impression Telegram calls. Telegram failures fail closed, not as a false nonmember result.

## Release prerequisites and order

1. Confirm the actual bot using the configured TELEGRAM_BOT_TOKEN is an administrator in `@hoviateman`. Never expose or copy the token into source or client code.
2. Compare deployed functions with repository versions before replacing them. Confirm `users.created_at` and the existing bot-start/growth schema match this migration.
3. Run migration `20260915093000_hoviat_vip_v1.sql` via the migration workflow. It creates new RLS-protected tables and a service-role-only RPC; it does not rewrite existing referral analytics.
4. Deploy `_shared/hoviat.ts` with each importing function: `growth-referral-v1`, `ai-gateway-v1`, `discovery-api-v33`, `telegram-chat-ui-v1`. Preserve each function's existing JWT/webhook settings. Mini App endpoints validate Telegram initData themselves.
5. Deploy the Worker and frontend together, after the membership endpoint is ready. The Pages bridge delegates its normal API routes to this Worker.
6. Test a nonmember, member, new invitee, repeated start, existing user, and the third verified invite inside Telegram. Inspect the actual paid AI response separately.

The UI prevents app mounting before membership confirmation; Worker application APIs and the direct Discovery and AI functions also enforce it. Existing public Telegram images remain public. Other independently callable legacy Edge Functions are not an assertion of an app-wide data privacy boundary and should be audited separately before treating membership as access control for confidential data.

## Verification

From frontend-react: `node tests/membership-vip.mjs`, `node tests/ai-contract.mjs`, `npm run typecheck`, `npm run build`.
From repository root: `npm run check`.
The membership test executes the migration and RPCs in an isolated PGlite PostgreSQL instance, checks privileges and account/referral/quota cases, then exercises Worker and AI gateway boundaries with mocked Telegram/provider responses. It is not a production database or live Telegram check. Browser tests are in `e2e/discovery.spec.cjs` and run in the existing CI workflow.

## Rollback

Restore the previous Worker/frontend and function versions in reverse release order if membership verification fails. Leave the additive tables intact for recovery and audit; do not drop them or clear referral credits to roll back UI.
