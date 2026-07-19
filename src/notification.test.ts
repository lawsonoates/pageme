import { describe, expect, test } from 'bun:test';

import { Schema } from 'effect';

import { format, Notification } from './notification.ts';

const decode = Schema.decodeUnknownSync(Notification);

describe('Notification', () => {
	test('accepts a valid notification', () => {
		const parsed = decode({
			agent: 'Claude Code',
			level: 'action_required',
			message: 'The generated migration removes two columns.',
		});
		expect(parsed.level).toBe('action_required');
	});

	test('capitalises the agent name on decode', () => {
		const parsed = decode({
			agent: 'claude code',
			level: 'info',
			message: 'm',
		});
		expect(parsed.agent).toBe('Claude code');
	});

	test('rejects an unknown level', () => {
		expect(() =>
			decode({ agent: 'Codex', level: 'urgent', message: 'm' })
		).toThrow();
	});

	test('rejects an empty agent', () => {
		expect(() =>
			decode({ agent: '', level: 'info', message: 'm' })
		).toThrow();
	});

	test('rejects an oversized agent', () => {
		expect(() =>
			decode({ agent: 'x'.repeat(121), level: 'info', message: 'm' })
		).toThrow();
	});

	test('rejects an oversized message', () => {
		expect(() =>
			decode({ agent: 'Codex', level: 'info', message: 'x'.repeat(2001) })
		).toThrow();
	});
});

describe('format', () => {
	test('renders heading, agent, message, and timestamp', () => {
		const rendered = format(
			{
				agent: 'Claude Code',
				level: 'action_required',
				message: 'The generated migration removes two columns.',
			},
			new Date('2026-07-15T10:00:00.000Z')
		);

		expect(rendered).toBe(
			[
				'**[PageMe · 🔔 ACTION REQUIRED]**',
				'**Claude Code**',
				'The generated migration removes two columns.',
				'_2026-07-15T10:00:00.000Z_',
			].join('\n\n')
		);
	});
});
