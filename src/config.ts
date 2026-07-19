import {
	Context,
	Effect,
	FileSystem,
	Layer,
	Option,
	Path,
	Redacted,
	Schema,
} from 'effect';
import type { PlatformError } from 'effect/PlatformError';

import { Destination } from './destination/index.ts';

/**
 * Settings for the Telegram destination. The bot token lives in a separate
 * owner-only file, not here.
 */
export const Telegram = Schema.Struct({
	/**
	 * chat-sdk channel id to post to, e.g. `telegram:12345678`. The prefix
	 * selects the chat-sdk adapter.
	 */
	channel: Schema.String,
});

/**
 * On-disk shape of the config file. A destination is configured exactly when
 * its key is present, so absence is the single source of truth for "not set
 * up".
 */
export const File = Schema.Struct({
	default: Schema.optional(Destination.Name),
	desktop: Schema.optional(Schema.Struct({})),
	telegram: Schema.optional(Telegram),
});

export type File = typeof File.Type;

/**
 * Failure reading or writing the config file.
 */
export class ConfigError extends Schema.TaggedErrorClass<ConfigError>()(
	'ConfigError',
	{
		message: Schema.String,
	}
) {}

export type Error = ConfigError;

export interface Interface {
	readonly read: () => Effect.Effect<File, ConfigError>;
	readonly write: (file: File) => Effect.Effect<void, ConfigError>;
	/**
	 * Reads the Telegram bot token, preferring `PAGEME_TELEGRAM_TOKEN` over the
	 * stored one so a secret manager can inject it without touching disk.
	 */
	readonly token: () => Effect.Effect<
		Option.Option<Redacted.Redacted<string>>,
		ConfigError
	>;
	/** Stores the Telegram bot token in an owner-only file. */
	readonly setToken: (
		token: Redacted.Redacted<string>
	) => Effect.Effect<void, ConfigError>;
	readonly clearToken: () => Effect.Effect<void, ConfigError>;
	/** Absolute path of the config file, for display. */
	readonly path: string;
}

export class Service extends Context.Service<Service, Interface>()('Config') {}

/** Overrides the stored token, for secret managers and CI. */
const variable = 'PAGEME_TELEGRAM_TOKEN';

/** Owner-only: the directory is 0700 and the token file 0600. */
const dirMode = 0o700;
const fileMode = 0o600;

/** A file that is not there is the normal empty state, not a failure. */
const absent = (error: PlatformError) => error.reason._tag === 'NotFound';

const fail = (message: string) => (cause: PlatformError) =>
	new ConfigError({ message: `${message}: ${cause.message}` });

export const layer = (
	dir: string
): Layer.Layer<Service, never, FileSystem.FileSystem | Path.Path> =>
	Layer.effect(
		Service,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const pathOf = yield* Path.Path;

			const path = pathOf.join(dir, 'config.json');
			const secret = pathOf.join(dir, 'telegram-token');
			const decode = Schema.decodeUnknownEffect(File);

			// The directory is not created on write, and 0700 keeps the token
			// unreadable by others even before it is written.
			const ensure = fs
				.makeDirectory(dir, { mode: dirMode, recursive: true })
				.pipe(Effect.mapError(fail(`Failed to create ${dir}`)));

			const read = Effect.fn('Config.read')(function* () {
				// A missing file means nothing is configured yet, not an error.
				const raw = yield* fs.readFileString(path).pipe(
					Effect.map((text) => JSON.parse(text) as unknown),
					Effect.catchIf(absent, () => Effect.succeed({})),
					Effect.mapError(fail(`Failed to read ${path}`))
				);

				return yield* decode(raw).pipe(
					Effect.mapError(
						(cause) =>
							new ConfigError({
								message: `${path} is not valid pageme config: ${cause.message}`,
							})
					)
				);
			});

			const write = Effect.fn('Config.write')(function* (file: File) {
				yield* ensure;
				yield* fs
					.writeFileString(
						path,
						`${JSON.stringify(file, null, '\t')}\n`
					)
					.pipe(Effect.mapError(fail(`Failed to write ${path}`)));
			});

			const token = Effect.fn('Config.token')(function* () {
				const injected = Option.fromNullishOr(process.env[variable]);
				if (Option.isSome(injected))
					return Option.some(Redacted.make(injected.value));

				const stored = yield* fs.readFileString(secret).pipe(
					Effect.map(Option.some),
					Effect.catchIf(absent, () =>
						Effect.succeed(Option.none<string>())
					),
					Effect.mapError(fail(`Failed to read ${secret}`))
				);

				return stored.pipe(
					Option.map((value) => Redacted.make(value.trim()))
				);
			});

			const setToken = Effect.fn('Config.setToken')(function* (
				value: Redacted.Redacted<string>
			) {
				yield* ensure;
				// `mode` applies only when the file is created, so remove any
				// existing one rather than inherit its permissions.
				yield* fs
					.remove(secret, { force: true })
					.pipe(
						Effect.andThen(
							fs.writeFileString(
								secret,
								`${Redacted.value(value)}\n`,
								{ mode: fileMode }
							)
						),
						Effect.mapError(fail(`Failed to write ${secret}`))
					);
			});

			const clearToken = Effect.fn('Config.clearToken')(function* () {
				yield* fs
					.remove(secret, { force: true })
					.pipe(Effect.mapError(fail(`Failed to delete ${secret}`)));
			});

			return { clearToken, path, read, setToken, token, write };
		})
	);

/**
 * Config rooted at `$XDG_CONFIG_HOME/pageme` (falling back to
 * `~/.config/pageme`).
 */
export const defaultLayer = layer(
	`${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`}/pageme`
);

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Config from './config.ts';
