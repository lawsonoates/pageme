# PageMe

PageMe lets coding agents notify you when they need input, when something fails, or when long-running work finishes.

Notifications can be sent to:

- macOS Notification Center
- Telegram

## Install

PageMe requires Node.js 22 or newer.

```bash
npm install -g pageme
pageme config add
```

Run `pageme config add` again to add another destination.

## Connect your agent

Choose either MCP or the PageMe skill. You do not need both.

### Option 1: MCP

Add PageMe to your agent's MCP configuration:

```json
{
	"mcpServers": {
		"pageme": {
			"command": "pageme",
			"args": ["mcp", "serve"]
		}
	}
}
```

Restart your agent after updating its configuration. It will receive `notify` and `destinations` tools.

### Option 2: Skill and CLI

Copy [`skills/pageme`](./skills/pageme) into your agent's skills directory. The skill teaches the agent to use the installed CLI:

```bash
pageme destinations
pageme notify --agent "Claude Code" --level completed \
  --message "The task is complete."
```

## Tell your agent when to page you

For example:

> Use PageMe when you need my input, when an important task fails, or when a long-running task completes. Do not send routine progress updates.

You can also request a destination directly:

> Page me on Telegram when you're done.

## Manage destinations

```bash
pageme config list
pageme config add
pageme config default desktop
pageme config rm telegram
```

## Development

```bash
bun install
bun test ./src/
bun run typecheck
bun run check
bun run build
```
