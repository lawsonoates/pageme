import { createMemoryState } from '@chat-adapter/state-memory';
import { createTelegramAdapter } from '@chat-adapter/telegram';
import { Chat } from 'chat';
import { Effect, Redacted } from 'effect';

import { format } from '../notification.ts';
import { Destination } from './index.ts';

export interface Options {
	/** Telegram bot token from BotFather. */
	readonly token: Redacted.Redacted<string>;
	/** chat-sdk channel id to post to, e.g. `telegram:12345678`. */
	readonly channel: string;
}

/**
 * Destination that posts notifications to a Telegram chat via chat-sdk.
 * Reaches the user's phone, so it works while they are away from this machine.
 *
 * @param options - Bot credentials and the chat-sdk channel id to post to.
 */
export const make = (options: Options) => {
	const chat = new Chat({
		adapters: {
			telegram: createTelegramAdapter({
				botToken: Redacted.value(options.token),
			}),
		},
		state: createMemoryState(),
		userName: 'pageme',
	});

	return Destination.make('telegram', (notification, timestamp) =>
		Effect.tryPromise({
			// chat-sdk errors may embed the Telegram API URL, which contains
			// the bot token. Scrub it before it reaches logs or the agent.
			catch: (cause) => {
				const raw =
					cause instanceof Error ? cause.message : String(cause);
				return new Error(
					raw.replaceAll(Redacted.value(options.token), '<redacted>'),
					{ cause }
				);
			},
			try: () =>
				chat
					.channel(options.channel)
					.post(format(notification, timestamp)),
		})
	);
};

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Telegram from './telegram.ts';
