import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';

// The ultracite vitest preset is intentionally not extended: tests run under
// bun:test, and the preset's prefer-importing-vitest-globals rule rewrites
// bun:test imports into broken vitest imports.
export default defineConfig({
	extends: [core],
	ignorePatterns: core.ignorePatterns,
	overrides: [
		{
			files: ['*.ts'],
			rules: {
				complexity: 'error',
			},
		},
	],
	rules: {
		complexity: 'off',
		curly: ['error', 'multi-or-nest', 'consistent'],
		'func-names': [
			'error',
			'always',
			{
				generators: 'never',
			},
		],
		'func-style': 'off',
		'import/no-relative-parent-imports': 'off',
		'import/no-self-import': 'off',
		'max-classes-per-file': 'off',
		'max-statements': 'off',
		'no-inner-declarations': 'off',
		'no-warning-comments': 'warn',
		'promise/prefer-await-to-callbacks': 'off',
		'promise/prefer-await-to-then': 'off',
		'typescript/no-namespace': 'off',
		'typescript/no-non-null-assertion': 'warn',
		'unicorn/catch-error-name': 'off',
	},
});
