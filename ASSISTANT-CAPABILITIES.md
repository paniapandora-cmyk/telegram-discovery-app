# Discovery assistant v3

The assistant uses Gemini via the existing authenticated `/api/ai/chat` route. No new secret is needed; `GEMINI_API_KEY` remains server-only. Default: `gemini-3.1-flash-lite`, with one bounded alternate-model attempt for temporary upstream errors. Model availability and free-tier quotas are controlled by Google.

## User features

- Search Discovery with a topic, request a trending digest, or ask for personalized posts.
- Summarize and categorize a sample of the authenticated user's latest saved posts.
- Summarize or translate a user-selected post excerpt from its viewer. Text is sent after pressing Send; images/videos and full linked articles are not fetched.
- Continue a conversation using up to six recent user/assistant messages. Thirty display messages are kept locally under a Telegram-user-specific key. Clearing the conversation removes this local history from the current account's key.
- Source cards link only to validated HTTPS Telegram post URLs. Save requires a user click and the existing authenticated save API. Navigation buttons open existing app pages.
- Copy drafts/replies, retry failures, and see the remaining per-user request allowance.
- Basic Markdown bold/list rendering uses escaped React text, never raw model HTML.

## Creator features

- Interpret a bounded sample (up to five channels) of the user's own 30-day creator analytics: views, opens, saves, tracked joins and conversion. These are Discovery-tracked aggregates, not all Telegram activity.
- Draft captions, opening hooks, calls to action, translations, rewrites and a proposed weekly content calendar. Drafts are not published or scheduled.
- Explain channel registration, referrals, membership and current quota rules without inventing account outcomes.

## Access boundary

The gateway verifies Telegram initData, required membership and the existing transactional daily quota before provider access. Client-supplied user IDs/channel ownership are never used. Retrieval forwards the same signed initData to fixed Discovery or creator API endpoints, which independently enforce identity/ownership. It never sends backend keys, raw profiles, private Telegram IDs or arbitrary database rows to Gemini. Explicit saved/creator requests retrieve only the relevant minimal fields.

No model-generated SQL, URLs, tool names or mutation instructions are executed. Post content, selected excerpts and history are untrusted data. A model response cannot publish, delete, buy, message people, grant VIP, modify permissions or access other users' information. A submitted selected excerpt is identified as user-provided, not independently verified full content. Empty/unavailable context must be disclosed rather than fabricated. Source-based claims use numbered citations.

The free Gemini tier may use content for product improvement. The UI discloses that selected text, relevant data and recent messages are sent to Gemini; avoid sending confidential material. No unlimited usage promise is made. Existing quota policy counts submitted attempts including provider failures; fallback does not consume another user quota.

## Validation and rollout

From `frontend-react`: `npm run typecheck`, `npm run build`, `node tests/assistant-context.mjs`, `node tests/membership-vip.mjs`, `node tests/ai-contract.mjs`. Browser scenarios are in `e2e/assistant.spec.cjs`.

Deploy `ai-gateway-v1/index.ts` with `_shared/hoviat.ts` and `_shared/discovery-assistant.ts`; keep custom Telegram authentication (`verify_jwt=false`). Deploy the matching Worker/frontend build for the new controls. Old clients can use natural-language live retrieval and receive source text, but do not send conversation history or selected-post context.

No database migration is required. Cloudflare frontend activation must be verified separately from Edge Function deployment. Roll back by redeploying the prior function sources and promoting the prior Cloudflare version; no user records need deletion.
