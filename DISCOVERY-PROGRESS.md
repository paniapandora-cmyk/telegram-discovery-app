# Discovery improvement batches

## Search and saved library — 2026-09-30

Ten implemented changes, pending frontend promotion:

1. Shared Persian text matching normalizes Arabic letter variants, diacritics and Persian/Arabic/ASCII digits.
2. Saved search matches all query words across title, excerpt, category and channel metadata.
3. Search and saved view preferences survive tab navigation in memory for the current app session, scoped by Telegram user. No new browser persistence is introduced.
4. Saved posts can be filtered by channel, combined with existing media filters.
5. Active saved filters can be cleared with one action, preserving the selected sort order.
6. Saved retrieval has a refresh action and explicit failure message; failed retrieval is not shown as an empty personal library.
7. Opening a saved post uses the filtered and sorted results as the viewer queue.
8. Keyboard activation of the remove-save button no longer also opens the parent post.
9. Search supports retry, clears outdated results while requesting new ones, and ignores aborted responses.
10. Failed remote history deletion retains the visible history and offers an honest error; local history is cleared after remote success.

Validation: frontend typecheck and build; browser scenarios in e2e/library-search.spec.cjs, plus existing CI gates.

Prior batches include comments response ordering, Creator Center reliability and returning to the previous scroll position. Physical-device referral and iPhone playback verification remain separate release checks (RELEASE-CHECKLIST.md).

## Search history isolation and ordering — 2026-10-02

- Browser history is now keyed per Telegram account; unidentified sessions do not persist it.
- Legacy shared history is removed rather than attributed to the next account. Server history remains unchanged.
- A request captures its account and local revision. Responses from another account, aborted requests and responses older than a local mutation are not applied.
- Successful deletion invalidates earlier list requests, preventing local resurrection of deleted history.
- Locally serialized result counts and timestamps now deserialize correctly.
- Added automated tests for account isolation, delayed deletion responses, account changes during requests, newer local writes, failed deletion and unavailable storage.
- This validates browser-side history behavior; it does not replace server authorization or constitute a full-system security audit.
