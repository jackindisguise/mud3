# mud3

A Multi-User Dungeon (MUD) server implementation built with TypeScript and Node.js. This project provides a complete, extensible MUD game engine with a rich dungeon system, character progression, combat mechanics, ability system, and social features.

## Features

### World & Dungeon System

- **3D Grid-Based World**: Rooms organized in width × height × layers with full coordinate support
- **Movement System**: Cardinal directions (N/S/E/W), diagonals (NE/NW/SE/SW), and vertical movement (UP/DOWN)
- **Room System**: Rooms with configurable exits (bitmask-based), density (passable/impassable), and custom descriptions
- **Room Links**: Create tunnels and connections between rooms, even across different dungeons
- **Template System**: Define reusable room and object templates for efficient dungeon creation
- **Serialization**: Full save/load support with template-aware compression for efficient storage
- **Reset System**: Automatically respawn mobs and items based on templates and room references
- **Minimap**: Visual minimap display showing surrounding rooms with vision blocking and directional indicators

### Character & Combat System

- **Character Progression**: Level-based system with experience points and stat growth
- **Races & Jobs**: Configurable race and job archetypes with attribute bonuses
- **Attributes**: Primary attributes (Strength, Agility, Intelligence) and derived secondary attributes
- **Equipment System**: Slotted equipment (Armor, Weapons, Accessories) with attribute bonuses
- **Weapon Types**: Configurable weapon types (shortsword, longsword, etc.) with type-specific properties
- **Combat**: Turn-based combat with attack power, defense, accuracy, crit rates, and damage types
- **Reciprocal Combat**: Automatic combat engagement when damage is dealt between mobs in the same room
- **Threat System**: Aggro management for NPCs with threat tables
- **Resources**: Health, Mana, and Exhaustion with automatic recovery

### Ability System

- **Learnable Abilities**: Players can learn and use special abilities (e.g., Whirlwind, Pure Power)
- **Proficiency System**: Abilities improve with use through configurable proficiency curves
- **Proficiency Tracking**: Four breakpoint system (25%, 50%, 75%, 100%) with linear interpolation
- **Ability Commands**: `learn <ability>` to learn new abilities, `abilities` to view all learned abilities with proficiency
- **Proficiency Notifications**: Automatic notifications when ability proficiency increases

### Commands & Interaction

- **Flexible Command System**: Pattern-based command parsing with priority levels (HIGH, NORMAL, LOW)
- **Command Aliases**: Multiple patterns per command for natural language processing
- **Error Handling**: Built-in error responses and user-friendly feedback
- **Comprehensive Command Set**: Movement, combat, inventory, equipment, social, and administrative commands

### Communication

- **Channels**: Configurable communication channels (OOC, Gossip, Say, Newbie, Trade) with customizable message patterns
- **Message Boards**: Persistent message boards with targeting (@mentions), read tracking, and interactive editing
- **Color Support**: ANSI color codes throughout the interface with web client HTML conversion

### Objects & Items

- **Object Hierarchy**: DungeonObjects can contain other objects (inventory, containers, nested items)
- **Item Types**: Movable items, equipment (armor/weapons), props, and special objects
- **Weight System**: Items have weight that affects carrying capacity
- **Keywords & Matching**: Flexible object identification by keywords

### Client Support

- **Telnet Server**: Traditional telnet protocol support for classic MUD clients
- **Web Client**: WebSocket-based web client for playing in a browser with HTML color rendering
- **Auto-Focus**: Web client automatically focuses command input on interaction for improved UX

### Persistence

- **YAML-Based Storage**: All game data (characters, dungeons, boards) stored in YAML files
- **Auto-Save**: Periodic automatic saves of game state
- **Package System**: Automated package discovery and dependency-ordered loading system

## Technology Stack

- **TypeScript**: Full type safety throughout the codebase
- **Node.js**: Runtime environment with ES modules
- **Telnet Server**: Custom telnet implementation for client connections
- **WebSocket**: WebSocket support for web-based clients
- **YAML**: Human-readable data storage format
- **Electron**: Cross-platform desktop application framework for the dungeon editor

## Dungeon Editor

mud3 ships with a first-party, Electron-based dungeon editor that lives in this repository (see `map-editor/` and `src/electron/`).

Launch the editor locally with:

```bash
npm run electron:dev
```

The Electron shell loads the bundled `map-editor` frontend, talks directly to the MUD data files, and provides:
- Visual room layout editing across layers
- Exit/link editing with validation
- Template-aware dungeon creation and duplication
- Attribute calculators for race/job combinations
- Weapon template editing with weapon type selection
- Mob template editing with ability configuration

You can also create distributable builds:
- `npm run electron:mac` – build a signed DMG for macOS (ARM64)
- `npm run electron:win:portable` – build a portable Windows executable

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
npm install
```

### Building

```bash
npm run build
```

### Running

```bash
npm start
```

### Development

```bash
# Run tests
npm test

# Run TypeScript tests (with source maps)
npm run test:ts

# Run individual test files for easier debugging
npm run test:individual:ts

# Type-check without building
npm run build:ts

# Generate documentation
npm run doc

# Run with auto-rebuild
npm run rerun

# Run TypeScript directly (development)
npm run start:ts

# Launch the Electron-based dungeon editor
npm run electron:dev

# Package the dungeon editor (optional)
npm run electron:mac
npm run electron:win:portable
```

## Architecture

The codebase follows a clear separation of concerns:

- **`src/core/`** - Core modules containing type definitions, classes, and core logic. These modules define the fundamental game entities and should never import from package modules.
- **`src/registry/`** - Registry modules providing runtime data access and helper functions. These manage centralized data structures and provide readonly views for external access.
- **`src/package/`** - Package modules handling loading, serialization, and persistence. These modules load data from files and populate the registries.
- **`src/commands/`** - Command implementations loaded by the commands package.
- **`src/abilities/`** - Ability implementations loaded by the abilities package.
- **`src/`** - Utility modules (game.ts, combat.ts, act.ts, etc.) that facilitate game functionality.

The package system automatically discovers all packages in `src/package/`, builds a dependency graph, and loads them in the correct order using topological sorting.

## Project Structure

- `src/` - Source code (TypeScript)
  - `core/` - Core modules (types, classes, core logic)
    - `dungeon.ts` - Dungeon, Room, Mob, Item classes and types
    - `character.ts` - Character class and message grouping
    - `command.ts` - Command system framework
    - `archetype.ts` - Race and Job types
    - `ability.ts` - Ability types
    - `board.ts`, `channel.ts`, `color.ts`, `equipment.ts`, etc.
  - `registry/` - Registry modules (runtime data access)
    - `dungeon.ts` - Dungeon registry and room link management
    - `character.ts` - Active character tracking
    - `config.ts`, `gamestate.ts`, `help.ts`, `locations.ts`, etc.
  - `package/` - Package modules (loading and serialization)
    - Automatically discovered and loaded in dependency order
    - Handles loading from YAML files and populating registries
  - `commands/` - Command implementations
  - `abilities/` - Ability implementations
  - `electron/` - Electron main process and preload scripts
  - `utils/` - Utility functions
- `package.ts` - Automated package loader with dependency resolution
- `data/` - Game data files (characters, dungeons, configs, help files)
  - `dungeons/` - Dungeon definitions
  - `characters/` - Player character data
  - `boards/` - Message board data
  - `races/` - Race archetype definitions
  - `jobs/` - Job archetype definitions
- `map-editor/` - Electron-based dungeon editor frontend
- `web-client/` - WebSocket-based web client frontend
- `dist/` - Compiled JavaScript output
- `docs/` - Generated TypeScript documentation
- `coverage/` - Test coverage reports