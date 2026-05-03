const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'gdrive-copy');
const CREDENTIALS_PATH = path.join(CONFIG_DIR, 'credentials.json');
const TOKEN_PATH = path.join(CONFIG_DIR, 'token.json');

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function progressPath(sourceFolderId) {
  return path.join(CONFIG_DIR, `progress-${sourceFolderId}.json`);
}

module.exports = { CONFIG_DIR, CREDENTIALS_PATH, TOKEN_PATH, ensureConfigDir, progressPath };
