# Commands

This directory contains command implementations that players can execute in-game.

## Purpose

Command modules:
- **Implement game commands** - Movement, combat, social, inventory, etc.
- **Handle player input** - Parse arguments and execute actions
- **Provide user feedback** - Send messages to players via IO system
- **Interact with game state** - Access characters, dungeons, and other game entities

## Architecture Rules

### ✅ Allowed

- Import from `src/core/` for types and classes
- Import from `src/registry/` for readonly data access
- Import from `src/package/` for package functions (commands are loaded at runtime)
- Import from `src/game.ts` for game functions (forEachCharacter, broadcast, etc.)
- Use IO functions for sending messages to players
- Access character and dungeon state

### ❌ Forbidden

- **DO NOT** perform file I/O operations directly
- **DO NOT** mutate registry state directly (use registry functions)

## Module Structure

Each command module **must** export:
- `default` - An object that satisfies the `CommandObject` interface

The `CommandObject` includes:
- `pattern` - Command pattern string (e.g., `"north~"`, `"get <item:word>"`)
- `execute` - Handler function that receives `CommandContext` and parsed arguments
- `priority` - Optional priority level (HIGH, NORMAL, LOW)
- `adminOnly` - Optional boolean flag to restrict command to admin users only
- `cooldown` - Optional cooldown function/value

## Command Categories

- **Movement** - `north.ts`, `south.ts`, `east.ts`, `west.ts`, `up.ts`, `down.ts`, etc.
- **Combat** - `attack.ts`, `flee.ts`, `block.ts`, `unblock.ts`
- **Social** - `say.ts`, `whisper.ts`, `ooc.ts`, `gocial.ts`, `reply.ts`
- **Inventory** - `get.ts`, `drop.ts`, `inventory.ts`, `equipment.ts`
- **Character** - `score.ts`, `look.ts`, `abilities.ts`, `learn.ts`, `levelup.ts`, `effects.ts`
- **Boards** - `board.ts`, `boards.ts`, `changes.ts`
- **Communication** - `busy.ts` - Busy mode and message queuing management
- **System** - `save.ts`, `quit.ts`, `help.ts`, `commands.ts`, `config.ts`, `calendar.ts`
- **Admin** - `exec.ts` - Execute JavaScript code in sandboxed context, `shutdown.ts` - Gracefully shutdown the game server

## Examples

```typescript
// ✅ Good: Command with default export
import { CommandContext } from "../core/command.js";
import { CommandObject } from "../package/commands.js";
import { getLocation, LOCATION } from "../registry/locations.js";

export default {
  pattern: "recall~",
  execute(context: CommandContext): void {
    const {actor} = context;
    const location = getLocation(LOCATION.START);
    // Move character to start location
  },
} satisfies CommandObject;
```

```typescript
// ✅ Good: Admin-only command
export default {
  pattern: "shutdown~",
  adminOnly: true,
  execute(context: CommandContext): void {
    // Only admin users can execute this command
  },
} satisfies CommandObject;
```

