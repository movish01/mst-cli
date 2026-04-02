# msteams-cli

A command-line client for Microsoft Teams. Chat, browse teams, and send messages — all from your terminal.

Works in two modes:
- **Interactive REPL** — run `msteams-cli` with no arguments to open a shell with fuzzy search, real-time messages, and tab completion
- **One-shot CLI** — run `msteams-cli <command>` for scripting, automation, and agent integration (supports `--json` output)

## Install

```bash
npx msteams-cli
```

Or install globally:

```bash
npm install -g msteams-cli
```

Requires **Node.js 22+**.

## Authentication

```bash
msteams-cli login
```

Opens your browser to sign in with your Microsoft org account. Tokens are cached locally at `~/.config/mst-cli/` so you only need to log in once.

No Azure AD app registration is required — msteams-cli uses Microsoft's pre-registered Graph CLI application.

```bash
msteams-cli status    # verify you're logged in
msteams-cli logout    # sign out and clear cached tokens
```

## Interactive Mode

```bash
msteams-cli
```

Opens a REPL shell with the `mst>` prompt. Available commands:

| Command | Description |
|---|---|
| `chats` | List and select a chat to open (arrow keys + fuzzy search) |
| `open [name]` | Open a chat by name or pick from selector |
| `search <query>` | Search loaded chats by name |
| `find <name>` | Find a person in your org directory and open a chat |
| `pin [name]` | Pin/unpin a chat (pinned chats appear at the top) |
| `unread` | Show chats with unread messages |
| `teams` | Browse teams and channels |
| `status` | Show current user info |
| `logout` | Sign out |
| `help` | Show available commands |
| `exit` | Quit |

**Tab completion** works for command names and chat names (e.g. `open Jo<Tab>`).

### Chat sessions

When you select a chat, the prompt changes to `mst:Name>` and you're in a live chat session:

- **Type and press Enter** to send a message (no `send` prefix needed)
- **`more`** loads older messages
- **New messages appear in real-time** via polling
- **Ctrl+C** to go back to the main prompt

**Background notifications** — while at the main `mst>` prompt, unread messages are checked every 30 seconds and displayed inline.

## CLI Commands

All commands support `--json` for machine-readable output.

### List chats

```bash
msteams-cli chats
msteams-cli chats --json
```

### Read messages

```bash
msteams-cli messages <chat-id>
msteams-cli messages <chat-id> --limit 50 --json
```

### Send a message

```bash
msteams-cli send <chat-id> "Hello from the terminal"
msteams-cli send <chat-id> --to "John Smith" "Hey!"    # fuzzy match by name
echo "deploy complete" | msteams-cli send <chat-id>     # pipe from stdin
```

### Teams and channels

```bash
msteams-cli teams                                              # list your teams
msteams-cli teams --json
msteams-cli channels <team-id>                                 # list channels in a team
msteams-cli send-channel <team-id> <channel-id> "message"      # send to a channel
```

### Unread

```bash
msteams-cli unread
msteams-cli unread --json
```

### Watch (for agents)

Stream new messages as JSON lines — designed for AI agents and automation:

```bash
msteams-cli watch <chat-id>
msteams-cli watch <chat-id> --interval 2000
```

Each new message is printed as a single JSON line to stdout. Press Ctrl+C to stop.

## Agent / Automation Usage

msteams-cli is designed to work with AI agents and scripts. Typical workflow:

```bash
# 1. Get chat list and find the right chat ID
CHAT_ID=$(msteams-cli chats --json | jq -r '.[] | select(.displayName == "John Smith") | .id')

# 2. Read recent messages
msteams-cli messages "$CHAT_ID" --json

# 3. Send a message
msteams-cli send "$CHAT_ID" "Automated reply from my agent"

# 4. Stream new messages in real-time
msteams-cli watch "$CHAT_ID" | while read -r line; do
  echo "$line" | jq .
  # process each message...
done
```

Pipe support lets you chain with other tools:

```bash
echo "Build #42 passed" | msteams-cli send <chat-id>
```

## Pinned Chats

Pin frequently used chats so they always appear at the top of the list:

```bash
# In REPL
mst> pin "John Smith"    # toggle pin
mst> pin                 # pick from selector
```

Pinned chats are stored locally at `~/.config/mst-cli/pinned-chats.json`.

## Permissions

msteams-cli requests the following Microsoft Graph scopes:

- `Chat.ReadWrite` — read and send chat messages
- `Team.ReadBasic.All` — list teams and channels
- `User.Read` — get your own profile
- `User.ReadBasic.All` — search org directory for people

No admin consent is required for these scopes. Your org admin may have additional policies that restrict some features.

## License

MIT
