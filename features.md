# MUD Feature Overview

## Server Lifecycle & Persistence
- `Game` starts/stops the TCP server, wires connection/disconnection handlers, and schedules character auto-saves, hourly board cleanup, five-minute game-state saves, and periodic dungeon resets so the world keeps running unattended (`src/game.ts`).
- Login sessions wrap each telnet client with inactivity timers and drive the callback-based `nanny()` prompts for username/password/creation before routing gameplay input (`src/game.ts`).
- `Game` also exposes helpers like `getGameStats()` and `broadcast()` so commands can report online players or push system-wide announcements (`src/game.ts`).

## Networking & Client IO
- `MudServer` and `MudClient` wrap Node TCP sockets, buffer complete lines, normalize telnet line endings, and expose `send`, `sendLine`, `ask`, and `yesno` helpers that make interactive prompts straightforward (`src/io.ts`).

## World & Dungeon Modeling
- `dungeon.ts` models a three-dimensional grid of rooms with direction utilities, coordinate helpers, entity classes (`Dungeon`, `Room`, `Mob`, `Item`, `Prop`, `RoomLink`), and global registry/serialization helpers for referencing rooms by string (`src/dungeon.ts`).
- `Equipment`, `Armor`, and `Weapon` objects occupy named slots and can grant primary, resource, and secondary attribute bonuses along with defense/attack stats, all serializable for persistence (`src/dungeon.ts`).

## Character Profiles & Progression
- `Character` stores credentials, hashed passwords, session links, message-group handling, and serialization, plus sensible defaults for settings, channels, and stats so new players are ready to play immediately (`src/character.ts`).
- Characters can toggle channels, block users, and maintain stats/playtime that other commands (like social/chat) rely on (`src/character.ts`).

## Command & Input Framework
- Pattern-based `Command` classes define human-readable templates with placeholders, optional arguments, and search scopes; `CommandRegistry` executes the best match and offers argument types for text, numbers, directions, mobs, items, equipment, and online characters (`src/command.ts`).

## Exploration & Navigation
- `look` renders room titles, wrapped descriptions, exit lists, contents, and an ASCII minimap around the player for quick orientation (`src/commands/look.ts`).
- Directional commands share `_movement.executeMovement()` to validate exits, move mobs, and auto-trigger `showRoom`, with `north`, `south`, diagonals, and vertical aliases bound to concise patterns (`src/commands/_movement.ts`, `src/commands/north.ts`).

## Inventory & Equipment Management
- `inventory` and `equipment` list carried gear and current loadout slot-by-slot, highlighting empty slots or unequipped items (`src/commands/inventory.ts`, `src/commands/equipment.ts`).
- Interaction commands let players pick up items from rooms or containers, drop belongings, and wear/remove slot-specific equipment while preventing actions like dropping equipped gear (`src/commands/get.ts`, `src/commands/drop.ts`, `src/commands/wear.ts`, `src/commands/remove.ts`).

## Status & Progress Insight
- `score` builds boxed summaries of identity, vitals, and primary/secondary attributes with alignment-aware formatting for readability (`src/commands/score.ts`).
- `bonuses` breaks down attribute/resource bonuses contributed by race, class, level growth, and equipped items so players can audit their build math (`src/commands/bonuses.ts`).

## Communication & Social Tools
- Chat channels are predefined with tags/colors, and the `channels` command lets players enable/disable subscriptions per channel (`src/channel.ts`, `src/commands/channels.ts`).
- `say`, `ooc`, `whisper`, and `reply` deliver local, global, and private chat while enforcing channel membership, blocking rules, and last-whisper tracking (`src/commands/say.ts`, `src/commands/ooc.ts`, `src/commands/whisper.ts`, `src/commands/reply.ts`).
- `block` and `unblock` commands manage ignore lists that gate whether whispers or channel messages can reach a character (`src/commands/block.ts`, `src/commands/unblock.ts`).

## Message Boards & Knowledge Base
- `Board` objects can be permanent or time-limited, track targets/read receipts, and notify addressed users when new mail arrives (`src/board.ts`).
- The `board`/`boards` command set lists boards, shows subjects, supports `read next`, enforces admin-only posting when configured, and offers dedicated aliases like `general`, `trade`, and `changes` for convenience (`src/commands/board.ts`, `src/commands/boards.ts`, `src/commands/general.ts`, `src/commands/trade.ts`, `src/commands/changes.ts`).
- `help` and `help search` expose helpfiles with alias/related metadata plus deep search that categorizes keyword, alias, content, and topic hits (`src/commands/help.ts`, `src/commands/help-search.ts`).

## Player Settings & Utility Commands
- `config` inspects or updates character settings such as default color, auto-look, verbose/brief modes, and custom prompt placeholders (`src/commands/config.ts`).
- `commands` lists every registered pattern/alias, `who` surfaces online counts from the game, and `save`/`quit` persist characters (with save-quit convenience) mid-session (`src/commands/commands.ts`, `src/commands/who.ts`, `src/commands/save.ts`, `src/commands/quit.ts`).
- Administrators can use `exec` to evaluate arbitrary async JavaScript within the running server for debugging or live changes (`src/commands/exec.ts`).

