import { defineConfig } from 'vite';
const localBridge = { '/api': { target: 'http://127.0.0.1:17843', changeOrigin: true, configure(proxy) { proxy.on('proxyReq', req => { req.setHeader('Origin', 'http://127.0.0.1:17843'); }); } } };

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: localBridge },
  preview: { proxy: localBridge },
  build: { target: 'es2022', chunkSizeWarningLimit: 650 },
  test: { include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'] },
});
