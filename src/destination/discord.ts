import { Effect, Redacted } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/unstable/http';

import { agents } from '../notification.ts';
import type { Level, Notification } from '../notification.ts';
import { Destination } from './index.ts';

export interface Options {
	// Both the address and the secret: anyone holding it can post to the channel.
	readonly url: Redacted.Redacted<string>;
}

// `discordapp.com` is the legacy host, still handed out by older clients.
const prefixes = [
	'https://discord.com/api/webhooks/',
	'https://discordapp.com/api/webhooks/',
] as const;

// Checked at configuration time so a typo is caught while the user is still
// looking at the prompt, rather than at the moment they need to be paged.
export const isWebhookUrl = (value: string): boolean =>
	prefixes.some((prefix) => value.startsWith(prefix));

// The embed's left bar carries the level: it reads faster than a heading in a
// busy channel. Discord's own status colours, so they match what users already
// read as success and danger elsewhere in the client.
const colors: Record<Level, number> = {
	action_required: 0xfa_a6_1a,
	completed: 0x57_f2_87,
	failed: 0xed_42_45,
	info: 0x58_65_f2,
};

// Overrides whatever the user happened to call the webhook in Discord.
const username = 'PageMe';

// Sent as an embed rather than a message body: Discord renders the level as a
// coloured bar and the agent as the author line, so neither is spelled out in
// the text. No title (the colour says the level) and no timestamp (Discord
// stamps every message it receives).
export const payload = (notification: Notification) => ({
	embeds: [
		{
			author: { name: agents[notification.agent] },
			color: colors[notification.level],
			description: notification.message,
		},
	],
	username,
});

// A webhook rather than a bot: posting is the only thing PageMe does, and a
// webhook needs no application, invite, or gateway connection — nothing to
// deploy and nothing to keep running.
export const make = (
	options: Options,
	client: HttpClient.HttpClient
): Destination.Interface => ({
	send: Effect.fn('Discord.send')(function* (notification: Notification) {
		yield* Effect.gen(function* () {
			const request = yield* HttpClientRequest.post(
				Redacted.value(options.url)
			).pipe(HttpClientRequest.bodyJson(payload(notification)));
			const response = yield* client.execute(request).pipe(
				// Effect records the full URL on HTTP spans, but this URL contains
				// the webhook credential and must never enter telemetry.
				Effect.provideService(HttpClient.TracerDisabledWhen, () => true)
			);

			if (response.status >= 200 && response.status < 300) return;

			// Discord explains a rejection in the body — a deleted webhook or
			// a bad payload — and the status alone does not.
			const detail = yield* response.text.pipe(
				// The rejection status is still useful if its body cannot be read.
				Effect.catch(() => Effect.succeed(''))
			);
			return yield* new Destination.DeliveryError({
				destination: 'discord',
				message: `Discord rejected the notification: ${response.status}${detail ? ` — ${detail}` : ''}`,
			});
		}).pipe(
			// The URL *is* the credential, and HTTP client errors include it.
			// Scrub it before the failure reaches logs or the agent.
			Effect.mapError(
				(cause) =>
					new Destination.DeliveryError({
						destination: 'discord',
						message: cause.message.replaceAll(
							Redacted.value(options.url),
							'<redacted webhook url>'
						),
					})
			)
		);
	}),
});

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Discord from './discord.ts';
