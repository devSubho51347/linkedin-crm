# LinkedIn CRM

A lightweight local-first Chrome extension that mirrors LinkedIn items into a personal Kanban board when the user clicks LinkedIn's native Save action.

## V1 Features

- Detects likely LinkedIn Save clicks on `linkedin.com`
- Stores only minimal metadata locally: URL, type, timestamps, status, note, and board month
- Auto-groups items into month-year boards
- Shows a five-column Kanban board: Unread, Read Next, In Progress, Action Needed, Done
- Provides a popup with a small daily review queue
- Supports search, filters, notes, archive, export, and deleting completed items

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this `linkedin-crm` folder.
5. Visit LinkedIn and click Save on a post or job.
6. Open the extension popup and choose Open Board.

## Privacy Model

The extension is local-first and does not include a backend. V1 stores saved item metadata in `chrome.storage.local`.

This implementation intentionally avoids auto-scrolling, background crawling, posting, messaging, applying to jobs, or collecting full post content.

## Policy Note

This approach is intentionally experimental and may be sensitive under LinkedIn's restrictions on extensions that scrape, copy, alter, or automate LinkedIn. Treat this as a local prototype, not a production compliance guarantee.
