import { Console, Effect, Option } from 'effect';
import { Command, Flag } from 'effect/unstable/cli';

import { Destination } from '../destination/index.ts';
import { Agent, Level, Message } from '../notification.ts';
import { descriptions } from '../notify-request.ts';
import { Registry } from '../registry.ts';

// The agent half of the CLI. These two commands are the CLI adapter over
// `Registry.send`, and their twins live in `src/mcp.ts`; the pair must accept
// and return the same things, so they are kept in one file to be read side by
// side. Prose here is written for a model, not for a person.

/**
 * `pageme notify` — the CLI transport.
 *
 * Takes the same `NotifyRequest` the MCP tool takes, spelled as flags and
 * validated by the same schemas, so both transports accept exactly what the
 * other does.
 */
export const notify = Command.make(
	'notify',
	{
		agent: Flag.string('agent').pipe(
			Flag.withSchema(Agent),
			Flag.withDescription(descriptions.agent)
		),
		destination: Flag.choice('destination', Destination.names).pipe(
			Flag.withDescription(descriptions.destination),
			Flag.optional
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
				destination: Option.getOrUndefined(destination),
				level,
				message,
			});
			// Same payload the MCP tool returns, so an agent reads one result
			// shape whichever transport it came through.
			yield* Console.log(
				JSON.stringify({ delivered: true, destination: sent })
			);
		})
).pipe(
	Command.withDescription(
		'Send a notification to the user. Use when you need their input, when an important task fails, or when a long-running task completes. Do not send routine progress updates.'
	)
);

/**
 * `pageme destinations` — what the agent can actually deliver to.
 *
 * Written for an agent to parse, not for a human to read: `config list` is the
 * human view of the same state.
 */
export const destinations = Command.make('destinations', {}, () =>
	Effect.gen(function* () {
		const registry = yield* Registry.Service;
		yield* Console.log(
			JSON.stringify({
				configured: registry.available,
				default: Option.getOrNull(registry.fallback),
			})
		);
	})
).pipe(
	Command.withDescription(
		'Print configured destinations as JSON, for agents to check before promising a destination'
	)
);
