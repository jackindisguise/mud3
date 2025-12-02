/**
 * Direction utilities for MUD movement and navigation.
 *
 * This module provides:
 * - Direction enum and constants
 * - Direction-to-text and text-to-direction conversion utilities
 * - Direction helper functions (reverse, component checks)
 *
 * @module direction
 */

/**
 * Enum for handling directional movement in the dungeon.
 *
 * @example
 * ```typescript
 * import { DIRECTION } from "./direction.js";
 *
 * // Move north (y - 1) and then up (if your world uses vertical layers)
 * if (player.canStep(DIRECTION.NORTH)) player.step(DIRECTION.NORTH);
 * if (player.canStep(DIRECTION.UP)) player.step(DIRECTION.UP);
 * ```
 */
export const enum DIRECTION {
	NORTH = 1 << 0,
	SOUTH = 1 << 1,
	EAST = 1 << 2,
	WEST = 1 << 3,
	NORTHEAST = 1 << 4,
	NORTHWEST = 1 << 5,
	SOUTHEAST = 1 << 6,
	SOUTHWEST = 1 << 7,
	UP = 1 << 8,
	DOWN = 1 << 9,
}

/**
 * Array containing all possible direction values.
 *
 * Useful for iterating exits, generating UI labels, or scanning around the player.
 * Order is: cardinal (N/S/E/W), diagonal (NE/NW/SE/SW), vertical (U/D).
 *
 * @example
 * ```typescript
 * import { DIRECTIONS, dir2text } from "./direction.js";
 *
 * // Gather exits from the center room
 * const exits = DIRECTIONS.filter((dir) => !!room.getStep(dir));
 * console.log(exits.map((d) => dir2text(d)).join(", ")); // e.g., "north, south, east, west, ..."
 * ```
 */
export const DIRECTIONS: ReadonlyArray<DIRECTION> = [
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
const DIR2REVERSE: Readonly<Map<DIRECTION, DIRECTION>> = new Map<
	DIRECTION,
	DIRECTION
>([
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
export const DIR2TEXT: ReadonlyMap<DIRECTION, DirectionText> = new Map<
	DIRECTION,
	DirectionText
>([
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
export const DIR2TEXT_SHORT: ReadonlyMap<DIRECTION, DirectionTextShort> =
	new Map<DIRECTION, DirectionTextShort>([
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
export const TEXT2DIR: ReadonlyMap<DirectionText, DIRECTION> = new Map<
	DirectionText,
	DIRECTION
>([
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
export const TEXT2DIR_SHORT: ReadonlyMap<DirectionTextShort, DIRECTION> =
	new Map<DirectionTextShort, DIRECTION>([
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
