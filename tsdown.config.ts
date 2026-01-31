import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: true,
  // We mark native modules and larger dependencies as external
  // to prevent issues with binary paths and keep the bundle clean.
  external: [
    '@ast-grep/napi',
    '@modelcontextprotocol/sdk',
    'simple-git',
  ],
})
