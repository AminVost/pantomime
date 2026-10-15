import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./generated", import.meta.url)) } },
  base: "./",
  build: { target: "es2022", cssCodeSplit: true, sourcemap: false },
  server: { host: "127.0.0.1" }
});
