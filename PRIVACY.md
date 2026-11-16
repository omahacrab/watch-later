# Privacy

Watch Later: YouTube Playlists & Feeds operates in your Chrome profile. There is no developer backend, analytics SDK, advertising integration or telemetry endpoint in this version.

## Local storage

The extension saves playlist metadata, selected channel/category/feed definitions, recovered information, and removal history in `chrome.storage.local`. Playlist IDs, video IDs, titles, channel names and timestamps may reveal your interests. Account data is separated using a hash of YouTube's account/session identity. It is not sent to the developer. Selections are held in memory; persistent feed choices and history stay local.

Removal history is a product feature. It is retained when you clear a playlist cache so you can restore videos later. Uninstalling the extension can erase its local data. Exports are files you control and may contain personal viewing interests.

## YouTube access

The extension needs access to `https://www.youtube.com/*` to run its request function in the signed-in YouTube tab you select. Authentication is generated inside that page. Cookie values and authorization headers are not returned to the extension UI, stored in exports, or sent to a developer server. Requests go to YouTube to read playlists/channels and carry out actions you choose. Thumbnail images load from YouTube's image servers.

The `scripting` permission injects this request function. The `storage` permission saves your local workspace. The extension requests no access to unrelated websites or all browsing history.

## Optional unavailable-video recovery

Recovery first checks YouTube's public metadata endpoint. The optional archive fallback requests permission for `https://web.archive.org/*`. Chrome describes this host permission as “Read and change your data on web.archive.org”; the extension uses it to fetch archival metadata by video ID. Recovery requests omit credentials and do not execute archived scripts. The requested video ID and your network address are visible to the archive service. Permission is optional and requested only when you use the recovery feature; denying it still allows the YouTube metadata check.

## Feeds and future features

Channel searches and upload reads go directly to YouTube through your selected tab. Categories are entered by you and stored locally. There is no automatic LLM tagging, usage-stat collection, or shared channel-tag database in this release. A future data-sharing feature would require a separately documented implementation and controls.
