import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const paths = new Map([
  ['/api/v1/user/session', 'POST'], ['/api/v1/capabilities', 'GET'], ['/api/v1/search', 'GET'],
  ['/api/v1/user/profile', 'GET'], ['/api/v1/user/profile', 'PUT'], ['/api/v1/user/participants', 'GET'], ['/api/v1/user/reservations', 'GET'],
  ['/api/v1/queue', 'GET'], ['/api/v1/playback', 'GET'], ['/api/v1/playback/agent', 'GET'],
  ['/api/v1/user/player/control', 'POST'],
  ['/api/v1/danmaku/status', 'GET'], ['/api/v1/danmaku', 'POST'],
  ['/api/v1/requests', 'POST'], ['/api/v1/requests/intent', 'POST'], ['/api/v1/requests/result', 'POST'],
]);
const boundary: Plugin = { name: 'user-api-boundary', configureServer(server) {
  server.middlewares.use((req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!path.startsWith('/api') && !path.startsWith('/php')) return next();
    if (paths.get(path) === req.method) return next();
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: { code: 'USER_PROXY_DENIED', message: '用户端不代理管理接口或旧 PHP 路径' } }));
  });
} };
export default defineConfig(({ mode, command }) => ({
  base: command === 'build' ? '/user/' : '/',
  plugins: [boundary, react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'], alias: { react: resolve(process.cwd(), 'node_modules/react'), '@vue/reactivity': resolve(process.cwd(), 'node_modules/@vue/reactivity'), i18next: resolve(process.cwd(), 'node_modules/i18next') } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, cors: false,
    watch: { usePolling: process.env.VITE_USE_POLLING === '1', interval: 500 },
    fs: { allow: [process.cwd(), resolve(process.cwd(), '../../packages/contracts'), resolve(process.cwd(), '../../packages/web-foundation'), resolve(process.cwd(), '../../packages/theme'), resolve(process.cwd(), '../../packages/language'), resolve(process.cwd(), '../../packages/reactiveStore')] },
    proxy: { '/api/v1/': { target: process.env.API_PROXY_TARGET || loadEnv(mode, process.cwd(), 'API_').API_PROXY_TARGET || 'http://127.0.0.1:3000',
      changeOrigin: false, configure(proxy) { proxy.on('proxyReq', (request) => request.removeHeader('authorization')); } } },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, cors: false },
}));
