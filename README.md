# MUD3 - A Modern TypeScript MUD Server

A feature-rich, text-based Multi-User Dungeon (MUD) server built with TypeScript and Node.js. This server provides a complete foundation for building persistent online text-based games with player accounts, world modeling, communication systems, and extensible command framework.

## ✨ Key Features

### 📋 Persistent Message Board System
- **Multiple Boards**: Create unlimited message boards with YAML configuration
- **Flexible Expiration**: Permanent boards or time-limited boards (auto-expire after set duration)
- **Interactive Editor**: Rich multi-line message editor with commands:
  - `!done` - Finish and preview message
  - `!show` - Display current body with line numbers
  - `!delete <n>` - Delete specific line
  - `!insert <n> <text>` - Insert a line at position <n>, pushing existing lines down
  - `!subject <text>` - Change subject inline
  - `!to <@targets>` - Change message targets inline
  - `!forget` / `!quit` - Cancel message creation
  - `!help` - Show command reference
- **Message Targeting**: Target messages to specific users with `@mentions` or make them public
- **Write Permissions**: Configure boards to allow all users or restrict to admins only
- **Auto-save**: Boards automatically saved on server shutdown
- **Auto-cleanup**: Expired messages automatically removed from time-limited boards

### 💬 Communication Channels
- **Multiple Channels**: OOC, NEWBIE, TRADE, GOSSIP, SAY, WHISPER
- **Color-coded Messages**: Each channel has distinct color schemes
- **Channel Management**: Subscribe/unsubscribe to channels with `channels` command
- **Whisper System**: Private messaging with `reply` command support
- **User Blocking**: Block users to prevent whispers and unwanted messages

### 🎨 Rich Terminal Experience
- **Full Color Support**: 16-color palette with dark and bright variants
- **Color Utilities**: `color()`, `colorize()`, `stripColors()`, `visibleLength()`
- **Color Tags**: Inline color codes like `{R` for red, `{G` for green, etc.
- **Formatted Output**: Colorized command outputs throughout the game

### 👤 Character System
- **Persistent Profiles**: YAML-based character storage
- **Playtime Tracking**: Automatic session tracking with formatted display
- **Statistics**: Track deaths, kills, and total playtime
- **Settings**: Customizable player preferences (channels, colors, etc.)
- **Admin System**: Built-in admin privileges and account management
- **Authentication**: Secure password hashing with SHA-256

### 🗺️ World Model
- **3D Grid System**: Rooms organized in width × height × layers
- **Movement**: Cardinal directions (N/S/E/W) and vertical (UP/DOWN)
- **Room Links**: Custom connections between non-adjacent rooms
- **Containment**: Objects can be in rooms, inventories, or nested containers
- **Entity Types**: Rooms, Mobs (NPCs/players), Items, Props

### ⚡ Command System
- **Pattern Matching**: Declarative command patterns with typed arguments
- **Autocomplete**: Partial command matching (e.g., `o` → `ooc`)
- **Argument Types**: text, word, number, object, mob, item, direction, character
- **Source Modifiers**: `@room`, `@inventory`, `@all` for object searches
- **Aliases**: Multiple patterns per command
- **Error Handling**: Custom error messages for parsing failures

### 📚 Help System
- **Topic-based Help**: YAML-based help files with keywords and aliases
- **Search**: Full-text search across all help content
- **Autocomplete**: Help topic autocomplete with prefix matching
- **Related Topics**: Cross-referenced help topics

### ⏰ Time Utilities
- **Duration Formatting**: Human-readable duration strings (`formatDuration()`)
- **Playtime Formatting**: Detailed playtime with hours, minutes, seconds (`formatPlaytime()`)
- **Centralized**: All time formatting in `time.ts` module

### 🧪 Testing & Quality
- **Comprehensive Tests**: Full test coverage with Node.js test framework
- **Type Safety**: Full TypeScript throughout
- **Linting**: Code quality enforcement

---

## 🚀 Quick Start

### Installation

```bash
npm install
npm run build
npm start
```

### Basic Usage

```ts
import { loadPackage } from 'package-loader';
import lockfile from './src/package/lockfile.ts';
import config from './src/package/config.ts';
import commands from './src/package/commands.ts';
import character from './src/package/character.ts';
import board from './src/package/board.ts';
import { startGame } from './src/game.ts';

// Load packages in sequence
await loadPackage(lockfile);   // ensure single instance
await loadPackage(config);     // load config.yaml (creates default if missing)
await loadPackage(commands);   // load commands from data/commands/ and src/commands/
await loadPackage(character);  // prepare character storage directory
await loadPackage(board);      // load message boards

// Start the game (sets Game.game singleton and begins accepting connections)
const game = await startGame();
```

### Connect

```bash
telnet localhost 23
# or use your favorite MUD client
```

---

## 📖 Available Commands

### Communication
- `say <message>` or `'<message>` - Speak to players in the same room
- `ooc <message>` or `"<message>` - Send out-of-character message
- `whisper <target> <message>` - Private message to a player
- `reply <message>` - Reply to last whisper
- `channels` - List and manage channel subscriptions
- `channels on <channel>` - Subscribe to a channel
- `channels off <channel>` - Unsubscribe from a channel

### Message Boards
- `board` or `boards` - List all available message boards
- `board <name>` - View messages on a board (subject lines only)
- `board <name> read <id>` - Read a specific message
- `board <name> write` - Start interactive message editor

### Information
- `who` - See who is currently online
- `score` or `info` or `me` - View your character information
- `help` - Show general help
- `help <topic>` - Get help on a specific topic
- `help search <query>` - Search all help topics
- `commands` - List all available commands

### Social
- `block <username>` - Block a user from messaging you
- `unblock <username>` - Unblock a user

---

## 🏗️ Core Modules

The core modules in `src/` provide the fundamental building blocks:

### game
Orchestrates the MUD server lifecycle, player connections, authentication flow, and player sessions.

**Key Exports:**
- `Game` class - Main game orchestrator
- `startGame()` - Bootstrap function with graceful shutdown
- `LOGIN_STATE` enum - Authentication flow states

**Methods:**
```ts
class Game {
  async start(): Promise<void>
  async stop(): Promise<void>
  broadcast(text: string, group?: MESSAGE_GROUP): void
  forEachCharacter(callback: (character: Character) => void): void
  getGameStats(): { activeConnections: number; playersOnline: number }
}
```

### io
Networking primitives for TCP connections.

**Key Exports:**
- `MudServer` class - TCP server wrapper
- `MudClient` class - Connection wrapper with I/O helpers

**MudClient Methods:**
```ts
class MudClient {
  send(text: string): void
  sendLine(text: string): void
  ask(question: string, callback: (answer: string) => void): void
  yesno(question: string, callback: (answer: boolean | undefined) => void): void
}
```

### character
Player data model combining persistent profile with runtime session.

**Key Exports:**
- `Character` class - Player profile and session
- `MESSAGE_GROUP` enum - Message categorization for prompts
- `CHANNEL` enum - Communication channels

**Character Methods:**
```ts
class Character {
  credentials: PlayerCredentials
  settings: PlayerSettings
  stats: PlayerStats
  mob: Mob
  
  setPassword(password: string): void
  verifyPassword(password: string): boolean
  startSession(connectionId: number, client: MudClient): void
  endSession(): void
  sendMessage(text: string, group: MESSAGE_GROUP): void
  getFormattedPlaytime(): string
  joinChannel(channel: CHANNEL): void
  leaveChannel(channel: CHANNEL): void
  block(username: string): void
  unblock(username: string): void
  ask(question: string, callback: (line: string) => void): void
  yesno(question: string, callback: (yesorno: boolean | undefined) => void): void
}
```

### dungeon
World model providing rooms, mobs, items, props, and movement.

**Key Classes:**
- `Dungeon` - 3D grid of rooms
- `Room` - Spatial locations with exits
- `Mob` - Living creatures (NPCs and player avatars)
- `Item` - Portable objects
- `Prop` - Fixed objects
- `RoomLink` - Custom connections between rooms

**Movement:**
```ts
const mob = new Mob({ display: 'Player' });
mob.moveTo(room);
if (mob.canStep(Direction.NORTH)) {
  mob.step(Direction.NORTH);
}
```

### command
Pattern-based command parsing and execution framework.

**Pattern Syntax:**
- `<name:type>` - Required argument
- `<name:type?>` - Optional argument
- `<name:type@source>` - Object with source modifier
- `word~` - Autocomplete literal

**Example:**
```ts
export default {
  pattern: "say <message:text>",
  aliases: ["'"],
  execute(context, args) {
    const message = args.get('message');
    context.actor.sendMessage(`You say: "${message}"`, MESSAGE_GROUP.CHANNELS);
  }
} satisfies CommandObject;
```

### board
Persistent message board system with class-based design.

**Key Classes:**
- `Board` - Message board with messages, permissions, expiration
- `BoardMessage` - Individual message with author, subject, content, targets

**Board Methods:**
```ts
class Board {
  addMessage(author: string, subject: string, content: string, targets?: string[]): BoardMessage
  getMessage(id: number): BoardMessage | undefined
  getVisibleMessages(username: string): BoardMessage[]
  canWrite(isAdmin: boolean): boolean
  removeExpiredMessages(): number
  getMessageCount(): number
  getAllMessages(): BoardMessage[]
}
```

### color
Terminal color utilities and formatting.

**Functions:**
- `color(text: string, colorCode: COLOR): string` - Apply color to text
- `colorize(text: string): string` - Parse and apply inline color tags
- `stripColors(text: string): string` - Remove color codes
- `visibleLength(text: string): number` - Get text length without color codes

**Color Tags:**
- `{r` - Dark red, `{R` - Bright red
- `{g` - Dark green, `{G` - Bright green
- `{b` - Dark blue, `{B` - Bright blue
- `{y` - Yellow, `{c` - Cyan, `{m` - Magenta
- `{x` - Reset colors

### time
Time formatting utilities for durations and timestamps.

**Functions:**
- `formatDuration(ms: number): string` - Format duration (days/hours/minutes)
- `formatPlaytime(ms: number): string` - Format playtime (hours/minutes/seconds)

### logger
Structured logging with file and console output using Winston.

---

## 📦 Package System

Built-in packages under `src/package/` provide configuration, persistence, and extensibility.

### commands
Loads command modules from:
- `data/commands/*.js` (runtime-extensible JavaScript commands)
- `dist/src/commands/*.js` (compiled built-in TypeScript commands)

### config
YAML configuration loader for `data/config.yaml`. Creates default config if missing.

**Config Structure:**
```yaml
game:
  name: mud3
  creator: jackindisguise
server:
  port: 23
  inactivity_timeout: 1800
security:
  password_salt: changeme_default_salt_12345
```

### character
Persists `Character` entities to `data/characters/<username>.yaml`.

**Functions:**
- `saveCharacter(character: Character): Promise<void>`
- `loadCharacter(username: string): Promise<Character | undefined>`
- `checkCharacterPassword(username: string, password: string): Promise<SerializedCharacter | undefined>`

### board
Persists `Board` entities to `data/boards/<name>.yaml`.

**Functions:**
- `saveBoard(board: Board): Promise<void>`
- `loadBoard(name: string): Promise<Board | undefined>`
- `getAllBoards(): Promise<Board[]>`

**Board YAML Format:**
```yaml
name: general
displayName: General
description: General discussion board
permanent: false
expirationMs: 2592000000  # 30 days in milliseconds
writePermission: all      # "all" or "admin"
messages: []
nextMessageId: 1
```

### help
Loads help files from `data/help/*.yaml` with keyword-based lookup and search.

### lockfile
Ensures only one instance runs by managing a `.lock` file.

---

## 📁 Directory Structure

```
mud-command2/
├── data/
│   ├── boards/          # Message board YAML files
│   ├── characters/      # Character save files
│   ├── commands/        # Runtime JavaScript commands
│   ├── config.yaml      # Game configuration
│   └── help/            # Help topic YAML files
├── src/
│   ├── commands/        # Built-in TypeScript commands
│   ├── package/         # Package modules (persistence, etc.)
│   ├── board.ts         # Board class and types
│   ├── channel.ts       # Channel system
│   ├── character.ts     # Character class
│   ├── color.ts         # Color utilities
│   ├── command.ts       # Command framework
│   ├── dungeon.ts       # World model
│   ├── game.ts          # Game orchestrator
│   ├── io.ts            # Network layer
│   ├── logger.ts        # Logging
│   └── time.ts          # Time formatting utilities
├── dist/                # Compiled JavaScript (generated)
├── logs/                # Log files (generated)
└── index.ts             # Entry point
```

---

## 🛠️ Development

### Scripts

```bash
npm run build      # Compile TypeScript
npm test           # Run all tests
npm run coverage   # Generate test coverage report
npm run doc        # Generate TypeScript documentation
npm start          # Start the server
npm run rerun      # Build and start
```

### Creating Commands

**TypeScript Command (Built-in):**
```ts
// src/commands/mycommand.ts
import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";

export default {
  pattern: "mycommand <arg:word>",
  execute(context: CommandContext, args: Map<string, any>): void {
    const arg = args.get("arg");
    context.actor.sendMessage(`You said: ${arg}`, MESSAGE_GROUP.COMMAND_RESPONSE);
  }
} satisfies CommandObject;
```

**JavaScript Command (Runtime):**
```js
// data/commands/mycommand.js
export default {
  pattern: "mycommand <arg:word>",
  execute(context, args) {
    const arg = args.get("arg");
    context.actor.sendMessage(`You said: ${arg}`, "COMMAND_RESPONSE");
  }
};
```

### Creating Message Boards

Create a YAML file in `data/boards/`:

```yaml
name: myboard
displayName: My Board
description: A custom message board
permanent: true
writePermission: all  # or "admin" for admin-only
messages: []
nextMessageId: 1
```

### Creating Help Topics

Create a YAML file in `data/help/`:

```yaml
keyword: mytopic
aliases: [topic, mt]
related: [othertopic]
content: |
  This is the help content for my topic.
  
  It supports multi-line text and formatting.
```

---

## 🔧 Configuration

### Server Configuration

Edit `data/config.yaml`:

```yaml
game:
  name: "My MUD"
  creator: "Your Name"
server:
  port: 23
  inactivity_timeout: 1800
security:
  password_salt: "your-secret-salt-here"
```

### Environment Variables

- `LOG_LEVEL` - Console log level (default: `error`, options: `error`, `warn`, `info`, `debug`)

---

## 📝 Module Dependencies

```
game
├── io (MudServer, MudClient)
├── character (Character, MESSAGE_GROUP)
├── command (CommandRegistry, CommandContext)
├── dungeon (Mob, Room)
├── board (Board)
├── package/config (CONFIG)
├── package/character (persistence)
├── package/board (persistence)
└── logger

character
├── dungeon (Mob)
├── channel (CHANNEL)
├── time (formatPlaytime)
├── package/config (CONFIG)
└── io (MudClient)

board
└── [no dependencies]

command
└── dungeon (Mob, Room, etc.)

dungeon
└── character (Character for Mob.character link)
```

---

## 🧪 Testing

The project includes comprehensive unit tests using Node.js's built-in test framework:

```bash
npm test              # Run all tests
npm run coverage      # Generate coverage report
```

Test files follow the pattern `*.spec.ts` and are located alongside their source files.

---

## 📄 License

ISC

---

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

---

## 🎮 Example Gameplay

```
> connect
Connected to MUD3
> create account alice
Password: ****
Account created! Logging in...
Welcome to MUD3, alice!

> who
=== Players Online ===
> alice

Total Players: 1
Total Connections: 1

> board
=== Available Message Boards ===

Changes (changes)
  Updates about the game.
  Permanent
  Messages: 1

General (general)
  General discussion board
  Time-limited (expires after 30 days)
  Messages: 0

Trade (trade)
  Trading board
  Time-limited (expires after 7 days)
  Messages: 0

> board general write
Target users (space-separated @mentions, or press Enter for public):
Subject: Hello World
Enter message body. Type !done when finished, or !help for commands.
> This is my first message!
> !done
=== Message Preview ===
Board: General
Visibility: Public
Subject: Hello World

Body:
This is my first message!

Submit this message? (y/n): y
Message #1 posted to General board.
```

---

Built with ❤️ using TypeScript and Node.js
