import { defineConfig } from "vite";

// 開発時のAPI呼び出しを backend (3001) に中継します。
// これで frontend (5173) から /api を叩いてもCORSで詰まりません。
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
