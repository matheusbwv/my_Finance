import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/my_Finance/",
  plugins: [react()],
  server: {
    host: true
  }
});
