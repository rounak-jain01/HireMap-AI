import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 👈 Naya Import

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 👈 Plugin add kar diya
  ],
})