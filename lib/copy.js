const fs = require('fs');
const { MultiBar, Presets } = require('cli-progress');
const { google } = require('googleapis');
const { progressPath } = require('./config');

// --- Concurrency limiter ---
function makeLimiter(n) {
  let running = 0;
  const queue = [];
  return (fn) => new Promise((resolve, reject) => {
    const run = () => {
      running++;
      fn().then(resolve, reject).finally(() => { running--; queue.shift()?.(); });
    };
    running < n ? run() : queue.push(run);
  });
}

const limit = makeLimiter(5);

// --- Retry with exponential backoff ---
async function withRetry(fn, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      const isRateLimit = e.code === 429 || (e.errors?.[0]?.domain === 'usageLimits');
      if (isRateLimit && i < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      } else {
        throw e;
      }
    }
  }
}

// --- Drive helpers ---
async function listChildren(drive, folderId) {
  const items = [];
  let pageToken = null;
  do {
    const res = await withRetry(() => drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken: pageToken || undefined,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    }));
    items.push(...res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return items;
}

async function findExistingFolder(drive, name, parentId) {
  const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const res = await withRetry(() => drive.files.list({
    q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }));
  return res.data.files[0]?.id ?? null;
}

// --- Progress persistence ---
let progress = { folders: {}, files: [] };
let PROGRESS_PATH;

function loadProgress(sourceFolderId) {
  PROGRESS_PATH = progressPath(sourceFolderId);
  if (fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    progress.files = progress.files || [];
    progress.folders = progress.folders || {};
    return true;
  }
  return false;
}

function flushProgress() {
  const tmp = PROGRESS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(progress, null, 2));
  fs.renameSync(tmp, PROGRESS_PATH);
}

// --- Copy logic ---
async function copyFile(drive, fileId, fileName, destFolderId, bar, stats) {
  if (progress.files.includes(fileId)) {
    if (bar) bar.increment();
    return;
  }
  await limit(() => withRetry(() => drive.files.copy({
    fileId,
    resource: { name: fileName, parents: [destFolderId] },
    fields: 'id',
    supportsAllDrives: true,
  })));
  progress.files.push(fileId);
  flushProgress();
  stats.files++;
  if (bar) bar.increment();
}

async function copyFolder(drive, srcId, destParentId, folderName, multibar, stats, skipNames, skipIds, parentPath = null) {
  if (skipIds.has(srcId) || skipNames.has(folderName)) {
    return;
  }

  let destId = progress.folders[srcId];

  if (!destId) {
    destId = await findExistingFolder(drive, folderName, destParentId);
    if (!destId) {
      const res = await limit(() => withRetry(() => drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [destParentId],
        },
        fields: 'id',
        supportsAllDrives: true,
      })));
      destId = res.data.id;
      stats.folders++;
    }
    progress.folders[srcId] = destId;
    flushProgress();
  }

  const myPath = parentPath ? `${parentPath}/${folderName}` : folderName;
  const childParentPath = parentPath === null ? '' : myPath;

  const children = await listChildren(drive, srcId);
  const files = children.filter(c => c.mimeType !== 'application/vnd.google-apps.folder');
  const subfolders = children.filter(c => c.mimeType === 'application/vnd.google-apps.folder');

  const bar = files.length > 0 ? multibar.create(files.length, 0, { folder: myPath }) : null;

  await Promise.all([
    ...files.map(f => copyFile(drive, f.id, f.name, destId, bar, stats)),
    ...subfolders.map(f => copyFolder(drive, f.id, destId, f.name, multibar, stats, skipNames, skipIds, childParentPath)),
  ]);

  if (bar) bar.stop();
}

// --- Main export ---
async function run({ auth, sourceFolderId, destFolderId, skipNames, skipIds }) {
  const drive = google.drive({ version: 'v3', auth });

  const resumed = loadProgress(sourceFolderId);

  const meta = await withRetry(() => drive.files.get({
    fileId: sourceFolderId,
    fields: 'name',
    supportsAllDrives: true,
  }));
  const folderName = meta.data.name;

  if (resumed) {
    console.log(`Resuming: ${Object.keys(progress.folders).length} folders and ${progress.files.length} files already done.\n`);
  }

  if (skipNames.size || skipIds.size) {
    if (skipNames.size) console.log(`Skipping folder names: [${[...skipNames].join(', ')}]`);
    if (skipIds.size) console.log(`Skipping folder IDs:   [${[...skipIds].join(', ')}]`);
    console.log('');
  }

  console.log(`Copying "${folderName}" → ${destFolderId === 'root' ? 'My Drive root' : destFolderId}\n`);

  const stats = { folders: 0, files: 0 };
  const startTime = Date.now();

  const multibar = new MultiBar({
    format: 'Copying: {folder} [{bar}] {value}/{total} files',
    clearOnComplete: false,
    hideCursor: true,
    autopadding: true,
  }, Presets.shades_classic);

  await copyFolder(drive, sourceFolderId, destFolderId, folderName, multibar, stats, skipNames, skipIds);

  multibar.stop();

  fs.unlinkSync(PROGRESS_PATH);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! Created ${stats.folders} folder(s), copied ${stats.files} file(s) in ${elapsed}s.`);
}

module.exports = { run };
