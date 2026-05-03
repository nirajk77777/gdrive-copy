const fs = require('fs');
const http = require('http');
const { google } = require('googleapis');
const { CREDENTIALS_PATH, TOKEN_PATH, ensureConfigDir } = require('./config');

async function setupCredentials(credentialsFilePath) {
  if (!fs.existsSync(credentialsFilePath)) {
    console.error(`File not found: ${credentialsFilePath}`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(credentialsFilePath, 'utf8'));
  } catch {
    console.error('Invalid JSON in credentials file.');
    process.exit(1);
  }
  if (!parsed.installed && !parsed.web) {
    console.error('Invalid credentials file: must contain "installed" or "web" key.');
    process.exit(1);
  }
  ensureConfigDir();
  fs.copyFileSync(credentialsFilePath, CREDENTIALS_PATH);
  console.log(`Credentials saved to ${CREDENTIALS_PATH}`);
  console.log('');
  console.log('Next: run  gdrive-copy <source-folder-id>  to authorize and start copying.');
  console.log('      (You\'ll need to add http://localhost:3000/callback as an authorized');
  console.log('       redirect URI in your Google Cloud Console OAuth client first.)');
}

async function authorize(port = 3000) {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('No credentials found. Run: gdrive-copy auth <path-to-credentials.json>');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id } = credentials.installed || credentials.web;
  const redirectUri = `http://localhost:${port}/callback`;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive'],
  });

  console.log('Opening browser for Google authorization...');
  console.log(`(If the browser doesn't open, visit: ${authUrl})`);
  console.log(`Make sure  http://localhost:${port}/callback  is listed as an authorized`);
  console.log('redirect URI in your Google Cloud Console OAuth client.\n');

  const { default: open } = await import('open');
  await open(authUrl);

  const tokens = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== '/callback') return;

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`<h2>Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Authorization successful!</h2><p>You can close this tab and return to the terminal.</p>');
        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500);
        res.end('<h2>Failed to exchange code for token.</h2><p>Check the terminal for details.</p>');
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {});
    server.on('error', reject);
  });

  ensureConfigDir();
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log(`Token saved to ${TOKEN_PATH}\n`);
  return oAuth2Client;
}

module.exports = { setupCredentials, authorize };
