# Electron

This directory contains the Electron main process and preload scripts for the dungeon editor.

## Purpose

Electron modules:
- **Main process** - Electron application entry point
- **Preload scripts** - Bridge between renderer and Node.js APIs
- **IPC handlers** - Handle communication between frontend and backend

## Architecture Rules

### ✅ Allowed

- Import Node.js modules (fs, path, etc.)
- Import from `src/map-editor/` for map editor service
- Expose safe APIs to renderer via preload scripts
- Handle Electron lifecycle events

### ❌ Forbidden

- **DO NOT** expose Node.js APIs directly to renderer (use preload)
- **DO NOT** import game runtime modules unnecessarily
- **DO NOT** perform blocking operations on main thread

## Key Modules

- `main.ts` - Electron main process entry point
- `preload.cts` - Preload script that exposes safe APIs to renderer

## Security

The preload script uses context isolation to prevent the renderer from accessing Node.js APIs directly. Only explicitly exposed functions are available to the frontend.

