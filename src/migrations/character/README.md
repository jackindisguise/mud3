# Character Migration System

This directory contains migrations that transform character YAML files from older versions to the current version.

## How It Works

1. **Version Detection**: When loading a character, the system checks the `version` field in the YAML file.

2. **Path Finding**: If the file version is older than the current version, the system finds the shortest migration path using BFS.

3. **Sequential Execution**: Migrations are executed in order, each transforming the data one version step forward.

4. **Automatic Registration**: Migrations register themselves when imported.

## Creating a Migration

Create a new file following this pattern: `v{from}-to-v{to}.ts`

Example: `v1.20.0-to-v1.21.0.ts`

```typescript
import { registerMigration } from "./registry.js";
import type { SerializedCharacter } from "../../../core/character.js";

registerMigration({
	from: "1.20.0",
	to: "1.21.0",
	description: "Renamed 'oldField' to 'newField' in settings",
	migrate: (data): SerializedCharacter & { version?: string } => {
		// Transform data here
		// Example: rename a field in settings
		if (data.settings.oldField) {
			data.settings.newField = data.settings.oldField;
			delete (data.settings as any).oldField;
		}
		
		// Example: add default value for new field
		if (!data.settings.someNewSetting) {
			data.settings.someNewSetting = "default";
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
- **Tested**: Test migrations with real old character files.

## Version Format

Uses semantic versioning: `major.minor.patch` (e.g., `1.21.0`)

- **Major**: Breaking changes (rare, may require manual intervention)
- **Minor**: New features, backward compatible changes
- **Patch**: Bug fixes, small adjustments

