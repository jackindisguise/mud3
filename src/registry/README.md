# Registry Modules

This directory contains registry modules that provide centralized runtime data access and helper functions.

## Purpose

Registry modules:
- **Centralize data access** - Single source of truth for runtime game state
- **Provide readonly views** - Export readonly versions of mutable internal state
- **Offer helper functions** - Convenient accessors and utilities for common operations
- **Manage state** - Internal mutable state with controlled external access

## Architecture Rules

### ✅ Allowed

- Define types for registry data structures
- Export readonly views of internal state
- Provide helper functions for accessing and querying data
- Update internal state via controlled setter functions
- Import from `src/core/` for type definitions
- Import from `src/utils/` for utility functions

### ❌ Forbidden

- **DO NOT** import from `src/package/` modules (circular dependency risk)
- **DO NOT** perform file I/O operations (that's package layer responsibility)
- **DO NOT** export mutable state directly (always use readonly wrappers)
- **DO NOT** depend on game runtime initialization order

## Pattern

Each registry module follows this pattern:

```typescript
// Internal mutable state
const INTERNAL_STATE: StateType = { ... };

// Readonly export for external use
export const READONLY_STATE: DeepReadonly<StateType> = INTERNAL_STATE;

// Controlled setter
export function setState(newState: StateType): void {
  // Update INTERNAL_STATE
}

// Helper functions
export function getItem(id: string): ItemType | undefined {
  // Query INTERNAL_STATE
}
```

## Key Modules

- `config.ts` - Game configuration access
- `gamestate.ts` - Game state (timestamps, ID counters, etc.)
- `dungeon.ts` - Dungeon registry and room link management
- `archetype.ts` - Race and Job registry
- `ability.ts` - Ability registry
- `help.ts` - Help system registry
- `board.ts` - Message board registry
- `locations.ts` - System location references
- `reserved-names.ts` - Blocked name patterns

