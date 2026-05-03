# gdrive-copy

[![npm version](https://img.shields.io/npm/v/gdrive-copy.svg)](https://www.npmjs.com/package/gdrive-copy)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/gdrive-copy.svg)](https://nodejs.org)

Copy a shared Google Drive folder (and everything inside it) to your own Google Drive — recursively, in parallel, with auto-resume if interrupted.

Built because Google Drive's "Add shortcut" doesn't actually copy anything, and "Make a copy" only works on individual files. This tool walks the entire tree and copies every file and folder to your Drive.

## Features

- **Recursive copy** of an entire shared folder tree into your own Drive
- **Native Google Workspace handling** — Docs, Sheets, and Slides are cloned as editable Google files (not exported to Office formats)
- **Parallel transfers** — 5 concurrent operations to speed up large folders
- **Resume on interrupt** — kill the script anytime; re-running picks up where it left off
- **No duplicates** — if a destination folder already exists, the tool reuses it instead of creating a copy
- **Skip filters** — exclude folders by name or Drive ID
- **Live progress bars** per folder, with full breadcrumb paths to disambiguate nested folders
- **Exponential-backoff retry** on rate-limit errors

## Installation

### From npm (once published)

```bash
npm install -g gdrive-copy
```

### From source

```bash
git clone <this-repo>
cd drive-copy
npm install
npm install -g .
```

After install, the `gdrive-copy` command is available globally.

## Setup — Get your Google API credentials

You need a Google Cloud OAuth client (a `credentials.json` file) before you can use the tool. It's a one-time setup that takes about 5 minutes.

**See the full step-by-step guide with screenshots:** [docs/SETUP.md](https://github.com/nirajk77777/gdrive-copy/blob/main/docs/SETUP.md)

The short version:
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google Drive API**
3. Configure the OAuth consent screen (External, Testing mode)
4. Create an **OAuth Client ID** of type **Desktop app**
5. Download the JSON → this is your `credentials.json`
6. Add your Google email to **Test users**

Then continue below.

---

## First-time use

### 1. Register your credentials with the tool

```bash
gdrive-copy auth ~/Downloads/credentials.json
```

This copies the file into `~/.config/gdrive-copy/credentials.json` so future runs can find it.

### 2. Run a copy

```bash
gdrive-copy <source-folder-id>
```

The folder ID is the long string at the end of the shared folder URL:
```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       this is the folder ID
```

On the **first** run, your browser will open automatically for Google sign-in:
1. Pick the test-user account you added during setup
2. Click "Continue" past the unverified-app warning
3. Approve the Drive scope
4. Browser shows "Authorization successful — you can close this tab"

A token is saved to `~/.config/gdrive-copy/token.json`. Subsequent runs skip the browser entirely.

The tool then prints a header line and shows a live progress bar per folder being copied:
```
Copying "Summer Trip 2024 Photos" → My Drive root

Copying: Albums/01 Day One/01         [████████░░░░] 120/200 files
Copying: Albums/01 Day One/02         [██████░░░░░░]  90/180 files
Copying: Albums/02 Day Two/01         [██████████░░] 200/250 files
Copying: Albums/04 Day Four           [█████░░░░░░░]  96/440 files
```

When everything finishes:
```
Done! Created 8 folder(s), copied 1432 file(s) in 184.2s.
```

## Usage

```
gdrive-copy <source-folder-id> [destination-folder-id] [options]
gdrive-copy auth <path-to-credentials.json>
gdrive-copy --help
```

### Arguments

| Argument                  | Required | Description                                                                |
| ------------------------- | -------- | -------------------------------------------------------------------------- |
| `<source-folder-id>`      | yes      | Drive ID of the shared folder you want to copy                             |
| `[destination-folder-id]` | no       | Where to copy *into*. Defaults to **My Drive root** if omitted             |

### Options

| Option                  | Description                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| `--skip="Folder Name"`  | Skip any folder with this exact name (repeatable)                      |
| `--skip-id=<folder-id>` | Skip a folder by its source Drive ID (repeatable)                      |
| `--port=3000`           | Port for the local OAuth redirect server (default `3000`)              |
| `--help`                | Show help                                                              |

### Examples

```bash
# Copy a shared folder into the root of My Drive
gdrive-copy 1AbCdEfGhIjKlMnOpQrStUvWxYz

# Copy into a specific existing folder in your Drive
gdrive-copy 1AbCdEfGhIjKlMnOpQrStUvWxYz 1XyZwVuTsRqPoNmLkJiHgFeDcBa

# Skip a folder by name
gdrive-copy 1AbCdEfGhIjKlMnOpQrStUvWxYz --skip="Archive"

# Skip multiple folders by name and ID
gdrive-copy 1AbCdEfGhIjKlMnOpQrStUvWxYz --skip="Old Stuff" --skip="Drafts" --skip-id=1FgHi...

# Use a different OAuth port (e.g. if 3000 is taken)
gdrive-copy 1AbCdEfGhIjKlMnOpQrStUvWxYz --port=8080
```

---

## How it works

### Concurrency
Five operations (file copies and folder creates) run in parallel via an inline semaphore. The traversal itself recurses without holding a slot, so deeply nested trees don't deadlock.

### Resume
Progress is persisted to `~/.config/gdrive-copy/progress-<sourceFolderId>.json` after every folder created and every file copied. The format is:
```json
{
  "folders": { "<src-folder-id>": "<dest-folder-id>" },
  "files":   [ "<src-file-id>", ... ]
}
```
On restart, already-recorded items are skipped. The progress file is deleted automatically once the run finishes successfully.

### Avoiding duplicates
Before creating a folder at the destination, the tool searches for an existing folder with the same name under the same parent (Drive query: `name='X' and '<parent>' in parents and mimeType='application/vnd.google-apps.folder'`). If one exists, it's reused. This is what makes it safe to re-run after a partial first attempt.

### Workspace files
Google Docs, Sheets, and Slides are copied with `drive.files.copy()` — Google's API clones them as native Workspace files in your Drive, so they remain editable. No export/import to Office formats happens.

### Rate limiting
On HTTP 429 (Drive API quota), the request is retried with exponential backoff: 1s, 2s, 4s, 8s, 16s. After 5 failed attempts the error is surfaced to the user; progress so far is preserved on disk.

---

## Troubleshooting

### `Access blocked: <app name> has not completed the Google verification process`

Your Google email is not on the test-users list. Add it under **Audience → Test users → + Add users** in Google Cloud Console (see [docs/SETUP.md Step 29](https://github.com/nirajk77777/gdrive-copy/blob/main/docs/SETUP.md#step-29--add-yourself-as-a-test-user)), then retry.

### `Error: redirect_uri_mismatch`

The OAuth client doesn't allow `http://localhost:3000/callback` as a redirect URI. With Desktop-app credentials this is allowed by default, but if you're using a **Web** application client instead, you'll need to either:
- Re-create the client as type **Desktop app** (recommended), or
- Add `http://localhost:3000/callback` to the client's **Authorized redirect URIs**

### `EADDRINUSE: address already in use :::3000`

Port 3000 is taken. Either stop the process using it, or pass a different port:
```bash
gdrive-copy <id> --port=8080
```

### `No credentials found. Run: gdrive-copy auth <path-to-credentials.json>`

You haven't registered `credentials.json` yet. Run the auth setup command first.

### Rate limit errors persist across retries

Drive's per-user quota is around 1000 requests / 100 seconds. If you're consistently hitting it, the script's exponential backoff should recover, but for very large copies (10,000+ files) you may want to leave it overnight.

### I want to start a copy from scratch (ignore previous progress)

Delete the progress file:
```bash
rm ~/.config/gdrive-copy/progress-<source-folder-id>.json
```

### I want to revoke access

Visit [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and remove the app, then delete `~/.config/gdrive-copy/token.json`.

---

## Contributing

PRs welcome. The code is small (`bin/` + three files in `lib/`) and intentionally has no test suite — its behavior is best validated against real Drive folders.

If you add a feature, please update this README's **Usage** and **Options** tables.

## License

MIT — see [LICENSE](./LICENSE).
