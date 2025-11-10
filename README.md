# mud3

mud3 is a modern TypeScript-based Multi-User Dungeon (MUD) server framework designed for building persistent online text-based games. It provides a complete foundation with built-in systems for player management, world modeling, communication, and command handling. The framework emphasizes extensibility, type safety, and developer experience, making it easy to create and customize your own MUD server.

The server architecture is modular and package-based, allowing you to extend functionality through a simple loader system. All game data is persisted using YAML files with atomic write operations to prevent corruption, ensuring data integrity even during unexpected shutdowns.

# Features

## 1. Efficient and user-accessible command pattern system

The command system uses declarative patterns to define commands with typed arguments, automatic parsing, and validation. Commands can be defined in TypeScript classes, JavaScript modules, or YAML files, providing flexibility for different use cases.

### Key Features

- **Pattern-based syntax**: Define commands using human-readable patterns like `"say <message:text>"` or `"get <item:object@room>"`
- **Typed arguments**: Built-in argument types including `text`, `word`, `number`, `object`, `mob`, `item`, `direction`, and `character`
- **Source modifiers**: Specify where to search for objects using `@room`, `@inventory`, or `@all`
- **Autocomplete support**: Use the `~` suffix on literal words to enable partial matching (e.g., `"ooc~"` matches "o", "oo", or "ooc")
- **Optional arguments**: Mark arguments as optional with `?` suffix (e.g., `"look <direction:direction?>"`)
- **Command aliases**: Support multiple patterns per command for alternate phrasings
- **Automatic priority**: Commands are matched longest-first, ensuring specific patterns are tried before general ones
- **Custom error handling**: Implement `onError()` methods to provide user-friendly error messages

### Usage Examples

**TypeScript Command:**
```typescript
import { Command, CommandContext } from "./command.js";

class SayCommand extends Command {
  pattern = "say <message:text>";
  
  execute(context: CommandContext, args: Map<string, any>) {
    const message = args.get("message");
    context.actor.sendLine(`You say: ${message}`);
  }
}

CommandRegistry.default.register(new SayCommand());
```

**YAML Command:**
```yaml
# data/commands/greet.yaml
pattern: greet <target:character>
execute: |
  function(context, args) {
    const target = args.get("target");
    context.actor.sendLine(`You greet ${target.display}!`);
  }
```

**JavaScript Command:**
```javascript
// data/commands/wave.js
export default {
  pattern: "wave <target:mob?>",
  execute(context, args) {
    const target = args.get("target");
    if (target) {
      context.actor.sendLine(`You wave at ${target.display}.`);
    } else {
      context.actor.sendLine("You wave.");
    }
  }
};
```

## 2. Expandable channel system

The channel system provides multiple communication channels that players can subscribe to, each with distinct color schemes and message formatting. Channels support both public and private messaging, with built-in user blocking capabilities.

### Key Features

- **Multiple channels**: OOC (Out of Character), NEWBIE, TRADE, GOSSIP, SAY (in-character speech), and WHISPER (private messages)
- **Channel subscription management**: Players can subscribe/unsubscribe to channels using the `channels` command
- **Color-coded messages**: Each channel has distinct color schemes for easy visual identification
- **Message targeting**: WHISPER channel supports private messaging with `@mentions` and `reply` command support
- **User blocking**: Block users to prevent whispers and unwanted messages
- **Default subscriptions**: Channels can be configured with default on/off states

### Usage Examples

**Managing Channels:**
```
channels                    # List all channels with subscription status
channels on newbie          # Subscribe to NEWBIE channel
channels off gossip         # Unsubscribe from GOSSIP channel
channels enable trade       # Subscribe to TRADE channel
channels disable ooc        # Unsubscribe from OOC channel
```

**Sending Messages:**
```
ooc Hello everyone!         # Send to OOC channel
say I walk into the room.   # Send to SAY channel (in-character)
whisper bob Hello!          # Send private message to bob
reply Thanks!               # Reply to last whisper
```

## 3. Easy-to-use message board system

The message board system provides persistent note boards with an interactive multi-line editor, message targeting, and flexible expiration policies. Boards can be configured as permanent (messages never expire) or time-limited (messages automatically expire after a set duration).

### Key Features

- **Interactive editor**: Rich multi-line message editor with commands for editing, previewing, and managing messages
- **Message targeting**: Target messages to specific users with `@mentions` or make them public
- **Expiration policies**: Boards can be permanent or time-limited with automatic cleanup
- **Write permissions**: Configure boards to allow all users or restrict to admins only
- **Auto-save**: Boards automatically saved on server shutdown
- **Auto-cleanup**: Expired messages automatically removed from time-limited boards

### Editor Commands

- `!done` - Finish and preview message
- `!show` - Display current body with line numbers
- `!delete <n>` - Delete specific line
- `!insert <n> <text>` - Insert a line at position <n>, pushing existing lines down
- `!subject <text>` - Change subject inline
- `!to <@targets>` - Change message targets inline
- `!forget` / `!quit` - Cancel message creation
- `!help` - Show command reference

### Usage Examples

**Board YAML Format:**

Boards are saved to two separate files in `data/boards/`:
- `<name>.yaml` - Board configuration
- `<name>.messages.yaml` - Board messages

**Board Configuration (`<name>.yaml`):**

```yaml
name: general
displayName: General
description: General discussion
permanent: false          # these messages expire
expirationMs: 2592000000  # Optional: milliseconds before messages expire (only used if permanent=false)
writePermission: all      # "all" or "admin"
nextMessageId: 3          # Next ID to use for new messages
```

**Board Messages (`<name>.messages.yaml`):**

```yaml
messages:
  - id: 1
    author: username
    subject: Message subject
    content: "Message content with\r\nmultiple lines"
    postedAt: "2024-01-15T10:30:00.000Z"
    targets:              # Optional: list of usernames, or omit for public messages
      - username1
      - username2
  - id: 2
    author: anotheruser
    subject: Another message
    content: "Single line message"
    postedAt: "2024-01-15T11:00:00.000Z"
```

The system automatically loads both files when a board is accessed.

**Posting a Message:**
```
board read general
board write general
> This is my message subject
> This is line one of my message.
> This is line two.
> !done
```

## 4. Dungeon and DungeonObject and Room systems

The dungeon system provides a complete three-dimensional world model with rooms organized in a grid system (width × height × layers). The system supports cardinal and vertical movement, object containment hierarchies, and serialization for persistence.

### Key Features

- **3D grid system**: Rooms organized in width × height × layers
- **Movement system**: Cardinal directions (N/S/E/W) and vertical (UP/DOWN)
- **Object containment**: Objects can be in rooms, inventories, or nested containers
- **Entity types**: Rooms, Mobs (NPCs/players), Items, and Props
- **Serialization**: Full serialization/deserialization support for persistence
- **Type safety**: Full TypeScript types throughout

### Usage Examples

**Creating a Dungeon:**
```typescript
import { Dungeon, DIRECTION } from "./dungeon.js";

const dungeon = Dungeon.generateEmptyDungeon({
  id: "midgar",
  dimensions: { width: 10, height: 10, layers: 3 }
});

const startRoom = dungeon.getRoom({ x: 5, y: 5, z: 0 });
```

**Moving Entities:**
```typescript
import { Movable } from "./dungeon.js";

const player = new Movable({ display: "Player", keywords: "player" });
startRoom.add(player);

if (player.canStep(DIRECTION.NORTH)) {
  player.step(DIRECTION.NORTH);
}
```

**Object Containment:**
```typescript
import { Item } from "./dungeon.js";

const sword = new Item({ display: "Sword", keywords: "sword" });
player.add(sword);  // Sword is now in player's inventory

const bag = new Item({ display: "Bag", keywords: "bag" });
player.add(bag);
bag.add(sword);  // Sword is now in the bag, which is in player's inventory
```

## 5. The dungeon registry system

The dungeon registry provides a global lookup mechanism for dungeons by their unique identifier. This enables cross-dungeon navigation, serialization, and room references.

### Key Features

- **Global registry**: All dungeons with an `id` are automatically registered
- **Lookup by ID**: Use `getDungeonById(id)` to retrieve registered dungeons
- **Type-safe access**: Readonly map interface prevents accidental modification
- **Automatic registration**: Setting a dungeon's `id` automatically registers it

### Usage Examples

**Registering a Dungeon:**
```typescript
const dungeon = Dungeon.generateEmptyDungeon({
  id: "midgar",
  dimensions: { width: 10, height: 10, layers: 1 }
});
// Automatically registered in DUNGEON_REGISTRY
```

**Looking Up a Dungeon:**
```typescript
import { getDungeonById } from "./dungeon.js";

const found = getDungeonById("midgar");
if (found) {
  const room = found.getRoom({ x: 5, y: 5, z: 0 });
}
```

## 6. The Room Link system

The Room Link system allows you to create custom connections between non-adjacent rooms, enabling complex world layouts beyond simple grid adjacency. Links can connect rooms within the same dungeon or across different dungeons.

### Key Features

- **Custom connections**: Create tunnels, portals, or other non-standard room connections
- **Cross-dungeon links**: Connect rooms in different dungeons
- **Bidirectional links**: Links can be one-way or two-way
- **Direction-based**: Links are associated with specific directions

### Usage Examples

**Creating a Room Link:**
```typescript
import { RoomLink, DIRECTION } from "./dungeon.js";

const roomA = dungeon.getRoom({ x: 0, y: 0, z: 0 });
const roomB = dungeon.getRoom({ x: 9, y: 9, z: 0 });

// Create a tunnel from roomA going north to roomB
RoomLink.createTunnel(roomA, DIRECTION.NORTH, roomB);
```

**Cross-Dungeon Links:**
```typescript
const dungeon1 = Dungeon.generateEmptyDungeon({
  id: "overworld",
  dimensions: { width: 10, height: 10, layers: 1 }
});

const dungeon2 = Dungeon.generateEmptyDungeon({
  id: "underworld",
  dimensions: { width: 5, height: 5, layers: 1 }
});

const overworldRoom = dungeon1.getRoom({ x: 5, y: 5, z: 0 });
const underworldRoom = dungeon2.getRoom({ x: 2, y: 2, z: 0 });

// Create a portal between dungeons
RoomLink.createTunnel(overworldRoom, DIRECTION.DOWN, underworldRoom);
```

## 7. The room ref system

The room ref system provides a string-based reference format for rooms that enables efficient serialization and cross-dungeon navigation. Room references use the format `@dungeon-id{x,y,z}`.

### Key Features

- **String references**: Use `@dungeon-id{x,y,z}` format to reference rooms
- **Cross-dungeon support**: References work across different dungeons
- **Serialization-friendly**: Easy to store and restore room references
- **Type-safe parsing**: `getRoomByRef()` validates and resolves references

### Usage Examples

**Creating Room References:**
```typescript
import { getRoomByRef } from "./dungeon.js";

const dungeon = Dungeon.generateEmptyDungeon({
  id: "midgar",
  dimensions: { width: 10, height: 10, layers: 3 }
});

// Get a room using reference format
const room = getRoomByRef("@midgar{5,3,1}");
if (room) {
  console.log(`Found room at ${room.x},${room.y},${room.z}`);
}
```

**Using in Serialization:**
```typescript
// Store room reference in character data
const characterData = {
  location: "@midgar{5,5,0}",
  // ... other data
};

// Later, restore location
const savedLocation = getRoomByRef(characterData.location);
if (savedLocation) {
  character.mob.location = savedLocation;
}
```

## 8. The simple client and server system

The client and server system provides a lightweight telnet-based networking layer with connection management, inactivity timeouts, and graceful shutdown handling. The system is designed to be minimal and predictable for testing.

### Key Features

- **Event-driven architecture**: Uses EventEmitter for connection and input events
- **Line buffering**: Automatically buffers incoming data and emits complete lines
- **Normalized line endings**: Handles CR/LF normalization automatically
- **Connection lifecycle**: Tracks connected clients and provides start/stop helpers
- **Inactivity timeouts**: Automatically disconnects idle clients
- **Graceful shutdown**: Properly closes all connections on server stop

### Usage Examples

**Starting a Server:**
```typescript
import { MudServer, MudClient } from "./io.js";

const server = new MudServer();

server.on("connection", (client: MudClient) => {
  client.sendLine("Welcome to the MUD!");
  
  client.on("input", (line: string) => {
    client.sendLine(`You said: ${line}`);
  });
  
  client.on("close", () => {
    console.log("Client disconnected");
  });
});

await server.start(4000);
```

**Client Methods:**
```typescript
client.sendLine("Hello!");           // Send a line with newline
client.send("Hello");                // Send without newline
client.sendLine("Prompt: ", true);   // Send with color enabled
client.close();                      // Close the connection
```

## 9. The color system

The color system provides full 16-color palette support with dark and bright variants, inline color tags, and utilities for color manipulation and formatting. Colors use a simple `{letter}` syntax for easy embedding in text.

### Key Features

- **16-color palette**: 8 dark colors and 8 bright colors
- **Inline color tags**: Use `{R` for red, `{G` for green, `{Y` for yellow, etc.
- **Background colors**: Support for background color codes
- **Text styles**: Bold, italic, and other text styling options
- **Color utilities**: Functions for colorizing, stripping colors, and calculating visible length
- **Escape sequences**: Use `{{` to include a literal `{` character

### Color Codes

- `{k` - Black
- `{r` - Maroon (dark red)
- `{g` - Dark green
- `{y` - Olive (dark yellow)
- `{b` - Dark blue
- `{m` - Purple
- `{c` - Teal
- `{w` - Silver (dark white)
- `{K` - Grey
- `{R` - Crimson (bright red)
- `{G` - Lime (bright green)
- `{Y` - Yellow
- `{B` - Light blue
- `{M` - Pink
- `{C` - Cyan
- `{W` - White

### Usage Examples

**Using Color Tags:**
```typescript
import { colorize } from "./color.js";

const message = "{RWarning!{x This is important.";
const colored = colorize(message);
client.sendLine(colored);
```

**Color Utilities:**
```typescript
import { colorize, stripColors, visibleLength } from "./color.js";

const text = "{RHello {GWorld{x";
const colored = colorize(text);        // Applies color codes
const plain = stripColors(text);       // Removes color codes: "Hello World"
const length = visibleLength(text);    // Returns 11 (ignores color codes)
```

# Packages

The mud3 framework uses a package-based architecture for modularity and extensibility. Packages handle persistence, configuration, and system initialization. All packages follow a consistent pattern with a `loader` function that is called during application startup.

## 1. Simple lockfile system that ensures you can't run multiple instances

The lockfile package prevents multiple server instances from running simultaneously by maintaining a process lock file with PID tracking. It automatically detects and removes stale locks from processes that are no longer running.

### Key Features

- **Process lock**: Creates a `.lock` file with process information
- **Stale lock detection**: Automatically removes locks from dead processes
- **Graceful cleanup**: Removes lock file on normal exit and common failure signals
- **Hostname tracking**: Records hostname for multi-machine environments

### Usage

The lockfile package is automatically loaded first in the startup sequence. If another instance is detected, the server will exit with an error message.

```typescript
import lockfile from "./src/package/lockfile.js";

await loadPackage(lockfile); // Always load first
```

## 2. Saving and loading basic config systems

The config package manages YAML-based configuration with default values, type-safe config structures, and automatic default file creation. Configuration is merged from the file into in-memory defaults, ensuring all required settings are present.

### Key Features

- **YAML-based**: Configuration stored in `data/config.yaml`
- **Type-safe**: TypeScript interfaces for game, server, and security config
- **Default values**: Automatically creates default config file if missing
- **Selective merging**: Only known keys from the file are merged into defaults
- **Atomic writes**: Uses temporary files and atomic rename for safe writes

### Configuration Structure

```yaml
game:
  name: mud3
  creator: jackindisguise
server:
  port: 23
  inactivity_timeout: 1800
security:
  password_salt: your-secret-salt
```

### Usage

```typescript
import config, { CONFIG } from "./src/package/config.js";

await loadPackage(config);
console.log(CONFIG.server.port); // 23
```

## 3. Saving and loading helpfiles

The help package loads topic-based help files from YAML files in the `data/help` directory. Each help file includes keywords, aliases, related topics, and content with full-text search capabilities.

### Key Features

- **YAML-based help files**: Each help topic is a separate YAML file
- **Keywords and aliases**: Multiple ways to reference the same help topic
- **Related topics**: Cross-referenced help topics for navigation
- **Full-text search**: Search across all help content
- **Topic tags**: Categorize help topics by type (e.g., "communication", "combat")

### Help File Format

```yaml
# data/help/combat.yaml
keyword: combat
aliases: [fight, battle]
related: [attack, defend, weapons]
topic: [combat, fighting, pvp]
content: |
  Combat in the game involves...
```

### Usage

```typescript
import help, { getHelpfile } from "./src/package/help.js";

await loadPackage(help);
const helpTopic = getHelpfile("combat");
if (helpTopic) {
  console.log(helpTopic.content);
}
```

## 4. Saving and loading message boards

The board package provides persistence for message boards with YAML serialization, automatic directory creation, and board management utilities. Boards are saved to `data/boards/<name>.yaml` with atomic writes.

### Key Features

- **YAML persistence**: Boards serialized to YAML files
- **Automatic directory creation**: Creates `data/boards` directory if needed
- **Atomic writes**: Uses temporary files and atomic rename to prevent corruption
- **Board management**: Functions to save, load, list, and delete boards

### Usage

```typescript
import board, { saveBoard, loadBoard, getAllBoards } from "./src/package/board.js";

await loadPackage(board);

const board = new Board("general", "General", "General discussion", true);
await saveBoard(board);

const loaded = await loadBoard("general");
const allBoards = await getAllBoards();
```

## 5. Saving and loading characters

The character package provides character persistence with YAML storage, password authentication, active character registry, and serialization support. Characters are saved to `data/characters/<username>.yaml`.

### Key Features

- **YAML persistence**: Characters serialized to YAML files
- **Password authentication**: Secure password hashing with SHA-256
- **Active character registry**: Prevents duplicate logins
- **Atomic writes**: Uses temporary files and atomic rename to prevent corruption
- **Serialization**: Full serialization/deserialization support

### Usage

```typescript
import character, { 
  saveCharacter, 
  loadCharacter, 
  checkCharacterPassword 
} from "./src/package/character.js";

await loadPackage(character);

await saveCharacter(playerCharacter);

const serialized = await checkCharacterPassword("username", "password");
if (serialized) {
  const char = loadCharacterFromSerialized(serialized);
}
```

## 6. Saving and loading commands

The commands package provides a flexible command loading system that supports multiple formats: YAML files, JavaScript modules, and compiled TypeScript commands. Commands can be loaded from `data/commands` (runtime-extensible) or `dist/src/commands` (compiled built-in commands).

### Key Features

- **Multiple formats**: Supports YAML, JavaScript, and TypeScript commands
- **Runtime extensibility**: Add commands by creating files in `data/commands`
- **Built-in commands**: Compiled TypeScript commands in `src/commands`
- **Automatic registration**: Commands are automatically registered into `CommandRegistry.default`
- **File filtering**: Files beginning with `_` are ignored

### YAML Command Format

```yaml
# data/commands/greet.yaml
pattern: greet <target:character>
aliases: [hello <target:character>]
execute: |
  function(context, args) {
    const target = args.get("target");
    context.actor.sendLine(`You greet ${target.display}!`);
  }
```

### JavaScript Command Format

```javascript
// data/commands/wave.js
export default {
  pattern: "wave <target:mob?>",
  execute(context, args) {
    const target = args.get("target");
    if (target) {
      context.actor.sendLine(`You wave at ${target.display}.`);
    } else {
      context.actor.sendLine("You wave.");
    }
  }
};
```

### TypeScript Command Format

```typescript
// src/commands/say.ts
import { Command, CommandContext } from "../command.js";

export default class SayCommand extends Command {
  pattern = "say <message:text>";
  
  execute(context: CommandContext, args: Map<string, any>) {
    const message = args.get("message");
    context.actor.sendLine(`You say: ${message}`);
  }
}
```

### Usage

```typescript
import commands from "./src/package/commands.js";

await loadPackage(commands);
// All commands from data/commands and src/commands are now registered
```

## 7. Saving and loading gamestate

The gamestate package provides runtime state persistence for tracking elapsed game time across server restarts. It automatically calculates downtime and adds it to elapsed time, ensuring continuity even after server restarts.

### Key Features

- **Elapsed time tracking**: Tracks total game time in milliseconds
- **Downtime calculation**: Automatically calculates and adds server downtime to elapsed time
- **Atomic writes**: Uses temporary files and atomic rename to prevent corruption
- **Default state**: Creates default gamestate file if missing
- **Session tracking**: Tracks time in current session separately from persisted time

### Usage

```typescript
import gamestate, { getElapsedTime, saveGameState } from "./src/package/gamestate.js";

await loadPackage(gamestate);

// Get total elapsed time (includes previous sessions + downtime)
const elapsed = getElapsedTime(); // milliseconds

// Save state (called automatically every 5 minutes)
await saveGameState();
```

### Game State Structure

```yaml
elapsedTime: 1234567890
lastSaved: "2024-01-15T10:30:00.000Z"
```
