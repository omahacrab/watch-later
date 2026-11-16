# v0.2.0 feature scope

The extension retains the v0.1.29 playlist engine and adds the expanded workspace. No demo data, fake network buttons, or simulated account actions are shipped.

| Area | Included |
| --- | --- |
| Connection | Auto-connect where possible, explicit YouTube tab chooser, account identity checks, reconnect, disconnect |
| Watch Later | Full continuation scan, unavailable-view command where exposed, separate YouTube total and capacity, stop, export, local cache |
| Search | Live filtering, exact phrases, field selectors/operators, exclusions, AND/OR, comma pills with pause before the next term, clear/search again |
| Selections | Persist across searches, dedicated selected list, count, select all across matching pages, fixed header checkbox, Shift-click inclusive range |
| Video rows | Number before checkbox, thumbnails, progress bar/percentage, collaboration-aware channel scope, individual remove/move/recovery |
| Playback/sort | Complete/partial/any/no-progress/range, local title/channel/duration sorts, returned YouTube sort commands and reported active sort |
| Playlist management | Restyled cards without image placeholders, find/view/count/create/delete, loading source playlists, create-only or create-and-transfer, Enter to create, clear repeated creation field |
| Transfers | Move/copy split button, multiple destinations, fresh selection on each open, add then verify every target before source removal, up to 500 actions per request |
| History | Account-wide searchable history with original source, metadata recovery retained, restore individually/selected/all, undo last removal, export, interrupted-operation reconciliation |
| Unavailable metadata | Bulk selection, counts-only progress, per-row status/retry, optional archive permission, metadata persistence across scans/removals |
| My feeds | Added channels, channel search, playlist-discovered channels, channel browsing, category union, multi-category assignment, saved feed views, on-demand upload pages, saved-playlist sources, add to Watch Later |
| Feed organisation | Channel name/most-saved sort, category/uncategorised filter, bulk category assignment, category rename/delete, feed edit/delete, local import/export |

Not represented as working features: precise playlist addition dates, comprehensive Shorts/live feeds, automatic background refresh, AI category inference, paid API integration, telemetry/contribution sharing, or Chrome Web Store distribution.

Exact response formats and capacity vary with YouTube. See VALIDATION.md for the distinction between automated coverage and signed-in live verification.
