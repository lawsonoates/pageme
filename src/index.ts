#!/usr/bin/env node
import {
	NodeHttpClient,
	NodeRuntime,
	NodeServices,
} from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';

import { Cli } from './cli/index.ts';

// Every expected failure carries a `message` written for whoever reads it, and
// becomes stderr plus a non-zero exit — what an agent shelling out observes.
const report = (error: { readonly message: string }) =>
	Effect.sync(() => {
		console.error(error.message);
		process.exitCode = 1;
	});

Command.run(Cli.run, { version: '0.1.0' }).pipe(
	Effect.catchTags({
		ConfigError: report,
		DeliveryError: report,
		NotConfiguredError: report,
	}),
	// `provideMerge` so the platform services reach both the app's own layers
	// and `Command.run`, which needs them for prompts and argument parsing.
	Effect.provide(
		Cli.layer.pipe(
			Layer.provideMerge(
				Layer.merge(NodeServices.layer, NodeHttpClient.layerUndici)
			)
		)
	),
	NodeRuntime.runMain
);
