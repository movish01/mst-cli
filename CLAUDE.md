# msteams-cli

CLI chat client for Microsoft Teams — interactive REPL + one-shot commands.
Published as `msteams-cli` on npm. Repo name is `mst-cli`.

## Project Structure

```
src/
├── index.ts                      # Entry point — Commander routes: no args → REPL, else CLI handler
├── cli/                          # One-shot CLI command handlers (lazy-loaded via dynamic import)
│   ├── login.ts                  # Device code / browser auth flow
│   ├── status.ts                 # Show logged-in user
│   ├── chats.ts                  # List chats (--json)
│   ├── messages.ts               # Read messages from chat (--limit, --json)
│   ├── send.ts                   # Send message by chat ID or --to name; supports stdin pipe
│   ├── teams.ts                  # List joined teams (--json)
│   ├── channels.ts               # List channels in a team (--json)
│   ├── send-channel.ts           # Send message to a channel
│   ├── unread.ts                 # List unread chats (--json)
│   ├── watch.ts                  # Stream new messages as JSON lines (agent-friendly)
│   └── cli.test.ts               # Tests for CLI commands
├── repl/                         # Interactive REPL shell
│   ├── repl.ts                   # Main loop — readline, auth, signal handling, background notifications
│   ├── commands.ts               # Command registry (chats, open, find, pin, unread, teams, etc.)
│   ├── chat-session.ts           # Live chat mode — display messages, poll, send, pagination
│   ├── completer.ts              # Tab completion for commands + chat names (async lazy-loading)
│   ├── prompt.ts                 # Prompt rendering (mst> and mst:Name>)
│   ├── session-state.ts          # Module-level active chat session tracker
│   ├── completer.test.ts
│   └── prompt.test.ts
├── core/                         # Shared by both CLI and REPL
│   ├── auth/
│   │   ├── config.ts             # Client ID, authority URL, Graph scopes
│   │   ├── auth-service.ts       # Singleton — device code, browser auth, silent refresh, logout
│   │   └── token-cache-plugin.ts # MSAL ICachePlugin → persists to ~/.config/mst-cli/token-cache.json
│   ├── graph/
│   │   ├── graph-client.ts       # Lazy singleton Graph SDK client with auth provider
│   │   ├── chats.ts              # Chat CRUD — list, messages, send, mark read, find by name, pagination
│   │   ├── teams.ts              # Teams/channels — list, messages, send
│   │   ├── types.ts              # ConversationItem, ChatMessage, Team, Channel interfaces
│   │   ├── html-to-text.ts       # HTML → plaintext for terminal display
│   │   ├── chats.test.ts
│   │   ├── teams.test.ts
│   │   └── html-to-text.test.ts
│   └── pinned.ts                 # Pin/unpin chats — JSON file at ~/.config/mst-cli/pinned-chats.json
└── utils/
    ├── time.ts                   # formatRelativeTime ("2m", "1h") + formatMessageTime ("2:45 PM")
    ├── config-dir.ts             # ~/.config/mst-cli/ path helpers + ensureConfigDir()
    ├── output.ts                 # outputJson() — pretty JSON for --json flag
    ├── time.test.ts
    └── config-dir.test.ts
```

## Three-Layer Architecture

```
┌─────────────┐   ┌──────────────┐
│  cli/       │   │  repl/       │
│  (one-shot) │   │  (interactive)│
└──────┬──────┘   └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
         ┌──────┴──────┐
         │   core/     │
         │  auth/      │
         │  graph/     │
         │  pinned.ts  │
         └─────────────┘
```

- **`core/`** — all Microsoft Graph API calls, auth, and persistence. Shared by both modes. Never imports from `cli/` or `repl/`.
- **`cli/`** — stateless command handlers. Each function runs once and exits.
- **`repl/`** — stateful interactive shell. Manages readline, polling, chat sessions.

## Auth

- **App ID**: `14d82eec-204b-4c2f-b7e8-296a70dab67e` — Microsoft's pre-registered Graph CLI app. No Azure AD registration needed.
- **Authority**: `https://login.microsoftonline.com/organizations` — multi-tenant org accounts only.
- **Scopes**: `Chat.ReadWrite`, `Team.ReadBasic.All`, `User.Read`, `User.ReadBasic.All`
- **Token cache**: MSAL's ICachePlugin writes to `~/.config/mst-cli/token-cache.json`
- **Flow**: Silent refresh → browser interactive → device code fallback.
- **Singleton**: `authService` is a module-level instance used everywhere.

### Known Org Restrictions

Some orgs block certain Graph API features:
- `Presence.Read` / `Presence.ReadWrite` — blocked by admin policy in some tenants (removed from codebase)
- `People.Read` — blocked; user search uses `/users?$search` with `User.ReadBasic.All` instead
- `/users` search may also be restricted — falls back to fuzzy search on cached chat list

## REPL Internals

### Readline Recreation Pattern

The REPL **recreates readline after every command**. This is required because `@inquirer/prompts` (used for arrow-key selection in `chats`, `teams`, etc.) takes over stdin/stdout. After inquirer returns, the old readline is broken. The loop pattern:

```
loop():
  1. rl = createRl()          ← fresh readline
  2. rl.prompt()
  3. wait for line input
  4. rl.close()               ← close before command
  5. await handler(args)       ← inquirer may run here
  6. goto 1                   ← new readline
```

### Signal Handling

- **Ctrl+C in chat session**: Stops polling, closes chat readline, returns to main prompt
- **Ctrl+C at main prompt**: First press shows warning, second press exits
- **SIGINT tracking**: `sigintCount` resets on any command input

### Background Notifications

- 30-second polling interval checks `getUnreadChats()`
- Only runs when NOT in a chat session (checked via `getActiveChatSession()`)
- Tracks `notifiedChatIds` set — only notifies once per unread chat
- Clears notification when chat becomes read
- Injects notification text using `readline.clearLine` + `cursorTo` to avoid corrupting user input

### Chat Session

- Prompt changes to `mst:Name>` (truncated to 15 chars)
- **Polling**: Every 4 seconds, fetches latest 5 messages, filters by `seenMessageIds` set
- **Pagination**: `more` command loads 20 older messages using `createdDateTime lt <oldest>` filter
- **Sending**: Just type and press Enter — no prefix needed
- **Read receipts**: Calls `markChatAsRead()` on session open (non-channel only)

## Key Patterns

### Deferred Chat Creation (`user:` prefix)

`findChatByName()` searches the org directory but does NOT create chats. It returns results with IDs like `user:abc-123`. When the user selects one, `getOrCreateChat()` POSTs to `/chats` to create the actual 1:1 conversation. This prevents ghost chats appearing in Teams for every search result.

### Lazy Loading

- **Conversations**: Cached after first `chats` / `open` / `search` call via `setCachedConversations()`
- **Tab completion**: First `<Tab>` triggers async chat fetch if cache is empty
- **CLI commands**: Dynamic `import()` in `index.ts` — only the invoked command's module is loaded

### Chat List Sorting

1. Pinned chats first (from `~/.config/mst-cli/pinned-chats.json`)
2. Then by `lastMessageTime` descending (most recent first)
3. Hidden chats filtered out (`viewpoint.isHidden`)
4. Meeting chats with no messages filtered out

### Unread Detection

Graph API's `viewpoint.lastMessageReadDateTime` compared against `lastMessageTime`. If last message is newer than last read, `unreadCount` is set to 1. Unread chats display with bold names in the selector.

## Config Files

All stored in `~/.config/mst-cli/`:

| File | Purpose |
|---|---|
| `token-cache.json` | MSAL token cache (access + refresh tokens) |
| `pinned-chats.json` | Array of `{id, displayName}` for pinned chats |

## Testing

Tests are co-located with source files (`*.test.ts`). Run with:

```bash
npm test              # single run
npm run test:watch    # watch mode
```

Uses **vitest** with ESM support. Graph API calls are mocked via `vi.mock()` — no real API calls in tests.

## Build & Run

```bash
npm run build         # tsc → dist/
npm start             # node dist/index.js (REPL)
npm run dev           # tsc --watch
```

Entry point: `bin/msteams-cli.js` → `dist/index.js`
