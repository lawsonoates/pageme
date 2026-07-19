import { describe, expect, test } from 'bun:test';

import { Effect, Exit, Option } from 'effect';

import { Destination } from './destination/index.ts';
import type { NotifyRequest } from './notify-request.ts';
import { Registry } from './registry.ts';

const request: NotifyRequest = {
	agent: 'Claude Code',
	level: 'completed',
	message: 'All 42 tests passed.',
};

// Records deliveries instead of reaching Telegram or Notification Center.
const stub = (sent: Destination.Name[], name: Destination.Name) =>
	[
		name,
		{
			send: () =>
				Effect.sync(() => {
					sent.push(name);
				}),
		},
	] as const;

const run = <A, E>(effect: Effect.Effect<A, E>) =>
	Effect.runSyncExit(effect as Effect.Effect<A, E, never>);

describe('registry', () => {
	test('delivers to the destination the agent names', () => {
		const sent: Destination.Name[] = [];
		const registry = Registry.make(
			[stub(sent, 'telegram'), stub(sent, 'desktop')],
			'telegram'
		);

		const exit = run(registry.send({ ...request, destination: 'desktop' }));

		expect(Exit.isSuccess(exit)).toBe(true);
		expect(sent).toEqual(['desktop']);
	});

	test('falls back to the configured default when none is named', () => {
		const sent: Destination.Name[] = [];
		const registry = Registry.make(
			[stub(sent, 'telegram'), stub(sent, 'desktop')],
			'desktop'
		);

		run(registry.send(request));

		expect(sent).toEqual(['desktop']);
	});

	test('falls back to the first configured destination without a default', () => {
		const sent: Destination.Name[] = [];
		const registry = Registry.make([stub(sent, 'telegram')]);

		expect(registry.fallback).toEqual(Option.some('telegram'));
		run(registry.send(request));

		expect(sent).toEqual(['telegram']);
	});

	test('ignores a default naming an unconfigured destination', () => {
		const sent: Destination.Name[] = [];
		const registry = Registry.make([stub(sent, 'desktop')], 'telegram');

		expect(registry.fallback).toEqual(Option.some('desktop'));
	});

	test('reports what is available when the agent names an unconfigured destination', () => {
		const sent: Destination.Name[] = [];
		const registry = Registry.make([stub(sent, 'desktop')]);

		// `flip` puts the typed error in the success channel, so the test can
		// assert on its fields rather than dig through a Cause.
		const exit = run(
			registry
				.send({ ...request, destination: 'telegram' })
				.pipe(Effect.flip)
		);

		const error = Exit.isSuccess(exit) ? exit.value : undefined;

		expect(error).toBeInstanceOf(Destination.NotConfiguredError);
		expect((error as Destination.NotConfiguredError).available).toEqual([
			'desktop',
		]);
		expect((error as Destination.NotConfiguredError).message).toContain(
			'desktop'
		);
		expect(sent).toEqual([]);
	});

	test('fails distinctly when nothing is configured at all', () => {
		const registry = Registry.make([]);

		const exit = run(registry.send(request));

		expect(Exit.isFailure(exit)).toBe(true);
		expect(registry.available).toEqual([]);
		expect(Option.isNone(registry.fallback)).toBe(true);
	});

	test('surfaces a delivery failure from the destination', () => {
		const registry = Registry.make([
			[
				'desktop',
				{
					send: () =>
						Effect.fail(
							new Destination.DeliveryError({
								destination: 'desktop',
								message: 'osascript exploded',
							})
						),
				},
			],
		]);

		const exit = run(registry.send(request));

		expect(Exit.isFailure(exit)).toBe(true);
	});
});
