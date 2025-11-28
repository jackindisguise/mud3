# Migration System

This directory contains migration systems that transform data files from older versions to the current version. The migration system supports multiple data types: dungeons, characters, rooms, mobs, items, equipment, armor, and weapons.

## Architecture

The migration system consists of:
- **Generic migration infrastructure** (`generic/`) - Core registry and runner used by all data types
- **Type-specific migration systems** - Each data type has its own directory with registry, runner, and migration files
- **Version management** (`version.ts`) - Utilities for version comparison and retrieving current `dungeonVersion`

## How It Works

1. **Version Detection**: When loading data, the system checks the `version` field in the YAML file.

2. **Current Version**: The system uses `dungeonVersion` from `package.json` (separate from application `version`) for dungeon-related data types.

3. **Path Finding**: If the file version is older than the current version, the system finds the shortest migration path using BFS.

4. **Sequential Execution**: Migrations are executed in order, each transforming the data one version step forward.

5. **Automatic Registration**: Migrations register themselves when imported via side effects.

## Migration Systems

Each data type has its own migration system:

- **`dungeon/`** - Migrates dungeon YAML files
- **`character/`** - Migrates character YAML files
- **`room/`** - Migrates room objects within dungeons
- **`mob/`** - Migrates mob templates and instances
- **`item/`** - Migrates item templates and instances
- **`equipment/`** - Migrates equipment templates and instances
- **`armor/`** - Migrates armor templates and instances
- **`weapon/`** - Migrates weapon templates and instances

## Creating a Migration

Each migration system follows the same pattern. Create a new file following this pattern: `v{from}-to-v{to}.ts`

Example for dungeon: `v1.0.0-to-v1.0.1.ts`

```typescript
import { registerMigration } from "./registry.js";
import type { SerializedDungeonFormat } from "../../package/dungeon.js";

registerMigration({
	from: "1.0.0",
	to: "1.0.1",
	description: "Added version field to root object",
	migrate: (data: SerializedDungeonFormat): SerializedDungeonFormat => {
		// Transform data here
		// Example: rename a field
		if (data.dungeon.someOldField) {
			data.dungeon.someNewField = data.dungeon.someOldField;
			delete (data.dungeon as any).someOldField;
		}
		
		return data;
	},
});
```

Then import it in the migration system's `index.ts`:
```typescript
import "./v1.0.0-to-v1.0.1.js";
```

## Template Migrations

Templates (mobs, items, equipment, armor, weapons) use the same migration systems as their instance counterparts. When a template is loaded, it's migrated using the appropriate type-specific migration system before being hydrated into a template object.

## Migration Guidelines

- **Idempotent**: Migrations should be safe to run multiple times (though they only run once per load).
- **Backward Compatible**: Don't break old data - transform it instead.
- **Descriptive**: Add a description explaining what changed.
- **Tested**: Test migrations with real old data files.

## Version Format

Uses semantic versioning: `major.minor.patch` (e.g., `1.0.1`)

- **Major**: Breaking changes (rare, may require manual intervention)
- **Minor**: New features, backward compatible changes
- **Patch**: Bug fixes, small adjustments

## Dungeon Version

Dungeon-related data types use `dungeonVersion` from `package.json`, which is separate from the application `version`. This allows dungeon data migrations to be versioned independently from application releases.

Use `npm run update-dungeon-version [patch|minor|major]` to increment the dungeon version.
