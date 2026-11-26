import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readReleaseVersion } from './scripts/check-release-version.mjs';
const { version } = await readReleaseVersion(fileURLToPath(new URL('.', import.meta.url)));
const marker = JSON.stringify({ app: 'ClassQuest', version, name: 'Lớp Học Vui' }) + '\n';
const localBridge = { '/api': { target: 'http://127.0.0.1:17843', changeOrigin: true, configure(proxy) { proxy.on('proxyReq', req => { req.setHeader('Origin', 'http://127.0.0.1:17843'); }); } } };

export default defineConfig({
  plugins: [{
    name: 'application-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'classquest-version.json', source: marker }); },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/classquest-version.json' || !['GET', 'HEAD'].includes(req.method)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache');
        res.end(req.method === 'HEAD' ? '' : marker);
      });
    },
  }],
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: localBridge },
  preview: { proxy: localBridge },
  build: { target: 'es2022', chunkSizeWarningLimit: 650 },
  test: { include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'] },
});
