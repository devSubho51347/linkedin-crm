# LinkedIn CRM

A lightweight local-first Chrome extension that mirrors LinkedIn items into a personal Kanban board when the user clicks LinkedIn's native Save action.

## V1 Features

- Detects likely LinkedIn Save clicks on `linkedin.com`
- Stores only minimal metadata locally: URL, type, timestamps, status, note, and board month
- Auto-groups items into month-year boards
- Shows a five-column Kanban board: Unread, Read Next, In Progress, Action Needed, Done
- Provides a popup with a small daily review queue
- Supports search, filters, notes, archive, export, and deleting completed items
- Supports scheduled email digests for the latest unread saved items

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this `linkedin-crm` folder.
5. Visit LinkedIn and click Save on a post or job.
6. Open the extension popup and choose Open Board.

## Email Digest Setup

The extension schedules digests locally with Chrome alarms. Email is sent through the serverless endpoint in `api/send-digest.js`, so the email provider secret is never stored in the extension.

Deploy this repo to Vercel and configure these environment variables:

- `RESEND_API_KEY`: your Resend API key
- `DIGEST_API_TOKEN`: a private token you choose for the extension to call the endpoint
- `RESEND_FROM`: optional sender address, defaults to `LinkedIn CRM <onboarding@resend.dev>`

Then open the dashboard and configure Email Digest:

- Email address: where the digest should be sent
- Backend endpoint: `https://your-project.vercel.app/api/send-digest`
- Digest token: the same value as `DIGEST_API_TOKEN`
- Frequency: daily, weekdays, or weekly
- Send time: local browser time
- Items per email: 5 or 6

Use Send Now to verify the setup before relying on the schedule.

## Privacy Model

The extension is local-first for saved item storage. V1 stores saved item metadata in `chrome.storage.local`.

Email digests send only the selected unread item URLs, item types, and notes to the configured backend endpoint at send time.

This implementation intentionally avoids auto-scrolling, background crawling, posting, messaging, applying to jobs, or collecting full post content.

## Policy Note

This approach is intentionally experimental and may be sensitive under LinkedIn's restrictions on extensions that scrape, copy, alter, or automate LinkedIn. Treat this as a local prototype, not a production compliance guarantee.
