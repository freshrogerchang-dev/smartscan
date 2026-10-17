// Read public dependency bytes/headers only; no model download or code execution.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const context = vm.createContext({ window: {} });
vm.runInContext(await readFile('public/runtime-config.js', 'utf8'), context);
const config = context.window.SMARTSCAN_CONFIG;
const sources = [
  { kind: 'script', url: `https://cdn.jsdelivr.net/npm/tesseract.js@${config.tesseractVersion}/dist/tesseract.min.js` },
  { kind: 'script', url: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js' },
  { kind: 'worker', url: config.workerPath },
  ...['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-lstm.wasm','tesseract-core-simd-lstm.wasm'].map(name => ({ kind: 'core', url: config.corePath + '/' + name })),
  ...['eng','chi_tra','jpn'].map(lang => ({ kind: 'model', url: config.langPath + '/' + lang + '.traineddata' }))
];
const assets = await Promise.all(sources.map(async item => {
  try {
    const method = item.kind === 'script' ? 'GET' : 'HEAD';
    const response = await fetch(item.url, { method, signal: AbortSignal.timeout(15000) });
    const bytes = method === 'GET' ? Buffer.from(await response.arrayBuffer()) : null;
    return { ...item, method, status: response.status, ok: response.ok, final_url: response.url,
      content_type: response.headers.get('content-type'), content_length_header: response.headers.get('content-length'),
      downloaded_bytes: bytes?.length ?? 0, integrity: bytes && response.ok ? 'sha384-' + createHash('sha384').update(bytes).digest('base64') : null };
  } catch (error) { return { ...item, ok: false, error: error.message }; }
}));
const report = { checked_at: new Date().toISOString(), scope: 'script GET for SRI; worker/core/model HEAD only; no browser or OCR validation', assets };
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/s4-runtime-assets.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(assets.map(x => ({ kind: x.kind, status: x.status, ok: x.ok, integrity: x.integrity, error: x.error })), null, 2));
if (assets.some(x => !x.ok)) process.exitCode = 1;
