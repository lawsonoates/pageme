import { Schema } from 'effect';

export const descriptions = {
	agent: 'Which agent you are. Shown as the notification title so the user knows who paged them.',
	level: 'Urgency of the notification.',
	message: 'Notification body, max 2000 characters.',
} as const;

export const Level = Schema.Literals([
	'info',
	'completed',
	'failed',
	'action_required',
]).annotate({ description: descriptions.level });

export type Level = typeof Level.Type;

// A fixed set rather than free text: left open, "claude", "Claude" and
// "claude-code" would arrive as different senders for the same agent.
export const Agent = Schema.Literals([
	'claude',
	'codex',
	'grok',
	'pi',
]).annotate({ description: descriptions.agent });

export type Agent = typeof Agent.Type;

// Kept apart from the wire value so the displayed name can be corrected
// ("Claude Code" rather than "claude") without changing what callers pass.
export const agents: Record<Agent, string> = {
	claude: 'Claude Code',
	codex: 'Codex',
	grok: 'Grok',
	pi: 'Pi',
};

export const Message = Schema.String.annotate({
	description: descriptions.message,
}).check(Schema.isNonEmpty(), Schema.isMaxLength(2000));

export const Notification = Schema.Struct({
	agent: Agent,
	level: Level,
	message: Message,
});

export type Notification = typeof Notification.Type;
