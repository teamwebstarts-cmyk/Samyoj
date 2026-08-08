import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const codespaceName = process.env.CODESPACE_NAME;
const codespaceDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? 'app.github.dev';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Allow the GitHub Codespaces forwarded host (Vite blocks non-localhost hosts by default)
    allowedHosts: codespaceName ? [`.${codespaceDomain}`] : undefined,
    // HMR must go over the forwarded HTTPS origin when running in a Codespace
    hmr: codespaceName
      ? {
          host: `${codespaceName}-3000.${codespaceDomain}`,
          protocol: 'wss',
          clientPort: 443,
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
      },
      // Health check endpoint
      '/healthz': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
