import { Effect, Schema } from 'effect';

import type { Notification } from '../notification.ts';

/**
 * Destinations a notification can be delivered to. The agent picks one by
 * name, so these strings are part of the MCP tool contract.
 */
export const Name = Schema.Literals(['telegram', 'desktop']);

/**
 * Name of a delivery destination.
 */
export type Name = typeof Name.Type;

/**
 * Every destination, whether or not the user has configured it.
 */
export const names: readonly Name[] = ['telegram', 'desktop'];

/**
 * Human-readable description of each destination, shown by `pageme config`
 * and in the MCP tool description so the agent knows what it is choosing.
 */
export const labels: Record<Name, string> = {
	desktop: 'macOS Notification Center on this machine',
	telegram: 'Telegram message to your chat',
};

/**
 * Failure delivering a notification to a destination.
 */
export class DeliveryError extends Schema.TaggedErrorClass<DeliveryError>()(
	'DeliveryError',
	{
		destination: Name,
		message: Schema.String,
	}
) {}

/**
 * The agent asked for a destination the user has not configured. Carries the
 * destinations that *are* available so the agent can retry against one of
 * them rather than guessing.
 */
export class NotConfiguredError extends Schema.TaggedErrorClass<NotConfiguredError>()(
	'NotConfiguredError',
	{
		available: Schema.Array(Name),
		message: Schema.String,
		requested: Name,
	}
) {}

/**
 * Builds the {@link NotConfiguredError} for a destination the user has not set
 * up. The message is written for the agent that will read it: it names what is
 * available so the agent can retry instead of guessing.
 *
 * @param requested - The destination the agent asked for.
 * @param available - The destinations that are configured.
 */
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

/**
 * The user has not configured any destination at all, so nothing can be
 * delivered until they run `pageme config add`.
 */
export class NoneConfiguredError extends Schema.TaggedErrorClass<NoneConfiguredError>()(
	'NoneConfiguredError',
	{
		message: Schema.String,
	}
) {}

/**
 * Expected failures of a delivery attempt.
 */
export type Error = DeliveryError | NotConfiguredError | NoneConfiguredError;

/**
 * A configured destination: knows how to deliver one notification.
 */
export interface Interface {
	readonly send: (
		notification: Notification,
		timestamp: Date
	) => Effect.Effect<void, DeliveryError>;
}

/**
 * Wraps a delivery call as a destination, translating any failure into a
 * {@link DeliveryError} tagged with where it was headed. Keeping the
 * translation here is what lets each destination fail in its own vocabulary.
 *
 * @param destination - Which destination is being delivered to.
 * @param send - Performs the delivery.
 */
export const make = (
	destination: Name,
	send: (
		notification: Notification,
		timestamp: Date
	) => Effect.Effect<void, unknown>
): Interface => ({
	send: Effect.fn('Destination.send')(function* (notification, timestamp) {
		yield* send(notification, timestamp).pipe(
			Effect.mapError(
				(cause) =>
					new DeliveryError({
						destination,
						message:
							cause instanceof globalThis.Error
								? cause.message
								: String(cause),
					})
			)
		);
	}),
});

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Destination from './index.ts';
