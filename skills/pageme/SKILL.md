---
name: pageme
description: Send PageMe notifications when a coding agent needs user input, an important task fails, or long-running work completes. Use when the user asks to be paged, pinged, messaged, told, alerted, or notified—including requests such as "page me on Discord when this finishes" or "let me know when you need me."
allowed-tools: Bash(pageme:*)
---

# User Notifications with PageMe

Send notifications through the `pageme` CLI. The user configures destinations; the agent only checks and uses them.

## Workflow

1. Before starting work the user expects to be notified about, check destinations:

    ```bash
    pageme destinations
    ```

    It prints JSON such as `{"configured":["discord","desktop"]}`.

2. Choose only a configured destination. Prefer one the user named. If that destination is unavailable, tell them before starting rather than silently substituting another. If none are configured, ask the user to run `pageme config add`.

3. Send the notification only when the requested event occurs:

    ```bash
    pageme notify --destination discord --agent pi --level completed \
      --message "Migration complete; all 42 tests pass."
    ```

4. Confirm delivery succeeded before saying the user was notified.

## Sending

Every notification requires:

- `--destination`: configured `discord` or `desktop`; there is no default
- `--agent`: your identity—`claude`, `codex`, `grok`, or `pi`
- `--level`: `info`, `completed`, `failed`, or `action_required`
- `--message`: a non-empty body of at most 2000 characters, passed as one quoted shell argument

Use `action_required` when blocked on user input, `failed` for important failures, and `completed` when monitored work finishes. Use `info` for other requested alerts.

Keep messages self-contained: state what happened and include the result, blocker, or next action. Do not include secrets or raw logs.

## Failures

Success exits with status 0 and prints JSON such as:

```json
{ "delivered": true, "destination": "discord" }
```

On a non-zero exit, never claim delivery succeeded. If the user named the destination, report the failure rather than redirecting silently. Otherwise, retry once with another configured destination when available. If `pageme` is missing, tell the user to run `npm install -g @lawsonoates/pageme`; do not install it without permission.

## When to Notify

Notify when the user requested it, input is required to continue, an important task fails, or long-running work completes. Send one notification per event. Do not notify for quick tasks or routine progress unless explicitly asked.
