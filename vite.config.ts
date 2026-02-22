
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
  },
  server: {
    // 轉發 API 請求給 Wrangler (Worker) 本地伺服器
    // proxy: {
    //   '/api': {
    //     target: 'http://127.0.0.1:8787',
    //     changeOrigin: true,
    //     secure: false,
    //   },
    //   '/login': {
    //     target: 'http://127.0.0.1:8787',
    //     changeOrigin: true,
    //     secure: false,
    //   }
    // }
  }
});
