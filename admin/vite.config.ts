import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const codespaceName = process.env.CODESPACE_NAME;

function stripViteClientInCodespaces(): Plugin {
  return {
    name: 'strip-vite-client-in-codespaces',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!codespaceName) return html;
        return html.replace(
          /<script type="module" src="\/@vite\/client"><\/script>\s*/g,
          ''
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), stripViteClientInCodespaces()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    allowedHosts: codespaceName ? true : undefined,
    hmr: codespaceName ? false : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
