#!/usr/bin/env node
import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';

import { Cli } from './cli/index.ts';

// Every expected failure carries a `message` written for whoever reads it —
// the agent, for delivery failures; the user, for config ones. Over MCP these
// are typed failures the SDK serialises; over the CLI they are stderr plus a
// non-zero exit, which is what an agent shelling out actually observes.
const report = (error: { readonly message: string }) =>
	Effect.sync(() => {
		console.error(error.message);
		process.exitCode = 1;
	});

Command.run(Cli.run, { version: '0.1.0' }).pipe(
	Effect.catchTags({
		ConfigError: report,
		DeliveryError: report,
		NoneConfiguredError: report,
		NotConfiguredError: report,
	}),
	// `provideMerge` so the platform services reach both the app's own layers
	// and `Command.run`, which needs them for prompts and argument parsing.
	Effect.provide(Cli.layer.pipe(Layer.provideMerge(NodeServices.layer))),
	NodeRuntime.runMain
);
