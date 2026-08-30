import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const codespaceName = process.env.CODESPACE_NAME;
const codespaceForwardingDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
const codespaceHttpsOrigin = codespaceName
  ? `https://${codespaceName}-3000.${codespaceForwardingDomain}`
  : '';

/** Vite still injects /@vite/client when hmr is false; that client throws in Codespaces. */
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
  define: {
    'import.meta.env.VITE_CODESPACE_HTTPS_ORIGIN': JSON.stringify(codespaceHttpsOrigin),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Allow the GitHub Codespaces forwarded host (Vite blocks non-localhost hosts by default)
    allowedHosts: codespaceName ? true : undefined,
    // Codespaces HTTPS preview often drops Vite's HMR websocket
    // (`wss://…-3000.app.github.dev` → "WebSocket closed without opened").
    // That uncaught error can block the page. Disable live-reload here;
    // refresh the browser after code changes.
    hmr: codespaceName ? false : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
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
