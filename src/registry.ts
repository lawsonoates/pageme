import { Context, DateTime, Effect, Layer, Option } from 'effect';
import { ChildProcessSpawner } from 'effect/unstable/process';

import { Config } from './config.ts';
import { Desktop } from './destination/desktop.ts';
import { Destination } from './destination/index.ts';
import { Telegram } from './destination/telegram.ts';
import type { NotifyRequest } from './notify-request.ts';

export interface Interface {
	/** Destinations the user has configured, in preference order. */
	readonly available: readonly Destination.Name[];
	/** The destination used when the agent does not name one. */
	readonly fallback: Option.Option<Destination.Name>;
	/**
	 * Delivers the request to the destination it names, or to the default when
	 * it names none, and answers where it went. Fails with `NotConfiguredError`
	 * if the requested destination is not set up.
	 *
	 * Stamps the notification itself, so callers neither supply a clock nor
	 * learn the time: one reading cannot disagree with another.
	 */
	readonly send: (
		request: NotifyRequest
	) => Effect.Effect<Destination.Name, Destination.Error>;
}

export class Service extends Context.Service<Service, Interface>()(
	'Registry'
) {}

/**
 * Routes notifications across a fixed set of live destinations. A destination
 * present in `entries` is configured and reachable; anything else the agent
 * names is a `NotConfiguredError`.
 *
 * @param entries - Configured destinations, in preference order.
 * @param preferred - Destination to use when the agent names none.
 */
export const make = (
	entries: readonly (readonly [Destination.Name, Destination.Interface])[],
	preferred?: Destination.Name
): Interface => {
	const destinations = new Map(entries);
	const available = entries.map(([name]) => name);
	const fallback = Option.fromNullishOr(
		preferred && destinations.has(preferred) ? preferred : available[0]
	);

	const send = Effect.fn('Registry.send')(function* (
		request: NotifyRequest
	): Effect.fn.Return<Destination.Name, Destination.Error> {
		const name = Option.orElse(
			Option.fromNullishOr(request.destination),
			() => fallback
		);
		if (Option.isNone(name)) {
			return yield* new Destination.NoneConfiguredError({
				message:
					'No notification destinations are configured. The user must run `pageme config add` before notifications can be delivered.',
			});
		}

		const target = destinations.get(name.value);
		if (!target)
			return yield* Destination.notConfigured(name.value, available);

		// Read after resolving, so the stamp is the moment of delivery rather
		// than of the request, and failed lookups never touch the clock.
		const timestamp = yield* DateTime.nowAsDate;

		// Rebuilt rather than passed through: `destination` has been consumed
		// by the resolution above, and must not travel below it.
		yield* target.send(
			{
				agent: request.agent,
				level: request.level,
				message: request.message,
			},
			timestamp
		);
		return name.value;
	});

	return { available, fallback, send };
};

/**
 * Builds the live destinations from the user's config. They are constructed
 * once at startup, so what the registry holds is exactly what is configured.
 */
export const layer = Layer.effect(
	Service,
	Effect.gen(function* () {
		const config = yield* Config.Service;
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const file = yield* config.read();
		const token = yield* config.token();

		const entries: [Destination.Name, Destination.Interface][] = [];

		// Telegram needs both halves: settings in the config file and a stored
		// token. Half-configured is not configured.
		if (file.telegram && Option.isSome(token)) {
			entries.push([
				'telegram',
				Telegram.make({
					channel: file.telegram.channel,
					token: token.value,
				}),
			]);
		}

		if (file.desktop && Desktop.supported)
			entries.push(['desktop', Desktop.make(spawner)]);

		return make(entries, file.default);
	})
);

export const defaultLayer = layer.pipe(Layer.provide(Config.defaultLayer));

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Registry from './registry.ts';
