import { Layer } from 'effect';
import { Command } from 'effect/unstable/cli';

import { Config } from '../config.ts';
import { Registry } from '../registry.ts';
import { config } from './config.ts';
import { destinations, notify } from './notify.ts';

export const run = Command.make('pageme').pipe(
	Command.withDescription(
		'Let local coding agents notify you when they need input or finish work.'
	),
	Command.withSubcommands([config, destinations, notify])
);

export const layer = Layer.mergeAll(Config.defaultLayer, Registry.defaultLayer);

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Cli from './index.ts';
