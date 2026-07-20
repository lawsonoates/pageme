import { Schema } from 'effect';

import { Destination } from './destination/index.ts';
import {
	Agent,
	descriptions as notificationDescriptions,
	Level,
	Message,
} from './notification.ts';

export const descriptions = {
	...notificationDescriptions,
	destination:
		'Where to deliver. Required: check `destinations` for what is configured, and prefer the one the user named if they named one.',
} as const;

// `destination` is required rather than defaulted: a silent default is how an
// agent believes it paged while the message went to a destination the user had
// stopped watching. The registry consumes it when resolving the target and
// passes only the notification onwards.
export const NotifyRequest = Schema.Struct({
	agent: Agent,
	destination: Destination.Name.annotate({
		description: descriptions.destination,
	}),
	level: Level,
	message: Message,
});

export type NotifyRequest = typeof NotifyRequest.Type;
