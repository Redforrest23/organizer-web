import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: '/redforrest23/organizer-web/',
    build: {
        outDir: 'dist',
        sourcemap: false
    }
});