# Redesign
I want to redesign my source code to make it more obvious and direct.

## Modules
I want to start a clear separation between core modules and package modules.

### Core Modules
Core modules should:
1. Define classes/types/interfaces.
5. Constants used in the core
6. Core functions

Core modules should minimally include other core modules, and should NEVER include package modules.

### Package Modules
Package modules should:
1. Serialization and deserialization methods
2. Runtime functionality and helper functions to facilitate functioning of the game.

Package modules do things that essentially make up the game's active state.
When you want to see what dungeons are loaded, you check the `dungeon` package.
When you want to see what helpfiles are loaded, you check the `help` package.

### Exception Modules
There are some source files that are exceptions.
`src/abilities` and `src/commands` are maybe closer to package modules than core modules.
They contain the implementation of a command, and the implementation of a specific ability.
They are not used directly, but are loaded by their respective packages: `abilities` and `commands`

# Implementation
I want to do this without breaking ANY current functionality.

Can you give me a play-by-play of how you'd achieve this?
Maybe generate a todo markdown file for it?