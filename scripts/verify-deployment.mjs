import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'https://smartscan-personal.freshrogerchang.workers.dev';
const version = process.argv[2];
if (!version) throw Error('Usage: node scripts/verify-deployment.mjs CLOUDFLARE_VERSION_ID');
async function files(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory()) result.push(...await files(directory + '/' + item.name, prefix + item.name + '/'));
    else if (item.isFile()) result.push(prefix + item.name);
  }
  return result;
}
const assets = await Promise.all((await files('public')).sort().map(async path => {
  try {
    const response = await fetch(base + '/' + path + '?verify=' + Date.now(), { signal: AbortSignal.timeout(20000) });
    const bytes = Buffer.from(await response.arrayBuffer()), local = await readFile('public/' + path);
    return { path: '/' + path, status: response.status, type: response.headers.get('content-type'),
      sha256: createHash('sha256').update(bytes).digest('hex'), matches_local: bytes.equals(local) };
  } catch(error) { return { path: '/' + path, matches_local: false, error: error.message }; }
}));
const report = { url: base, version_id: version, app_version: JSON.parse(await readFile('package.json','utf8')).version, checked_at: new Date().toISOString(), assets };
await writeFile('docs/evidence/s4-cloudflare-deployment.json', JSON.stringify(report,null,2) + '\n');
console.log(JSON.stringify({ assets: assets.length, all_http_200: assets.every(x=>x.status===200), all_bytes_match: assets.every(x=>x.matches_local) }));
if (assets.some(x=>x.status!==200 || !x.matches_local)) process.exitCode = 1;
