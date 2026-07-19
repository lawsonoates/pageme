import dedent from 'dedent';
import { Effect, Layer, Option, Schema } from 'effect';
import { McpServer, Tool, Toolkit } from 'effect/unstable/ai';

import { Destination } from './destination/index.ts';
import { NotifyRequest } from './notify-request.ts';
import { Registry } from './registry.ts';

const names = Destination.names
	.map((name) => `${name} (${Destination.labels[name]})`)
	.join(', ');

const notify = Tool.make('notify', {
	description: dedent`
		Send a notification to the user. Use when you need their input, when an important task fails, or when a long-running task completes. Do not send routine progress updates.

		Call \`destinations\` first if you need to know what is configured. Set \`destination\` when the user asked for a specific one — for example "message me on telegram when you are done".

		Destinations: ${names}. Omit \`destination\` to use the user's default. If the chosen destination is not configured the call fails and names the ones that are.
	`,
	failure: Schema.Union([
		Destination.DeliveryError,
		Destination.NotConfiguredError,
		Destination.NoneConfiguredError,
	]),
	parameters: NotifyRequest,
	success: Schema.Struct({
		delivered: Schema.Literal(true),
		destination: Destination.Name,
	}),
});

const destinations = Tool.make('destinations', {
	description: dedent`
		List configured notification destinations. Call before promising a destination, and before a long task you will report back on. Only names in \`configured\` can be delivered to; \`default\` is used when \`notify\` omits \`destination\`.
	`,
	success: Schema.Struct({
		configured: Schema.Array(Destination.Name),
		default: Schema.NullOr(Destination.Name),
	}),
});

/**
 * The PageMe MCP toolkit: `notify` plus `destinations`.
 */
export const toolkit = Toolkit.make(notify, destinations);

/**
 * Handlers for {@link toolkit}, routing each notification through the
 * `Registry` to the destination the agent chose.
 */
export const handlers = toolkit.toLayer(
	Effect.gen(function* () {
		const registry = yield* Registry.Service;

		return {
			destinations: () =>
				Effect.succeed({
					configured: [...registry.available],
					default: Option.getOrNull(registry.fallback),
				}),
			notify: Effect.fn('Mcp.notify')(function* (params) {
				const destination = yield* registry.send(params);
				return { delivered: true, destination } as const;
			}),
		};
	})
);

/**
 * MCP server over stdio, the transport local agents spawn directly.
 */
export const layer = McpServer.toolkit(toolkit).pipe(
	Layer.provide(handlers),
	Layer.provideMerge(
		McpServer.layerStdio({
			name: 'pageme',
			version: '0.1.0',
		})
	)
);

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Mcp from './mcp.ts';
