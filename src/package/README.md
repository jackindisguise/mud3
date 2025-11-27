# Package Modules

This directory contains package modules that handle loading, serialization, and persistence of game data.

## Purpose

Package modules:
- **Load data from files** - Read YAML files and populate registries
- **Serialize data** - Convert game objects to serializable formats
- **Deserialize data** - Convert serialized data back to game objects
- **Save data to files** - Write YAML files with atomic operations
- **Manage dependencies** - Declare dependencies on other packages

## Architecture Rules

### ✅ Allowed

- Import from `src/core/` for type definitions and classes
- Import from `src/registry/` for data access and state updates
- Perform file I/O operations (read/write YAML files)

### ❌ Forbidden

- **DO NOT** mutate registry state without using registry setter functions
- **DO NOT** perform file I/O without atomic write protection
- **DO NOT** depend on packages that depend on you (circular dependencies)

## Package Definition

Each package module must export a `Package` definition:

```typescript
export default {
  loader: async () => {
    // Load data from files
    // Populate registries
  },
  dependencies: [otherPkg], // Optional array of packages
} satisfies Package;
```

## Loading Order

Packages are automatically discovered and loaded in dependency order using topological sorting. The `lockfile` package is always loaded first if present.

## Key Modules

- `dungeon.ts` - Dungeon loading, saving, and template management
- `character.ts` - Character loading, saving, and password hashing
- `gamestate.ts` - Game state persistence
- `config.ts` - Configuration loading and merging
- `archetype.ts` - Race and Job loading
- `ability.ts` - Ability loading
- `help.ts` - Help system loading
- `board.ts` - Message board loading
- `locations.ts` - System location loading
- `reserved-names.ts` - Reserved names cache building
- `commands.ts` - Command loading from YAML files
- `lockfile.ts` - Package loading lock management

