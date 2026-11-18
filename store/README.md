# Chrome Web Store submission

Status: prepared locally; not yet uploaded or submitted. Google developer sign-in is required.

- Visibility: Unlisted. Free installation.
- Package: `downloads/watch-later-webstore-v0.2.4.zip` (manifest at archive root).
- Upload assets: `store/assets/`.
- Text, permission explanations and review instructions: `store/listing.json`.
- Public privacy URL: https://github.com/omahacrab/watch-later/blob/main/PRIVACY.md

Do not upload the GitHub installation ZIP with its enclosing `watch-later/` directory to the store.

## Data migration from an unpacked installation

The store installation may have a different extension ID and separate local storage. Do not uninstall the old copy before transferring data:

1. In the old copy, use History > Export history and Connection & settings > Export feeds.
2. Keep those files private. They contain personal playlist and channel choices.
3. In the store copy, connect to the same YouTube account. Use History > Import history, then Connection & settings > Import feeds.
4. Load the playlist again from YouTube. Confirm history and feeds are present before disabling/removing the old copy.

History import merges records, preserves newer restored states, and makes no YouTube changes. Feed import replaces the destination feed definitions after confirmation. Playlists themselves remain on YouTube.

## Submission and updates

The publisher account owner must complete Google sign-in, any required developer registration/payment and publisher certifications. Confirm the dashboard's data-use fields against the implementation and `listing.json`. Submit for review with unlisted distribution and automatic publication after approval. Registration or review is not a successful publication.

After approval, record the listing URL and store item ID here. Future releases need an increased manifest version, a new root-level ZIP, upload and review. Chrome updates installations from that listing after the new version is approved and published. GitHub ZIP copies do not auto-update.

Official references:
- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/publish
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/images
