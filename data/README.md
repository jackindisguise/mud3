# Game Data

This directory contains all persistent game data stored in YAML format.

## Purpose

This directory stores:
- **Character data** - Player character files
- **Dungeon definitions** - Dungeon layouts, templates, resets, and mob AI scripts
- **Configuration** - Game and server configuration
- **Archetypes** - Race and Job definitions
- **Help files** - In-game help documentation
- **Message boards** - Persistent message board data
- **System data** - Locations, gamestate, calendar, etc.

## Structure

- `characters/` - Player character files (one file per character)
- `dungeons/` - Dungeon definition files (one file per dungeon)
- `boards/` - Message board files (one file per board, plus message files)
- `races/` - Race archetype definitions
- `jobs/` - Job archetype definitions
- `help/` - Help system documentation files
- `commands/` - Command definition YAML files
- `config.yaml` - Main game configuration
- `locations.yaml` - System location references
- `gamestate.yaml` - Game state persistence (timestamps, ID counters)
- `calendar.yaml` - Calendar system configuration and events

## File Format

All data files use YAML format for human readability:
- Indentation-based structure
- Comments supported
- Type-safe (validated against JSON schemas in `schemas/`)

## Data Persistence

- Files are written atomically (temp file + rename) to prevent corruption
- Character files are saved periodically and on logout
- Dungeon files are saved when modified via the map editor
- Game state is saved periodically and on shutdown

## Notes

- Data files are the source of truth for game state
- Files should be backed up regularly
- YAML files can be edited manually, but should be validated against schemas
- The map editor provides a safe way to edit dungeon files
- Character files should not be edited while the character is logged in
- Mob templates can include AI scripts (inline JavaScript or file paths) for custom NPC behavior
- AI scripts are executed in a VM sandbox with access to mob APIs and event system

