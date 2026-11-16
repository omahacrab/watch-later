# Watch Later Cleaner

Search your YouTube Watch Later playlist and remove reviewed selections in batches of **500**.

## Install in Chrome (Windows)

1. Extract this ZIP to a permanent folder, for example `Documents\WatchLaterCleaner`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** at the top right.
4. Click **Load unpacked**. Select the `watch-later-cleaner` folder containing `manifest.json`, not the ZIP.
5. Click Chrome's puzzle-piece Extensions button, then pin **Watch Later Cleaner**.
6. Keep the extracted folder in place. Chrome loads the extension from that folder.

## Use

1. Open YouTube and sign in to the account whose Watch Later playlist you want to clean.
2. Click the extension icon. The cleaner opens in its own tab, so closing a popup will not interrupt it.
3. Click **Connect** if it has not connected automatically, then **Load / refresh playlist**. Keep the YouTube tab and cleaner tab open.
4. Search titles and channels. Search terms are case insensitive; multiple words must all match. Use the field dropdown for title-only or channel-only searching.
5. Choose individual checkboxes or **Select all matches**. This selects every matching page, not just the visible 500 rows. Selections remain when the search changes; the count shows selections outside the current search.
6. Click **Review removal**, inspect the complete selected-title list, and confirm. It sends up to **500 removals per request**, including a smaller final batch when necessary.

The extension generates requests from the current YouTube session. No Console commands, copied requests, API keys or additional login are required by the intended flow. The first authenticated run on your Chrome installation still needs live verification.

## Saved lists and interrupted work

- Playlist metadata is saved locally per account, including partial scans. A fresh scan always starts at the beginning, independent of how far you scrolled on YouTube.
- Reopening the extension restores the saved list after account identification. Refresh to pick up new videos or changes made elsewhere.
- **Stop** prevents subsequent requests; an in-flight request can finish.
- Removal is enabled after a complete scan. A completed scan means no continuation remains, not that YouTube's headline count has been independently reconciled.
- Unavailable entries are shown if YouTube returns them. Entries without a playlist-entry removal ID are shown but cannot be selected. Items omitted by YouTube cannot be recovered by the extension.
- Before each removal request, the extension saves a pending-batch record. An interrupted or unconfirmed batch blocks further removal until a fresh scan finishes, avoiding blind retries.
- A confirmed batch is removed from the local list only after YouTube returns `STATUS_SUCCEEDED`. This is API confirmation, not an independent post-removal read. Refresh the list for an independent check.
- The YouTube page itself can show stale rows until you reload it.
- **Export list** saves a JSON backup with titles, channels and video links. This is not automatic undo. Removed videos can be added back manually from their links.
- **Clear saved data** clears this account's local cache, not YouTube videos. Uninstalling removes the extension's local data.

## Privacy and permissions

Permissions: `scripting`, `storage`, and access only to `https://www.youtube.com/*`. No all-sites access, analytics, third-party server, remote code, cookies API, or browsing-history permission.

The extension runs a small function inside the selected YouTube tab to read its session context, generate a short-lived authentication header, and send requests to YouTube. Cookie values and authorization headers stay in the YouTube page and are never saved by the extension. A hashed account identifier separates local caches. Playlist titles, channels, video IDs, playlist-entry IDs and pending-removal IDs are stored in Chrome's local extension storage, not sync storage.

If multiple YouTube accounts are open, leave only the intended account's Watch Later tab open before connecting. Account identity is checked again before every operation. Sign-in/session problems stop requests rather than falling back to another account.

## Version 0.1.3 limitations

This is an initial unpacked build, not a Chrome Web Store release. It uses YouTube's undocumented internal API. The session authentication and live endpoint compatibility have not been tested in your signed-in Chrome. YouTube may change those details. If you get an error, send the visible error text; do not send cookies or authorization headers.

The earlier console workflow confirmed batches of 10 and 4. This build uses the requested size of 500, but live acceptance of 500 is still unverified. A failed batch stops work; it does not silently fall back to repeated smaller requests.

No background schedule runs. Keep both tabs open during work. The scan is sequential because each page supplies the next continuation token; it does not render or scroll through thousands of YouTube rows.

## Development

Plain JavaScript, Chrome Manifest V3, no build or dependency installation required. `node --test tests/*.test.js` runs unit tests. Main files: `youtube.js` (YouTube session transport), `core.js` (parsing, search and batches), `app.js` (UI and saved-state workflow).

Chrome API references: https://developer.chrome.com/docs/extensions/reference/api/scripting and https://developer.chrome.com/docs/extensions/reference/api/storage .

## Update 0.1.1

Adds list-level continuation tokens, nested load-more commands, incomplete-scan detection, structural diagnostics in exported JSON, and visible Connecting / Reconnect states. Old scan caches must be refreshed with the new parser before removal.

To update without changing the installed extension location: extract the new ZIP, copy the files inside its `watch-later-cleaner` folder into your originally installed `watch-later-cleaner` folder, choose Replace, then open `chrome://extensions` and click the extension’s circular Reload icon. Close the old Cleaner tab and reopen via the extension icon. Click Load / refresh playlist.

If a scan stops as incomplete, export the list and share that JSON for debugging. It contains playlist metadata and response key paths, but no session context, authentication headers or continuation-token values.

## Update 0.1.2: search operators and larger batches

- `"the race"` searches the exact phrase, case-insensitively, within a title or a channel. It does not match “disgrace”. Straight and curly double quotes work. Quoted words require word boundaries; unquoted terms keep substring matching.
- `channel:"the race"` searches that phrase in channel names; `title:formula` searches titles. Explicit field operators override the dropdown for that term.
- `-shorts` excludes a term; `-channel:"the race"` excludes a channel phrase.
- `formula OR motogp` matches either group. `|` is an alternative to uppercase OR. Multiple terms use AND by default; uppercase AND is also accepted. Parentheses and regular expressions are not supported.
- Unfinished quotes or operators show an error and return no matches rather than unexpectedly widening the search.
- Results show 500 rows per screen. **Select all matches** still covers every screen. Changing the search does not clear previous selections; inspect the review dialog before removal.
- Removal requests now contain up to 500 actions. This size is experimental on live YouTube. Rejected or uncertain requests stop and require a refresh before further removal; there is no blind retry or automatic smaller-batch fallback.
- Loading still uses YouTube-controlled response sizes and continuation tokens. No verified 500-item fetch parameter was found. The extra delay between read requests was removed; fetching 500 items may still take several sequential requests. This is separate from displaying or removing 500 at once.

Update by replacing files in the original installed folder, clicking Reload in `chrome://extensions`, and reopening the Cleaner tab. Saved lists can be searched with the new operators without reloading all videos.

## Update 0.1.3: live YouTube total and capacity

A separate prominent card shows the total reported in YouTube's playlist header, out of the requested 5,000-video capacity reference, plus spaces available. For example, 4,809 means 191 spaces available. This is separate from the fetched-entry count and search-match count.

The extension reads fresh playlist header metadata on connection and initial load. **After every confirmed removal batch**, it requests the first playlist response again and refreshes the total from YouTube. It does not subtract removed rows and call that a live count. No full rescan is needed for this total refresh. The Refresh total button repeats the count-only check on demand.

The timestamp shows when the total was read. If a count request fails or the response lacks readable count metadata, the previous number is marked as last known/stale. On initial connection only, the visible Watch Later header can supply a fallback reading; this is labeled as coming from the open page. YouTube can itself take time to reflect changes; the extension displays what the fresh response reports.

This is refreshed after removals made through the extension, not a background monitor of changes in other tabs. Use Refresh total for changes made directly in YouTube or on another device. The removal batch size remains 500.

## Update 0.1.4: disable search suggestions

The search field explicitly disables browser autocomplete, spelling corrections and capitalization. Its generic `query` identifier was replaced with an extension-specific ID and name. The extension does not collect search history or read searches from other apps. No browser history or saved data in other apps is deleted. Update the installed files, reload the extension, and close/reopen the Cleaner tab to load the changed HTML.

## Update 0.1.5: small video thumbnails

Each row now shows a 96 × 54 thumbnail beside its title (80 × 45 on narrow screens). Images load lazily as rows approach the visible area. Existing cached lists work immediately using their saved video IDs; a full playlist rescan is not required. Unavailable entries and image failures show a neutral placeholder.

Images are requested from YouTube's `i.ytimg.com` thumbnail server without sending a referrer. No additional Chrome permissions are added. The image service receives the video image requests as with normal image loading; no third-party thumbnail service is used.

Replace the installed files, reload the extension at `chrome://extensions`, then close and reopen the Cleaner tab.

## Update 0.1.6: All from this channel

Every result row has an **All from this channel** button. It clears the current text and unavailable-only filters, then shows every entry in the saved Watch Later list with that exact displayed channel name. It does not fetch the channel's full public upload history. A channel label appears above the results; **Show all channels** removes this restriction. You can type to search within the selected channel.

Selections are preserved, including any from other channels. The selection count and removal review show that scope. Rows without a channel name have the button disabled. Matching currently uses the displayed channel-name string, not a unique channel ID; identically named channels cannot be distinguished by this build.

## Update 0.1.7: channel identity and collaborations

Replaces exact combined-label comparison with per-channel matching. Fresh playlist scans retain each channel link's browse ID and displayed name. A single-channel button includes videos with that channel alone or alongside collaborators, including different display names sharing the same ID. A collaboration shows **All from these channels** and matches videos associated with any participating channel, without duplicating rows.

Update the installed files, reload the extension, reopen the Cleaner, and **Load / refresh playlist once** to collect the new channel metadata. Older cached lists can infer collaborator names only when each component is independently represented in the saved playlist. A channel name containing “and” is not blindly split. When IDs are unavailable, normalized display-name fallback is used, so ambiguous identically named channels may still require fresh metadata.

The buttons show videos inside the scanned Watch Later playlist, not a channel's public upload history. After clicking, a status message reports the match count and a scope label lists the chosen channel(s). Existing selections remain intact and should be reviewed before removing.

## Update 0.1.8: range selection, direct removal and restore history

- Channel buttons no longer call scroll-to-top. A shorter filtered list can still cause normal browser scroll-position clamping.
- Click a checkbox, then hold Shift and click another to select both endpoints and every selectable result between them. It works in either direction, including across result pages, using the current filtered order. Changing filters or clearing the selection resets the range anchor. Ordinary clicks still toggle individual checkboxes.
- Each row has a **Remove** button. It immediately removes that one entry without a confirmation dialog, records history after confirmation from YouTube, and refreshes the YouTube total. The existing bulk-removal review remains.
- Expand **Removal history** below the results to restore one entry, select several, or restore all unrestored entries. Removal and restore requests both use up to 500 actions. A failed or uncertain batch stops; a new full scan reconciles it before another mutation.
- Restore first scans the playlist to skip already-present video IDs and checks reported capacity where available. It refreshes the total after each confirmed restore batch and rescans at the end to capture new playlist-entry IDs. This can take longer than direct removal.
- Restores add videos back; original playlist positions are not preserved. Unavailable videos may not be restorable, and entries without video IDs have Restore disabled. YouTube may reject a restore batch containing unavailable entries; it stops rather than blindly replaying.
- History begins with removals made by this version. Earlier removals cannot be reconstructed. A removal interrupted before confirmation is added to history only if a fresh completed scan shows its playlist entry absent, with that outcome explicitly labeled.
- Records are local and per YouTube account. They contain titles, channels, video and playlist-entry IDs, and timestamps, not image bytes. The panel shows the actual history size in KB. There is no silent truncation. If Chrome storage fills, the required save before the next mutation fails and stops work; export history to keep a separate copy.
- **Export history** saves a JSON copy. Clearing the playlist cache preserves history. Uninstalling the extension or deleting its local Chrome storage removes it, so export first if you need a durable backup.

Install by replacing files in the existing folder, reloading the extension, and closing/reopening the Cleaner. Saved playlists are retained. Live restore API compatibility must still be verified in your signed-in browser.

## Update 0.1.9: search pills, playlist moves, playback progress

### Search pills
Type a comma outside quotes to turn the preceding entry into a removable pill. Enter also commits an entry. Multiple pills, plus any text still being typed, use OR (match any). The Title/Channel/Both selector applies to all pills, while explicit `title:` and `channel:` operators override it. Quotes protect commas within a phrase. For example: `channel:"the race",title:mearsheimer,motogp,`. Malformed queries return no matches and show a message. Selecting all still selects all filtered pages; existing selections are preserved when filters change.

### Move to playlist
Select videos and click **Move to playlist**, or use a row's **Move…** button. The picker requests playlists offered by YouTube's Save dialog. Choose an existing destination or create a **new private playlist** by entering a name. There is no public-sharing default.

For an existing destination, the tool reads its contents first to skip duplicate additions. Each batch adds missing video IDs, checks YouTube's explicit success status, reads the destination back to verify membership, then removes the Watch Later entries. A copy failure, incomplete destination scan, uncertain response or stop request prevents source deletion for that batch. Earlier completed batches remain moved. A new playlist can remain empty if a later step fails; creation is not automatically retried.

Moves are recorded in removal history. Restoring a moved video adds it back to Watch Later and leaves the destination copy intact. The destination playlist is never deleted or cleaned up automatically. If the operation is interrupted, refresh Watch Later before retrying. Destination duplicates are checked again on the next attempt.

The API flow and safeguards are fixture-tested; live playlist-picker, create and move compatibility need testing in the user's signed-in YouTube session.

### Playback progress
A small red progress line on the thumbnail and an `N% played` label are displayed when YouTube returns `thumbnailOverlayResumePlaybackRenderer.percentDurationWatched`. Refresh the playlist once to populate this new field. These are snapshots from the last scan, not a background watch-history feed.

Filters: Completed (exactly 100%), Partly watched (greater than 0 and below 100%), Any recorded progress, and No progress shown. Missing data is NOT labeled unwatched, since absence does not prove no viewing. Different YouTube surfaces may return different history/progress metadata. If YouTube omits it, the extension cannot fabricate it.

### Date added and interface
No date-added column has been introduced: reliable historical Watch Later added dates have not been verified through this transport. A video's upload/publication date is not its Watch Later addition date. The separate manager remains the current interface; an optional embedded YouTube toolbar/panel is a future design option.

References: https://ytjs.dev/api/youtubei.js/namespaces/Managers/classes/PlaylistManager ; https://ytjs.dev/api/youtubei.js/namespaces/YTNodes/classes/ThumbnailOverlayResumePlayback ; https://developers.google.com/youtube/v3/docs/playlistItems/list .

## Update 0.1.10: selected-video list and list navigation

The selection toolbar stays at the top of the viewport while scrolling through results. **Selected videos (N)** opens a paginated list of all current selections, regardless of the active search, channel or playback filter. Uncheck an entry there to deselect it without removing it from YouTube. Returning to search preserves the search and remaining selections.

Previous/Next buttons and page counts now appear above and below the results. They stay synchronized. The header checkbox selects all removable matching videos across every page, just like Select all matches. Its partial state indicates that some matches are selected. Unchecking it deselects only current matches, preserving selections from other searches. Search changes continue to preserve selections.

Also removed duplicate Move controls accidentally present in the previous HTML. Update by replacing files in the installed folder, reloading the extension, and reopening its tab. No full playlist rescan is required for these changes.

## Update 0.1.11: numbering, sorting and unavailable-video requests

Results are numbered in their current filtered/sorted order across pages. Sorting choices always include YouTube order, Reverse loaded order, Title A–Z, Channel A–Z and duration ascending/descending. Additional date-added, date-published and popularity choices appear when YouTube returns usable native sort commands. Native sorts reload the list using those returned commands; local sorts do not require requests. A reversed list is never labeled as a real date sort. Existing selections are retained when native sorts or unavailable-only trigger a reload.

The loader looks for YouTube's Show unavailable videos command in its response and in the currently open Watch Later page. If present, it requests the expanded view before continuing pagination. If the open Watch Later page already indicates Hide unavailable videos, its expanded page data can be used as the initial response. Unavailable rows are recognized through explicit playability, missing IDs, and exact private/deleted/unavailable placeholders. Their original entry IDs remain available for deletion where YouTube supplies them.

Checking Unavailable only reloads once if no expanded request has been made. If no usable command is available or YouTube still returns no identifiable unavailable rows, the UI reports that limitation instead of claiming none exist. Exported JSON includes safe menu diagnostics (labels and presence flags, not command tokens). The user should reload/refresh once after this update for menu discovery. The exact live response variant still needs user verification.

Filtering remains immediate on every input event, including uncommitted text alongside comma-separated OR pills. No Enter or comma is necessary to see matches. Optimized hidden-selection counting to avoid repeatedly scanning all matching rows for every selected video.

## Update 0.1.12: playlist picker layout

The Move dialog now shows playlists in an internal searchable radio-button list with a capped height and its own scrollbar. It no longer opens the browser's native select popup, which could extend up to the screen edge. The dialog is constrained to the viewport with outer margins.

A prominent **＋ Create new playlist** button sits beside **Choose existing playlist**, above the list. Selecting it reveals the name field and changes the action to **Create playlist & move videos**. New playlists remain private. No playlist rescan is needed after updating.

## Update 0.1.13: faster search/remove loop

Row numbers now appear to the left of their checkboxes, with the header checkbox aligned to the same column. Search, filters, selection controls and top pagination stay together in a sticky panel while scrolling.

Clear search clears typed text, OR pills, the channel scope, and playback/unavailable filters, then focuses the search input without a forced scroll. It retains selected videos, the Title/Channel/Both selector and sorting.

After a fully successful removal operation, if no matches remain, the search automatically clears and focuses ready for the next query. If results remain, it keeps the query and shows Removed N with a Search again button. That button performs the same clear-and-focus action. Errors, uncertain requests and user-stopped operations do not trigger auto-clear. The bulk confirmation dialog closes when removal starts. Saved playlist/history data is unchanged by clearing search.

Update installed files, reload the extension, and reopen the Cleaner. No playlist rescan is necessary.

## Update 0.1.14: always-visible select-all header

Moved the list header and select-all checkbox into the sticky search workspace, directly above the video rows. On shorter screens the search controls scroll internally while the list header stays visible. Select-all behavior is unchanged: all matching pages, preserving selections outside the current filter. No playlist rescan required.


## v0.1.15
Creating a playlist now offers two buttons: Create playlist returns to the picker with the new private playlist selected, without moving videos. Create playlist & move videos retains the immediate move flow.


## v0.1.16
Move to multiple playlists using destination checkboxes. Newly created playlists join the selection. Every batch is copied and verified in all destinations before Watch Later removal; a failure keeps the source batch, although successful destination copies remain.
The sort control shows the loaded response’s selected sort when reported. A separate label shows the YouTube tab’s selected sort at the last load. Unknown sorts are explicitly marked not reported.


## v0.1.17
Manage playlists is available after connecting, without selecting videos. Create private playlists or delete a regular playlist using the per-row Delete button. The confirmation identifies the exact playlist by name, ID, and an Open link so identically named playlists can be checked. Deleting a playlist cannot be undone through video removal history. Watch Later and other system playlists are blocked. Deletion requests are not automatically retried; the picker is refreshed before reporting success.
Implementation reference: https://github.com/LuanRT/YouTube.js/blob/main/src/parser/classes/endpoints/DeletePlaylistEndpoint.ts (playlist/delete request).


## v0.1.18
The destination reader accepts explicit English empty-playlist messages in the selected browse tab, in addition to normal video lists. Unknown, unavailable, error and pagination responses remain blocked. After copying, every selected video must still be found in every destination before removal. Failed destination parsing records a structure-only diagnostic in Export list and identifies whether the failure occurred before copying or during verification.


## v0.1.19
Fix Manage playlists HTTP 400: use an available video ID from selected or loaded videos for YouTube’s Save-menu playlist request. If none is cached, read the first Watch Later page without changing selections or the saved list. Empty requests are blocked. Deletion verification uses the same request helper. Management controls are initialized before fetching, so failed loads do not reveal Move videos or stale entries. Creation remains accessible when listing fails.


## v0.1.20
After creating a playlist, refresh destination controls after the operation finishes so Delete buttons and selection checkboxes become active immediately. Existing destination selections remain intact.


## v0.1.21
Playlist rows show video counts in Manage playlists and the move picker. Use exact picker metadata when available, otherwise fetch each missing header total sequentially in the background. New playlists start at zero. Counts refresh on reopening; unknown counts are labelled unavailable. Background updates change only count labels, preserving selections and focus.


## v0.1.22
Move verification retries destination reads up to four times with short delays, without repeating add requests. Requests bypass browser caching. Missing videos still prevent source removal; errors include the missing count. Copy-phase failures automatically clear their source-action lock because no removal has been sent. Uncertain removals/restores trigger automatic reconciliation scans, both after failure and on reconnect/startup. Failed reconciliation retains the lock; no destructive action is retried automatically. Enter in the new playlist name field runs Create playlist only; starting a new playlist clears the previous name.


## v0.1.23
Opening a fresh Move dialog starts with no destination selected, including after closing, cancelling, or completing a prior move. Move videos remains disabled until a destination is explicitly selected. Selections within the same open dialog, including newly created playlists, are retained.


## v0.1.24
Search stays pinned above the results alongside the select-all header. Secondary controls can scroll within the sticky area without scrolling the search field away.


## v0.1.25
After filtering with All from this channel (or these channels), bring the first result below the full sticky workspace if obscured or offscreen. Use the measured header height and preserve scroll when the result is already visible.


## v0.1.26
Recover details on unavailable rows checks YouTube oEmbed, then up to three recent Wayback snapshots. The toolbar supports selected unavailable videos, or all unavailable videos when nothing is selected. Chrome asks for optional web.archive.org access on first use. No Firecrawl, API key or paid credits. Requests omit cookies; video IDs are sent to YouTube and the archive only when recovery is requested. Bulk recovery runs sequentially, supports Stop, and stops on rate limiting.
Successful metadata is cached locally per account, survives refreshes, becomes searchable, and supplies channel filters. Videos stay unavailable. Archived details links identify the source, with capture date on hover. No archived scripts or HTML are executed. Missing records remain unchanged.


## v0.1.27
Separate Recover selected and Recover all unavailable buttons now sit with selection controls. Row buttons use a single line. Failed and unsuccessful recovery attempts are saved per video and displayed in the row with Retry recovery, surviving refresh and rescans. Bulk recovery continues after individual failures but pauses for archive rate limits. Successful retries clear the previous failure. Archive HTTP errors are distinguished from no usable metadata.


## v0.1.28
Removal history retains recovered titles, channels and source links. Stored recovered metadata fills older unavailable/placeholder history entries automatically. Removal snapshots are copied so later list changes do not mutate historical entries. Restoration status and removal IDs are preserved.


## v0.1.29
Live recovery counts appear beside the selection controls: checked/total, recovered, unavailable, and failed requests when any occur. Counts update per video and retain the finished, stopped or paused summary. No progress bar.
