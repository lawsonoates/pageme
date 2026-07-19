---
name: pageme
description: Notify the user through PageMe when you need their input, when an important task fails, or when a long-running task completes. Use when the user asks to be paged, told, messaged, pinged, or notified about work finishing — including when they name a destination like "page me on telegram when you're done".
---

# PageMe

Sends the user a notification. Destinations are configured by the user, not by you.

## Which transport

PageMe is reachable two ways, and they take the same fields and return the same result:

- If the `notify` and `destinations` **MCP tools** are available, call those.
- Otherwise run the **`pageme` CLI**.

Everything below applies to both; the CLI form is shown because it is the one that needs spelling out.

## Check destinations first

**Before promising a destination**, and before any long task you will report back on:

```bash
pageme destinations
```

```json
{
	"configured": ["desktop"],
	"default": "desktop"
}
```

Only `configured` destinations work. If the user asks for one that is not in that list, say so immediately and offer a configured one — do not discover it later when the work is already done and the notification fails.

If `configured` is empty, tell the user to run `pageme config add` before relying on notifications.

## Send

```bash
pageme notify --agent "Claude Code" --level completed \
  --message "Migration applied; 42 tests pass."
```

- `--agent` — your product name, e.g. `Claude Code` or `Codex` (not a headline).
- `--message` — the detail, ≤ 2000 chars. Quote it. For anything multi-line, prefer a single-quoted string so backticks and `$` are not expanded by the shell.
- `--level` — `info`, `completed`, `failed`, or `action_required`.
- `--destination` — omit to use the user's default. Set it **only** when the user named one ("telegram me when it's done").

On success it prints `{"delivered":true,"destination":"desktop"}` and exits 0.

## When it fails

A failed page exits non-zero and explains itself on stderr. Naming a destination that is not configured tells you which ones are, so retry against one of those rather than guessing:

```text
"telegram" is not configured. Configured destinations: desktop. Retry with one of
those, or tell the user to run `pageme config add telegram`.
```

Do not report a task as "you've been notified" when the page failed.

## When to notify

Notify when you need input to continue, when an important task fails, or when a long-running task completes.

Do not send routine progress updates.
