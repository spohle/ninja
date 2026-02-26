import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  // this block will allow docker to expose the port to the computer
  server: {
    host: true, // binds to 0.0.0.0
    port: 5173,
    watch: {
      usePolling: true, // ensures hot reloading works across docker
    }
  }
})
