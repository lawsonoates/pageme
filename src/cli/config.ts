import { Console, Effect, Option } from 'effect';
import { Argument, Command, Prompt } from 'effect/unstable/cli';

import { Config } from '../config.ts';
import { Desktop } from '../destination/desktop.ts';
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

const addTelegram = Effect.gen(function* () {
	const config = yield* Config.Service;

	const token = yield* Prompt.run(
		Prompt.password({
			message: 'Telegram bot token (from @BotFather)',
		})
	);
	const channel = yield* Prompt.run(
		Prompt.text({
			message: 'Chat id to post to, e.g. telegram:12345678',
			validate: (value) =>
				value.startsWith('telegram:')
					? Effect.succeed(value)
					: Effect.fail('Chat id must start with "telegram:".'),
		})
	);

	yield* config.setToken(token);
	const file = yield* config.read();
	yield* config.write({
		...file,
		default: file.default ?? 'telegram',
		telegram: { channel },
	});
	yield* Console.log('✓ Configured telegram');
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
	yield* config.write({
		...file,
		default: file.default ?? 'desktop',
		desktop: {},
	});
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

			return yield* chosen === 'telegram' ? addTelegram : addDesktop;
		})
).pipe(Command.withDescription('Configure a notification destination'));

const list = Command.make('list', {}, () =>
	Effect.gen(function* () {
		const config = yield* Config.Service;
		const file = yield* config.read();
		const token = yield* config.token();

		yield* Console.log(`Config: ${config.path}\n`);

		for (const name of Destination.names) {
			const on =
				name === 'telegram'
					? Boolean(file.telegram) && Option.isSome(token)
					: Boolean(file.desktop) && Desktop.supported;
			const mark = file.default === name ? ' (default)' : '';
			const detail =
				name === 'telegram' && file.telegram
					? ` → ${file.telegram.channel}`
					: '';
			yield* Console.log(
				`${on ? '✓' : '✗'} ${name}${mark}${detail} — ${Destination.labels[name]}`
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

			if (chosen === 'telegram') yield* config.clearToken();

			const next = { ...file, [chosen]: undefined };
			yield* config.write({
				...next,
				default: next.default === chosen ? undefined : next.default,
			});
			yield* Console.log(`✓ Removed ${chosen}`);
		})
).pipe(Command.withDescription('Remove a configured destination'));

const fallback = Command.make(
	'default',
	{
		name: Argument.string('destination').pipe(
			Argument.withDescription(
				'Destination used when the agent does not name one'
			)
		),
	},
	({ name }) =>
		Effect.gen(function* () {
			const config = yield* Config.Service;
			const chosen = yield* parse(name);
			const file = yield* config.read();

			if (!file[chosen]) {
				return yield* new Config.ConfigError({
					message: `"${chosen}" is not configured yet. Run \`pageme config add ${chosen}\` first.`,
				});
			}

			yield* config.write({ ...file, default: chosen });
			yield* Console.log(`✓ Default destination is now ${chosen}`);
		})
).pipe(Command.withDescription('Set the default destination'));

/**
 * `pageme config` — manage notification destinations.
 */
export const config = Command.make('config').pipe(
	Command.withDescription('Manage notification destinations'),
	Command.withSubcommands([add, list, rm, fallback])
);
