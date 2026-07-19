import { Effect, Stream } from 'effect';
import type { ChildProcessSpawner } from 'effect/unstable/process';
import { ChildProcess } from 'effect/unstable/process';

import { Destination } from './index.ts';

// AppleScript reads the fields from argv, so agent-controlled text never has
// to be escaped into the script source.
const script = [
	'on run argv',
	'display notification (item 2 of argv) with title (item 1 of argv)',
	'end run',
].join('\n');

/**
 * Destination that posts to macOS Notification Center via `osascript`. Needs
 * no configuration, but only reaches the user while they are at this machine.
 *
 * @param spawner - Runs `osascript`; injected so the caller owns the platform.
 */
export const make = (
	spawner: ChildProcessSpawner.ChildProcessSpawner['Service']
) =>
	Destination.make('desktop', (notification) =>
		Effect.scoped(
			Effect.gen(function* () {
				const handle = yield* spawner.spawn(
					ChildProcess.make('osascript', [
						'-e',
						script,
						notification.agent,
						notification.message,
					])
				);

				// Drain first: the streams close when the process exits, and
				// osascript explains itself on stderr rather than in its code.
				const output = yield* Stream.mkString(
					Stream.decodeText(handle.all)
				);
				const code = yield* handle.exitCode;

				if (code !== 0) {
					return yield* Effect.fail(
						new Error(
							output.trim() || `osascript exited with ${code}`
						)
					);
				}
			})
		)
	);

/**
 * Notification Center only exists on macOS.
 */
export const supported = process.platform === 'darwin';

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Desktop from './desktop.ts';
