import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tideDpopPlugin } from '@tidecloak/js/vite';
import tideConfig from './public/tidecloak.json';
export default defineConfig({
  plugins: [tideDpopPlugin({ config: tideConfig }), react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? 3001}` } },
});
