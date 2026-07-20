import { describe, expect, test } from 'bun:test';

import { Effect, Redacted } from 'effect';
import type { HttpClientRequest } from 'effect/unstable/http';
import {
	HttpClient,
	HttpClientError,
	HttpClientResponse,
} from 'effect/unstable/http';

import type { Notification } from '../notification.ts';
import { Discord } from './discord.ts';

const notification = (overrides: Partial<Notification> = {}): Notification => ({
	agent: 'claude',
	level: 'completed',
	message: 'All 42 tests passed.',
	...overrides,
});

const url = 'https://discord.com/api/webhooks/123/secret';

const send = (client: HttpClient.HttpClient) =>
	Discord.make({ url: Redacted.make(url) }, client).send(notification());

describe('discord webhook urls', () => {
	test('accepts both the current and legacy hosts', () => {
		expect(
			Discord.isWebhookUrl('https://discord.com/api/webhooks/123/abc')
		).toBe(true);
		expect(
			Discord.isWebhookUrl('https://discordapp.com/api/webhooks/123/abc')
		).toBe(true);
	});

	test('rejects anything else, including look-alike hosts', () => {
		for (const value of [
			'',
			'not a url',
			'https://example.com/api/webhooks/123/abc',
			// A prefix check must not be fooled by the host appearing later.
			'https://evil.test/https://discord.com/api/webhooks/123/abc',
			// Plain http would send the secret in the clear.
			'http://discord.com/api/webhooks/123/abc',
		])
			expect(Discord.isWebhookUrl(value)).toBe(false);
	});
});

describe('discord delivery', () => {
	test('posts JSON through the Effect HTTP client', async () => {
		let sent: HttpClientRequest.HttpClientRequest | undefined;
		const client = HttpClient.make((request) =>
			Effect.sync(() => {
				sent = request;
				return HttpClientResponse.fromWeb(
					request,
					new Response(null, { status: 204 })
				);
			})
		);

		await Effect.runPromise(send(client));

		expect(sent?.method).toBe('POST');
		expect(sent?.url).toBe(url);
		expect(sent?.headers['content-type']).toBe('application/json');
		if (sent?.body._tag !== 'Uint8Array') throw new Error('missing body');
		expect(JSON.parse(new TextDecoder().decode(sent.body.body))).toEqual(
			Discord.payload(notification())
		);
	});

	test('includes Discord rejection details in the delivery error', async () => {
		const client = HttpClient.make((request) =>
			Effect.succeed(
				HttpClientResponse.fromWeb(
					request,
					new Response('Unknown Webhook', { status: 404 })
				)
			)
		);

		const error = await Effect.runPromise(send(client).pipe(Effect.flip));

		expect(error.message).toBe(
			'Discord rejected the notification: 404 — Unknown Webhook'
		);
	});

	test('redacts the webhook URL from HTTP client errors', async () => {
		const client = HttpClient.make((request) =>
			Effect.fail(
				new HttpClientError.HttpClientError({
					reason: new HttpClientError.TransportError({
						description: `could not reach ${url}`,
						request,
					}),
				})
			)
		);

		const error = await Effect.runPromise(send(client).pipe(Effect.flip));

		expect(error.message).not.toContain(url);
		expect(error.message).toContain('<redacted webhook url>');
	});
});

describe('discord payload', () => {
	test('carries the message and agent as embed structure', () => {
		const [embed] = Discord.payload(notification()).embeds;

		expect(embed.description).toBe('All 42 tests passed.');
		expect(embed.author.name).toBe('Claude Code');
	});

	test('adds no chrome of its own beyond the coloured bar', () => {
		const [embed] = Discord.payload(notification()).embeds;

		// Discord stamps the message itself, and the colour carries the
		// level, so neither is repeated inside the embed.
		expect(embed).not.toHaveProperty('timestamp');
		expect(embed).not.toHaveProperty('title');
	});

	test('gives every level its own colour', () => {
		const seen = new Set<number>();

		for (const level of [
			'info',
			'completed',
			'failed',
			'action_required',
		] as const)
			seen.add(Discord.payload(notification({ level })).embeds[0].color);

		// The colour is the only thing distinguishing one level from another,
		// so a shared value would erase the level entirely.
		expect(seen.size).toBe(4);
	});

	test('posts under the PageMe name whatever the webhook was called', () => {
		expect(Discord.payload(notification()).username).toBe('PageMe');
	});

	test('shows the display name rather than the wire value', () => {
		const [embed] = Discord.payload(
			notification({ agent: 'claude' })
		).embeds;

		expect(embed.author.name).toBe('Claude Code');
	});

	test('a maximum-length message stays within the description limit', () => {
		// Discord caps an embed description at 4096 characters. Nothing
		// truncates, so that holds only while the schema's own 2000 stays
		// below it. Agent names need no such check now that they come from a
		// fixed set whose longest entry is 11 characters.
		const [embed] = Discord.payload(
			notification({ message: 'b'.repeat(2000) })
		).embeds;

		expect(embed.description.length).toBeLessThanOrEqual(4096);
	});
});
