# PageMe

PageMe lets coding agents notify you when they need input, when something fails, or when long-running work finishes.

Notifications can be sent to:

- macOS Notification Center
- Discord

## Install

PageMe requires Node.js 22 or newer.

```bash
npm install -g pageme
pageme config add
```

Run `pageme config add` again to add another destination.

## Connect your agent

Copy [`skills/pageme`](./skills/pageme) into your agent's skills directory. The skill teaches the agent to use the installed CLI:

```bash
pageme destinations
pageme notify --destination discord --agent claude --level completed \
  --message "The task is complete."
```

## Tell your agent when to page you

For example:

> Use PageMe when you need my input, when an important task fails, or when a long-running task completes. Do not send routine progress updates.

You can also request a destination directly:

> Page me on Discord when you're done.

## Manage destinations

```bash
pageme config list
pageme config add
pageme config rm discord
```

There is no default destination: every `notify` names where it goes. An agent that guesses wrong fails loudly and is told what is configured, rather than delivering somewhere you stopped watching.

Discord stores its webhook URL in an owner-only file under the config directory, and `PAGEME_DISCORD_TOKEN` overrides the stored value so a secret manager can inject one without touching disk.

### Discord

Discord needs one value, and no bot application: in the channel you want to be paged in, open **Channel Settings → Integrations → Webhooks → New Webhook**, copy the webhook URL, and give it to `pageme config add discord`. Treat it as a secret — anyone holding it can post to that channel.

## Development

```bash
bun install
bun test ./src/
bun run typecheck
bun run check
bun run build
```
