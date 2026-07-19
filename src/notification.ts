import { Schema, SchemaTransformation } from 'effect';

/**
 * What each field means, written for the agent that has to fill it in. Kept
 * beside the constraints they describe, so "max 2000 characters" and
 * `isMaxLength(2000)` cannot drift apart. `NotifyRequest` gathers them for
 * callers.
 *
 * Annotated onto the *base* schema rather than the finished one: JSON Schema
 * is generated from the encoded side, so a description attached after a
 * transformation is dropped, and one attached after a check is buried in
 * `allOf` where MCP clients do not look.
 */
export const descriptions = {
	agent: 'Your product name, e.g. "Claude Code" or "Codex". Shown as the notification title so the user knows who paged them.',
	level: 'Urgency of the notification.',
	message: 'Notification body, max 2000 characters.',
} as const;

/**
 * Severity levels a coding agent can attach to a notification.
 */
export const Level = Schema.Literals([
	'info',
	'completed',
	'failed',
	'action_required',
]).annotate({ description: descriptions.level });

/**
 * Severity level of a notification.
 */
export type Level = typeof Level.Type;

/**
 * Name of the coding agent sending the notification, e.g. "Claude Code" or
 * "Codex". Shown as the notification title so the user can see who paged them.
 * The first character is capitalised on decode.
 */
export const Agent = Schema.String.annotate({
	description: descriptions.agent,
}).pipe(
	Schema.decode(SchemaTransformation.capitalize()),
	Schema.check(Schema.isNonEmpty(), Schema.isMaxLength(120))
);

/**
 * Body of a notification.
 */
export const Message = Schema.String.annotate({
	description: descriptions.message,
}).check(Schema.isNonEmpty(), Schema.isMaxLength(2000));

/**
 * A notification sent by a coding agent: who sent it, what happened, and how
 * urgent it is.
 */
export const Notification = Schema.Struct({
	agent: Agent,
	level: Level,
	message: Message,
});

/**
 * A notification sent by a coding agent.
 */
export type Notification = typeof Notification.Type;

const headings: Record<Level, string> = {
	action_required: '🔔 ACTION REQUIRED',
	completed: '✅ COMPLETED',
	failed: '❌ FAILED',
	info: 'ℹ️ INFO',
};

/**
 * Renders a notification as the markdown message delivered to a chat
 * destination.
 *
 * @param notification - The notification to render.
 * @param timestamp - When the notification was sent; rendered as a UTC footer.
 */
export const format = (notification: Notification, timestamp: Date): string =>
	[
		`**[PageMe · ${headings[notification.level]}]**`,
		`**${notification.agent}**`,
		notification.message,
		`_${timestamp.toISOString()}_`,
	].join('\n\n');
