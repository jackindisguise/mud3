# Core Modules

This directory contains the core game logic, type definitions, and classes that form the foundation of the MUD engine.

## Purpose

Core modules define:
- **Type definitions** - Interfaces, types, and enums used throughout the codebase
- **Classes** - Core game entities (Character, Dungeon, Room, Mob, Item, etc.)
- **Core logic** - Fundamental game mechanics (combat, attributes, equipment, etc.)
- **Constants** - Shared constants and enums

## Architecture Rules

### ✅ Allowed

- Define types, interfaces, and classes
- Define constants and enums
- Implement core game logic
- Import from other core modules (minimal dependencies)
- Import from `src/utils/` for utility functions

### ❌ Forbidden

- **DO NOT** import from `src/package/` modules
- **DO NOT** import from `src/registry/` modules
- **DO NOT** import from `src/commands/` or `src/abilities/`
- **DO NOT** perform file I/O operations
- **DO NOT** access mutable registry state directly (use readonly exports)
- **DO NOT** depend on game runtime state (use dependency injection)

## Examples

```typescript
// ✅ Good: Core class definition
export class DungeonObject {
  // ...
}

// ✅ Good: Type definition
export interface SerializedDungeonObject {
  // ...
}

// ❌ Bad: Importing from package
import { loadDungeon } from "../package/dungeon.js";

// ❌ Bad: File I/O
import { readFile } from "fs/promises";
```

## Key Modules

- `dungeon.ts` - Dungeon, Room, Mob, Item classes and world model
- `character.ts` - Character class and message grouping
- `command.ts` - Command system framework
- `archetype.ts` - Race and Job type definitions
- `ability.ts` - Ability type definitions
- `equipment.ts` - Equipment slot definitions
- `board.ts` - Message board types
- `channel.ts` - Communication channel types

