import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Para desarrollo local con las funciones serverless usa `vercel dev` (sirve cliente
// + /api en un mismo origen). Si prefieres `vite` a secas, este proxy reenvía /api a
// un `vercel dev` levantado en el puerto 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Permite importar `shared/` (constantes/eventos) desde fuera de la carpeta client.
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
