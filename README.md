# mud3

A Multi-User Dungeon (MUD) server implementation built with TypeScript and Node.js. This project provides a complete, extensible MUD game engine with a rich dungeon system, character progression, combat mechanics, and social features.

## Features

### World & Dungeon System

- **3D Grid-Based World**: Rooms organized in width × height × layers with full coordinate support
- **Movement System**: Cardinal directions (N/S/E/W), diagonals (NE/NW/SE/SW), and vertical movement (UP/DOWN)
- **Room System**: Rooms with configurable exits (bitmask-based), density (passable/impassable), and custom descriptions
- **Room Links**: Create tunnels and connections between rooms, even across different dungeons
- **Template System**: Define reusable room and object templates for efficient dungeon creation
- **Serialization**: Full save/load support with template-aware compression for efficient storage
- **Reset System**: Automatically respawn mobs and items based on templates and room references

### Character & Combat System

- **Character Progression**: Level-based system with experience points and stat growth
- **Races & Jobs**: Configurable race and job archetypes with attribute bonuses
- **Attributes**: Primary attributes (Strength, Agility, Intelligence) and derived secondary attributes
- **Equipment System**: Slotted equipment (Armor, Weapons, Accessories) with attribute bonuses
- **Combat**: Turn-based combat with attack power, defense, accuracy, crit rates, and damage types
- **Threat System**: Aggro management for NPCs with threat tables
- **Resources**: Health, Mana, and Exhaustion with automatic recovery

### Commands & Interaction

- **Flexible Command System**: Pattern-based command parsing with priority levels (HIGH, NORMAL, LOW)
- **Command Aliases**: Multiple patterns per command for natural language processing
- **Error Handling**: Built-in error responses and user-friendly feedback

### Communication

- **Channels**: Configurable communication channels (OOC, Gossip, Say, Newbie, Trade) with customizable message patterns
- **Message Boards**: Persistent message boards with targeting (@mentions), read tracking, and interactive editing
- **Color Support**: ANSI color codes throughout the interface

### Objects & Items

- **Object Hierarchy**: DungeonObjects can contain other objects (inventory, containers, nested items)
- **Item Types**: Movable items, equipment (armor/weapons), props, and special objects
- **Weight System**: Items have weight that affects carrying capacity
- **Keywords & Matching**: Flexible object identification by keywords

### Persistence

- **YAML-Based Storage**: All game data (characters, dungeons, boards) stored in YAML files
- **Auto-Save**: Periodic automatic saves of game state
- **Package System**: Modular loading system for commands, configs, archetypes, and more

## Technology Stack

- **TypeScript**: Full type safety throughout the codebase
- **Node.js**: Runtime environment with ES modules
- **Telnet Server**: Custom telnet implementation for client connections
- **YAML**: Human-readable data storage format

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

# Generate documentation
npm run doc

# Run with auto-rebuild
npm run rerun

# Launch the Electron-based dungeon editor
npm run electron:dev

# Package the dungeon editor (optional)
npm run electron:mac
npm run electron:win:portable
```

## Project Structure

- `src/` - Source code (TypeScript)
- `data/` - Game data files (characters, dungeons, configs, help files)
- `dist/` - Compiled JavaScript output
- `docs/` - Generated TypeScript documentation
- `coverage/` - Test coverage reports