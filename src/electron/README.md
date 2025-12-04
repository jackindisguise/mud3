# Electron

This directory contains the Electron main process and preload scripts for the map editor and archetype editor.

## Purpose

Electron modules:
- **Main process** - Electron application entry point
- **Preload scripts** - Bridge between renderer and Node.js APIs
- **IPC handlers** - Handle communication between frontend and backend

## Editors

### Map Editor
- `main.ts` - Electron main process entry point for map editor
- `preload.cts` - Preload script that exposes safe APIs to renderer for map editor

### Archetype Editor
- `archetype-main.ts` - Electron main process entry point for archetype editor
- `archetype-preload.cts` - Preload script that exposes safe APIs to renderer for archetype editor

### Helpfile Editor
- `helpfile-main.ts` - Electron main process entry point for helpfile editor
- `helpfile-preload.cts` - Preload script that exposes safe APIs to renderer for helpfile editor

### Character Editor
- `character-main.ts` - Electron main process entry point for character editor
- `character-preload.cts` - Preload script that exposes safe APIs to renderer for character editor

## Architecture Rules

### ✅ Allowed

- Import Node.js modules (fs, path, etc.)
- Import from `src/map-editor/` for map editor service
- Import from `src/archetype-editor/` for archetype editor service
- Import from `src/helpfile-editor/` for helpfile editor service
- Import from `src/character-editor/` for character editor service
- Expose safe APIs to renderer via preload scripts
- Handle Electron lifecycle events

### ❌ Forbidden

- **DO NOT** expose Node.js APIs directly to renderer (use preload)
- **DO NOT** import game runtime modules unnecessarily
- **DO NOT** perform blocking operations on main thread

## Security

The preload scripts use context isolation to prevent the renderer from accessing Node.js APIs directly. Only explicitly exposed functions are available to the frontend.

