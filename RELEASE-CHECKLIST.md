# Release verification

## 2026-09-30 — stabilization batch 1

- Production HTML serves `index-DuY2zbka.js` and `index-bjMzpdNN.css`, matching the previous `3c93ff2` build. This checks the published frontend assets, not authenticated Telegram flows.
- Local membership/referral/VIP/quota tests passed, including unique invitations and access gates.
- Local social permission, rate limit, idempotency, parent scope and owner-only deletion tests passed.
- Local public video URL boundary tests passed.
- Added a comments regression scenario: a delayed initial list response must not replace the refreshed list after a successful comment submission.
- Type checking and production build passed for this batch. Browser and quality checks are recorded in GitHub Actions for the associated commit.

## Still requires live Telegram verification

- New-account referral through the bot, channel join and Mini App entry, through three valid invitations.
- Video playback on a physical iPhone as well as Android.
- The current comments fix after its frontend version is promoted.

## Release and rollback

1. Verify both Quality Gates and Browser E2E succeeded for the intended commit.
2. Match the Cloudflare version to that commit before promoting it.
3. Record the current active Cloudflare version before promotion.
4. Smoke-test entry, Creator Center, comments and saving after promotion.
5. If a regression blocks core use, restore the recorded previous Cloudflare version. This frontend-only batch has no database migration to reverse.
