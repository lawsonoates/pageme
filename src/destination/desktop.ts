import { Effect, Stream } from 'effect';
import type { ChildProcessSpawner } from 'effect/unstable/process';
import { ChildProcess } from 'effect/unstable/process';

import { agents } from '../notification.ts';
import type { Notification } from '../notification.ts';
import { Destination } from './index.ts';

// AppleScript reads the fields from argv, so agent-controlled text never has
// to be escaped into the script source.
const script = [
	'on run argv',
	'display notification (item 2 of argv) with title (item 1 of argv)',
	'end run',
].join('\n');

export const make = (
	spawner: ChildProcessSpawner.ChildProcessSpawner['Service']
): Destination.Interface => ({
	send: Effect.fn('Desktop.send')(function* (notification: Notification) {
		yield* Effect.scoped(
			Effect.gen(function* () {
				const handle = yield* spawner.spawn(
					ChildProcess.make('osascript', [
						'-e',
						script,
						agents[notification.agent],
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
					return yield* new Destination.DeliveryError({
						destination: 'desktop',
						message:
							output.trim() || `osascript exited with ${code}`,
					});
				}
			})
		).pipe(
			// Spawning and draining fail in the platform's vocabulary; the
			// exit-code path above already speaks ours.
			Effect.mapError((cause) =>
				cause instanceof Destination.DeliveryError
					? cause
					: new Destination.DeliveryError({
							destination: 'desktop',
							message: cause.message,
						})
			)
		);
	}),
});

export const supported = process.platform === 'darwin';

// oxlint-disable-next-line no-barrel-file -- self-reexport gives namespace ergonomics without `namespace`; nothing beyond this module is re-exported
export * as Desktop from './desktop.ts';
