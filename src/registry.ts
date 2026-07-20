import { Context, Effect, Layer, Option } from 'effect';
import { HttpClient } from 'effect/unstable/http';
import { ChildProcessSpawner } from 'effect/unstable/process';

import { Config } from './config.ts';
import { Desktop } from './destination/desktop.ts';
import { Discord } from './destination/discord.ts';
import { Destination } from './destination/index.ts';
import type { NotifyRequest } from './notify-request.ts';

export interface Interface {
	readonly available: readonly Destination.Name[];
	readonly send: (
		request: NotifyRequest
	) => Effect.Effect<Destination.Name, Destination.Error>;
}

export class Service extends Context.Service<Service, Interface>()(
	'Registry'
) {}

export const make = (
	entries: readonly (readonly [Destination.Name, Destination.Interface])[]
): Interface => {
	const destinations = new Map(entries);
	const available = entries.map(([name]) => name);

	const send = Effect.fn('Registry.send')(function* (
		request: NotifyRequest
	): Effect.fn.Return<Destination.Name, Destination.Error> {
		const target = destinations.get(request.destination);
		if (!target) {
			return yield* Destination.notConfigured(
				request.destination,
				available
			);
		}

		// Rebuilt rather than passed through: `destination` has been consumed
		// by the resolution above, and must not travel below it.
		yield* target.send({
			agent: request.agent,
			level: request.level,
			message: request.message,
		});
		return request.destination;
	});

	return { available, send };
};

export const layer = Layer.effect(
	Service,
	Effect.gen(function* () {
		const config = yield* Config.Service;
		const client = yield* HttpClient.HttpClient;
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const file = yield* config.read();
		const discordUrl = yield* config.token('discord');

		const entries: [Destination.Name, Destination.Interface][] = [];

		// Discord needs both halves: a key in the config file and a stored
		// webhook URL. Half-configured is not configured.
		if (file.discord && Option.isSome(discordUrl)) {
			entries.push([
				'discord',
				Discord.make({ url: discordUrl.value }, client),
			]);
		}

		if (file.desktop && Desktop.supported)
			entries.push(['desktop', Desktop.make(spawner)]);

		return make(entries);
	})
);

export const defaultLayer = layer.pipe(Layer.provide(Config.defaultLayer));

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Registry from './registry.ts';
