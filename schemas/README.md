# JSON Schemas

This directory contains JSON Schema definitions used to validate YAML data files.

## Purpose

Schema files provide:
- **Type validation** - Ensure YAML files match expected structure
- **Documentation** - Serve as a reference for data file formats
- **IDE support** - Enable autocomplete and validation in editors
- **Data integrity** - Catch errors before runtime

## Schema Files

Each schema corresponds to a data type:

- `archetype.schema.json` - Race and Job archetype definitions
- `board.schema.json` - Message board structure
- `board-messages.schema.json` - Message board message format
- `character.schema.json` - Character data structure
- `config.schema.json` - Game configuration format
- `dungeon.schema.json` - Dungeon file format
- `gamestate.schema.json` - Game state persistence format
- `help.schema.json` - Help system entry format
- `job.schema.json` - Job archetype structure
- `locations.schema.json` - System location references
- `race.schema.json` - Race archetype structure

## Usage

Schemas are used by:
- The map editor for validating dungeon data
- Development tools for validating YAML files
- IDE extensions for providing autocomplete

## Validation

To validate a YAML file against its schema, use a JSON Schema validator:

```bash
# Example using ajv-cli
ajv validate -s schemas/character.schema.json -d data/characters/player.yaml
```

## Notes

- Schemas use JSON Schema Draft 7 or later
- YAML files are validated after being parsed to JSON
- Schema files should be kept in sync with TypeScript type definitions


