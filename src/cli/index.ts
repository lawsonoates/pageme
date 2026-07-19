import { Console, Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';

import { Config } from '../config.ts';
import { Mcp } from '../mcp.ts';
import { Registry } from '../registry.ts';
import { config } from './config.ts';
import { destinations, notify } from './notify.ts';

const serve = Command.make('serve', {}, () =>
	Effect.gen(function* () {
		const registry = yield* Registry.Service;

		// The MCP client owns stdout for JSON-RPC, so warn on stderr only.
		if (registry.available.length === 0) {
			yield* Console.error(
				'pageme: no destinations configured; run `pageme config add`.'
			);
		}

		yield* Effect.never;
	}).pipe(Effect.provide(Mcp.layer))
).pipe(
	Command.withDescription(
		'Run the MCP server on stdio for a local agent to connect to'
	)
);

const mcp = Command.make('mcp').pipe(
	Command.withDescription('Host the MCP transport'),
	Command.withSubcommands([serve])
);

/**
 * Root `pageme` command.
 */
export const run = Command.make('pageme').pipe(
	Command.withDescription(
		'Let local coding agents notify you when they need input or finish work.'
	),
	Command.withSubcommands([config, destinations, mcp, notify])
);

/**
 * Services every command needs.
 */
export const layer = Layer.mergeAll(Config.defaultLayer, Registry.defaultLayer);

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Cli from './index.ts';
