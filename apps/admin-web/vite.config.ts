import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const boundary: Plugin = { name: 'admin-api-boundary', configureServer(server) {
  server.middlewares.use((req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith('/api') && !path.startsWith('/php')) return next();
    const allowed = (path === '/api/v1/admin/session' && ['GET', 'POST', 'DELETE'].includes(req.method || '')) ||
      (['/api/v1/admin/queue', '/api/v1/admin/status'].includes(path) && req.method === 'GET') ||
      (path === '/api/v1/settings' && ['GET', 'PUT'].includes(req.method || '')) ||
      (path === '/api/v1/playback/control' && req.method === 'POST') ||
      (/^\/api\/v1\/admin\/requests\/\d+$/.test(path) && req.method === 'DELETE') ||
      (/^\/api\/v1\/admin\/requests\/\d+\/move$/.test(path) && req.method === 'POST');
    if (allowed) return next();
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: { code: 'ADMIN_PROXY_DENIED', message: '只代理统一 Node 管理 API' } }));
  });
} };
export default defineConfig(({ mode }) => ({
  plugins: [boundary, react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true, cors: false,
    fs: { allow: [process.cwd(), resolve(process.cwd(), '../../packages/contracts')] },
    proxy: { '/api/v1/': { target: loadEnv(mode, process.cwd(), 'API_').API_PROXY_TARGET || 'http://127.0.0.1:3000',
      changeOrigin: false, configure(proxy) { proxy.on('proxyReq', (request) => request.removeHeader('authorization')); } } },
  },
}));
