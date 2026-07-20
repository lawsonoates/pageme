import { describe, expect, test } from 'bun:test';

import { Schema } from 'effect';

import { agents, Notification } from './notification.ts';

const decode = Schema.decodeUnknownSync(Notification);

describe('Notification', () => {
	test('accepts a valid notification', () => {
		const parsed = decode({
			agent: 'claude',
			level: 'action_required',
			message: 'The generated migration removes two columns.',
		});
		expect(parsed.level).toBe('action_required');
		expect(parsed.agent).toBe('claude');
	});

	test('rejects an unknown level', () => {
		expect(() =>
			decode({ agent: 'codex', level: 'urgent', message: 'm' })
		).toThrow();
	});

	test('rejects an agent outside the known set', () => {
		// Free text used to be accepted, which let the same sender arrive
		// under several spellings.
		for (const agent of ['', 'Claude Code', 'claude-code', 'gemini']) {
			expect(() =>
				decode({ agent, level: 'info', message: 'm' })
			).toThrow();
		}
	});

	test('rejects an oversized message', () => {
		expect(() =>
			decode({ agent: 'codex', level: 'info', message: 'x'.repeat(2001) })
		).toThrow();
	});
});

describe('agents', () => {
	test('gives every agent a display name', () => {
		expect(agents).toEqual({
			claude: 'Claude Code',
			codex: 'Codex',
			grok: 'Grok',
			pi: 'Pi',
		});
	});

	test('names every accepted agent, so none can render as undefined', () => {
		for (const agent of Notification.fields.agent.literals)
			expect(agents[agent]).toBeTruthy();
	});
});
