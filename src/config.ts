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

// Empty: a Discord incoming webhook URL names the channel and authorises
// posting to it, so this key is only a presence marker and the URL lives in the
// owner-only file alone.
export const Discord = Schema.Struct({});

// A destination is configured exactly when its key is present, so absence is
// the single source of truth for "not set up".
export const File = Schema.Struct({
	desktop: Schema.optional(Schema.Struct({})),
	discord: Schema.optional(Discord),
});

export type File = typeof File.Type;

export class ConfigError extends Schema.TaggedErrorClass<ConfigError>()(
	'ConfigError',
	{
		message: Schema.String,
	}
) {}

export type Error = ConfigError;

// `desktop` is absent because it spawns a local process rather than calling an
// API, so asking it for a secret is a type error rather than a runtime `none`.
export const tokenNames = ['discord'] as const;

export type TokenName = (typeof tokenNames)[number];

export interface Interface {
	readonly read: () => Effect.Effect<File, ConfigError>;
	readonly write: (file: File) => Effect.Effect<void, ConfigError>;
	// Prefers `PAGEME_<NAME>_TOKEN` over the stored token, so a secret manager
	// can inject it without touching disk.
	readonly token: (
		destination: TokenName
	) => Effect.Effect<Option.Option<Redacted.Redacted<string>>, ConfigError>;
	readonly setToken: (
		destination: TokenName,
		token: Redacted.Redacted<string>
	) => Effect.Effect<void, ConfigError>;
	readonly clearToken: (
		destination: TokenName
	) => Effect.Effect<void, ConfigError>;
	readonly path: string;
}

export class Service extends Context.Service<Service, Interface>()('Config') {}

// Derived from the destination name rather than listed, so a new destination
// cannot ship with a config file and no override variable.
const variable = (destination: TokenName) =>
	`PAGEME_${destination.toUpperCase()}_TOKEN`;

// Owner-only: the directory is 0700 and the token file 0600.
const dirMode = 0o700;
const fileMode = 0o600;

// A file that is not there is the normal empty state, not a failure.
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
			const secret = (destination: TokenName) =>
				pathOf.join(dir, `${destination}-token`);
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

			const token = Effect.fn('Config.token')(function* (
				destination: TokenName
			) {
				const injected = Option.fromNullishOr(
					process.env[variable(destination)]
				);
				if (Option.isSome(injected))
					return Option.some(Redacted.make(injected.value));

				const file = secret(destination);
				const stored = yield* fs.readFileString(file).pipe(
					Effect.map(Option.some),
					Effect.catchIf(absent, () =>
						Effect.succeed(Option.none<string>())
					),
					Effect.mapError(fail(`Failed to read ${file}`))
				);

				return stored.pipe(
					Option.map((value) => Redacted.make(value.trim()))
				);
			});

			const setToken = Effect.fn('Config.setToken')(function* (
				destination: TokenName,
				value: Redacted.Redacted<string>
			) {
				yield* ensure;
				const file = secret(destination);
				// `mode` applies only when the file is created, so remove any
				// existing one rather than inherit its permissions.
				yield* fs
					.remove(file, { force: true })
					.pipe(
						Effect.andThen(
							fs.writeFileString(
								file,
								`${Redacted.value(value)}\n`,
								{ mode: fileMode }
							)
						),
						Effect.mapError(fail(`Failed to write ${file}`))
					);
			});

			const clearToken = Effect.fn('Config.clearToken')(function* (
				destination: TokenName
			) {
				const file = secret(destination);
				yield* fs
					.remove(file, { force: true })
					.pipe(Effect.mapError(fail(`Failed to delete ${file}`)));
			});

			return { clearToken, path, read, setToken, token, write };
		})
	);

export const defaultLayer = layer(
	`${process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`}/pageme`
);

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Config from './config.ts';
