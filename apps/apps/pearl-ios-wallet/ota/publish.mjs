import { createHash, createSign, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [dist, keyPath] = process.argv.slice(2);
if (!dist || !keyPath) throw new Error('Usage: node ota/publish.mjs <expo-export-directory> <private-key.pem>');
const config = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const runtime = config.runtimeVersion;
if (typeof runtime !== 'string' || !/^[a-zA-Z0-9._()-]+$/.test(runtime)) throw new Error('Invalid runtimeVersion');
const metadata = JSON.parse(readFileSync(path.join(dist, 'metadata.json'), 'utf8')).fileMetadata.ios;
const id = randomUUID();
const dir = path.join(os.tmpdir(), `pearl-ota-${id}`);
mkdirSync(dir, { recursive: true });
const base = `https://github.com/KhanhD1nh/pearl/releases/download/ota-${id}`;
const files = [];
function asset(file, ext, launch = false) {
  const data = readFileSync(path.join(dist, file));
  const key = createHash('md5').update(data).digest('hex');
  const name = `${key}.${launch ? 'bundle' : ext}`;
  const target = path.join(dir, name);
  if (!files.includes(target)) { copyFileSync(path.join(dist, file), target); files.push(target); }
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json' };
  const contentType = launch ? 'application/javascript' : types[ext];
  if (!contentType) throw new Error(`Unsupported asset extension: ${ext}`);
  return { hash: createHash('sha256').update(data).digest('base64url'), key, fileExtension: `.${launch ? 'bundle' : ext}`, contentType, url: `${base}/${name}` };
}
const manifest = JSON.stringify({ id, createdAt: new Date().toISOString(), runtimeVersion: runtime, launchAsset: asset(metadata.bundle, null, true), assets: metadata.assets.map(a => asset(a.path, a.ext)), metadata: {}, extra: { expoClient: config } });
const signature = createSign('RSA-SHA256').update(manifest).end().sign(readFileSync(keyPath), 'base64');
const record = path.join(dir, 'ios.json');
writeFileSync(record, JSON.stringify({ manifest, signature }));
execFileSync('gh', ['release', 'create', `ota-${id}`, ...files, '--repo', 'KhanhD1nh/pearl', '--title', `OTA ${id}`, '--notes', `Runtime ${runtime}`, '--prerelease'], { stdio: 'inherit' });
const api = `repos/KhanhD1nh/pearl/contents/${runtime}/ios.json`;
let sha;
try { sha = JSON.parse(execFileSync('gh', ['api', `${api}?ref=ota-updates`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).sha; } catch {}
const body = JSON.stringify({ message: `Publish OTA ${id}`, branch: 'ota-updates', content: readFileSync(record).toString('base64'), ...(sha ? { sha } : {}) });
execFileSync('gh', ['api', '--method', 'PUT', api, '--input', '-'], { input: body, stdio: ['pipe', 'ignore', 'inherit'] });
console.log(`Published ${id} for ${runtime}`);
