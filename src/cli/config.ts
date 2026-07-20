import { Console, Effect, Option } from 'effect';
import { Argument, Command, Prompt } from 'effect/unstable/cli';

import { Config } from '../config.ts';
import { Desktop } from '../destination/desktop.ts';
import { Discord } from '../destination/discord.ts';
import { Destination } from '../destination/index.ts';

// The human half of the CLI: interactive, prose written for the user, and
// changing whenever config storage does. The agent-facing commands live in
// `./notify.ts`, which shares nothing with this beyond the `Config` service.

const parse = (name: string) =>
	Destination.names.includes(name as Destination.Name)
		? Effect.succeed(name as Destination.Name)
		: Effect.fail(
				new Config.ConfigError({
					message: `Unknown destination "${name}". Choose one of: ${Destination.names.join(', ')}.`,
				})
			);

// One prompt, because a Discord incoming webhook URL is the whole
// configuration. Prompted as a password: it grants anyone holding it the right
// to post, so it should not sit in the terminal scrollback.
const addDiscord = Effect.gen(function* () {
	const config = yield* Config.Service;

	const url = yield* Prompt.run(
		Prompt.password({
			message:
				'Discord webhook URL (Channel Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL)',
			validate: (value) =>
				Discord.isWebhookUrl(value)
					? Effect.succeed(value)
					: Effect.fail(
							'That is not a Discord webhook URL. It should start with https://discord.com/api/webhooks/.'
						),
		})
	);

	yield* config.setToken('discord', url);
	const file = yield* config.read();
	yield* config.write({ ...file, discord: {} });
	yield* Console.log('✓ Configured discord');
});

const addDesktop = Effect.gen(function* () {
	if (!Desktop.supported) {
		return yield* new Config.ConfigError({
			message:
				'Desktop notifications need macOS Notification Center, which is not available on this platform.',
		});
	}

	const config = yield* Config.Service;
	const file = yield* config.read();
	yield* config.write({ ...file, desktop: {} });
	yield* Console.log('✓ Configured desktop');
});

const add = Command.make(
	'add',
	{
		name: Argument.string('destination').pipe(
			Argument.withDescription(
				`Destination to configure: ${Destination.names.join(', ')}`
			),
			Argument.optional
		),
	},
	({ name }) =>
		Effect.gen(function* () {
			const chosen = yield* Option.match(name, {
				onNone: () =>
					Prompt.run(
						Prompt.select({
							choices: Destination.names.map((choice) => ({
								description: Destination.labels[choice],
								title: choice,
								value: choice,
							})),
							message: 'Which destination?',
						})
					),
				onSome: parse,
			});

			const flows = { desktop: addDesktop, discord: addDiscord };
			return yield* flows[chosen];
		})
).pipe(Command.withDescription('Configure a notification destination'));

const list = Command.make('list', {}, () =>
	Effect.gen(function* () {
		const config = yield* Config.Service;
		const file = yield* config.read();

		yield* Console.log(`Config: ${config.path}\n`);

		for (const name of Destination.names) {
			// A chat destination counts as on only with both halves present,
			// matching what the registry actually builds.
			const on =
				name === 'desktop'
					? Boolean(file.desktop) && Desktop.supported
					: Boolean(file[name]) &&
						Option.isSome(yield* config.token(name));
			// No target is printed: Discord's lives inside the webhook URL,
			// which is a secret, and desktop has none.
			yield* Console.log(
				`${on ? '✓' : '✗'} ${name} — ${Destination.labels[name]}`
			);
		}
	})
).pipe(Command.withDescription('Show configured destinations'));

const rm = Command.make(
	'rm',
	{
		name: Argument.string('destination').pipe(
			Argument.withDescription('Destination to remove')
		),
	},
	({ name }) =>
		Effect.gen(function* () {
			const config = yield* Config.Service;
			const chosen = yield* parse(name);
			const file = yield* config.read();

			if (chosen !== 'desktop') yield* config.clearToken(chosen);

			yield* config.write({ ...file, [chosen]: undefined });
			yield* Console.log(`✓ Removed ${chosen}`);
		})
).pipe(Command.withDescription('Remove a configured destination'));

export const config = Command.make('config').pipe(
	Command.withDescription('Manage notification destinations'),
	Command.withSubcommands([add, list, rm])
);
