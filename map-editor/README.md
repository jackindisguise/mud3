# Map Editor Frontend

This directory contains the frontend application for the Electron-based dungeon editor.

## Purpose

The map editor frontend provides:
- **Visual dungeon editing** - Grid-based room layout editor
- **Template management** - Create and edit room, mob, and object templates
- **Reset configuration** - Set up dungeon resets for spawning mobs and items
- **Room link editing** - Create tunnels and connections between rooms
- **Attribute calculators** - Calculate mob attributes from race/job combinations

## Structure

- `index.html` - Main HTML entry point
- `static/` - Static assets
  - `app.js` - Main application JavaScript
  - `dark.css` - Dark theme stylesheet
  - `light.css` - Light theme stylesheet
  - `grid.css` - Grid layout styles
  - `theme-init.js` - Theme initialization
  - `vendor/` - Third-party libraries (js-yaml)

## Architecture

The frontend communicates with the Electron main process via the preload script (`src/electron/preload.cts`), which exposes safe APIs for:
- Reading and writing dungeon files
- Accessing race/job data
- Calculating attributes
- Getting hit types and weapon types

## Development

The frontend is bundled and served by the Electron main process. Changes to frontend files require rebuilding the Electron application or restarting the development server.

## Notes

- The frontend is a vanilla JavaScript application (no framework)
- Styling uses CSS with dark/light theme support
- The grid system uses CSS Grid for layout
- YAML parsing is handled by js-yaml library


