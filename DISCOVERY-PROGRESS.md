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
