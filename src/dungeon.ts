/**
 * Three-dimensional dungeon/world model with rooms, movement, links, and serialization.
 *
 * Provides direction utilities, a grid-based `Dungeon` with `Room`s, movable entities,
 * a global dungeon registry, and helpers for converting between directions and text
 * or resolving room references from strings. This is the core world module.
 *
 * What you get
 * - Direction utilities: `DIRECTION`, `DIRECTIONS`, `dir2text`, `text2dir`, `dir2reverse`,
 *   `DIR2TEXT`, `DIR2TEXT_SHORT`, `TEXT2DIR`, `TEXT2DIR_SHORT`, and helpers like
 *   `isNorthward`/`isSouthward`/`isEastward`/`isWestward`
 * - Core types: `Coordinates`, `MapDimensions`, `DungeonOptions`
 * - Registry and lookup: `DUNGEON_REGISTRY`, `getDungeonById(id)`, `ROOM_LINKS`
 * - Reference parsing: `getRoomByRef("@id{x,y,z}")`
 * - Classes: `Dungeon`, `DungeonObject`, `Room`, `Movable`, `Mob`, `Item`, `Prop`, `RoomLink`
 * - Serialization types: `Serialized*`, `AnySerializedDungeonObject`
 *
 * Quick start
 * ```ts
 * import { Dungeon, DIRECTION, Movable, RoomLink, getDungeonById, getRoomByRef } from "./dungeon.js";
 *
 * // 1) Create a 3x3x1 dungeon with an id and pre-generated rooms
 * const dungeon = Dungeon.generateEmptyDungeon({
 * 	id: "midgar",
 * 	dimensions: { width: 3, height: 3, layers: 1 }
 * });
 *
 * // 2) Place a player (Movable) in the center room
 * const start = dungeon.getRoom({ x: 1, y: 1, z: 0 })!;
 * const player = new Movable();
 * start.add(player);
 *
 * // 3) Move around using directions
 * if (player.canStep(DIRECTION.NORTH)) player.step(DIRECTION.NORTH);
 *
 * // 4) Register lookup by id (automatic via id) and fetch later
 * const again = getDungeonById("midgar");
 * console.log(again === dungeon); // true
 *
 * // 5) Create a tunnel between rooms (even across dungeons)
 * const a = dungeon.getRoom({ x: 2, y: 2, z: 0 })!;
 * const b = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
 * RoomLink.createTunnel(a, DIRECTION.NORTH, b);
 *
 * // 6) Resolve a room by string reference
 * const refRoom = getRoomByRef("@midgar{1,1,0}");
 * ```
 *
 * Notes
 * - Coordinates are `{ x, y, z }` with increasing `x` = east, increasing `y` = south,
 *   increasing `z` = up. `getStep` and movement helpers use this convention.
 * - `Dungeon.generateEmptyDungeon()` allocates and connects all rooms eagerly.
 * - Setting `Dungeon.id` registers the dungeon in `DUNGEON_REGISTRY` for global lookup.
 * - Serialization helpers on `DungeonObject` and subclasses capture hierarchy and types;
 *   deserialization reconstructs objects.
 *
 * @module dungeon
 */

import { string } from "mud-ext";
import { Character, MESSAGE_GROUP } from "./character.js";
import logger from "./logger.js";

/**
 * Enum for handling directional movement in the dungeon.
 *
 * @example
 * ```typescript
 * import { Dungeon, DIRECTION, Movable } from "./dungeon.js";
 *
 * // Create a small 2x2x1 dungeon and place a player in the bottom-left room
 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 2, height: 2, layers: 1 } });
 * const start = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
 * const player = new Movable();
 * start.add(player);
 *
 * // Move north (y - 1) and then up (if your world uses vertical layers)
 * if (player.canStep(DIRECTION.NORTH)) player.step(DIRECTION.NORTH);
 * if (player.canStep(DIRECTION.UP)) player.step(DIRECTION.UP);
 * ```
 */
export enum DIRECTION {
	NORTH,
	SOUTH,
	EAST,
	WEST,
	NORTHEAST,
	NORTHWEST,
	SOUTHEAST,
	SOUTHWEST,
	UP,
	DOWN,
}

/**
 * Array containing all possible direction values.
 *
 * Useful for iterating exits, generating UI labels, or scanning around the player.
 * Order is: cardinal (N/S/E/W), diagonal (NE/NW/SE/SW), vertical (U/D).
 *
 * @example
 * ```typescript
 * import { Dungeon, DIRECTIONS, dir2text } from "./dungeon.js";
 *
 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 3, height: 3, layers: 1 } });
 * const room = dungeon.getRoom({ x: 1, y: 1, z: 0 })!;
 *
 * // Gather exits from the center room
 * const exits = DIRECTIONS.filter((dir) => !!room.getStep(dir));
 * console.log(exits.map((d) => dir2text(d)).join(", ")); // e.g., "north, south, east, west, ..."
 * ```
 */
export const DIRECTIONS: DIRECTION[] = [
	DIRECTION.NORTH,
	DIRECTION.SOUTH,
	DIRECTION.EAST,
	DIRECTION.WEST,
	DIRECTION.NORTHEAST,
	DIRECTION.NORTHWEST,
	DIRECTION.SOUTHEAST,
	DIRECTION.SOUTHWEST,
	DIRECTION.UP,
	DIRECTION.DOWN,
];

/**
 * Maps each direction to its opposite direction.
 * Includes both cardinal and diagonal directions.
 * Used for calculating reverse movements and entry/exit directions.
 *
 * @example
 * ```typescript
 * // Get opposite of a direction
 * const south = DIR2REVERSE.get(DIRECTION.NORTH); // DIRECTION.SOUTH
 *
 * // Get opposite of a diagonal
 * const southwest = DIR2REVERSE.get(DIRECTION.NORTHEAST); // DIRECTION.SOUTHWEST
 *
 * // Using with room entry/exit
 * room.onEnter(player, DIR2REVERSE.get(exitDirection)); // Get entry direction from exit
 * ```
 */
const DIR2REVERSE = new Map<DIRECTION, DIRECTION>([
	[DIRECTION.NORTH, DIRECTION.SOUTH],
	[DIRECTION.SOUTH, DIRECTION.NORTH],
	[DIRECTION.EAST, DIRECTION.WEST],
	[DIRECTION.WEST, DIRECTION.EAST],
	[DIRECTION.UP, DIRECTION.DOWN],
	[DIRECTION.DOWN, DIRECTION.UP],
	[DIRECTION.NORTHEAST, DIRECTION.SOUTHWEST],
	[DIRECTION.NORTHWEST, DIRECTION.SOUTHEAST],
	[DIRECTION.SOUTHEAST, DIRECTION.NORTHWEST],
	[DIRECTION.SOUTHWEST, DIRECTION.NORTHEAST],
]);

/**
 * Gets the opposite direction for a given direction.
 * Works with both cardinal and diagonal directions.
 * Used primarily for calculating entry directions from exit directions
 * and vice versa.
 *
 * @param dir - The direction to reverse
 * @returns The opposite direction, or undefined if the direction is invalid
 *
 * @example
 * ```typescript
 * // Basic direction reversal
 * const south = dir2reverse(DIRECTION.NORTH); // Returns DIRECTION.SOUTH
 * const up = dir2reverse(DIRECTION.DOWN); // Returns DIRECTION.UP
 *
 * // Diagonal direction reversal
 * const southwest = dir2reverse(DIRECTION.NORTHEAST); // Returns DIRECTION.SOUTHWEST
 *
 * // Using with room movement
 * if (room.canExit(player, DIRECTION.NORTH)) {
 *   const nextRoom = room.getStep(DIRECTION.NORTH);
 *   // Check if we can enter from the opposite direction
 *   if (nextRoom.canEnter(player, dir2reverse(DIRECTION.NORTH))) {
 *     player.step(DIRECTION.NORTH);
 *   }
 * }
 * ```
 */
export function dir2reverse(dir: DIRECTION): DIRECTION {
	return DIR2REVERSE.get(dir)!;
}

/**
 * Type representing the full text name of a direction.
 *
 * This type defines all possible string representations of directions in their
 * full, unabbreviated form. Used for displaying directions in user interfaces,
 * command help text, and narrative descriptions.
 *
 * Includes all ten standard directions:
 * - Cardinal directions: "north", "south", "east", "west"
 * - Diagonal directions: "northeast", "northwest", "southeast", "southwest"
 * - Vertical directions: "up", "down"
 *
 * @example
 * ```typescript
 * const direction: DirectionText = "north";
 * const diagonal: DirectionText = "northeast";
 * const vertical: DirectionText = "up";
 *
 * // Type-safe function parameter
 * function describeDirection(dir: DirectionText) {
 *   console.log(`You are facing ${dir}.`);
 * }
 * describeDirection("north"); // OK
 * describeDirection("n");     // Error: not a DirectionText
 * ```
 */
export type DirectionText =
	| "north"
	| "south"
	| "east"
	| "west"
	| "northeast"
	| "northwest"
	| "southeast"
	| "southwest"
	| "up"
	| "down";

/**
 * Maps directions to their full text representations.
 *
 * This constant map provides full text representations for all direction values.
 * Used for displaying directions in user interfaces, commands, and narrative text
 * where clarity and readability are preferred over brevity.
 *
 * Text representations follow natural language:
 * - Cardinal directions: north, south, east, west
 * - Diagonal directions: northeast, northwest, southeast, southwest
 * - Vertical directions: up, down
 *
 * This map is primarily used internally by the `dir2text()` function when called
 * with `short: false` (or by default), but can be accessed directly for iteration
 * or lookup.
 *
 * @example
 * Basic lookup:
 * ```typescript
 * DIR2TEXT.get(DIRECTION.NORTH);     // "north"
 * DIR2TEXT.get(DIRECTION.NORTHEAST); // "northeast"
 * DIR2TEXT.get(DIRECTION.UP);        // "up"
 * ```
 *
 * @example
 * Iterate through all directions and their text:
 * ```typescript
 * for (const [dir, text] of DIR2TEXT.entries()) {
 *   console.log(`${dir}: ${text}`);
 * }
 * // Output:
 * // DIRECTION.NORTH: north
 * // DIRECTION.SOUTH: south
 * // DIRECTION.EAST: east
 * // ...
 * ```
 *
 * @example
 * Use in command processing:
 * ```typescript
 * function move(directionText: string) {
 *   for (const [dir, text] of DIR2TEXT.entries()) {
 *     if (text === directionText) {
 *       player.step(dir);
 *       break;
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link dir2text} - Recommended function for converting directions to text
 * @see {@link DIR2TEXT_SHORT} - Abbreviated version of this map
 */
export const DIR2TEXT = new Map<DIRECTION, DirectionText>([
	[DIRECTION.NORTH, "north"],
	[DIRECTION.SOUTH, "south"],
	[DIRECTION.EAST, "east"],
	[DIRECTION.WEST, "west"],
	[DIRECTION.NORTHEAST, "northeast"],
	[DIRECTION.NORTHWEST, "northwest"],
	[DIRECTION.SOUTHEAST, "southeast"],
	[DIRECTION.SOUTHWEST, "southwest"],
	[DIRECTION.UP, "up"],
	[DIRECTION.DOWN, "down"],
]);

/**
 * Type representing the abbreviated text name of a direction.
 *
 * This type defines all possible abbreviated string representations of directions.
 * Used for compact displays, command shortcuts, and space-constrained interfaces
 * like minimaps or status bars.
 *
 * Abbreviations follow standard conventions:
 * - Cardinal directions: "n", "s", "e", "w"
 * - Diagonal directions: "ne", "nw", "se", "sw"
 * - Vertical directions: "u", "d"
 *
 * @example
 * ```typescript
 * const shortDir: DirectionTextShort = "n";
 * const shortDiagonal: DirectionTextShort = "ne";
 * const shortVertical: DirectionTextShort = "u";
 *
 * // Type-safe function for compact display
 * function displayExitList(exits: DirectionTextShort[]) {
 *   console.log(`Exits: ${exits.join(", ")}`);
 * }
 * displayExitList(["n", "e", "u"]); // "Exits: n, e, u"
 * ```
 */
export type DirectionTextShort =
	| "n"
	| "s"
	| "e"
	| "w"
	| "ne"
	| "nw"
	| "se"
	| "sw"
	| "u"
	| "d";

/**
 * Maps directions to their abbreviated text representations.
 *
 * This constant map provides abbreviated (short) text representations for all
 * direction values. Used for compact displays like minimaps, status bars, or
 * space-constrained interfaces where full direction names would be too verbose.
 *
 * Abbreviations follow standard conventions:
 * - Cardinal directions: n, s, e, w (single letter)
 * - Diagonal directions: ne, nw, se, sw (two letters)
 * - Vertical directions: u, d (single letter)
 *
 * This map is primarily used internally by the `dir2text()` function when called
 * with `short: true`, but can be accessed directly for iteration or lookup.
 *
 * @example
 * Basic lookup:
 * ```typescript
 * DIR2TEXT_SHORT.get(DIRECTION.NORTH);     // "n"
 * DIR2TEXT_SHORT.get(DIRECTION.NORTHEAST); // "ne"
 * DIR2TEXT_SHORT.get(DIRECTION.UP);        // "u"
 * ```
 *
 * @example
 * Iterate through all directions and their abbreviations:
 * ```typescript
 * for (const [dir, abbr] of DIR2TEXT_SHORT.entries()) {
 *   console.log(`${dir}: ${abbr}`);
 * }
 * // Output:
 * // DIRECTION.NORTH: n
 * // DIRECTION.SOUTH: s
 * // DIRECTION.EAST: e
 * // ...
 * ```
 *
 * @see {@link dir2text} - Recommended function for converting directions to text
 * @see {@link DIR2TEXT} - Full-name version of this map
 */
export const DIR2TEXT_SHORT: Map<DIRECTION, DirectionTextShort> = new Map<
	DIRECTION,
	DirectionTextShort
>([
	[DIRECTION.NORTH, "n"],
	[DIRECTION.SOUTH, "s"],
	[DIRECTION.EAST, "e"],
	[DIRECTION.WEST, "w"],
	[DIRECTION.NORTHEAST, "ne"],
	[DIRECTION.NORTHWEST, "nw"],
	[DIRECTION.SOUTHEAST, "se"],
	[DIRECTION.SOUTHWEST, "sw"],
	[DIRECTION.UP, "u"],
	[DIRECTION.DOWN, "d"],
]);

/**
 * Maps full direction text to their DIRECTION enum values.
 *
 * This constant map provides reverse lookup from full text representations to
 * direction enum values. Used for parsing user input, command processing, and
 * converting text-based directions back to enum values.
 *
 * Text representations follow natural language:
 * - Cardinal directions: north, south, east, west
 * - Diagonal directions: northeast, northwest, southeast, southwest
 * - Vertical directions: up, down
 *
 * This map is primarily used internally by the `text2dir()` function, but can be
 * accessed directly for iteration or lookup.
 *
 * @example
 * Basic lookup:
 * ```typescript
 * TEXT2DIR.get("north");     // DIRECTION.NORTH
 * TEXT2DIR.get("northeast"); // DIRECTION.NORTHEAST
 * TEXT2DIR.get("up");        // DIRECTION.UP
 * ```
 *
 * @example
 * Iterate through all text-to-direction mappings:
 * ```typescript
 * for (const [text, dir] of TEXT2DIR.entries()) {
 *   console.log(`"${text}" => ${dir}`);
 * }
 * // Output:
 * // "north" => DIRECTION.NORTH
 * // "south" => DIRECTION.SOUTH
 * // "east" => DIRECTION.EAST
 * // ...
 * ```
 *
 * @see {@link text2dir} - Recommended function for converting text to directions
 * @see {@link TEXT2DIR_SHORT} - Abbreviated version of this map
 * @see {@link DIR2TEXT} - Full-name reverse map (direction to text)
 */
export const TEXT2DIR = new Map<DirectionText, DIRECTION>([
	["north", DIRECTION.NORTH],
	["south", DIRECTION.SOUTH],
	["east", DIRECTION.EAST],
	["west", DIRECTION.WEST],
	["northeast", DIRECTION.NORTHEAST],
	["northwest", DIRECTION.NORTHWEST],
	["southeast", DIRECTION.SOUTHEAST],
	["southwest", DIRECTION.SOUTHWEST],
	["up", DIRECTION.UP],
	["down", DIRECTION.DOWN],
]);

/**
 * Maps abbreviated direction text to their DIRECTION enum values.
 *
 * This constant map provides reverse lookup from abbreviated text representations
 * to direction enum values. Used for parsing compact user input, command shortcuts,
 * and converting abbreviated directions back to enum values.
 *
 * Abbreviations follow standard conventions:
 * - Cardinal directions: n, s, e, w (single letter)
 * - Diagonal directions: ne, nw, se, sw (two letters)
 * - Vertical directions: u, d (single letter)
 *
 * This map is primarily used internally by the `text2dir()` function when processing
 * abbreviated input, but can be accessed directly for iteration or lookup.
 *
 * @example
 * Basic lookup:
 * ```typescript
 * TEXT2DIR_SHORT.get("n");  // DIRECTION.NORTH
 * TEXT2DIR_SHORT.get("ne"); // DIRECTION.NORTHEAST
 * TEXT2DIR_SHORT.get("u");  // DIRECTION.UP
 * ```
 *
 * @example
 * Iterate through all abbreviated mappings:
 * ```typescript
 * for (const [text, dir] of TEXT2DIR_SHORT.entries()) {
 *   console.log(`"${text}" => ${dir}`);
 * }
 * // Output:
 * // "n" => DIRECTION.NORTH
 * // "s" => DIRECTION.SOUTH
 * // "e" => DIRECTION.EAST
 * // ...
 * ```
 *
 * @see {@link text2dir} - Recommended function for converting text to directions
 * @see {@link TEXT2DIR} - Full-name version of this map
 * @see {@link DIR2TEXT_SHORT} - Abbreviated reverse map (direction to text)
 */
export const TEXT2DIR_SHORT: Map<DirectionTextShort, DIRECTION> = new Map<
	DirectionTextShort,
	DIRECTION
>([
	["n", DIRECTION.NORTH],
	["s", DIRECTION.SOUTH],
	["e", DIRECTION.EAST],
	["w", DIRECTION.WEST],
	["ne", DIRECTION.NORTHEAST],
	["nw", DIRECTION.NORTHWEST],
	["se", DIRECTION.SOUTHEAST],
	["sw", DIRECTION.SOUTHWEST],
	["u", DIRECTION.UP],
	["d", DIRECTION.DOWN],
]);

/**
 * Converts a DIRECTION enum value to its text representation.
 *
 * @param dir - The direction to convert
 * @param short - Whether to return abbreviated form (default: false)
 * @returns The text name of the direction - full (e.g., "north") or abbreviated (e.g., "n")
 *
 * @example
 * Basic usage returns full direction name:
 * ```typescript
 * dir2text(DIRECTION.NORTH); // "north"
 * dir2text(DIRECTION.NORTHEAST); // "northeast"
 * ```
 *
 * @example
 * Explicit false parameter returns full direction name:
 * ```typescript
 * dir2text(DIRECTION.NORTH, false); // "north"
 * dir2text(DIRECTION.NORTHEAST, false); // "northeast"
 * ```
 *
 * @example
 * True parameter returns abbreviated direction name:
 * ```typescript
 * dir2text(DIRECTION.NORTH, true); // "n"
 * dir2text(DIRECTION.NORTHEAST, true); // "ne"
 * ```
 */
export function dir2text(
	dir: DIRECTION,
	short: boolean
): DirectionText | DirectionTextShort;
export function dir2text(dir: DIRECTION, short: false): DirectionText;
export function dir2text(dir: DIRECTION, short: true): DirectionTextShort;
export function dir2text(dir: DIRECTION): DirectionText;
export function dir2text(dir: DIRECTION, short: boolean = false) {
	if (short) return DIR2TEXT_SHORT.get(dir)!;
	return DIR2TEXT.get(dir)!;
}

/**
 * Converts a text representation to its DIRECTION enum value.
 *
 * Accepts both full direction names (e.g., "north", "northeast") and abbreviated
 * forms (e.g., "n", "ne"). The search is case-insensitive for convenience.
 *
 * @param text - The direction text to convert (full or abbreviated)
 * @returns The DIRECTION enum value, or undefined if not found
 *
 * @example
 * Full direction names:
 * ```typescript
 * text2dir("north"); // DIRECTION.NORTH
 * text2dir("northeast"); // DIRECTION.NORTHEAST
 * text2dir("up"); // DIRECTION.UP
 * ```
 *
 * @example
 * Abbreviated direction names:
 * ```typescript
 * text2dir("n"); // DIRECTION.NORTH
 * text2dir("ne"); // DIRECTION.NORTHEAST
 * text2dir("u"); // DIRECTION.UP
 * ```
 *
 * @example
 * Use in command parsing:
 * ```typescript
 * function processMove(input: string) {
 *   const dir = text2dir(input);
 *   if (dir !== undefined) {
 *     player.step(dir);
 *   } else {
 *     console.log("Invalid direction");
 *   }
 * }
 * ```
 *
 * @see {@link dir2text} - Converts DIRECTION to text (opposite operation)
 * @see {@link TEXT2DIR} - Full direction text to DIRECTION map
 * @see {@link TEXT2DIR_SHORT} - Abbreviated direction text to DIRECTION map
 */
export function text2dir(text: DirectionText): DIRECTION;
export function text2dir(text: DirectionTextShort): DIRECTION;
export function text2dir(text: string): DIRECTION | undefined;
export function text2dir(
	text: DirectionText | DirectionTextShort | string
): DIRECTION | undefined {
	let result = TEXT2DIR.get(text as DirectionText);
	if (result === undefined)
		result = TEXT2DIR_SHORT.get(text as DirectionTextShort);
	if (result === undefined) return undefined;
	return result;
}

/**
 * Checks if a direction has a northward component.
 * Returns true for NORTH, NORTHEAST, and NORTHWEST.
 *
 * @param dir The direction to check
 * @returns true if the direction includes a northward component
 *
 * @example
 * ```typescript
 * isNorthward(DIRECTION.NORTH); // true
 * isNorthward(DIRECTION.NORTHEAST); // true
 * isNorthward(DIRECTION.NORTHWEST); // true
 * isNorthward(DIRECTION.SOUTH); // false
 * isNorthward(DIRECTION.EAST); // false
 * ```
 */
export function isNorthward(dir: DIRECTION) {
	return [DIRECTION.NORTH, DIRECTION.NORTHEAST, DIRECTION.NORTHWEST].includes(
		dir
	);
}

/**
 * Checks if a direction has a southward component.
 * Returns true for SOUTH, SOUTHEAST, and SOUTHWEST.
 *
 * @param dir The direction to check
 * @returns true if the direction includes a southward component
 *
 * @example
 * ```typescript
 * isSouthward(DIRECTION.SOUTH); // true
 * isSouthward(DIRECTION.SOUTHEAST); // true
 * isSouthward(DIRECTION.SOUTHWEST); // true
 * isSouthward(DIRECTION.NORTH); // false
 * isSouthward(DIRECTION.WEST); // false
 * ```
 */
export function isSouthward(dir: DIRECTION) {
	return [DIRECTION.SOUTH, DIRECTION.SOUTHEAST, DIRECTION.SOUTHWEST].includes(
		dir
	);
}

/**
 * Checks if a direction has an eastward component.
 * Returns true for EAST, NORTHEAST, and SOUTHEAST.
 *
 * @param dir The direction to check
 * @returns true if the direction includes an eastward component
 *
 * @example
 * ```typescript
 * isEastward(DIRECTION.EAST); // true
 * isEastward(DIRECTION.NORTHEAST); // true
 * isEastward(DIRECTION.SOUTHEAST); // true
 * isEastward(DIRECTION.WEST); // false
 * isEastward(DIRECTION.NORTH); // false
 * ```
 */
export function isEastward(dir: DIRECTION) {
	return [DIRECTION.EAST, DIRECTION.SOUTHEAST, DIRECTION.NORTHEAST].includes(
		dir
	);
}

/**
 * Checks if a direction has a westward component.
 * Returns true for WEST, NORTHWEST, and SOUTHWEST.
 *
 * @param dir The direction to check
 * @returns true if the direction includes a westward component
 *
 * @example
 * ```typescript
 * isWestward(DIRECTION.WEST); // true
 * isWestward(DIRECTION.NORTHWEST); // true
 * isWestward(DIRECTION.SOUTHWEST); // true
 * isWestward(DIRECTION.EAST); // false
 * isWestward(DIRECTION.SOUTH); // false
 * ```
 */
export function isWestward(dir: DIRECTION) {
	return [DIRECTION.WEST, DIRECTION.SOUTHWEST, DIRECTION.NORTHWEST].includes(
		dir
	);
}

/**
 * Defines the dimensions of a dungeon's room grid.
 * Represents a three-dimensional space where rooms can exist.
 *
 * @property width - Number of rooms along the X axis (east-west)
 * @property height - Number of rooms along the Y axis (north-south)
 * @property layers - Number of rooms along the Z axis (up-down)
 *
 * @example
 * ```typescript
 * const dimensions: MapDimensions = {
 *   width: 10,   // 10 rooms wide (x-axis)
 *   height: 10,  // 10 rooms tall (y-axis)
 *   layers: 3    // 3 vertical levels (z-axis)
 * };
 * ```
 */
export interface MapDimensions {
	width: number;
	height: number;
	layers: number;
}

/**
 * Options for creating a `Dungeon` instance.
 *
 * Currently the only required option is `dimensions`, which describes the
 * three-dimensional grid size for rooms. This type is intentionally simple so
 * it can be extended in the future with additional configuration options.
 *
 * @property id - The unique string identifier of this dungeon.
 * @property dimensions - The width/height/layers of the dungeon grid.
 *
 * @example
 * ```typescript
 * const options: DungeonOptions = {
 *   dimensions: { width: 10, height: 10, layers: 3 }
 * };
 * const dungeon = new Dungeon(options);
 * ```
 */
export interface DungeonOptions {
	id?: string;
	dimensions: MapDimensions;
}

/**
 * Registry of dungeons by their optional persistent ID.
 * Use `getDungeonById(id)` to look up a registered dungeon.
 *
 * Note: only dungeons with an assigned `id` are present in this map.
 */
export const DUNGEON_REGISTRY: Map<string, Dungeon> = new Map();

/**
 * Lookup a dungeon previously registered with an ID.
 *
 * Only dungeons that were created with an `id` option or had their `id`
 * property set will be present in the registry. This function provides a
 * global lookup mechanism for retrieving dungeon instances by their unique
 * identifier, which is useful for serialization, room references, and
 * cross-dungeon navigation.
 *
 * @param id The dungeon id to look up
 * @returns The Dungeon instance or undefined when not found
 *
 * @example
 * ```typescript
 * // Create a dungeon with an ID
 * const dungeon = new Dungeon({
 *   id: "midgar",
 *   dimensions: { width: 10, height: 10, layers: 3 }
 * });
 *
 * // Look it up later from anywhere
 * const found = getDungeonById("midgar");
 * console.log(found === dungeon); // true
 * ```
 */
export function getDungeonById(id: string) {
	return DUNGEON_REGISTRY.get(id);
}

/**
 * Parse a room reference string and return the corresponding Room.
 * The format is `@dungeon-id{x,y,z}` where dungeon-id is the registered
 * dungeon identifier and x,y,z are the numeric coordinates.
 *
 * @param roomRef The room reference string in format `@dungeon-id{x,y,z}`
 * @returns The Room instance if found, undefined if the format is invalid,
 *          the dungeon doesn't exist, or the coordinates are out of bounds
 *
 * @example
 * ```typescript
 * // Register a dungeon with an id
 * const dungeon = Dungeon.generateEmptyDungeon({
 *   id: "midgar",
 *   dimensions: { width: 10, height: 10, layers: 3 }
 * });
 *
 * // Look up a room using the reference format
 * const room = getRoomByRef("@midgar{5,3,1}");
 * if (room) {
 *   console.log(`Found room at ${room.x},${room.y},${room.z}`);
 * }
 * ```
 */
export function getRoomByRef(roomRef: string): Room | undefined {
	// Match pattern: @dungeon-id{x,y,z}
	const match = roomRef.match(/^@([^{]+)\{(\d+),(\d+),(\d+)\}$/);
	if (!match) return undefined;

	const [, dungeonId, xStr, yStr, zStr] = match;
	const dungeon = getDungeonById(dungeonId);
	if (!dungeon) return undefined;

	const x = parseInt(xStr, 10);
	const y = parseInt(yStr, 10);
	const z = parseInt(zStr, 10);

	return dungeon.getRoom(x, y, z);
}

/**
 * The main container class that manages a three-dimensional map..
 * Creates and maintains a grid of interconnected rooms and manages all objects within the dungeon.
 *
 * @example
 * ```typescript
 * // Create a new dungeon with specific dimensions
 * const dungeon = Dungeon.generateEmptyDungeon({
 *   dimensions: { width: 10, height: 10, layers: 3 }
 * });
 *
 * // Get a room at specific coordinates
 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
 *
 * // Add objects to the room
 * const object = new DungeonObject();
 * room.add(object);
 *
 * // Add objects to the object
 * const object2 = new DungeonObject();
 * object.add(object2);
 *
 * // Dungeon contains the room *and* its contents
 * console.log(dungeon.contains(room) === true)
 * console.log(dungeon.contains(object) === true)
 * console.log(dungeon.contains(object2) === true)
 * ```
 */
export class Dungeon {
	/**
	 * Three-dimensional array of rooms that makes up the dungeon grid.
	 * Indexed as [z][y][x] for vertical layers, rows, and columns respectively.
	 * Can be undefined before grid initialization or contain undefined slots
	 * for ungenerated rooms.
	 */
	private _rooms: (Room | undefined)[][][];

	/**
	 * Optional persistent identifier for this dungeon. When assigned the
	 * dungeon is registered in `DUNGEON_REGISTRY` and can be looked up via
	 * `getDungeonById(id)`.
	 */
	private _id?: string;

	/**
	 * Registry of all objects that exist in this dungeon, regardless of their
	 * containment relationships. This includes rooms, items, creatures, and any
	 * other objects that are part of the dungeon hierarchy.
	 */
	private _contents: DungeonObject[] = [];

	/**
	 * The size of the dungeon in all three dimensions. Used for bounds checking
	 * and room generation. These dimensions are immutable after creation.
	 */
	private _dimensions: MapDimensions;

	/**
	 * Creates a new dungeon and populates it with empty rooms.
	 * This is a convenience method that creates a dungeon instance and
	 * immediately calls generateRooms() to fill it with Room objects.
	 *
	 * @param options Configuration options for the dungeon
	 * @returns A new Dungeon instance with all rooms initialized
	 *
	 * @example
	 * ```typescript
	 * // Create a fully populated 5x5x2 dungeon
	 * const dungeon = Dungeon.generateEmptyDungeon({
	 *   dimensions: { width: 5, height: 5, layers: 2 }
	 * });
	 *
	 * // All rooms are already created and accessible
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * console.log(room instanceof Room); // true
	 * ```
	 */
	static generateEmptyDungeon(options: DungeonOptions) {
		const dungeon = new Dungeon(options);
		dungeon.generateRooms();
		return dungeon;
	}

	/**
	 * Create a new Dungeon instance.
	 *
	 * @param options Configuration options for the dungeon
	 * @param options.dimensions The three-dimensional size of the dungeon grid
	 *
	 * @example
	 * ```typescript
	 * // Create a 10x10 dungeon with 3 vertical layers
	 * const dungeon = new Dungeon({ dimensions: { width: 10, height: 10, layers: 3 } });
	 * ```
	 */
	constructor(options: DungeonOptions) {
		this._dimensions = options.dimensions;
		// assign id early so the registry contains the dungeon immediately
		if (options.id) this.id = options.id;
		this._rooms = this.generateGrid();
	}

	/**
	 * Persistent unique identifier for this dungeon.
	 *
	 * Can be set at construction time (via the `id` option) or set directly.
	 * The dungeon will be registered in the global {@link DUNGEON_REGISTRY}.
	 * You can retrieve it later from anywhere using {@link getDungeonById}.
	 *
	 * @example
	 * ```typescript
	 * import { Dungeon, getDungeonById } from "./dungeon.js";
	 *
	 * const dungeon = Dungeon.generateEmptyDungeon({
	 *   id: "midgar",
	 *   dimensions: { width: 2, height: 2, layers: 1 },
	 * });
	 *
	 * // The dungeon is automatically registered under its id
	 * console.log(getDungeonById("midgar") === dungeon); // true
	 * ```
	 *
	 * Note: Internally, changing the id updates its registration; clearing it
	 * unregisters the dungeon.
	 */
	get id(): string | undefined {
		return this._id;
	}

	/**
	 * Set the persistent dungeon id. Setting to `undefined`
	 * will unregister the dungeon. Setting to a string will register it or
	 * throw if the id is already in use by another dungeon.
	 */
	private set id(value: string) {
		// unregister old id
		/*if (this._id) {
			DUNGEON_REGISTRY.delete(this._id);
			this._id = undefined;
		}*/

		if (DUNGEON_REGISTRY.has(value))
			throw new Error(`Dungeon id "${value}" is already in use`);
		this._id = value;
		DUNGEON_REGISTRY.set(value, this);

		const roomCount =
			this._dimensions.width *
			this._dimensions.height *
			this._dimensions.layers;
		logger.info(
			`Registered dungeon "${value}" with ${roomCount} rooms (${this._dimensions.width}x${this._dimensions.height}x${this._dimensions.layers})`
		);
	}

	/**
	 * Gets a safe, shallow copy of the dungeon's contents.
	 * Returns all objects that exist in the dungeon, regardless of their location
	 * within the dungeon's containment hierarchy.
	 *
	 * @returns An array containing all objects in the dungeon
	 *
	 * @example
	 * ```typescript
	 * // Create a dungeon with some objects
	 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 10, height: 10, layers: 1 } });
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * const player = new Movable();
	 * const sword = new DungeonObject();
	 *
	 * // Add objects to the dungeon
	 * room.add(player);
	 * player.add(sword);
	 *
	 * // All objects are tracked by the dungeon
	 * const allObjects = dungeon.contents;
	 * console.log(allObjects.includes(room)); // true
	 * console.log(allObjects.includes(player)); // true
	 * console.log(allObjects.includes(sword)); // true
	 * ```
	 */
	get contents() {
		return [...this._contents];
	}

	/**
	 * Add objects to this dungeon's registry of all contained objects.
	 * Also sets the object's dungeon reference to this dungeon.
	 *
	 * @param dobjs The objects to add to this dungeon
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 5, height: 5, layers: 1 } });
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * const chest = new DungeonObject();
	 * const coin = new DungeonObject();
	 *
	 * // Add multiple objects at once
	 * dungeon.add(chest, coin);
	 * console.log(dungeon.contains(chest)); // true
	 * console.log(dungeon.contains(coin)); // true
	 *
	 * // Objects know their dungeon
	 * console.log(chest.dungeon === dungeon); // true
	 * ```
	 */
	add(...dobjs: DungeonObject[]) {
		for (let obj of dobjs) {
			if (this.contains(obj)) continue;
			this._contents.push(obj);
			if (obj.dungeon !== this) obj.dungeon = this;
		}
	}

	/**
	 * Remove objects from this dungeon's registry of contained objects.
	 * Also unsets the object's dungeon reference if it points to this dungeon.
	 *
	 * @param dobjs The objects to remove from this dungeon
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 5, height: 5, layers: 1 } });
	 * const chest = new DungeonObject();
	 *
	 * // Add and then remove an object
	 * dungeon.add(chest);
	 * console.log(dungeon.contains(chest)); // true
	 * console.log(chest.dungeon === dungeon); // true
	 *
	 * dungeon.remove(chest);
	 * console.log(dungeon.contains(chest)); // false
	 * console.log(chest.dungeon === dungeon); // false
	 * ```
	 */
	remove(...dobjs: DungeonObject[]) {
		for (let obj of dobjs) {
			const index = this._contents.indexOf(obj);
			if (index === -1) continue;
			this._contents.splice(index, 1);
			if (obj.dungeon === this) obj.dungeon = undefined;
		}
	}

	/**
	 * Check whether this dungeon contains the given object.
	 *
	 * @param dobj The object to test for membership in this dungeon
	 * @returns true if the object is registered in this dungeon's contents
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 3, height: 3, layers: 1 } });
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * const chest = new DungeonObject({ keywords: "chest" });
	 * const coin = new DungeonObject({ keywords: "coin" });
	 *
	 * // Place chest in room (chest and room are added to dungeon.contents)
	 * room.add(chest);
	 * console.log(dungeon.contains(chest)); // true
	 *
	 * // Put coin in the chest (coin is also added to dungeon.contents via location updates)
	 * chest.add(coin);
	 * console.log(dungeon.contains(coin)); // true
	 *
	 * // Note: contains() only checks registered top-level membership
	 * // To verify 'coin' is inside 'chest', check chest.contains(coin)
	 * console.log(chest.contains(coin)); // true
	 * ```
	 */
	contains(dobj: DungeonObject) {
		return this._contents.indexOf(dobj) !== -1;
	}

	/**
	 * Initialize the internal 3D room grid structure.
	 *
	 * This creates a three-dimensional array sized according to `dimensions` and
	 * fills it with `undefined` placeholders. It does not allocate `Room`
	 * instances - that work is performed by `generateEmptyRooms()` (or you can
	 * allocate rooms yourself and assign them into the grid). Splitting
	 * allocation from instantiation allows faster, low-cost grid setup in cases
	 * where rooms are created lazily or populated from external data.

	 * @param dimensions The size of the grid to create (width, height, layers)
	 * @example
	 * ```typescript
	 * // Create an internal grid sized 10x10x2 but don't instantiate Room objects yet
	 * const dungeon = new Dungeon({ dimensions: { width: 10, height: 10, layers: 2 } });
	 * // The constructor calls generateGrid automatically; the grid currently holds undefined values
	 * console.log(dungeon.getRoom({ x: 0, y: 0, z: 0 })); // undefined until generateEmptyRooms() runs
	 * ```
	 */
	private generateGrid() {
		const rooms: (Room | undefined)[][][] = [];
		for (let z = 0; z < this._dimensions.layers; z++) {
			const layer: (Room | undefined)[][] = [];
			for (let y = 0; y < this._dimensions.height; y++) {
				const row: (Room | undefined)[] = [];
				for (let x = 0; x < this._dimensions.width; x++) {
					row.push(undefined);
				}
				layer.push(row);
			}
			rooms.push(layer);
		}
		return rooms;
	}

	/**
	 * Instantiate `Room` objects for every slot in the internal grid.
	 *
	 * This walks the `rooms` 3D array created by `generateGrid()` and replaces
	 * `undefined` placeholders with actual `Room` instances that are linked back
	 * to this dungeon. Use this to eagerly allocate every room in the dungeon.
	 *
	 * @example
	 * ```typescript
	 * const dungeon = new Dungeon({ dimensions: { width: 10, height: 10, layers: 2 }});
	 * // after generateGrid (done in constructor) the grid is empty; populate it now
	 * dungeon.generateRooms();
	 * const start = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * console.log(start instanceof Room); // true
	 * ```
	 */
	generateRooms() {
		for (let z = 0; z < this._dimensions.layers; z++)
			for (let y = 0; y < this._dimensions.height; y++)
				for (let x = 0; x < this._dimensions.width; x++)
					this.createRoom({ coordinates: { x, y, z } });
	}

	/**
	 * Adds an existing Room instance to the dungeon's room grid at the room's coordinates.
	 * The room must have valid coordinates that are within the dungeon's dimensions.
	 * If a room already exists at those coordinates, it will be replaced.
	 *
	 * Note: This method allows direct modification of the dungeon's room grid.
	 * Use with caution as it can create inconsistencies if not used properly.
	 *
	 * @param room The Room instance to add to the dungeon
	 * @returns true if the room was added to the dungeon
	 *
	 * @example
	 * ```typescript
	 * const room = new Room({ coordinates: { x: 0, y: 0, z: 0 } });
	 * const added = dungeon.addRoom(room);
	 * if (added) {
	 *   console.log('Room added successfully');
	 * }
	 * ```
	 */
	addRoom(room: Room): boolean {
		const { x, y, z } = room.coordinates;

		// Check if coordinates are within bounds
		if (
			x < 0 ||
			x >= this._dimensions.width ||
			y < 0 ||
			y >= this._dimensions.height ||
			z < 0 ||
			z >= this._dimensions.layers
		)
			return false;

		this._rooms[z][y][x] = room;
		room.dungeon = this;
		return true;
	}

	/**
	 * Creates a new Room with the given options and adds it to the dungeon.
	 * The room will be placed in the dungeon's room grid according to its coordinates.
	 *
	 * @param options The options for creating the room, must include coordinates
	 * @returns The created room if successful, undefined if the coordinates are invalid
	 *
	 * @example
	 * ```typescript
	 * const room = dungeon.createRoom({
	 *   coordinates: { x: 0, y: 0, z: 0 },
	 *   keywords: "start room",
	 *   description: "You are in the starting room."
	 * });
	 *
	 * if (room) console.log('Room created and added successfully');
	 * ```
	 */
	createRoom(options: RoomOptions): Room | undefined {
		const room = new Room({ ...options, dungeon: this });
		if (this.addRoom(room)) return room;
	}

	/**
	 * Get the room at the specified coordinates.
	 * Returns undefined when the coordinates are outside the dungeon bounds.
	 *
	 * @param coordinates The coordinates object containing x/y/z positions
	 * @returns The Room at the coordinates or undefined if out of bounds
	 *
	 * @example
	 * ```typescript
	 * // Using a coordinates object
	 * const room1 = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * if (!room1) throw new Error('No room at those coordinates');
	 * ```
	 */
	getRoom(coordinates: Coordinates): Room | undefined;

	/**
	 * Get the room at the specified coordinates.
	 * Returns undefined when the coordinates are outside the dungeon bounds.
	 *
	 * @param x The x-coordinate of the room
	 * @param y The y-coordinate of the room
	 * @param z The z-coordinate of the room
	 * @returns The Room at the coordinates or undefined if out of bounds
	 *
	 * @example
	 * ```typescript
	 * // Using xyz coordinates
	 * const room1 = dungeon.getRoom(0, 0, 0);
	 * if (!room1) throw new Error('No room at those coordinates');
	 * ```

	 * @param x 
	 * @param y 
	 * @param z 
	 */
	getRoom(x: number, y: number, z: number): Room | undefined;
	getRoom(
		coordsOrX: Coordinates | number,
		y?: number,
		z?: number
	): Room | undefined {
		let coords: Coordinates;

		if (
			typeof coordsOrX === "number" &&
			typeof y === "number" &&
			typeof z === "number"
		) {
			coords = { x: coordsOrX, y, z };
		} else {
			coords = coordsOrX as Coordinates;
		}

		if (coords.x < 0 || coords.x >= this._dimensions.width) return;
		if (coords.y < 0 || coords.y >= this._dimensions.height) return;
		if (coords.z < 0 || coords.z >= this._dimensions.layers) return;
		return this._rooms[coords.z][coords.y][coords.x];
	}

	/**
	 * Gets the room adjacent to a given position in the specified direction.
	 * The input coordinates can be either explicit coordinates or a Room
	 * instance (in which case its coordinates are used).
	 *
	 * @param coordinates Starting position as either Coordinates or a Room instance
	 * @param direction The direction to move, can be a single direction or combination
	 * @returns The Room in the specified direction, or undefined if out of bounds
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({
	 *   dimensions: { width: 3, height: 3, layers: 2 }
	 * });
	 * const start = dungeon.getRoom({ x: 1, y: 1, z: 0 });
	 *
	 * // Using explicit coordinates
	 * const northRoom = dungeon.getStep({ x: 1, y: 1, z: 0 }, DIRECTION.NORTH);
	 *
	 * // Using a room instance
	 * const eastRoom = dungeon.getStep(start, DIRECTION.EAST);
	 *
	 * // Diagonal movement
	 * const neRoom = dungeon.getStep(start, DIRECTION.NORTHEAST);
	 *
	 * // Vertical movement
	 * const upRoom = dungeon.getStep(start, DIRECTION.UP);
	 *
	 * // Returns undefined if moving out of bounds
	 * const invalid = dungeon.getStep(start, DIRECTION.WEST); // undefined if at x=0
	 * ```
	 */
	getStep(coordinates: Coordinates | Room, direction: DIRECTION) {
		if (coordinates instanceof Room) coordinates = coordinates.coordinates;
		if (isNorthward(direction)) coordinates.y--;
		if (isSouthward(direction)) coordinates.y++;
		if (isEastward(direction)) coordinates.x++;
		if (isWestward(direction)) coordinates.x--;
		if (direction === DIRECTION.UP) coordinates.z++;
		if (direction === DIRECTION.DOWN) coordinates.z--;
		return this.getRoom(coordinates);
	}
}

/**
 * Options used to construct or initialize a `DungeonObject`.
 *
 * These are helper parameters passed into `DungeonObject` and its subclasses
 * to set initial metadata and optionally register the object with a `Dungeon`.
 *
 * @property keywords - Space-delimited identification keywords (e.g. "small coin").
 * @property display - Short, human-friendly name for the object (e.g. "Gold Coin").
 * @property description - Longer descriptive text shown when examining the object.
 * @property dungeon - Optional `Dungeon` instance. If provided, the object is added to that dungeon.
 *
 * @example
 * ```typescript
 * import { Dungeon, DungeonObject } from "./dungeon.js";
 *
 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 2, height: 1, layers: 1 } });
 * const coin = new DungeonObject({
 *   keywords: "coin gold",
 *   display: "Gold Coin",
 *   description: "A small, shiny gold coin.",
 *   dungeon,
 * });
 * // coin is now tracked by dungeon.contents
 * ```
 */
export interface DungeonObjectOptions {
	keywords?: string;
	display?: string;
	description?: string;
	dungeon?: Dungeon;
}

/**
 * Options for creating a `Room`.
 *
 * This type includes the required `coordinates` property and inherits the
 * general `DungeonObjectOptions`.
 *
 * @property coordinates - The location of the room inside the dungeon grid.
 *
 * @example
 * ```typescript
 * const room = new Room({
 *   coordinates: { x: 0, y: 0, z: 0 },
 *   keywords: "start",
 *   description: "The starting room of the dungeon."
 * });
 * ```
 */
export interface RoomOptions extends DungeonObjectOptions {
	coordinates: Coordinates;
}

/**
 * Base serialized form for all DungeonObject types.
 * Contains the core properties that all dungeon objects share when serialized.
 *
 * @property type - The class name of the original object for proper deserialization
 * @property keywords - Space-delimited identification keywords
 * @property display - Human-readable display name
 * @property description - Detailed object description
 * @property contents - Array of serialized contained objects
 * @property dungeonId - ID of the dungeon this object belongs to (if any)
 */
export interface SerializedDungeonObject {
	type: SerializedDungeonObjectType;
	keywords: string;
	display: string;
	description?: string;
	contents?: SerializedDungeonObject[];
	location?: string; // RoomRef value
}

/**
 * Serialized form for Room objects.
 * Extends the base serialized form with room-specific coordinate data.
 *
 * @property coordinates - The room's position in the dungeon grid
 */
export interface SerializedRoom extends SerializedDungeonObject {
	type: "Room";
	coordinates: Coordinates;
}

/**
 * Serialized form for Movable objects.
 * Currently identical to base form but defined for type safety and future extensions.
 */
export interface SerializedMovable extends SerializedDungeonObject {
	type: "Movable";
}

/**
 * Serialized form for Mob objects.
 * Currently identical to Movable form but defined for type safety and future extensions.
 */
export interface SerializedMob extends SerializedDungeonObject {
	type: "Mob";
}

/**
 * Serialized form for Item objects.
 * Currently identical to Movable form but defined for type safety and future extensions.
 */
export interface SerializedItem extends SerializedDungeonObject {
	type: "Item";
}

/**
 * Serialized form for Prop objects.
 * Currently identical to base form but defined for type safety and future extensions.
 */
export interface SerializedProp extends SerializedDungeonObject {
	type: "Prop";
}

/**
 * Union type representing valid serialized object types.
 */
export type SerializedDungeonObjectType =
	| "DungeonObject"
	| "Room"
	| "Movable"
	| "Mob"
	| "Item"
	| "Prop";

/**
 * Union type representing any valid serialized dungeon object form.
 */
export type AnySerializedDungeonObject =
	| SerializedDungeonObject
	| SerializedRoom
	| SerializedMovable
	| SerializedMob
	| SerializedItem
	| SerializedProp;

/**
 * Base class for all objects that can exist in the dungeon.
 * Provides core functionality for object identification, containment, and location management.
 *
 * @example
 * ```typescript
 * import { Dungeon, DungeonObject } from "./dungeon.js";
 *
 * // Create a dungeon and a starting room
 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 1, height: 1, layers: 1 } });
 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
 *
 * // Create a sword and a bag
 * const sword = new DungeonObject({ keywords: "longsword sword", display: "A Sharp Longsword" });
 * const bag = new DungeonObject({ keywords: "bag", display: "Leather Bag" });
 *
 * // Place bag in the room and put sword in the bag
 * room.add(bag);
 * bag.add(sword);
 *
 * // Check containment
 * console.log(bag.contains(sword)); // true
 * console.log(sword.location === bag); // true
 * console.log(dungeon.contains(sword)); // true (registered via containment)
 * ```
 */
export class DungeonObject {
	/**
	 * Space-separated list of words that can be used to identify this object.
	 * Used by the match() method for object identification and targeting.
	 */
	keywords: string = "dungeon object";

	/**
	 * Human-readable name for this object, shown in interfaces and output.
	 */
	display: string = "Dungeon Object";

	/**
	 * Detailed description of this object, shown when examining or looking.
	 * Can include multiple sentences and rich descriptive text about the
	 * object's appearance, state, and notable features.
	 */
	description?: string;

	/**
	 * Array of objects directly contained by this object. Acts as a container
	 * registry for inventory, room contents, or nested object hierarchies.
	 * @private
	 */
	private _contents: DungeonObject[] = [];

	/**
	 * Reference to the dungeon this object belongs to, if any.
	 * All objects in a containment tree share the same dungeon reference.
	 * @private
	 */
	private _dungeon?: Dungeon;

	/**
	 * Reference to the container holding this object, if any.
	 * Forms part of the object containment hierarchy along with _contents.
	 * @private
	 */
	private _location?: DungeonObject;

	/**
	 * Create a new DungeonObject.
	 *
	 * @param options Optional initialization values
	 * @param options.keywords Space-delimited keywords
	 * @param options.display Human-readable display string
	 * @param options.description Longer descriptive text
	 * @param options.dungeon If provided, the object will be added to that dungeon
	 *
	 * @example
	 * ```typescript
	 * const sword = new DungeonObject({ keywords: "steel sword", display: "A Sword" });
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * sword.dungeon = dungeon; // adds sword to dungeon.contents
	 * ```
	 */
	constructor(options?: DungeonObjectOptions) {
		if (!options) return;
		if (options.dungeon) this.dungeon = options.dungeon;
		if (options.keywords) this.keywords = options.keywords;
		if (options.display) this.display = options.display;
		if (options.description) this.description = options.description;
	}

	/**
	 * Returns all objects directly contained by this object.
	 * The array it returns is a copy that can be safely transformed.
	 *
	 * @returns An array of DungeonObjects directly contained by this object
	 *
	 * @example
	 * ```typescript
	 * const bag = new DungeonObject();
	 * const coin = new DungeonObject({ keywords: "gold coin" });
	 * const gem = new DungeonObject({ keywords: "ruby gem" });
	 *
	 * bag.add(coin, gem);
	 * const items = bag.contents;
	 * console.log(items.length); // 2
	 * console.log(items.some(item => item.match("coin"))); // true
	 * ```
	 */
	get contents() {
		return [...this._contents];
	}

	/**
	 * Sets the container of this object and manages all related containment updates.
	 * When an object's location changes, it automatically:
	 * - Removes itself from its old container
	 * - Adds itself to the new container
	 * - Updates its dungeon reference to match its new container
	 *
	 * @param dobj The new container for this object, or undefined to remove from current container
	 *
	 * @example
	 * ```typescript
	 * const chest = new DungeonObject({ keywords: "wooden chest" });
	 * const sword = new DungeonObject({ keywords: "steel sword" });
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 *
	 * // Place chest in room
	 * chest.location = room;
	 * console.log(room.contains(chest)); // true
	 *
	 * // Put sword in chest
	 * sword.location = chest;
	 * console.log(chest.contains(sword)); // true
	 * console.log(dungeon.contains(sword)); // true (inherits dungeon from chest)
	 *
	 * // Remove from chest
	 * sword.location = undefined;
	 * console.log(chest.contains(sword)); // false
	 * ```
	 */
	set location(dobj: DungeonObject | undefined) {
		if (this._location === dobj) return;
		if (this._location) {
			const oldLocation: DungeonObject = this._location;
			this._location = undefined;
			oldLocation.remove(this);
		}

		this._location = dobj;
		if (dobj) {
			dobj.add(this);
			this.dungeon = dobj.dungeon;
		} else this.dungeon = undefined;
	}

	/**
	 * Sets the container (location) of this object.
	 * Assigning a new location will remove the object from its previous container
	 * and add it to the new container. Setting to `undefined` removes it from any container.
	 *
	 * @example
	 * ```typescript
	 * const chest = new DungeonObject({ keywords: "wooden chest" });
	 * const coin = new DungeonObject({ keywords: "gold coin" });
	 * chest.add(coin);
	 * // coin.location === chest;
	 * ```
	 */
	get location(): DungeonObject | undefined {
		return this._location;
	}

	/**
	 * Assign or remove this object's dungeon.
	 * When set, the object will be added to the dungeon's global contents and
	 * all contained objects will inherit the dungeon reference.
	 *
	 * @param dungeon The dungeon to assign, or `undefined` to remove
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 5, height: 5, layers: 1 } });
	 * const room = dungeon.getRoom({coordinates: {x:0, y:0, z:0}});
	 * const item = new DungeonObject({ keywords: "gem" });
	 * item.move(room); // item is now tracked in dungeon.contents
	 * ```
	 */
	set dungeon(dungeon: Dungeon | undefined) {
		if (this.dungeon === dungeon) return;

		// unassign dungeon
		if (this.dungeon) {
			const oldDungeon: Dungeon = this.dungeon;
			this._dungeon = undefined;
			oldDungeon.remove(this);
		}

		// move off of old dungeon location
		if (this.location && this.location.dungeon !== dungeon)
			this.location = undefined;

		// update new dungeon
		this._dungeon = dungeon;
		if (dungeon) dungeon.add(this);

		// inform our contents that we're in a new dungeon
		for (let obj of this._contents) obj.dungeon = dungeon;
	}

	/**
	 * Get the dungeon this object belongs to, if any.
	 * @returns The Dungeon instance or undefined
	 *
	 * @example
	 * ```typescript
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * const item = new DungeonObject();
	 * room.add(item);
	 * console.log(item.dungeon === dungeon); // true
	 * ```
	 */
	get dungeon() {
		return this._dungeon;
	}

	/**
	 * Check if the given keywords match this object's own keywords.

	 * @param keywords Space-delimited search terms
	 * @returns true if the search terms match this object's keywords
	 *
	 * @example
	 * ```typescript
	 * const sword = new DungeonObject({ keywords: "steel sword" });
	 * const bag = new DungeonObject({ keywords: "leather bag" });
	 * bag.add(sword);
	 *
	 * // Correct: match tests the object's own keywords
	 * console.log(sword.match("sword")); // true
	 *
	 * // To check contents, test each contained item
	 * console.log(bag.contents.some(item => item.match("sword"))); // true
	 * ```
	 */
	match(keywords: string): boolean {
		return string.matchKeywords(keywords, this.keywords);
	}

	/**
	 * Add objects to this container's contents.
	 * Also sets each object's location to this container. Objects already in this
	 * container are ignored. This method maintains containment consistency by
	 * ensuring both the contents array and location references are updated.
	 *
	 * @param dobjs The objects to add to this container
	 *
	 * @example
	 * ```typescript
	 * const chest = new DungeonObject({ keywords: "chest" });
	 * const coin = new DungeonObject({ keywords: "coin" });
	 * const gem = new DungeonObject({ keywords: "gem" });
	 *
	 * // Add multiple items at once
	 * chest.add(coin, gem);
	 *
	 * // Items are now in the chest
	 * console.log(chest.contains(coin)); // true
	 * console.log(coin.location === chest); // true
	 *
	 * // Adding an item that's already contained is ignored
	 * chest.add(coin); // no effect
	 * ```
	 */
	add(...dobjs: DungeonObject[]) {
		for (let obj of dobjs) {
			if (this.contains(obj)) continue;
			this._contents.push(obj);
			if (obj.location !== this) obj.move(this);
		}
	}

	/**
	 * Remove objects from this container's contents.
	 * Also unsets each object's location if it points to this container.
	 * Objects not found in the contents are ignored. This method maintains
	 * containment consistency by ensuring both the contents array and location
	 * references are updated.
	 *
	 * @param dobjs The objects to remove from this container
	 *
	 * @example
	 * ```typescript
	 * const chest = new DungeonObject({ keywords: "chest" });
	 * const coin = new DungeonObject({ keywords: "coin" });
	 *
	 * // Add and then remove an item
	 * chest.add(coin);
	 * console.log(chest.contains(coin)); // true
	 *
	 * chest.remove(coin);
	 * console.log(chest.contains(coin)); // false
	 * console.log(coin.location === undefined); // true
	 *
	 * // Removing an item that's not contained is ignored
	 * chest.remove(coin); // no effect
	 * ```
	 */
	remove(...dobjs: DungeonObject[]) {
		for (let obj of dobjs) {
			const index = this._contents.indexOf(obj);
			if (index === -1) continue;
			this._contents.splice(index, 1);
			if (obj.location === this) obj.move(undefined);
		}
	}

	/**
	 * Check if we directly contain the given object.
	 *
	 * This method tests whether the specified object is immediately present in
	 * this container's `contents` array. It does not perform a deep or recursive
	 * search. To check for nested containment (for example, whether the object
	 * exists anywhere inside this container's subtree), you can walk the
	 * containment graph manually or implement a helper that searches recursively.
	 *
	 * @param dobj The object to test for direct containment
	 * @returns true if `dobj` is directly contained by this object
	 *
	 * @example
	 * ```typescript
	 * const bag = new DungeonObject({ keywords: "bag" });
	 * const pouch = new DungeonObject({ keywords: "pouch" });
	 * const coin = new DungeonObject({ keywords: "coin" });
	 * bag.add(pouch);
	 * pouch.add(coin);
	 *
	 * console.log(bag.contains(pouch)); // true (direct)
	 * console.log(bag.contains(coin)); // false (coin is nested inside pouch)
	 * // To check nested containment:
	 * function containsRecursive(container: DungeonObject, target: DungeonObject): boolean {
	 *   if (container.contains(target)) return true;
	 *   for (const child of container.contents) {
	 *     if (containsRecursive(child, target)) return true;
	 *   }
	 *   return false;
	 * }
	 * console.log(containsRecursive(bag, coin)); // true
	 * ```
	 */
	contains(dobj: DungeonObject) {
		return this._contents.indexOf(dobj) !== -1;
	}

	/**
	 * Moves this object to a new container, triggering appropriate movement events.
	 * This is the preferred method for changing an object's location as it provides
	 * a hook for custom movement behavior in subclasses.
	 *
	 * @param dobj The new container for this object, or undefined to remove from current container
	 *
	 * @example
	 * ```typescript
	 * const creature = new DungeonObject();
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * creature.move(room);
	 * ```
	 */
	move(dobj: DungeonObject | undefined) {
		this.location = dobj;
	}

	/**
	 * Serializes the dungeon object data for persistence.
	 * Includes dungeon ID when the object belongs to a registered dungeon.
	 * Contents are serialized recursively to preserve the object hierarchy.
	 *
	 * @returns Serializable object data with type information
	 *
	 * @example
	 * ```typescript
	 * const chest = new DungeonObject({
	 *   keywords: "wooden chest",
	 *   display: "Wooden Chest",
	 *   description: "A sturdy wooden chest with iron hinges."
	 * });
	 *
	 * const coin = new DungeonObject({ keywords: "gold coin" });
	 * chest.add(coin);
	 *
	 * const saveData = chest.serialize();
	 * // saveData contains type, keywords, display, description, contents, and dungeonId (if any)
	 * ```
	 */
	serialize(): SerializedDungeonObject {
		const locationRef =
			this.location instanceof Room ? this.location.getRoomRef() : undefined;
		const serializedContents = this._contents.map((obj) => obj.serialize());
		return {
			type: this.constructor.name as SerializedDungeonObjectType,
			keywords: this.keywords,
			display: this.display,
			description: this.description,
			...(serializedContents.length > 0 && { contents: serializedContents }),
			...(locationRef && { location: locationRef }),
		};
	}

	/**
	 * Creates a DungeonObject instance from serialized data.
	 * Recursively deserializes contained objects to restore the object hierarchy.
	 * Note: This creates a new object hierarchy separate from any existing dungeon.
	 * The dungeonId field is preserved but objects are not automatically added to dungeons.
	 *
	 * @param data Serialized object data
	 * @returns New DungeonObject instance with restored hierarchy
	 *
	 * @example
	 * ```typescript
	 * const saveData: SerializedDungeonObject = {
	 *   type: "DungeonObject",
	 *   keywords: "wooden chest",
	 *   display: "Wooden Chest",
	 *   description: "A sturdy wooden chest.",
	 *   contents: [
	 *     {
	 *       type: "Item",
	 *       keywords: "gold coin",
	 *       display: "Gold Coin",
	 *       description: "A shiny gold coin.",
	 *       contents: [],
	 *     }
	 *   ],
	 *   dungeonId: "main-dungeon"
	 * };
	 *
	 * const chest = DungeonObject.deserialize(saveData);
	 * console.log(chest.keywords); // "wooden chest"
	 * console.log(chest.contents.length); // 1
	 * console.log(chest.contents[0].keywords); // "gold coin"
	 * // Note: dungeonId is preserved in the serialized data but objects
	 * // are not automatically added to dungeons during deserialization
	 * ```
	 */
	public static deserialize(data: AnySerializedDungeonObject): DungeonObject {
		/** shortcut support */
		switch (data.type) {
			case "Room":
				// Delegate to Room-specific deserializer
				return Room.deserialize(data as SerializedRoom);
			case "Movable":
				return Movable.deserialize(data as SerializedMovable);
			case "Mob":
				return Mob.deserialize(data as SerializedMob);
			case "Item":
				return Item.deserialize(data as SerializedItem);
			case "Prop":
				return Prop.deserialize(data as SerializedProp);
			case "DungeonObject":
				// handled in main body
				break;
			default: // type is not recognized or not set
				// we never get to the main body!
				throw new Error("no valid type to deserialize");
		}

		// DungeonObjects in particular
		let obj: DungeonObject = new DungeonObject(data);

		// Handle contents for all object types
		if (data.contents) {
			for (const contentData of data.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				obj.add(contentObj);
			}
		}

		return obj;
	}
}

/**
 * Represents a position in the three-dimensional dungeon space.
 * Used for room positioning and movement calculations.
 *
 * @property x - Position along the east-west axis (positive = east)
 * @property y - Position along the north-south axis (positive = south)
 * @property z - Position along the up-down axis (positive = up)
 *
 * @example
 * ```typescript
 * // Ground floor coordinates
 * const start: Coordinates = { x: 0, y: 0, z: 0 };
 *
 * // Second floor, northeast corner
 * const upstairs: Coordinates = { x: 9, y: 0, z: 1 };
 *
 * // Get room at coordinates
 * const room = dungeon.getRoom(coordinates);
 *
 * // Calculate new coordinates
 * const newCoords: Coordinates = {
 *   x: room.x + 1,  // One room east
 *   y: room.y,      // Same north-south position
 *   z: room.z + 1   // One level up
 * };
 * ```
 */
export interface Coordinates {
	x: number;
	y: number;
	z: number;
}

/**
 * Represents a single location within the dungeon.
 * Rooms are connected to adjacent rooms and can contain objects and characters.
 * Extends DungeonObject to inherit containment and identification features.
 *
 * @example
 * ```typescript
 * // Get a room from the dungeon
 * const room = dungeon.getRoom({ x: 1, y: 1, z: 0 });
 *
 * // Check adjacent rooms
 * const northRoom = room.getStep(DIRECTION.NORTH);
 * const southEastRoom = room.getStep(DIRECTION.SOUTHEAST);
 *
 * // Add objects to the room
 * const chest = new DungeonObject();
 * room.add(chest);
 *
 * // Custom movement rules
 * class LockedRoom extends Room {
 *   canEnter(movable: Movable, direction?: DIRECTION) {
 *     return movable.hasKey; // Custom logic
 *   }
 * }
 * ```
 *
 * Features:
 * - Three-dimensional positioning
 * - Adjacent room navigation
 * - Movement validation hooks
 * - Customizable entry/exit behavior
 * - Container functionality (inherited)
 */
export class Room extends DungeonObject {
	/**
	 * The position of this room in the dungeon's coordinate system.
	 * Set during construction and immutable afterwards.
	 * @private
	 */
	private _coordinates: Coordinates;

	/**
	 * Links from this room to other rooms, overriding normal spatial relationships.
	 * Links allow connections between any rooms regardless of their position.
	 * This property is optional and is left undefined when the room has no links to
	 * avoid allocating an array for every room in large dungeons where only a
	 * small subset of rooms actually use links.
	 * @private
	 */
	private _links?: RoomLink[];

	/**
	 * Returns a shallow copy of the room's coordinates.
	 * @returns The room coordinates as an object { x, y, z }
	 *
	 * @example
	 * ```typescript
	 * const room = dungeon.getRoom({ x: 1, y: 2, z: 0 });
	 * const coords = room.coordinates;
	 * console.log(coords.x, coords.y, coords.z);
	 * ```
	 */
	get coordinates(): Coordinates {
		return {
			x: this._coordinates.x,
			y: this._coordinates.y,
			z: this._coordinates.z,
		};
	}

	/**
	 * X coordinate (east-west) of this room.
	 * @returns number X coordinate
	 */
	get x() {
		return this._coordinates.x;
	}

	/**
	 * Y coordinate (north-south) of this room.
	 * @returns number Y coordinate
	 */
	get y() {
		return this._coordinates.y;
	}

	/**
	 * Z coordinate (vertical layer) of this room.
	 * @returns number Z coordinate
	 */
	get z() {
		return this._coordinates.z;
	}

	/**
	 * Create a new Room instance.
	 *
	 * @param options Room initialization options
	 * @param options.coordinates The position of the room in the dungeon
	 *
	 * @example
	 * ```typescript
	 * const room = new Room({ coordinates: { x: 1, y: 1, z: 0 }, dungeon });
	 * ```
	 */
	constructor(options: RoomOptions) {
		super(options);
		this._coordinates = options.coordinates;
	}

	/**
	 * Deserialize a SerializedRoom into a Room instance.
	 */
	public static deserialize(data: SerializedRoom): Room {
		const room = new Room(data);
		if (data.contents && Array.isArray(data.contents)) {
			for (const contentData of data.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				room.add(contentObj);
			}
		}
		return room;
	}

	/**
	 * Add a RoomLink to this room.
	 * This method is called by RoomLink when it is constructed.
	 *
	 * @param link - The RoomLink to add
	 * @internal
	 */
	addLink(link: RoomLink) {
		if (!this._links) this._links = [];
		if (!this._links.includes(link)) this._links.push(link);
	}

	/**
	 * Remove a RoomLink from this room.
	 * This method is called by RoomLink when it is removed.
	 *
	 * @param link - The RoomLink to remove
	 * @internal
	 */
	removeLink(link: RoomLink) {
		if (!this._links) return;
		const index = this._links.indexOf(link);
		if (index !== -1) {
			this._links.splice(index, 1);
		}
		// If there are no more links, release the array to save memory
		if (this._links.length === 0) this._links = undefined;
	}

	/**
	 * Gets the room adjacent to this room in the specified direction.
	 * Returns undefined if there is no room in that direction or if this room
	 * is not part of a dungeon.
	 *
	 * @param dir The direction to check for an adjacent room
	 * @returns The adjacent Room instance or undefined
	 *
	 * @example
	 * ```typescript
	 * const room = dungeon.getRoom({ x: 1, y: 1, z: 0 });
	 *
	 * // Check basic directions
	 * const northRoom = room.getStep(DIRECTION.NORTH);
	 * if (northRoom) {
	 *   console.log("There is a room to the north");
	 * }
	 *
	 * // Check diagonal movement
	 * const northeastRoom = room.getStep(DIRECTION.NORTHEAST);
	 * ```
	 */
	getStep(dir: DIRECTION) {
		// First check for a linked room in this direction
		if (this._links) {
			for (const link of this._links) {
				const destination = link.getDestination(this, dir);
				if (destination) {
					return destination;
				}
			}
		}
		// If no link handles this direction, use normal spatial navigation
		return this.dungeon?.getStep(this, dir);
	}

	/**
	 * Determines if a movable object can enter this room from a specific direction.
	 * Override this method to implement custom entry restrictions.
	 *
	 * @param movable The object attempting to enter
	 * @param direction The direction from which the object is entering (opposite of movement direction)
	 * @returns true if entry is allowed, false otherwise
	 *
	 * @example
	 * ```typescript
	 * class KeyedRoom extends Room {
	 *   canEnter(movable: Movable, direction?: DIRECTION) {
	 *     return movable.contents.some(item => item.match("bronze key"));
	 *   }
	 * }
	 * ```
	 */
	canEnter(movable: Movable, direction?: DIRECTION) {
		return true;
	}

	/**
	 * Determines if a movable object can exit this room in a specific direction.
	 * Override this method to implement custom exit restrictions.
	 *
	 * @param movable The object attempting to exit
	 * @param direction The direction in which the object is trying to move
	 * @returns true if exit is allowed, false otherwise
	 *
	 * @example
	 * ```typescript
	 * class OneWayRoom extends Room {
	 *   canExit(movable: Movable, direction?: DIRECTION) {
	 *     // Only allow exit to the east
	 *     return direction === DIRECTION.EAST;
	 *   }
	 * }
	 * ```
	 */
	canExit(movable: Movable, direction?: DIRECTION) {
		return true;
	}

	/**
	 * Hook called when a movable object enters this room.
	 * Override this method to implement custom entry behavior.
	 *
	 * @param movable The object that entered the room
	 * @param direction The direction from which the object entered (opposite of movement direction)
	 *
	 * @example
	 * ```typescript
	 * class TrapRoom extends Room {
	 *   onEnter(movable: Movable, direction?: DIRECTION) {
	 *     console.log("The floor gives way beneath you!");
	 *     const pitRoom = this.getStep(DIRECTION.DOWN);
	 *     if (pitRoom) movable.move(pitRoom);
	 *   }
	 * }
	 * ```
	 */
	onEnter(movable: Movable, direction?: DIRECTION) {}

	/**
	 * Hook called when a movable object exits this room.
	 * Override this method to implement custom exit behavior.
	 *
	 * @param movable The object that exited the room
	 * @param direction The direction in which the object moved
	 *
	 * @example
	 * ```typescript
	 * class AlarmRoom extends Room {
	 *   onExit(movable: Movable, direction?: DIRECTION) {
	 *     if (!hasSneak) {
	 *       console.log("An alarm sounds as you leave!");
	 *       this.contents.forEach(obj => {
	 *         if (obj instanceof Guard) {
	 *           obj.pursue(movable);
	 *         }
	 *       });
	 *     }
	 *   }
	 * }
	 * ```
	 */
	onExit(movable: Movable, direction?: DIRECTION) {}

	/**
	 * Generates a room reference string for this room in the format `@dungeon-id{x,y,z}`.
	 * Returns undefined if the room's dungeon does not have an ID.
	 * This reference can be parsed back into a Room using `getRoomByRef()`.
	 *
	 * @returns The room reference string, or undefined if the dungeon has no ID
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({
	 *   id: "castle",
	 *   dimensions: { width: 10, height: 10, layers: 1 }
	 * });
	 * const room = dungeon.getRoom({ x: 5, y: 3, z: 0 });
	 *
	 * const ref = room.getRoomRef();
	 * console.log(ref); // "@castle{5,3,0}"
	 *
	 * // Can be parsed back into a room
	 * const sameRoom = getRoomByRef(ref);
	 * console.log(sameRoom === room); // true
	 * ```
	 */
	getRoomRef(): string | undefined {
		if (!this.dungeon?.id) return undefined;
		return `@${this.dungeon.id}{${this.x},${this.y},${this.z}}`;
	}

	/**
	 * Serializes the room data for persistence.
	 * Includes coordinates in addition to the base DungeonObject data.
	 *
	 * @returns Serializable room data with type information
	 *
	 * @example
	 * ```typescript
	 * const room = new Room({
	 *   coordinates: { x: 5, y: 3, z: 1 },
	 *   keywords: "throne room",
	 *   display: "Royal Throne Room",
	 *   description: "A magnificent throne room with golden pillars."
	 * });
	 *
	 * const saveData = room.serialize();
	 * // saveData includes coordinates along with other room properties
	 * ```
	 */
	serialize(): SerializedRoom {
		const baseData = super.serialize();
		return {
			...baseData,
			type: "Room" as const,
			coordinates: this.coordinates,
		};
	}
}

/**
 * Represents objects that can move between rooms in the dungeon.
 * Extends DungeonObject with movement capabilities and position tracking.
 * Typically used for characters, NPCs, or any object that needs to move.
 *
 * @example
 * ```typescript
 * // Create a movable character
 * const player = new Movable();
 * player.keywords = "player hero";
 *
 * // Place in starting room
 * const startRoom = dungeon.getRoom({ x: 0, y: 0, z: 0 });
 * startRoom.add(player);
 *
 * // Move to adjacent room
 * if (player.canStep(DIRECTION.NORTH)) {
 *   player.step(DIRECTION.NORTH);
 * }
 *
 * // Get current position
 * console.log(player.coordinates); // { x: 0, y: -1, z: 0 }
 * ```
 *
 * Features:
 * - Room-to-room movement
 * - Position tracking
 * - Movement validation
 * - Coordinate caching
 * - Automatic position updates
 * - Movement event hooks (through Room)
 */
export class Movable extends DungeonObject {
	/**
	 * Cache of the current room coordinates where this object resides.
	 * This is synchronized with the containing room's coordinates when the
	 * object moves between rooms, and cleared when not in a room.
	 * Caching coordinates improves performance by avoiding frequent room lookups
	 * during movement and position checks.
	 * @private
	 */
	private _coordinates: Coordinates | undefined;

	/**
	 * Deserialize a SerializedMovable into a Movable instance.
	 */
	public static deserialize(data: AnySerializedDungeonObject): Movable {
		const movable = new Movable(data as SerializedMovable);
		if (data.contents && Array.isArray(data.contents)) {
			for (const contentData of data.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				movable.add(contentObj);
			}
		}
		return movable;
	}

	/**
	 * Set the location (container) of this movable object.
	 * Also caches the room coordinates when the object is placed in a `Room`.
	 *
	 * @param dobj The container to move into, or undefined to remove from any container
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * player.location = room; // player now in room and coordinates cached
	 * player.location = undefined; // player removed from room
	 * ```
	 */
	set location(dobj: DungeonObject | undefined) {
		super.location = dobj;
		if (this.location instanceof Room)
			this._coordinates = this.location.coordinates;
		else if (this._coordinates) this._coordinates = undefined;
	}

	/**
	 * Get the current container/location of this movable object.
	 * @returns The DungeonObject containing this object, or undefined
	 */
	get location() {
		return super.location;
	}

	/**
	 * Gets the current coordinates of this movable object in the dungeon.
	 * Returns undefined if the object is not currently in a room.
	 *
	 * @returns The object's current position or undefined
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * console.log(player.coordinates); // undefined
	 *
	 * const room = dungeon.getRoom({ x: 5, y: 3, z: 1 });
	 * room.add(player);
	 *
	 * const pos = player.coordinates;
	 * console.log(pos); // { x: 5, y: 3, z: 1 }
	 * ```
	 */
	get coordinates(): Coordinates | undefined {
		if (!this._coordinates) return;
		return {
			x: this._coordinates.x,
			y: this._coordinates.y,
			z: this._coordinates.z,
		};
	}

	/**
	 * Gets the X coordinate (east-west position) of this movable object.
	 * Returns undefined if the object is not in a room.
	 *
	 * @returns The object's X coordinate or undefined
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * const room = dungeon.getRoom({ x: 5, y: 0, z: 0 });
	 * room.add(player);
	 *
	 * console.log(player.x); // 5
	 * console.log(player.x === room.x); // true
	 * ```
	 */
	get x() {
		return this._coordinates?.x;
	}

	/**
	 * Gets the Y coordinate (north-south position) of this movable object.
	 * Returns undefined if the object is not in a room.
	 *
	 * @returns The object's Y coordinate or undefined
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * const room = dungeon.getRoom({ x: 0, y: 3, z: 0 });
	 * room.add(player);
	 *
	 * console.log(player.y); // 3
	 * player.step(DIRECTION.NORTH);
	 * console.log(player.y); // 2
	 * ```
	 */
	get y() {
		return this._coordinates?.y;
	}

	/**
	 * Gets the Z coordinate (vertical level) of this movable object.
	 * Returns undefined if the object is not in a room.
	 *
	 * @returns The object's Z coordinate or undefined
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * const groundFloor = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * groundFloor.add(player);
	 *
	 * console.log(player.z); // 0
	 * if (player.canStep(DIRECTION.UP)) {
	 *   player.step(DIRECTION.UP);
	 *   console.log(player.z); // 1
	 * }
	 * ```
	 */
	get z() {
		return this._coordinates?.z;
	}

	/**
	 * Gets the room adjacent to this movable object's current position in the specified direction.
	 * Returns undefined if the object is not in a room or if there is no room in that direction.
	 *
	 * @param dir The direction to check
	 * @returns The adjacent room or undefined
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * const room = dungeon.getRoom({ x: 1, y: 1, z: 0 });
	 * room.add(player);
	 *
	 * const northRoom = player.getStep(DIRECTION.NORTH);
	 * if (northRoom) {
	 *   console.log("There's a room to the north");
	 * }
	 *
	 * // Check diagonal movement
	 * const neRoom = player.getStep(DIRECTION.NORTHEAST);
	 * console.log(neRoom === room.getStep(DIRECTION.NORTHEAST)); // true
	 * ```
	 */
	getStep(dir: DIRECTION) {
		if (!(this.location instanceof Room)) return;
		return this.location.getStep(dir);
	}

	/**
	 * Checks if this object can move in the specified direction.
	 * Movement is allowed only if:
	 * - The object is in a room
	 * - There is a room in the target direction
	 * - The current room allows exit in that direction
	 * - The target room allows entry from that direction
	 *
	 * @param dir The direction to check
	 * @returns true if movement is allowed, false otherwise
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * const startRoom = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * startRoom.add(player);
	 *
	 * // Check before moving
	 * if (player.canStep(DIRECTION.EAST)) {
	 *   console.log("You can move east");
	 * } else {
	 *   console.log("You can't go that way");
	 * }
	 *
	 * // Check combined directions
	 * if (player.canStep(DIRECTION.NORTHEAST)) {
	 *   console.log("You can move northeast");
	 * }
	 * ```
	 */
	canStep(dir: DIRECTION): boolean {
		if (!(this.location instanceof Room)) return false;
		const exit = this.getStep(dir);
		if (!exit) return false;
		if (!this.location.canExit(this, dir)) return false;
		if (!exit.canEnter(this, dir2reverse(dir))) return false;
		return true;
	}

	/**
	 * Moves this object one room in the specified direction.
	 * The move only occurs if canStep() returns true for that direction.
	 * Triggers appropriate exit/enter events on both rooms.
	 *
	 * @param dir The direction to move
	 * @returns true if the move was successful, false otherwise
	 *
	 * @example
	 * ```typescript
	 * const player = new Movable();
	 * player.keywords = "player adventurer";
	 * const startRoom = dungeon.getRoom({ x: 1, y: 1, z: 0 });
	 * startRoom.add(player);
	 *
	 * // Basic movement
	 * if (player.step(DIRECTION.NORTH)) {
	 *   console.log("Moved north successfully");
	 * }
	 *
	 * // Complex movement with room events
	 * class GuardedRoom extends Room {
	 *   onEnter(movable: Movable) {
	 *     console.log("A guard watches you enter...");
	 *   }
	 *   onExit(movable: Movable) {
	 *     console.log("The guard nods as you leave.");
	 *   }
	 * }
	 * ```
	 */
	step(dir: DIRECTION): boolean {
		if (!this.canStep(dir)) return false;
		const exit = this.getStep(dir);
		if (this.location instanceof Room) this.location.onExit(this, dir);
		this.move(exit);
		if (this.location instanceof Room)
			this.location.onEnter(this, dir2reverse(dir));
		return true;
	}
}

/**
 * These are objects that are intended to occupy rooms but not much else.
 * They will be used to generate extra descriptions for the room, or they might
 * be a sign that is in the room that can be read.
 */
export class Prop extends DungeonObject {
	/**
	 * Deserialize a SerializedProp into a Prop instance.
	 */
	public static deserialize(data: SerializedProp): Prop {
		const prop = new Prop(data);
		if (data.contents && Array.isArray(data.contents)) {
			for (const contentData of data.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				prop.add(contentObj);
			}
		}
		return prop;
	}
}

/**
 * These are mobs. They get into fights, interact with stuff, and die.
 */
export class Mob extends Movable {
	/** Private storage for the Character reference */
	private _character?: Character;

	/**
	 * Gets the Character that controls this mob (if any).
	 * @returns The Character instance or undefined for NPCs
	 */
	public get character(): Character | undefined {
		return this._character;
	}

	/**
	 * Sets the Character that controls this mob and establishes bidirectional reference.
	 * @param char The Character instance to associate with this mob
	 */
	public set character(char: Character | undefined) {
		if (this.character === char) return;
		const ochar = this.character;
		this._character = char;

		// If we're clearing or there was no change for the new character, still detach previous owner
		if (ochar && ochar.mob === this) {
			ochar.mob = new Mob();
		}

		// Ensure the new character points to this mob
		if (char && char.mob !== this) {
			char.mob = this;
		}
	}

	/**
	 * Send text to the controlling character's client, if any.
	 */
	public send(text: string): void {
		this.character?.send(text);
	}

	/**
	 * Send a line to the controlling character's client, if any.
	 */
	public sendLine(text: string): void {
		this.character?.sendLine(text);
	}

	public sendMessage(text: string, group: MESSAGE_GROUP) {
		this.character?.sendMessage(text, group);
	}

	/**
	 * Deserialize a SerializedMob into a Mob instance.
	 */
	public static deserialize(data: SerializedMob): Mob {
		const mob = new Mob(data);
		if (data.contents && Array.isArray(data.contents)) {
			for (const contentData of data.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				mob.add(contentObj);
			}
		}
		return mob;
	}
}

/**
 * There are items. They are the things that mobs pick up, equip, use, drop, throw, etc.
 */
export class Item extends Movable {
	/**
	 * Deserialize a SerializedItem into an Item instance.
	 */
	public static deserialize(data: SerializedItem): Item {
		const item = new Item(data);
		if (data.contents && Array.isArray(data.contents)) {
			for (const contentData of data.contents) {
				const contentObj = DungeonObject.deserialize(contentData);
				item.add(contentObj);
			}
		}
		return item;
	}
}

/**
 * Global registry of created RoomLink instances.
 *
 * This array is intentionally module-level so the application can iterate
 * and persist links across dungeons. Links created by `RoomLink.createTunnel`
 * are pushed here; `RoomLink.remove()` removes links from this array.
 */
export const ROOM_LINKS: RoomLink[] = [];

/**
 * Represents a bidirectional portal between two rooms.
 * Links override normal spatial relationships to connect arbitrary rooms.
 *
 * @example
 * ```typescript
 * import { Dungeon, RoomLink, DIRECTION } from "./dungeon.js";
 *
 * const midgar = Dungeon.generateEmptyDungeon({ dimensions: { width: 6, height: 6, layers: 1 } });
 * const sector7 = Dungeon.generateEmptyDungeon({ dimensions: { width: 1, height: 1, layers: 1 } });
 * const midgarRoom = midgar.getRoom({ x: 5, y: 5, z: 0 })!;
 * const sectorRoom = sector7.getRoom({ x: 0, y: 0, z: 0 })!;
 *
 * RoomLink.createTunnel(midgarRoom, DIRECTION.NORTH, sectorRoom);
 *
 * // The rooms are now connected via these directions
 * console.log(midgarRoom.getStep(DIRECTION.NORTH) === sectorRoom); // true
 * console.log(sectorRoom.getStep(DIRECTION.SOUTH) === midgarRoom); // true
 * ```
 */
export class RoomLink {
	/**
	 * The originating endpoint for this link.
	 *
	 * Contains the source `room` instance and the `direction` (a DIRECTION
	 * flag) that, when used with Room.getStep() from that room, should resolve
	 * to the other endpoint. This property is private and intended for use
	 * only by the RoomLink implementation and the Room class (via
	 * addLink/removeLink).
	 *
	 * Example: `{ room: roomA, direction: DIRECTION.NORTH }` means "from
	 * roomA moving NORTH you arrive at the other endpoint".
	 * @private
	 */
	private _from: { room: Room; direction: DIRECTION };

	/**
	 * The destination endpoint for this link.
	 *
	 * Contains the target `room` and the `direction` on the target room that
	 * represents the return traversal (the reverse direction). For two-way
	 * links the Room.getStep() call on the destination room using this
	 * direction will resolve back to the originating room.
	 * @private
	 */
	private _to: { room: Room; direction: DIRECTION };

	/**
	 * When true the link only functions in the `from` -> `to` direction.
	 *
	 * A one-way link will be registered only on the `_from.room` so calls to
	 * `getStep()` on the `_to.room` will not consider this link when resolving
	 * movements. The flag is private and set at construction time.
	 * @private
	 */
	private _oneWay: boolean = false;

	/**
	 * Create a RoomLink instance.
	 *
	 * Note: the constructor only initialises the link state and DOES NOT
	 * register the link with either room. This keeps `new RoomLink(...)` free
	 * of side-effects. Use `RoomLink.createTunnel(...)` which will construct
	 * the link and register it with the rooms (registering the `_to` room is
	 * skipped for one-way links).
	 *
	 * @param options.from.room The originating Room instance
	 * @param options.from.direction The direction on the originating room that leads to the destination
	 * @param options.to.room The destination Room instance
	 * @param options.to.direction The (reverse) direction on the destination room that leads back to the origin
	 * @param options.oneWay When true the link is one-way (from -> to only)
	 *
	 * @remarks
	 * The constructor accepts explicit from/to directions. The `createTunnel`
	 * factory provides a more ergonomic API and will infer the reverse
	 * direction automatically; the constructor remains available for internal
	 * or advanced usage where callers want to control both endpoints explicitly.
	 */
	private constructor(options: {
		from: { room: Room; direction: DIRECTION };
		to: { room: Room; direction: DIRECTION };
		oneWay?: boolean;
	}) {
		this._from = options.from;
		this._to = options.to;
		this._oneWay = !!options.oneWay;
	}

	/**
	 * Create and register a RoomLink between two rooms.
	 *
	 * This factory is the recommended way to create links because it performs
	 * the necessary registration with the provided Room instances and infers
	 * the reverse direction automatically. It never mutates the rooms in a way
	 * that breaks invariants: the link is added to the `_from.room` and,
	 * unless `oneWay` is true, also to the `_to.room`.
	 *
	 * @param fromRoom The room which will act as the source endpoint
	 * @param direction The direction (on `fromRoom`) that will lead to `toRoom`
	 * @param toRoom The room which will act as the destination endpoint
	 * @param oneWay When true only `fromRoom` will register the link; traversal back from `toRoom` will not use this link
	 * @returns The created RoomLink instance (already registered on the appropriate rooms)
	 *
	 * @example
	 * // Two-way link: moving NORTH from roomA goes to roomB, and moving SOUTH from roomB returns to roomA
	 * const link = RoomLink.createTunnel(roomA, DIRECTION.NORTH, roomB);
	 *
	 * @example
	 * // One-way link: moving EAST from roomA goes to roomB, but moving WEST from roomB does not return to roomA
	 * const oneWay = RoomLink.createTunnel(roomA, DIRECTION.EAST, roomB, true);
	 */
	static createTunnel(
		fromRoom: Room,
		direction: DIRECTION,
		toRoom: Room,
		oneWay: boolean = false
	) {
		// infer the reverse direction automatically
		const reverse = dir2reverse(direction);

		const link = new RoomLink({
			from: { room: fromRoom, direction },
			to: { room: toRoom, direction: reverse },
			oneWay,
		});

		// Register with the "from" room always
		link._from.room.addLink(link);
		// Register with the "to" room only for two-way links
		if (!link._oneWay) link._to.room.addLink(link);
		// Register in the global link registry for persistence/inspection
		ROOM_LINKS.push(link);

		const fromRef =
			fromRoom.getRoomRef() || `${fromRoom.x},${fromRoom.y},${fromRoom.z}`;
		const toRef = toRoom.getRoomRef() || `${toRoom.x},${toRoom.y},${toRoom.z}`;
		const dirText = dir2text(direction);
		logger.debug(
			`Created ${
				oneWay ? "one-way" : "bidirectional"
			} room link: ${fromRef} ${dirText} -> ${toRef}`
		);

		return link;
	}

	/**
	 * Resolve the linked destination when moving from `fromRoom` in `direction`.
	 *
	 * The Room class calls this method while evaluating `getStep()` so it can
	 * discover linked rooms that override spatial adjacency. The resolution
	 * rules are straightforward:
	 * - If `fromRoom` matches the link's `_from.room` and `direction` equals
	 *   `_from.direction`, return `_to.room`.
	 * - If the link is two-way and `fromRoom` matches `_to.room` with
	 *   `direction === _to.direction`, return `_from.room`.
	 * - Otherwise return `undefined` to indicate this link does not handle the
	 *   requested traversal.
	 *
	 * This method does not perform permission checks (canEnter/canExit) - it
	 * only resolves spatial/linked connectivity. Permission checks are done
	 * by the calling code (e.g., Movable.canStep).
	 *
	 * @param fromRoom The room where traversal begins
	 * @param direction The direction of traversal
	 * @returns The destination `Room` if this link handles the traversal, otherwise `undefined`
	 */
	getDestination(fromRoom: Room, direction: DIRECTION): Room | undefined {
		// Check from -> to
		if (fromRoom === this._from.room && direction === this._from.direction) {
			return this._to.room;
		}
		// Check to -> from (only if link is not one-way)
		if (
			!this._oneWay &&
			fromRoom === this._to.room &&
			direction === this._to.direction
		) {
			return this._from.room;
		}
		return undefined;
	}

	/**
	 * Remove this link from both connected rooms.
	 *
	 * This method detaches the link from any room that currently has it. The
	 * operation is idempotent and safe to call multiple times: `removeLink`
	 * on the rooms will simply ignore links that are not present.
	 *
	 * After calling `remove()` there are no references to this link left in
	 * the connected rooms' _links arrays, but the RoomLink object itself is
	 * not modified further - callers may keep or discard the instance as they
	 * wish.
	 */
	remove() {
		const fromRef =
			this._from.room.getRoomRef() ||
			`${this._from.room.x},${this._from.room.y},${this._from.room.z}`;
		const toRef =
			this._to.room.getRoomRef() ||
			`${this._to.room.x},${this._to.room.y},${this._to.room.z}`;
		const dirText = dir2text(this._from.direction);
		logger.debug(
			`Removing ${
				this._oneWay ? "one-way" : "bidirectional"
			} room link: ${fromRef} ${dirText} -> ${toRef}`
		);

		// Remove from connected rooms
		this._from.room.removeLink(this);
		this._to.room.removeLink(this);

		// Remove from the global registry if present
		const index = ROOM_LINKS.indexOf(this);
		if (index !== -1) ROOM_LINKS.splice(index, 1);
	}
}
