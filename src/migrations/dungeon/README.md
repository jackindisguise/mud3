# Dungeon Migration System

This directory contains migrations that transform dungeon YAML files from older versions to the current version.

## How It Works

1. **Version Detection**: When loading a dungeon, the system checks the `version` field in the YAML file.

2. **Current Version**: The system uses `dungeonVersion` from `package.json` (separate from application `version`) as the target version.

3. **Path Finding**: If the file version is older than the current `dungeonVersion`, the system finds the shortest migration path using BFS.

3. **Sequential Execution**: Migrations are executed in order, each transforming the data one version step forward.

4. **Automatic Registration**: Migrations register themselves when imported.

## Creating a Migration

Create a new file following this pattern: `v{from}-to-v{to}.ts`

Example: `v1.20.0-to-v1.21.0.ts`

```typescript
import { registerMigration } from "./registry.js";
import type { SerializedDungeonFormat } from "../../dungeon.js";

registerMigration({
	from: "1.20.0",
	to: "1.21.0",
	description: "Renamed 'oldField' to 'newField'",
	migrate: (data: SerializedDungeonFormat): SerializedDungeonFormat => {
		// Transform data here
		// Example: rename a field
		if (data.dungeon.oldField) {
			data.dungeon.newField = data.dungeon.oldField;
			delete (data.dungeon as any).oldField;
		}
		
		return data;
	},
});
```

Then import it in `index.ts`:
```typescript
import "./v1.20.0-to-v1.21.0.js";
```

## Migration Guidelines

- **Idempotent**: Migrations should be safe to run multiple times (though they only run once per load).
- **Backward Compatible**: Don't break old data - transform it instead.
- **Descriptive**: Add a description explaining what changed.
- **Tested**: Test migrations with real old dungeon files.

## Version Format

Uses semantic versioning: `major.minor.patch` (e.g., `1.0.1`)

- **Major**: Breaking changes (rare, may require manual intervention)
- **Minor**: New features, backward compatible changes
- **Patch**: Bug fixes, small adjustments

## Dungeon Version

Dungeon migrations use `dungeonVersion` from `package.json`, which is separate from the application `version`. This allows dungeon data migrations to be versioned independently from application releases.

Use `npm run update-dungeon-version [patch|minor|major]` to increment the dungeon version.

