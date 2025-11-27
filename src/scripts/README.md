# Scripts

This directory contains utility scripts that are run independently, not as part of the main game runtime.

## Purpose

Script modules:
- **Standalone utilities** - Scripts that perform one-off tasks
- **Development tools** - Helper scripts for development workflow
- **Build-time operations** - Scripts run during build or setup

## Architecture Rules

### ✅ Allowed

- Import from any source module
- Perform file I/O operations
- Run as standalone Node.js scripts
- Use command-line arguments

### ❌ Forbidden

- **DO NOT** be imported by game runtime modules
- **DO NOT** depend on active game sessions
- **DO NOT** assume game state is initialized

## Key Modules

- `start-map-editor.ts` - Script to start the map editor service independently

## Usage

Scripts are typically run via npm scripts or directly with `tsx`:

```bash
npm run script:name
# or
npx tsx src/scripts/script-name.ts
```

