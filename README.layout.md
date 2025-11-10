# mud3
1. Describe what the mud3 project is all about.

# Features
Explain the features in the game.
1. Efficient and user-accessible command pattern system.
2. Expandable channel system.
3. Easy-to-use message board system.
4. Dungeon and DungeonObject and Room systems.
5. The dungeon registry system.
6. The Room Link system.
7. The room ref system.
8. The simple client and server system.
9. The color system.

# Packages
Explain the package system.
1. Saving and loading basic config systems.
2. Saving and loading helpfiles.
3. Simple lockfile system that ensures you can't run multiple instances.
4. Saving and loading message boards.
5. Saving and loading characters.
6. Saving and loading commands.
    1. Allows for pure-text YAML command loading (data/commands/*.yaml).
    2. Allows for plain JavaScript command loading (data/commands/*.js).
    3. Allows for compiled TypeScript command loading (src/commands/*.ts).