import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // During local `npm run dev`, forward API calls to the Express server
      // so you don't need CORS config. In production, Express serves both.
      "/api": "http://localhost:3000",
    },
  },
});
