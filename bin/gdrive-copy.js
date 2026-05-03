#!/usr/bin/env node

const { setupCredentials, authorize } = require('../lib/auth');
const { run } = require('../lib/copy');

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = [];
  const skipNames = new Set();
  const skipIds = new Set();
  let port = 3000;

  for (const arg of args) {
    if (arg.startsWith('--skip-id=')) {
      skipIds.add(arg.slice('--skip-id='.length));
    } else if (arg.startsWith('--skip=')) {
      skipNames.add(arg.slice('--skip='.length));
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.slice('--port='.length), 10);
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { positional, skipNames, skipIds, port };
}

function printHelp() {
  console.log(`
gdrive-copy — Copy a shared Google Drive folder to your own Drive

Usage:
  gdrive-copy auth <path-to-credentials.json>   Save Google OAuth credentials
  gdrive-copy <source-folder-id> [dest-id]      Copy folder (dest defaults to My Drive root)

Options:
  --skip="Folder Name"   Skip a folder by name (repeatable)
  --skip-id=<id>         Skip a folder by Drive ID (repeatable)
  --port=3000            Port for OAuth redirect server (default: 3000)
  --help                 Show this help

First-time setup:
  1. Go to console.cloud.google.com → create project → enable Drive API
  2. Create OAuth2 credentials (Desktop app) → download credentials.json
  3. Add http://localhost:3000/callback as an authorized redirect URI
  4. Run: gdrive-copy auth ./credentials.json
  5. Run: gdrive-copy <shared-folder-id>
`);
}

async function main() {
  const { positional, skipNames, skipIds, port } = parseArgs();

  if (positional[0] === 'auth') {
    const credFile = positional[1];
    if (!credFile) {
      console.error('Usage: gdrive-copy auth <path-to-credentials.json>');
      process.exit(1);
    }
    await setupCredentials(credFile);
    return;
  }

  if (positional[0] === '--help' || positional[0] === 'help' || process.argv[2] === '--help') {
    printHelp();
    return;
  }

  const sourceFolderId = positional[0];
  if (!sourceFolderId) {
    printHelp();
    process.exit(1);
  }

  const destFolderId = positional[1] || 'root';

  const auth = await authorize(port);
  await run({ auth, sourceFolderId, destFolderId, skipNames, skipIds });
  process.exit(0);
}

main().catch(err => {
  console.error('\nError:', err.message || err);
  console.error('Progress saved — re-run the same command to resume.');
  process.exit(1);
});
