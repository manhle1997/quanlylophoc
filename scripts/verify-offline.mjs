import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const files = await fs.readdir(root, { recursive: true });
let bytes = 0;
for (const file of files) {
  const target = path.join(root, file), info = await fs.stat(target); if (!info.isFile()) continue;
  bytes += info.size;
  if (/\.(html|css|js)$/.test(file)) {
    const text = await fs.readFile(target, 'utf8');
    const externalAsset = /(?:src|href)\s*=\s*["']https?:\/\//i.test(text) || /(?:fetch|import)\s*\(\s*["']https?:\/\//.test(text) || /https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com)/.test(text);
    if (externalAsset) throw new Error(`External runtime dependency found: ${file}`);
  }
}
console.log(`Static offline check PASS: ${files.length} entries, ${(bytes / 1024).toFixed(1)} KiB. Runtime loopback-only requests are checked by E2E; this scan alone does not prove cold-start offline.`);
