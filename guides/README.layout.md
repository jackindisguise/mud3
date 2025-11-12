# mud3
1. Describe what the mud3 project is all about.

# Features
Explain the features in the game.
1. Efficient and user-accessible command pattern system.
    1. Explain command priority system (HIGH, NORMAL, LOW).
    2. Explain how commands are sorted by priority first, then pattern length.
2. Expandable channel system.
3. Easy-to-use message board system.
    1. Explain targetable messages.
    2. Explain the writing interface.
    3. Explain the read tracking using character IDs.
    4. Explain the `board <name> read` functionality that reads the oldest unread message on a board.
    5. Explain how you get shown your unread messages when you join.
        1. It only shows unread messages since you last joined.
    6. Explain how it informs you when you get messages sent to you.
4. Dungeon and DungeonObject and Room systems.
    1. Explain the allowed exits system (bitmask for controlling movement directions).
    2. Explain the dungeon template system for room definitions.
    3. Explain dungeon persistence (save/load from YAML).
    4. Explain room descriptions (roomDescription field for objects).
5. Moving around on the map.
    1. Explain movement commands (north, south, east, west, up, down, diagonals).
    3. Explain automatic character placement on login (new characters to @tower{0,0,0}, existing characters to saved location).
6. The minimap and description.
    1. Explain the look command (with optional direction argument).
    2. Explain the minimap display (configurable size, shows surrounding rooms).
    3. Explain how room info is displayed alongside the minimap.
7. The dungeon registry system.
8. The Room Link system.
    1. Explain how links override the allowed exits system.
9. The room ref system.
10. The simple client and server system.
11. The color system.

# Packages
Explain the package system.
1. Simple lockfile system that ensures you can't run multiple instances.
2. Saving and loading basic config systems.
3. Saving and loading helpfiles.
4. Saving and loading message boards.
5. Saving and loading characters.
6. Saving and loading commands.
    1. Allows for pure-text YAML command loading (data/commands/*.yaml).
    2. Allows for plain JavaScript command loading (data/commands/*.js).
    3. Allows for compiled TypeScript command loading (src/commands/*.ts).
7. Saving and loading gamestate.
8. Saving and loading dungeons.
    1. Automatically loads all dungeons from data/dungeons/*.yaml on package initialization.
    2. Uses template system to deduplicate room definitions.
    3. Saves dungeons with 3D grid representation and room template references.