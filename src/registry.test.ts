import { describe, expect, test } from 'bun:test';

import { Effect, Exit } from 'effect';

import { Destination } from './destination/index.ts';
import type { NotifyRequest } from './notify-request.ts';
import { Registry } from './registry.ts';

const request = (destination: Destination.Name): NotifyRequest => ({
	agent: 'claude',
	destination,
	level: 'completed',
	message: 'All 42 tests passed.',
});

// Records deliveries instead of reaching Discord or Notification Center.
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
		const registry = Registry.make([
			stub(sent, 'discord'),
			stub(sent, 'desktop'),
		]);

		const exit = run(registry.send(request('desktop')));

		expect(Exit.isSuccess(exit)).toBe(true);
		expect(sent).toEqual(['desktop']);
	});

	test('answers with the destination it delivered to', () => {
		const sent: Destination.Name[] = [];
		const registry = Registry.make([stub(sent, 'discord')]);

		const exit = run(registry.send(request('discord')));

		expect(Exit.isSuccess(exit) && exit.value).toBe('discord');
	});

	test('never substitutes another destination for the one named', () => {
		const sent: Destination.Name[] = [];
		// Exactly one destination is configured, and it is not the one asked
		// for: the tempting "there is only one, use it" shortcut is the
		// behaviour this asserts against.
		const registry = Registry.make([stub(sent, 'desktop')]);

		const exit = run(registry.send(request('discord')));

		expect(Exit.isFailure(exit)).toBe(true);
		expect(sent).toEqual([]);
	});

	test('reports what is available when the agent names an unconfigured destination', () => {
		const sent: Destination.Name[] = [];
		const registry = Registry.make([stub(sent, 'desktop')]);

		// `flip` puts the typed error in the success channel, so the test can
		// assert on its fields rather than dig through a Cause.
		const exit = run(registry.send(request('discord')).pipe(Effect.flip));

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

	test('tells the user to configure something when nothing is', () => {
		const registry = Registry.make([]);

		const exit = run(registry.send(request('discord')).pipe(Effect.flip));
		const error = Exit.isSuccess(exit) ? exit.value : undefined;

		expect(error).toBeInstanceOf(Destination.NotConfiguredError);
		expect((error as Destination.NotConfiguredError).available).toEqual([]);
		// With nothing set up the agent cannot retry its way out, so the
		// message has to point at `config add` instead.
		expect((error as Destination.NotConfiguredError).message).toContain(
			'pageme config add'
		);
		expect(registry.available).toEqual([]);
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

		const exit = run(registry.send(request('desktop')));

		expect(Exit.isFailure(exit)).toBe(true);
	});
});
