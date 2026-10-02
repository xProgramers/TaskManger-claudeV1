import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Keep the Supabase SDK in its own long-cacheable chunk.
        manualChunks: { supabase: ['@supabase/supabase-js'], react: ['react', 'react-dom'] },
      },
    },
  },
});
