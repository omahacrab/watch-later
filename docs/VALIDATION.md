# Validation for v0.2.1

## Completed locally

- `npm run check`: JavaScript syntax, manifest version and narrowly scoped permissions, content security policy, HTML ID uniqueness, local stylesheet/script/icon references, and no inline scripts or event handlers.
- `npm test`: **61 tests passed**. This includes parser and search units, session transport fixtures, the original multi-step playlist workflow, and a DOM integration test using the actual `app.html`.
- The original workflow exercises a 732-entry playlist, 500/214 removal batches, counts independent of loaded entries, selections across searches, inclusive Shift-click ranges, history, restores, stopped scans, unconfirmed mutations, automatic recovery, playlist creation/deletion, multiple destinations, recovered metadata and per-row actions.
- The full-page DOM workflow exercises comma-to-pill pause, category union and feed deduplication, channel search/assignment, saved feed persistence, copy retaining the original, moving from a regular playlist to Watch Later without duplicating an existing video, restoring to the source playlist, and preserving history while it is filtered.
- History merge coverage verifies that an older workspace cannot erase a newer restore state or recovered details.
- Channel tests verify primary-content scoping, distinct channels with the same name, returned Videos commands, parsed upload progress, collaboration-aware discovery, category deletion, approximate dates and import validation.
- Packaging validates the ZIP and its manifest, uses an explicit runtime allowlist, and produces a SHA-256 checksum.

These checks use fixtures and API doubles. They do not claim that YouTube's current live response format matches every fixture.

## Visual checks completed for v0.2.1

The actual production app was served with isolated mock Chrome APIs using `node scripts/preview.mjs`. The preview copies runtime files rather than maintaining another implementation. The mock transport and synthetic thumbnails never enter the installation ZIP.

Browser checks covered the main workspace, compact playlist cards, move destination alignment, Move/Copy menu, selected-video drawer, feed category chips and feed results. A 0–60% playback range returned 24 of 36 fixture entries. Search, filters and select-all remained sticky while scrolling; channel filtering positioned the first row at the bottom of the sticky region. A screenshot is saved in `docs/images/v0.2.1-workspace.jpg`.

The DOM integration test additionally exercises availability/reset controls, playback filtering, search help and clearing the selection drawer.

## Not completed in this environment

Mobile visual validation and installation into the user's local Chrome profile were not performed.

A real signed-in YouTube account was not connected for v0.2.1 validation. The failed cloud-browser sign-in session was not treated as a successful test. The rebuilt extension was not installed in the user's Chrome profile remotely.

## Live acceptance checklist

Use a small disposable source/destination playlist before a large operation:

- Install the extracted folder containing `manifest.json`; ensure the extension opens without console errors.
- Choose between multiple signed-in YouTube tabs and verify account changes are detected.
- Load a playlist over 100 entries and verify continuation collection, unavailable entries, displayed YouTube total, progress filters and native sort labels.
- Inspect sticky search and select-all at desktop and narrow widths, including channel filtering that reveals the first result below the sticky region.
- Create two playlists, use Enter/create-only, reopen the name field, and verify it is empty. Check counts and deletion controls after creation.
- Copy a video to two destinations, then move another. Verify source removal occurs only for Move and only after both copies are visible.
- Reopen the transfer dialog and verify no previous destinations are selected.
- Interrupt a mutation, reopen the workspace, and check automatic reconciliation before another action.
- Restore one and multiple history entries to their original sources, including an entry already present and a recovered unavailable title.
- Test bulk metadata recovery with permission denied/granted and confirm counts and row failures.
- Search for a channel, assign two categories, combine categories, save/edit a feed, load more uploads, and save a feed video to Watch Later.
- Confirm up-to-500-action mutation acceptance on the live endpoint. Loading page sizes remain controlled by YouTube.

The repository download is an experimental release candidate until this checklist has been exercised against real YouTube responses.
