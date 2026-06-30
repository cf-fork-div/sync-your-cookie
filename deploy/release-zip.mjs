import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;

const distZipDir = path.join(root, 'dist-zip');
const releaseDir = path.join(root, 'dist', 'release');

if (!fs.existsSync(distZipDir)) {
  console.error('dist-zip/ not found. Run `pnpm zip` first.');
  process.exit(1);
}

const zips = fs
  .readdirSync(distZipDir)
  .filter(name => name.endsWith('.zip'))
  .map(name => ({
    name,
    mtime: fs.statSync(path.join(distZipDir, name)).mtimeMs,
  }))
  .sort((a, b) => b.mtime - a.mtime);

if (zips.length === 0) {
  console.error('No .zip files in dist-zip/. Run `pnpm zip` first.');
  process.exit(1);
}

const latest = zips[0].name;
fs.mkdirSync(releaseDir, { recursive: true });

const stableName = `sync-your-cookie-${version}.zip`;
const src = path.join(distZipDir, latest);
const dest = path.join(releaseDir, stableName);

fs.copyFileSync(src, dest);
console.log(`Release package: ${path.relative(root, dest)}`);
console.log(`  (from ${latest})`);
