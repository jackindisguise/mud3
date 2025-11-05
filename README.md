A text-based MUD (Multi-User Dungeon) server built with TypeScript and Node.js.

# Quick Start

```ts
import { loadPackage } from 'package-loader';
import lockfile from './src/package/lockfile.ts';
import config from './src/package/config.ts';
import commands from './src/package/commands.ts';
import character from './src/package/character.ts';
import { startGame } from './src/game.ts';

// Load packages in sequence
await loadPackage(lockfile);   // ensure single instance
await loadPackage(config);     // load config.yaml (creates default if missing)
await loadPackage(commands);   // load commands from data/commands/ and src/commands/
await loadPackage(character);  // prepare character storage directory

// Start the game (sets Game.game singleton and begins accepting connections)
const game = await startGame();
```

---

# Core Modules

The core modules in `src/` provide the fundamental building blocks for the MUD server:

- **game** - Server lifecycle, player sessions, and authentication
- **io** - Network layer for TCP connections
- **character** - Player data model and messaging
- **dungeon** - World model (rooms, mobs, items, movement)
- **command** - Command parsing and execution framework
- **logger** - Structured logging with file/console output

## game

Orchestrates the MUD server lifecycle, player connections, authentication flow, and player sessions.

### Key Exports

- `Game` class - Main game orchestrator
- `startGame()` - Bootstrap function with graceful shutdown
- `LOGIN_STATE` enum - Authentication flow states
- `LoginSession` interface - Per-connection state container

### Game Class Methods

```ts
class Game {
  async start(): Promise<void>
  async stop(): Promise<void>
  
  // Broadcasting
  broadcast(text: string, group?: MESSAGE_GROUP): void
  announce(text: string): void
  
  // Iteration
  forEachSession(callback: (session: LoginSession) => void): void
  forEachCharacter(callback: (character: Character) => void): void
  
  // Statistics
  getGameStats(): { activeConnections: number; playersOnline: number }
  
  // Singleton
  static game?: Game
}
```

### Usage Example

```ts
import { startGame, Game } from './src/game.ts';

const game = await startGame();
const stats = game.getGameStats();
console.log(`${stats.playersOnline} players online`);

game.broadcast("Server restart in 5 minutes!", MESSAGE_GROUP.SYSTEM);

game.forEachCharacter((char) => {
  console.log(char.credentials.username);
});
```

---

## io

Networking primitives for the MUD server. Provides `MudServer` (TCP server) and `MudClient` (per-connection wrapper).

### Key Exports

- `MudServer` class - TCP server wrapper
- `MudClient` class - Connection wrapper with I/O helpers

### MudServer

```ts
class MudServer {
  async start(): Promise<void>
  async stop(): Promise<void>
}

// Events
server.on('listening', () => { })
server.on('connection', (client: MudClient) => { })
server.on('disconnection', (client: MudClient) => { })
```

### MudClient

```ts
class MudClient {
  send(text: string): void
  sendLine(text: string): void
  ask(question: string, callback: (answer: string) => void): void
  yesno(question: string, callback: (answer: boolean | undefined) => void): void
  close(): void
  getAddress(): string
}

// Events
client.on('input', (line: string) => { })
```

---

## character

Player data model combining persistent profile (credentials, settings, stats) with runtime session (connection, messaging).

### Key Exports

- `Character` class - Player profile and session
- `MESSAGE_GROUP` enum - Message categorization for prompts
- `PlayerSettings`, `PlayerCredentials`, `PlayerStats` interfaces
- `SerializedCharacter` interface - Persistence format

### MESSAGE_GROUP

```ts
enum MESSAGE_GROUP {
  INFO = "INFO",
  COMBAT = "COMBAT", 
  COMMAND_RESPONSE = "COMMAND_RESPONSE",
  SYSTEM = "SYSTEM",
  CHANNELS = "CHANNELS"
}
```

When a message arrives with a different group than the previous one, a blank line and prompt are emitted to visually separate contexts.

### Character Class

```ts
class Character {
  credentials: PlayerCredentials
  settings: PlayerSettings
  stats: PlayerStats
  mob: Mob
  session?: PlayerSession
  
  setPassword(password: string): void
  verifyPassword(password: string): boolean
  static hashPassword(password: string): string
  
  startSession(connectionId: number, client: MudClient): void
  endSession(): void
  
  send(text: string): void
  sendLine(text: string): void
  sendMessage(text: string, group: MESSAGE_GROUP): void
  
  serialize(): SerializedCharacter
  static deserialize(data: SerializedCharacter): Character
}
```

---

## dungeon

World model providing rooms, mobs, items, props, and movement. Implements a 3D grid-based world with exits, containment, and spatial relationships.

### Key Exports

**Base Classes:**
- `DungeonObject` - Base for all world entities
- `Movable` - Entities that can move between containers
- `Container` - Entities that can hold other objects

**Concrete Classes:**
- `Room` - Spatial locations with exits
- `Mob` - Living creatures (NPCs and player avatars)
- `Item` - Portable objects
- `Prop` - Fixed objects (furniture, scenery)

**World Management:**
- `Dungeon` - 3D grid of rooms with dimensions
- `RoomLink` - Custom connections between non-adjacent rooms

**Enums:**
- `Direction` - Cardinal directions (NORTH, SOUTH, EAST, WEST, UP, DOWN)

### Class Hierarchy

```
DungeonObject (abstract)
├── Movable (abstract)
│   ├── Mob
│   └── Item
├── Container (abstract)
│   ├── Room
│   └── Prop
└── RoomLink
```

### RoomLink

```ts
class RoomLink {
  static createTunnel(
    fromRoom: Room,
    direction: Direction,
    toRoom: Room,
    oneWay?: boolean
  ): RoomLink
  
  getDestination(fromRoom: Room, direction: Direction): Room | undefined
  remove(): void
}
```

### Usage Example

```ts
import { Dungeon, Room, Mob, Item, Direction, RoomLink } from './src/dungeon.ts';

const dungeon = new Dungeon({ width: 10, height: 10, layers: 3 });
dungeon.generateEmptyRooms();

const startRoom = dungeon.getRoom(0, 0, 0)!;
startRoom.display = 'Town Square';

const player = new Mob({ display: 'Player', keywords: 'player' });
player.moveTo(startRoom);

if (player.canStep(Direction.NORTH)) {
  player.step(Direction.NORTH);
}

// Create custom link (two-way by default)
RoomLink.createTunnel(startRoom, Direction.UP, dungeon.getRoom(5, 5, 1)!);

// Create one-way link
RoomLink.createTunnel(startRoom, Direction.EAST, dungeon.getRoom(9, 0, 0)!, true);
```

---

## command

Command parsing and execution framework with pattern matching, argument extraction, and registry management.

### Key Exports

- `Command` class - Pattern-based command parser
- `CommandRegistry` class - Command collection manager
- `CommandContext` interface - Execution context (actor, room, etc.)
- `ParseResult` interface - Parse outcome

### Pattern Syntax

- `<name>` - Required argument
- `<name:type>` - Typed argument (text, number, word, any)
- `<...name>` - Consumes remaining input
- Literal text - Must match exactly

Examples:
- `"say <message:text>"` - Matches "say hello world"
- `"give <item> to <target>"` - Matches "give sword to alice"
- `"look <...target>"` - Matches "look at the old sword"

### CommandRegistry

```ts
class CommandRegistry {
  static default: CommandRegistry
  
  register(commandObj: CommandObject): void
  unregister(pattern: string): void
  parse(input: string): ParseResult | undefined
  execute(input: string, context: CommandContext): boolean
}
```

### Usage Example

```ts
import { CommandRegistry } from './src/command.ts';

const sayCommand = {
  pattern: 'say <message:text>',
  aliases: ["'"],
  
  execute(context, args) {
    const message = args.get('message');
    context.actor.sendMessage(`You say: "${message}"`, MESSAGE_GROUP.CHANNELS);
    
    if (context.room) {
      for (const mob of context.room.contents) {
        if (mob instanceof Mob && mob !== context.actor) {
          mob.sendMessage(`${context.actor} says, "${message}"`, MESSAGE_GROUP.CHANNELS);
        }
      }
    }
  },
  
  onError(context, result) {
    context.actor.sendLine(result.error ?? 'Invalid command');
  }
};

CommandRegistry.default.register(sayCommand);
```

---

## logger

Structured logging with file output and console output. Uses Winston for formatting and transport.

### Key Export

- `logger` (default export) - Winston logger instance

### Log Levels

- `error` - Errors and exceptions
- `warn` - Warning messages
- `info` - General information
- `debug` - Debug information

### Usage

```ts
import logger from './src/logger.ts';

logger.info('Server started', { port: 4000 });
logger.debug('Processing command', { command: 'say', actor: 'Alice' });
logger.warn('Connection timeout', { address: '127.0.0.1' });
logger.error('Failed to save character', { error: err.message });
```

### Configuration

- `LOG_LEVEL` environment variable controls console output (default: 'error')
- File logs always written to `logs/` directory as JSON lines
- Console logs disabled during tests

---

# Package System

The built-in packages under `src/package/` provide configuration, persistence, and extensibility.

Package loader target: each module exports a default object `{ name, loader, dependencies }` for composition with a package loader.

## commands

Loads command modules from two locations at startup:

- `data/commands` (runtime-extensible JS commands)
- `dist/src/commands` (compiled built-in commands)

Only `.js` files are loaded; files beginning with `_` are ignored.

### Command shape

```js
// data/commands/say.js
export default {
  pattern: 'say <...text:any>',
  aliases: ['"'],
  execute(ctx, args) {
    const text = args.get('text');
    ctx.client.sendLine(text);
  },
  onError(ctx, result) {
    ctx.client.sendLine(result.error ?? 'Could not parse command');
  }
};
```

Directory conventions:
- Put custom runtime commands in `data/commands/*.js`
- Built-in commands live in `src/commands/*.ts`

---

## config

YAML configuration loader that loads `data/config.yaml` and merges it into a typed in-memory `CONFIG` object.

### Types

```ts
export type GameConfig = { name: string; creator: string };
export type ServerConfig = { port: number; inactivity_timeout: number };
export type SecurityConfig = { password_salt: string };
export type Config = {
  game: GameConfig;
  server: ServerConfig;
  security: SecurityConfig;
};
```

### Usage

```ts
import configPkg, { CONFIG } from './src/package/config.ts';
await loadPackage(configPkg);
console.log(CONFIG.server.port);
```

Example `data/config.yaml`:

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

---

## lockfile

Ensures only one instance of the app runs by managing a `.lock` file in the project root.

### Usage

```ts
import { loadPackage } from 'package-loader';
import lockfile from './src/package/lockfile.ts';
await loadPackage(lockfile);
// Exits the process if another instance is running
```

#### Standalone utilities

```ts
import { isProcessRunning, createLock, removeLock, checkLock } from './src/package/lockfile.ts';

if (await checkLock()) process.exit(1);
await createLock();
// ... later
await removeLock();
```

---

## character

Persists `Character` entities to `data/characters/<username>.yaml` and restores them back using `Character.serialize()`/`Character.deserialize()`.

Active character registry: this package maintains a registry of usernames that are currently active. `loadCharacter()` refuses to load a character that's already active.

### Authentication helpers

- `checkCharacterPassword(username, password)` - Verifies password against the stored hash in the character file. Returns `SerializedCharacter` if the password matches, `undefined` otherwise.
- `loadCharacterFromSerialized(data)` - Deserializes character data and registers it as active.

This approach is more efficient for login flows because password verification happens before deserializing the full character object.

### Usage

```ts
import { loadPackage } from 'package-loader';
import characterPkg, { 
  saveCharacter, 
  loadCharacter, 
  unregisterActiveCharacter,
  checkCharacterPassword,
  loadCharacterFromSerialized 
} from './src/package/character.ts';

await loadPackage(characterPkg);

// Creating and saving a new character
const player = new Character({ credentials: { username: 'Alice' } });
player.setPassword('secret123');
await saveCharacter(player);

// Loading an existing character (automatically registers as active)
const reloaded = await loadCharacter('Alice');

// Authentication flow (password check + load)
const serialized = await checkCharacterPassword('Alice', 'secret123');
if (serialized) {
  const character = loadCharacterFromSerialized(serialized);
}

// Later, on disconnect
unregisterActiveCharacter('Alice');
```

---

# Directory Structure

- `data/config.yaml` - game/server/security config (autocreated if missing)
- `data/commands/*.js` - runtime command modules
- `data/characters/*.yaml` - character saves
- `.lock` - process lock file (created/removed by lockfile package)
- `logs/` - JSON log files

---

# Module Dependencies

```
game
├── io (MudServer, MudClient)
├── character (Character, MESSAGE_GROUP)
├── command (CommandRegistry, CommandContext)
├── dungeon (Mob, Room)
├── package/config (CONFIG)
├── package/character (persistence functions)
└── logger

io
└── logger

character
├── dungeon (Mob)
├── package/config (CONFIG for password salt)
└── io (MudClient)

dungeon
├── character (Character for Mob.character link)
└── [no core dependencies]

command
└── [no core dependencies]

logger
└── [no core dependencies]
```
