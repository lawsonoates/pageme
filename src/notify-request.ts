import { Schema } from 'effect';

import { Destination } from './destination/index.ts';
import {
	Agent,
	descriptions as notificationDescriptions,
	Level,
	Message,
} from './notification.ts';

/**
 * What each field means, written for the agent that has to fill it in. Both
 * transports address the same reader — an agent choosing how to call this —
 * so the CLI reads its flag help from here and the MCP tool schema carries
 * the same strings as annotations.
 *
 * Neither mentions the values a choice accepts: the CLI renders `(choices: …)`
 * itself, and the tool schema carries an `enum`.
 */
export const descriptions = {
	...notificationDescriptions,
	destination:
		'Where to deliver. Omit unless the user named a destination; the default is used otherwise.',
} as const;

/**
 * What an agent asks for: a notification plus, optionally, where to send it.
 *
 * Distinct from {@link Notification}, which is the payload the user reads. The
 * registry consumes `destination` when it resolves the target and passes only
 * the notification onwards, so nothing below the resolution point can hold a
 * destination that disagrees with the one actually delivering.
 *
 * The fields carry their own descriptions; only `destination` is annotated
 * here, and outside `Schema.optional` — annotating within it is dropped.
 */
export const NotifyRequest = Schema.Struct({
	agent: Agent,
	destination: Schema.optional(Destination.Name).annotate({
		description: descriptions.destination,
	}),
	level: Level,
	message: Message,
});

/**
 * A request from an agent to notify the user.
 */
export type NotifyRequest = typeof NotifyRequest.Type;
