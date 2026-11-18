# v0.2.4 YouTube History in playlists

- Adds a built-in History card in Your playlists, separate from Removal history.
- Loads YouTube history through the History browse endpoint with continuation support, search, sorting, selection and verified copying to editable playlists.
- History is available as a channel-discovery and saved-feed source; backup/import preserves that source.
- History cannot be deleted, used as a transfer destination, or modified through playlist edit operations. Its page links to YouTube for history removal/settings.
- Updates the privacy notice and prepared Chrome Web Store listing to disclose local watch-history caching. No additional permissions or analytics.
- Automated fixtures cover history parsing, pagination, copying without removal IDs, source retention, failed responses, destination restrictions and feed backup. Signed-in live History responses still need verification.
- Store package refreshed; submission still requires publisher sign-in and review.

# v0.2.3 store preparation and history migration

Adds History > Import history to merge existing JSON exports into a new installation without changing YouTube videos. Validation rejects malformed records, strips unrelated fields and unsafe recovered links, preserves original playlist destinations and newer restoration state, and deduplicates records.

Packaging now produces a separate Chrome Web Store ZIP with manifest.json at the root. Listing text, permission explanations, privacy policy and review instructions are prepared under store/. Store submission still requires publisher authentication; this release does not claim store approval or automatic updates for unpacked copies.

# v0.2.2 inline channel tags

Each channel row now has a tag input with existing-name suggestions. Comma, Enter and click-away commit tags. Each pill has an × to remove its channel assignment. Row updates preserve the active input and do not rebuild the list while typing.

Assigning a tag adds the channel to My feeds and creates a matching saved feed immediately unless a single-category feed already exists. Reusing a name ignores case, outer whitespace and equivalent Unicode forms. Tag-created feeds retain their category link through export/import; category renaming updates linked names and category deletion removes linked feeds. Removing one assignment keeps the tag and feed for other channels. Bulk assignment and the existing category picker remain available.

Validated with 63 tests and browser interaction using isolated fixtures. No new permissions, analytics or paid services. GitHub downloads remain manual; Chrome Web Store publication is the recommended automatic-update route and has not been performed.

# v0.2.1 interface correction

Restores the approved prototype's visual structure on the production extension. Version 0.2.0 carried the new functions but retained the old oversized layout.

- Compact connection row and capacity beside the page title; visible version badge.
- Sticky search, labeled playback/availability/sort filters, selection count and select-all; compact numbered rows with horizontal actions.
- Selected-video drawer with Move, Remove and Clear selection.
- Compact playlist cards and aligned destination rows; create-only and create-and-transfer remain available, as does the Move/Copy split button.
- My feeds presents category chips above the saved-feed/channel browser.
- Search help and connection settings remain directly accessible, including opening Watch Later when no YouTube tab exists.

No production transport, storage keys or batch sizes changed. The approved design was recovered from prototype version 10 (commit 879373e4559cf7f64eb0f3ae8a6da2f36179732e). The preview fixture is excluded from the installable package.

Visual browser checks use the actual production HTML/CSS/JS with isolated mock Chrome APIs. All 61 automated tests pass, including extended DOM coverage for the revised controls. Live YouTube mutations still require the acceptance checklist in VALIDATION.md.

# v0.2.0 experimental release candidate

Renamed to **Watch Later: YouTube Playlists & Feeds**.

The workspace now separates Watch Later, Your playlists, Removal history and My feeds. Regular editable playlists can be loaded and used as sources. The transfer button supports copying or moving to several destinations. History records the original source so restores return videos to that playlist.

My feeds combines channel categories and saved feed views. Search YouTube for channels, discover channels from loaded playlists, assign categories, and browse saved videos or recent upload pages. Category selection uses OR across categories and deduplicates videos.

The release preserves 500-action batching, live playback filters, exact search phrases, comma pills, persistent selection, sticky controls, thumbnails, unavailable metadata recovery and automatic interrupted-operation reconciliation. The comma interaction temporarily shows the whole list until another term is entered. Recovery actions appear only when unavailable videos are selected.

This is a testable prerelease, not a claim that every YouTube response has been verified in a real account. Keep history/feeds exports when updating, and use a small test playlist for the first live move/copy/restore checks.
