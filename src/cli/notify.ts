import { Console, Effect } from 'effect';
import { Command, Flag } from 'effect/unstable/cli';

import { Destination } from '../destination/index.ts';
import { Agent, Level, Message } from '../notification.ts';
import { descriptions } from '../notify-request.ts';
import { Registry } from '../registry.ts';

// The agent half of the CLI: these two commands are the whole surface an agent
// touches, and `./config.ts` is the human one. Prose here is written for a
// model, not for a person.

// Spells `NotifyRequest` as flags and validates them with that struct's own
// schemas, so what the CLI accepts is defined in one place.
export const notify = Command.make(
	'notify',
	{
		agent: Flag.choice('agent', Agent.literals).pipe(
			Flag.withDescription(descriptions.agent)
		),
		destination: Flag.choice('destination', Destination.names).pipe(
			Flag.withDescription(descriptions.destination)
		),
		level: Flag.choice('level', Level.literals).pipe(
			Flag.withDescription(descriptions.level)
		),
		message: Flag.string('message').pipe(
			Flag.withSchema(Message),
			Flag.withDescription(descriptions.message)
		),
	},
	({ agent, destination, level, message }) =>
		Effect.gen(function* () {
			const registry = yield* Registry.Service;
			const sent = yield* registry.send({
				agent,
				destination,
				level,
				message,
			});
			// JSON rather than prose: the reader is an agent, and a
			// machine-readable result is one less thing to parse wrong.
			yield* Console.log(
				JSON.stringify({ delivered: true, destination: sent })
			);
		})
).pipe(
	Command.withDescription(
		'Send a notification to the user. Use when you need their input, when an important task fails, or when a long-running task completes. Do not send routine progress updates.'
	)
);

// Written for an agent to parse, not a human: `config list` is the human view
// of the same state.
export const destinations = Command.make('destinations', {}, () =>
	Effect.gen(function* () {
		const registry = yield* Registry.Service;
		yield* Console.log(JSON.stringify({ configured: registry.available }));
	})
).pipe(
	Command.withDescription(
		'Print configured destinations as JSON, for agents to check before promising a destination'
	)
);
