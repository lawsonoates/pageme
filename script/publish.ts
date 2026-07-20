#!/usr/bin/env bun

import { $ } from 'bun';

const version = Bun.argv.at(2);
const semver =
	/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?(?:\+[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?$/u;

// ---- guard ----
if (!version || !semver.test(version)) {
	console.error('Usage: bun run release <version>');
	process.exit(1);
}

const branch = await $`git branch --show-current`.text();
if (branch.trim() !== 'master') {
	console.error(
		`Refusing to publish from "${branch.trim()}"; checkout master first.`
	);
	process.exit(1);
}

const status = await $`git status --porcelain`.text();
if (status.trim()) {
	console.error('Refusing to publish with uncommitted changes.');
	process.exit(1);
}

await $`git fetch origin master`;
const head = await $`git rev-parse HEAD`.text();
const remote = await $`git rev-parse origin/master`.text();
if (head.trim() !== remote.trim()) {
	console.error(
		'Refusing to publish: master is not in sync with origin/master.'
	);
	process.exit(1);
}

await $`npm whoami`;

const tag = await $`git tag --list v${version}`.text();
if (tag.trim()) {
	console.error(`Refusing to publish: tag v${version} already exists.`);
	process.exit(1);
}

const pkg = await Bun.file('package.json').json();
if (pkg.name !== '@lawsonoates/pageme') {
	console.error('Refusing to publish an unexpected package.');
	process.exit(1);
}

const published = await $`npm view ${pkg.name}@${version} version`
	.quiet()
	.nothrow();
if (published.exitCode === 0) {
	console.error(
		`Refusing to publish: ${pkg.name}@${version} already exists.`
	);
	process.exit(1);
}

console.log(`\n=== releasing ${pkg.name}@${version} ===\n`);

// ---- version ----
const bump = pkg.version !== version;
if (bump) {
	pkg.version = version;
	await Bun.write('package.json', `${JSON.stringify(pkg, null, '\t')}\n`);
	await $`bun install --lockfile-only`;
}

// ---- validate ----
await Promise.all([$`bun run check`, $`bun run test`, $`bun run typecheck`]);
await $`bun run build`;
await $`npm pack --dry-run`;

// ---- release ----
if (bump) {
	await $`git add package.json bun.lock`;
	await $`git commit -m ${`release: pageme v${version}`}`;
}
await $`git tag -a v${version} -m ${`release: pageme v${version}`}`;
await $`npm publish --access public`;
await $`git push --follow-tags`;

console.log(`\n=== published ${pkg.name}@${version} ===\n`);
