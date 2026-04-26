import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: false,
  bundle: true,
  minify: false,
  treeshake: true,
});
