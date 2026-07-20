import { defineConfig } from 'tsdown';

export default defineConfig({
	clean: true,
	deps: {
		onlyImport: ['@effect/platform-node', 'effect'],
	},
	dts: false,
	entry: ['src/index.ts'],
	format: ['esm'],
	platform: 'node',
	publint: {
		level: 'error',
	},
	sourcemap: true,
});
