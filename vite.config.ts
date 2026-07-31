/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // Testing the mobile layer on a real device through an ngrok tunnel.
  // `allowedHosts` is matched against the Host header, which is a bare hostname
  // — a full URL with a scheme never matches and every request comes back
  // "Blocked request. This host is not allowed." The leading dot allows the
  // hostname and all its subdomains, so a free tunnel's rotating subdomain
  // keeps working without editing this file on every ngrok restart.
  server: {
    allowedHosts: ['.ngrok-free.dev'],
  },
})
