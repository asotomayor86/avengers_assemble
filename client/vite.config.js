import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite sirve el frontend en :5173 y reenvía /api y /socket.io
// al servidor Node (:3000), de modo que el cliente siempre usa el mismo origen.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Permite importar `shared/` (constantes/eventos) desde fuera de la carpeta client.
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
