# Core Modules

This document covers the core modules in `src/` that provide the fundamental building blocks for the MUD server. For package documentation (commands, config, lockfile, character), see [README.packages.md](README.packages.md).

## Overview

The core modules provide:
- **game** - Server lifecycle, player sessions, and authentication
- **io** - Network layer for TCP connections
- **character** - Player data model and messaging
- **dungeon** - World model (rooms, mobs, items, movement)
- **command** - Command parsing and execution framework
- **logger** - Structured logging with file/console output

---

## game

Orchestrates the MUD server lifecycle, player connections, authentication flow, and player sessions. It bridges the network layer (`MudServer`/`MudClient`) with the domain model (`Character`/`Mob`) and persistence (package loaders).

### Key Exports

- `Game` class - Main game orchestrator
- `startGame()` - Bootstrap function with graceful shutdown
- `LOGIN_STATE` enum - Authentication flow states
- `LoginSession` interface - Per-connection state container

### Game Class

The `Game` class manages:
- TCP server startup/shutdown
- Login flow with username/password authentication
- Active player sessions and character tracking
- Auto-save every 5 minutes
- Inactivity timeout handling

#### Key Methods

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

- `broadcast()` - Send messages to all active playing characters (respects MESSAGE_GROUP)
- `announce()` - Send messages to all connected clients regardless of login state
- `forEachSession()` - Execute a function for each login session
- `forEachCharacter()` - Execute a function for each active character

### Usage

```ts
import { startGame, Game } from './src/game.ts';

// Start the game (sets Game.game singleton)
const game = await startGame();

// Access singleton from commands
const stats = game.getGameStats();
console.log(`${stats.playersOnline} players online`);

// Broadcast to all players
game.broadcast("Server restart in 5 minutes!", MESSAGE_GROUP.SYSTEM);

// Iterate over sessions
game.forEachCharacter((char) => {
  console.log(char.credentials.username);
});

// Later, stop gracefully
await game.stop();
```

### Login Flow

1. Client connects → `LOGIN_STATE.CONNECTED`
2. Ask for username
3. If username exists → ask for password → verify → load character
4. If username new → confirm creation → ask for password → confirm password → create character
5. Show MOTD → press any key
6. `LOGIN_STATE.PLAYING` → start session

### Configuration

Uses `CONFIG` from `package/config`:
- `server.port` - TCP port (default 23)
- `server.inactivity_timeout` - Seconds before disconnect (default 1800)

---

## io

Networking primitives for the MUD server. Provides `MudServer` (TCP server) and `MudClient` (per-connection wrapper) with event-driven architecture and helper methods for player interaction.

### Key Exports

- `MudServer` class - TCP server wrapper
- `MudClient` class - Connection wrapper with I/O helpers

### MudServer

Wraps Node's `net.Server` with EventEmitter pattern.

#### Events

```ts
server.on('listening', () => { })
server.on('connection', (client: MudClient) => { })
server.on('disconnection', (client: MudClient) => { })
```

#### Methods

```ts
class MudServer {
  async start(): Promise<void>
  async stop(): Promise<void>
}
```

### MudClient

Wraps a TCP socket with player-friendly I/O methods.

#### Events

```ts
client.on('input', (line: string) => { })
```

#### Methods

```ts
class MudClient {
  // Output
  send(text: string): void
  sendLine(text: string): void
  
  // Input prompts
  ask(question: string, callback: (answer: string) => void): void
  yesno(question: string, callback: (answer: boolean | undefined) => void): void
  
  // Connection
  close(): void
  getAddress(): string
}
```

- `sendLine()` - Send text with newline
- `ask()` - Prompt for text input, calls callback with response
- `yesno()` - Prompt for yes/no, calls callback with true/false/undefined
- `close()` - Immediately destroy the socket connection

### Usage

```ts
import { MudServer } from './src/io.ts';

const server = new MudServer(4000);

server.on('connection', (client) => {
  client.sendLine('Welcome!');
  
  client.ask('What is your name?', (name) => {
    client.sendLine(`Hello, ${name}!`);
  });
  
  client.yesno('Continue?', (answer) => {
    if (answer === true) {
      client.sendLine('Great!');
    } else {
      client.close();
    }
  });
});

await server.start();
```

---

## character

Player data model combining persistent profile (credentials, settings, stats) with runtime session (connection, messaging). Establishes bidirectional link with `Mob` for in-world representation.

### Key Exports

- `Character` class - Player profile and session
- `MESSAGE_GROUP` enum - Message categorization for prompts
- `PlayerSettings`, `PlayerCredentials`, `PlayerStats` interfaces
- `SerializedCharacter` interface - Persistence format

### MESSAGE_GROUP

Controls prompt emission based on message grouping:

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

#### Key Properties

```ts
class Character {
  credentials: PlayerCredentials  // username, password hash, email, etc.
  settings: PlayerSettings        // preferences (prompt, colors, etc.)
  stats: PlayerStats              // gameplay statistics
  mob: Mob                        // in-world avatar (bidirectional link)
  session?: PlayerSession         // active connection state
}
```

#### Methods

```ts
// Password management
setPassword(password: string): void
verifyPassword(password: string): boolean
static hashPassword(password: string): string

// Session management
startSession(connectionId: number, client: MudClient): void
endSession(): void

// Messaging
send(text: string): void
sendLine(text: string): void
sendMessage(text: string, group: MESSAGE_GROUP): void

// Serialization
serialize(): SerializedCharacter
static deserialize(data: SerializedCharacter): Character
```

### Usage

```ts
import { Character, MESSAGE_GROUP } from './src/character.ts';
import { Mob } from './src/dungeon.ts';

// Create a character
const mob = new Mob({ display: 'Alice', keywords: 'alice' });
const char = new Character({
  credentials: { username: 'alice' },
  mob
});

// Set password (hashed with CONFIG.security.password_salt)
char.setPassword('secret123');

// Start session when client connects
char.startSession(1, client);

// Send messages
char.sendLine('Welcome back!');
char.sendMessage('You feel stronger!', MESSAGE_GROUP.INFO);
char.sendMessage('The orc attacks!', MESSAGE_GROUP.COMBAT);

// Verify password later
if (char.verifyPassword('secret123')) {
  console.log('Password valid');
}

// Serialize for saving
const data = char.serialize();
```

### Password Security

- Passwords are hashed using SHA-256 with `CONFIG.security.password_salt`
- Never stored in plain text
- Use `setPassword()` to hash and store
- Use `verifyPassword()` to check credentials

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

### DungeonObject

Base class for all world entities.

```ts
abstract class DungeonObject {
  display: string           // Display name
  keywords: string          // Space-separated search keywords
  description: string       // Long description
  location?: Container      // Current container
  
  move(container: Container): void
  toString(): string
}
```

### Movable

Entities that can move between rooms.

```ts
abstract class Movable extends DungeonObject {
  step(direction: Direction): boolean
  canStep(direction: Direction): boolean
}
```

### Room

Spatial locations in the world.

Rooms automatically connect to adjacent rooms in the same dungeon based on coordinates.

### Mob

Living creatures (NPCs and player avatars).

```ts
class Mob extends Movable {
  character?: Character  // Bidirectional link for players
  
  // Messaging (delegates to character if present)
  sendLine(text: string): void
  sendMessage(text: string, group: MESSAGE_GROUP): void
  
  serialize(): SerializedMob
  static deserialize(data: SerializedMob): Mob
}
```

### Item

Portable objects that can be picked up.

```ts
class Item extends Movable {
  serialize(): SerializedItem
  static deserialize(data: SerializedItem): Item
}
```

### Prop

Fixed objects like furniture or scenery.

```ts
class Prop extends Movable {
  serialize(): SerializedProp
  static deserialize(data: SerializedProp): Prop
}
```

### Dungeon

3D grid-based world.

```ts
class Dungeon {
  dimensions: { width: number; height: number; layers: number }
  rooms: (Room | undefined)[][][]

  // Grid management
  initializeGrid(dimensions: { width: number; height: number; layers: number }): void
  generateEmptyRooms(): void
  getRoom(x: number, y: number, z: number): Room | undefined
  
  // Serialization
  serialize(): SerializedDungeon
  static deserialize(data: SerializedDungeon): Dungeon
}
```

### RoomLink

Custom connections between non-adjacent rooms.

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

### Usage

```ts
import { Dungeon, Room, Mob, Item, Direction } from './src/dungeon.ts';

// Create a dungeon
const dungeon = new Dungeon({ width: 10, height: 10, layers: 3 });
dungeon.generateEmptyRooms();

// Get a room
const startRoom = dungeon.getRoom(0, 0, 0)!;
startRoom.display = 'Town Square';
startRoom.description = 'A bustling town square.';

// Create a mob
const orc = new Mob({ display: 'an orc', keywords: 'orc' });
orc.moveTo(startRoom);

// Create an item
const sword = new Item({ display: 'a sword', keywords: 'sword' });
sword.moveTo(startRoom);

// Movement
const player = new Mob({ display: 'Player', keywords: 'player' });
player.moveTo(startRoom);

if (player.canStep(Direction.NORTH)) {
  player.step(Direction.NORTH);
  console.log(`Moved to ${player.location?.display}`);
}

// Create custom link (two-way by default)
const portal = RoomLink.createTunnel(
  startRoom,
  Direction.UP,
  dungeon.getRoom(5, 5, 1)!
);

// Create one-way link
const oneWay = RoomLink.createTunnel(
  startRoom,
  Direction.EAST,
  dungeon.getRoom(9, 0, 0)!,
  true  // oneWay = true
);
```

---

## command

Command parsing and execution framework with pattern matching, argument extraction, and registry management.

### Key Exports

- `Command` class - Pattern-based command parser
- `CommandRegistry` class - Command collection manager
- `CommandContext` interface - Execution context (actor, room, etc.)
- `ParseResult` interface - Parse outcome

### Command Class

Parses user input against a pattern and extracts arguments.

#### Pattern Syntax

- `<name>` - Required argument
- `<name:type>` - Typed argument (text, number, word, any)
- `<...name>` - Consumes remaining input
- Literal text - Must match exactly

Examples:
- `"say <message:text>"` - Matches "say hello world"
- `"give <item> to <target>"` - Matches "give sword to alice"
- `"look <...target>"` - Matches "look at the old sword"

```ts
class Command {
  constructor(pattern: string)
  
  parse(input: string): ParseResult
}
```

### ParseResult

```ts
interface ParseResult {
  command: Command
  success: boolean
  args: Map<string, any>
  error?: string
}
```

### CommandRegistry

Manages a collection of commands with pattern matching and aliases.

```ts
class CommandRegistry {
  static default: CommandRegistry
  
  register(commandObj: CommandObject): void
  unregister(pattern: string): void
  
  parse(input: string): ParseResult | undefined
  execute(input: string, context: CommandContext): boolean
}
```

- `parse()` - Find matching command and extract arguments
- `execute()` - Parse and execute command, call onError if fails

### CommandObject Interface

Commands implement this interface:

```ts
interface CommandObject {
  pattern: string
  aliases?: string[]
  execute(context: CommandContext, args: Map<string, any>): void
  onError?(context: CommandContext, result: ParseResult): void
}
```

### CommandContext

Execution context passed to commands:

```ts
interface CommandContext {
  actor: Mob          // Who executed the command
  room?: Room         // Current room (if any)
}
```

### Usage

```ts
import { CommandRegistry, Command } from './src/command.ts';

// Define a command
const sayCommand = {
  pattern: 'say <message:text>',
  aliases: ["'"],
  
  execute(context, args) {
    const message = args.get('message');
    context.actor.sendMessage(`You say: "${message}"`, MESSAGE_GROUP.CHANNELS);
    
    // Broadcast to room
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

// Register command
CommandRegistry.default.register(sayCommand);

// Execute user input
const context = { actor: playerMob, room: currentRoom };
const executed = CommandRegistry.default.execute("say hello", context);
if (!executed) {
  playerMob.sendLine("Do what?");
}
```

### Command Parsing Examples

```ts
const cmd = new Command("give <item> to <target>");

// Success
const result1 = cmd.parse("give sword to alice");
// result1.success === true
// result1.args.get('item') === 'sword'
// result1.args.get('target') === 'alice'

// Failure
const result2 = cmd.parse("give sword");
// result2.success === false
// result2.error === "Missing required argument: target"
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

### Configuration

- `LOG_LEVEL` environment variable controls console output (default: 'error')
- File logs always written to `logs/` directory as JSON lines
- Console logs disabled during tests

### Usage

```ts
import logger from './src/logger.ts';

logger.info('Server started', { port: 4000 });
logger.debug('Processing command', { command: 'say', actor: 'Alice' });
logger.warn('Connection timeout', { address: '127.0.0.1' });
logger.error('Failed to save character', { error: err.message });
```

### File Output

Logs are written to `logs/` directory:
- Structured JSON format
- One log entry per line
- Rotates automatically

Example log file entry:
```json
{"level":"info","message":"Server started","port":4000,"timestamp":"2025-11-05T10:30:00.000Z"}
```

---

## Module Dependencies

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

---

## Quick Reference

### Starting the Server

```ts
import { loadPackage } from 'package-loader';
import lockfile from './src/package/lockfile.ts';
import config from './src/package/config.ts';
import commands from './src/package/commands.ts';
import character from './src/package/character.ts';
import { startGame } from './src/game.ts';

await loadPackage(lockfile);
await loadPackage(config);
await loadPackage(commands);
await loadPackage(character);

const game = await startGame();
```

### Creating a World

```ts
const dungeon = new Dungeon({ width: 10, height: 10, layers: 1 });
dungeon.generateEmptyRooms();

const room = dungeon.getRoom(0, 0, 0)!;
room.display = 'Starting Room';
room.description = 'You are in a small room.';
```

### Creating a Character

```ts
const mob = new Mob({ display: 'Player', keywords: 'player' });
const char = new Character({ credentials: { username: 'alice' }, mob });
char.setPassword('secret');
char.startSession(1, client);
```

### Implementing a Command

```ts
export default {
  pattern: 'look',
  execute(context) {
    const room = context.room;
    if (!room) return;
    
    context.actor.sendMessage(room.display, MESSAGE_GROUP.INFO);
    context.actor.sendMessage(room.description, MESSAGE_GROUP.INFO);
  }
};
```
