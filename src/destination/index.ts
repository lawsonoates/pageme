import type { Effect } from 'effect';
import { Schema } from 'effect';

import type { Notification } from '../notification.ts';

// The agent picks one by name, so these strings are part of what the CLI accepts.
export const Name = Schema.Literals(['discord', 'desktop']);

export type Name = typeof Name.Type;

export const names: readonly Name[] = ['discord', 'desktop'];

export const labels: Record<Name, string> = {
	desktop: 'macOS Notification Center on this machine',
	discord: 'Discord message to your channel',
};

export class DeliveryError extends Schema.TaggedErrorClass<DeliveryError>()(
	'DeliveryError',
	{
		destination: Name,
		message: Schema.String,
	}
) {}

// Carries the destinations that *are* available so the agent can retry against
// one of them rather than guessing.
export class NotConfiguredError extends Schema.TaggedErrorClass<NotConfiguredError>()(
	'NotConfiguredError',
	{
		available: Schema.Array(Name),
		message: Schema.String,
		requested: Name,
	}
) {}

export const notConfigured = (
	requested: Name,
	available: readonly Name[]
): NotConfiguredError =>
	new NotConfiguredError({
		available,
		message:
			available.length === 0
				? `"${requested}" is not configured, and no other destination is either. Tell the user to run \`pageme config add ${requested}\`.`
				: `"${requested}" is not configured. Configured destinations: ${available.join(', ')}. Retry with one of those, or tell the user to run \`pageme config add ${requested}\`.`,
		requested,
	});

// No separate "nothing is configured" failure: every request names a
// destination, so an empty setup is a NotConfiguredError with an empty
// `available` list.
export type Error = DeliveryError | NotConfiguredError;

// Each destination builds its own DeliveryError rather than failing loosely for
// something here to tag: a shared wrapper would have to accept an `unknown`
// failure, costing every destination its typed error channel.
export interface Interface {
	readonly send: (
		notification: Notification
	) => Effect.Effect<void, DeliveryError>;
}

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Destination from './index.ts';
