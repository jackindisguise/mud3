# Map Editor

This directory contains the map editor service that provides backend functionality for the Electron-based dungeon editor.

## Purpose

Map editor modules:
- **Dungeon file operations** - Read and write dungeon YAML files
- **Template management** - Provide template data to frontend
- **Attribute calculation** - Calculate mob attributes from race/job/level
- **Data validation** - Validate dungeon data before saving

## Architecture Rules

### ✅ Allowed

- Import from `src/core/` for type definitions
- Import from `src/registry/` for data access
- Import from `src/package/` for dungeon loading/saving functions
- Perform file I/O operations for dungeon files
- Use atomic file writes (temp file + rename)

### ❌ Forbidden

- **DO NOT** import game runtime modules (combat, act, etc.)
- **DO NOT** mutate game state (this is a read-only editor service)
- **DO NOT** depend on active game sessions

## Key Modules

- `map-editor-service.ts` - Main service class with dungeon file operations
- `map-editor-server.ts` - HTTP server that exposes service via API

## API Endpoints

The map editor service provides endpoints for:
- Listing dungeons
- Loading dungeon data
- Creating/updating dungeons
- Getting races, jobs, hit types, weapon types
- Calculating mob attributes
- Getting current `dungeonVersion` from package.json

## Features

- **Cross-Dungeon Editing**: Create room links between different dungeons with automatic reciprocal link creation
- **Make 2-Way Button**: One-click button (⇄) to create bidirectional room links
- **Exit Overrides**: Edit custom exit configurations for specific room cells
- **Template Management**: Create and edit room and object templates
- **Data Migration**: Automatically migrates dungeon data to current `dungeonVersion` when loading

## Usage

The map editor service is used by the Electron main process to handle requests from the frontend dungeon editor application.

