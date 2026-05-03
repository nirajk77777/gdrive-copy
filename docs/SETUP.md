# Setting up Google API credentials for `gdrive-copy`

This walkthrough takes about 5 minutes. You only do it once. At the end you'll have a `credentials.json` file that `gdrive-copy` uses to talk to Google Drive on your behalf.

> Screenshots are referenced from `../screenshots/` (relative to this file). If you're reading this on GitHub or in your editor, the images render inline.

---

### Step 1 — Open Google Cloud Console

Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in.

![Step 1](../screenshots/1.png)

### Step 2 — Click "Select a project" in the top bar

If you have no project yet, the dialog will be mostly empty. Click **New project** in the top right of the dialog.

![Step 2](../screenshots/2.png)

### Step 3 — Name your project

Name it something memorable like **"My Drive API"** and click **Create**.

![Step 3](../screenshots/3.png)

### Step 4 — Wait for the create notification

A notification appears in the top right when the project is ready.

![Step 4](../screenshots/4.png)

### Step 5 — Switch to your new project

Click **Select a project** again and pick the one you just created.

![Step 5](../screenshots/5.png)

### Step 6 — Confirm the project is active

The home page now reads "You're working in My Drive API" with a project number and ID.

![Step 6](../screenshots/6.png)

### Step 7 — Open the menu → APIs & Services → Library

From the hamburger menu, hover **APIs & Services** and click **Library**.

![Step 7](../screenshots/7.png)

### Step 8 — Search for "Google Drive API"

Type **Google Drive API** in the search bar and click the first result (the Drive logo card, not "Drive Activity API").

![Step 8](../screenshots/8.png)

### Step 9 — Enable the API

On the Google Drive API page, click **Enable**.

![Step 9](../screenshots/9.png)

### Step 10 — API is enabled

You'll be redirected to the API/Service Details page. Status should read **Enabled**.

![Step 10](../screenshots/10.png)

### Step 11 — Open Credentials in the sidebar

In the left sidebar, click **Credentials**.

![Step 11](../screenshots/11.png)

### Step 12 — You'll see the empty Credentials page

A yellow banner asks you to configure the OAuth consent screen first.

![Step 12](../screenshots/12.png)

### Step 13 — Same view, ready to start creating

Click **+ Create credentials** at the top.

![Step 13](../screenshots/13.png)

### Step 14 — Pick "OAuth client ID"

From the dropdown, select **OAuth client ID**.

![Step 14](../screenshots/14.png)

### Step 15 — Configure consent screen first

You'll be told the consent screen must be set up before you can create a client. Click **Configure consent screen**.

![Step 15](../screenshots/15.png)

### Step 16 — Click "Get started" on the Google Auth Platform

The Auth Platform Branding page tells you nothing is configured yet. Click **Get started**.

![Step 16](../screenshots/16.png)

### Step 17 — App Information

Enter an **App name** (e.g. "My GDrive App") and your **User support email**, then click **Next**.

![Step 17](../screenshots/17.png)

### Step 18 — Audience: pick External

Choose **External** (Internal is only for Google Workspace organizations).

![Step 18](../screenshots/18.png)

### Step 19 — External selected, click Next

Confirm External is selected and proceed.

![Step 19](../screenshots/19.png)

### Step 20 — Contact Information

Enter the email Google should use to notify you about changes to this project.

![Step 20](../screenshots/20.png)

### Step 21 — Finish: agree to the policy

Tick **I agree to the Google API Services: User Data Policy**, then click **Continue**.

![Step 21](../screenshots/21.png)

### Step 22 — All four steps complete, click Create

![Step 22](../screenshots/22.png)

### Step 23 — Open OAuth Overview, click "Create OAuth client"

The Auth Platform now shows the Overview page with a button to create your first OAuth client.

![Step 23](../screenshots/23.png)

### Step 24 — Clients page → "+ Create client"

![Step 24](../screenshots/24.png)

### Step 25 — Application type: pick "Desktop app"

This is critical — `gdrive-copy` uses the desktop OAuth flow.

![Step 25](../screenshots/25.png)

### Step 26 — Name the client and Create

Default name (e.g. "Desktop client 1") is fine. Click **Create**.

![Step 26](../screenshots/26.png)

### Step 27 — OAuth client created — download JSON

A modal shows your Client ID and Client secret. **Click "Download JSON"** — this is your `credentials.json` file. Save it somewhere you can find it (e.g. `~/Downloads/credentials.json`).

> The Client secret is only displayed once. Download it now.

![Step 27](../screenshots/27.png)

### Step 28 — Confirm the client is listed

You should see your new client in the OAuth 2.0 Client IDs table.

![Step 28](../screenshots/28.png)

### Step 29 — Add yourself as a test user

In the left sidebar click **Audience**. Scroll to **Test users** and click **+ Add users**.

> While the app is in "Testing" status, only emails listed here can authorize it. Without this step, Google will block your sign-in with an "Access blocked: app has not completed verification" error.

![Step 29](../screenshots/29.png)

### Step 30 — Enter your Google email and Save

Use the same email whose Drive you'll be copying into.

![Step 30](../screenshots/30.png)

### Step 31 — Verify your credentials.json downloaded

The browser's download tray should show a file like `client_secret_…apps.googleusercontent.com.json`. Rename it to `credentials.json` for convenience.

![Step 31](../screenshots/31.png)

---

## Done — register your credentials with the tool

Back in your terminal:

```bash
gdrive-copy auth ~/Downloads/credentials.json
```

You're now ready to copy a folder. See the [main README](../README.md#first-time-use) for usage.
