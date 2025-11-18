#!/usr/bin/env node

/**
 * Analyzer script to convert ROM/MERC .are files to JSON format.
 * Preserves the same structure as the .are file for easier parsing.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ============================================================================
// Enums
// ============================================================================

export enum ResetType {
	MOBILE = "M",
	EQUIP = "E",
	GIVE = "G",
	OBJECT = "O",
	PUT = "P",
	DOOR = "D",
	RANDOMIZE = "R",
}

// Flag maps: letter code -> flag name
export const RESISTANCE_FLAG_MAP: Record<string, string> = {
	A: "SUMMON",
	B: "CHARM",
	C: "MAGIC",
	D: "WEAPON",
	E: "BASH",
	F: "PIERCE",
	G: "SLASH",
	H: "FIRE",
	I: "COLD",
	J: "LIGHTNING",
	K: "ACID",
	L: "POISON",
	M: "NEGATIVE",
	N: "HOLY",
	O: "ENERGY",
	P: "MENTAL",
	Q: "DISEASE",
	R: "DROWNING",
	S: "LIGHT",
	T: "SOUND",
	X: "WOOD",
	Y: "SILVER",
	Z: "IRON",
};

export const IMMUNITY_FLAG_MAP: Record<string, string> = {
	A: "SUMMON",
	B: "CHARM",
	C: "MAGIC",
	D: "WEAPON",
	E: "BASH",
	F: "PIERCE",
	G: "SLASH",
	H: "FIRE",
	I: "COLD",
	J: "LIGHTNING",
	K: "ACID",
	L: "POISON",
	M: "NEGATIVE",
	N: "HOLY",
	O: "ENERGY",
	P: "MENTAL",
	Q: "DISEASE",
	R: "DROWNING",
	S: "LIGHT",
	T: "SOUND",
	X: "WOOD",
	Y: "SILVER",
	Z: "IRON",
};

export const VULNERABILITY_FLAG_MAP: Record<string, string> = {
	A: "SUMMON",
	B: "CHARM",
	C: "MAGIC",
	D: "WEAPON",
	E: "BASH",
	F: "PIERCE",
	G: "SLASH",
	H: "FIRE",
	I: "COLD",
	J: "LIGHTNING",
	K: "ACID",
	L: "POISON",
	M: "NEGATIVE",
	N: "HOLY",
	O: "ENERGY",
	P: "MENTAL",
	Q: "DISEASE",
	R: "DROWNING",
	S: "LIGHT",
	T: "SOUND",
	X: "WOOD",
	Y: "SILVER",
	Z: "IRON",
};

export const FORM_FLAG_MAP: Record<string, string> = {
	A: "EDIBLE",
	B: "POISON",
	C: "MAGICAL",
	D: "INSTANT_DECAY",
	E: "OTHER",
	G: "ANIMAL",
	H: "SENTIENT",
	I: "UNDEAD",
	J: "CONSTRUCT",
	K: "MIST",
	L: "INTANGIBLE",
	M: "BIPED",
	N: "CENTAUR",
	O: "INSECT",
	P: "SPIDER",
	Q: "CRUSTACEAN",
	R: "WORM",
	S: "BLOB",
	V: "MAMMAL",
	W: "BIRD",
	X: "REPTILE",
	Y: "SNAKE",
	Z: "DRAGON",
	aa: "AMPHIBIAN",
	bb: "FISH",
	cc: "COLD_BLOOD",
};

// Direction map: ROM direction code -> readable direction name
// Based on merc.h: DIR_NORTH(0), DIR_EAST(1), DIR_SOUTH(2), DIR_WEST(3), DIR_UP(4), DIR_DOWN(5)
// .are format uses numbered D codes (D0-D5) and diagonal directions
export const DIRECTION_MAP: Record<string, string> = {
	// Numbered D codes map to DIR_ constants
	D0: "north", // DIR_NORTH = 0
	D1: "east", // DIR_EAST = 1
	D2: "south", // DIR_SOUTH = 2
	D3: "west", // DIR_WEST = 3
	D4: "up", // DIR_UP = 4
	D5: "down", // DIR_DOWN = 5
	// Diagonal directions
	NE: "northeast",
	NW: "northwest",
	SE: "southeast",
	SW: "southwest",
};

// ============================================================================
// Flag Conversion Functions
// ============================================================================

/**
 * Convert a flag string to an array of flag names using a map
 */
function parseFlags(
	flagString: string,
	flagMap: Record<string, string>
): string[] {
	if (!flagString || flagString === "0") {
		return [];
	}

	const flags: string[] = [];
	for (const char of flagString) {
		const upperChar = char.toUpperCase();
		const flagName = flagMap[upperChar];
		if (flagName) {
			flags.push(flagName);
		}
	}

	return flags;
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface AreaData {
	filename: string;
	areaName: string;
	description: string;
	minVnum: number;
	maxVnum: number;
}

export interface Mobile {
	vnum: number;
	keywords: string;
	shortDescription: string;
	longDescription: string;
	detailedDescription: string;
	race: string;
	actFlags: string;
	affectFlags: string;
	alignment: number;
	level: number;
	armorClass: number;
	hitroll: number;
	damageDice: string;
	damageBonus: string;
	damageType: string;
	saveModifiers: {
		pierce: number;
		bash: number;
		slash: number;
		exotic: number;
	};
	resistanceFlags: string[]; // Array of resistance flags (e.g., "SUMMON", "PIERCE")
	immunityFlags: string[]; // Array of immunity flags (e.g., "FIRE", "COLD")
	vulnerabilityFlags: string[]; // Array of vulnerability flags (e.g., "POISON")
	formFlags: string[]; // Array of form flags (e.g., "UNDEAD", "BIPED")
	defaultPosition: string;
	defaultPosition2: string;
	sex: string;
	gold: number;
	experience: number;
	size: string;
	material: number;
}

export interface ObjectExtraDescription {
	keywords: string;
	description: string;
}

export interface Object {
	vnum: number;
	keywords: string;
	shortDescription: string;
	longDescription: string;
	itemType: string;
	itemClass: string;
	extraFlags: string;
	wearFlags: string;
	value0: string;
	value1: string;
	value2: string;
	value3: string;
	value4: string;
	weight: number;
	cost: number;
	rent: number;
	material: string;
	extraDescriptions?: ObjectExtraDescription[];
}

export interface RoomExit {
	direction: string; // Readable direction name (e.g., "north", "east", "south", "west", "up", "down", "northeast", etc.)
	description: string;
	keyVnum: number;
	exitFlags: number;
	destVnum: number;
}

export interface RoomExtraDescription {
	keywords: string;
	description: string;
}

export interface Room {
	vnum: number;
	name: string;
	description: string;
	roomFlags: number;
	sectorType: string;
	healRate: number;
	exits: RoomExit[];
	extraDescriptions: RoomExtraDescription[];
}

export interface Reset {
	type: ResetType;
	ifFlag: number;
	limit: number;
	arg1: number;
	arg2: number;
	arg3: number;
	comment?: string;
}

export interface AreFile {
	area: AreaData;
	mobiles: Mobile[];
	objects: Object[];
	rooms: Room[];
	resets: Reset[];
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a tilde-terminated string from lines
 */
function parseTildeString(
	lines: string[],
	startIndex: number
): { value: string; nextIndex: number } {
	let result = "";
	let i = startIndex;

	while (i < lines.length) {
		const line = lines[i];
		// Check if line ends with ~ (tilde can be on same line or separate)
		if (line.trim().endsWith("~")) {
			// Remove the ~ and add to result
			const content = line.replace(/~$/, "").trim();
			if (content) {
				if (result) result += "\n";
				result += content;
			}
			return { value: result.trim(), nextIndex: i + 1 };
		}
		// Check if this is a standalone ~ line
		if (line.trim() === "~") {
			return { value: result.trim(), nextIndex: i + 1 };
		}
		if (result) result += "\n";
		result += line;
		i++;
	}

	return { value: result.trim(), nextIndex: i };
}

/**
 * Parse multi-line description (ends with ~ on blank line)
 */
function parseDescription(
	lines: string[],
	startIndex: number
): { value: string; nextIndex: number } {
	let result = "";
	let i = startIndex;
	let foundTilde = false;

	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === "~") {
			if (foundTilde) {
				// Second ~ means end of description
				return { value: result.trim(), nextIndex: i + 1 };
			}
			foundTilde = true;
		} else if (foundTilde && line.trim() === "") {
			// Blank line after ~ means end
			return { value: result.trim(), nextIndex: i + 1 };
		} else {
			if (result) result += "\n";
			result += line;
			foundTilde = false;
		}
		i++;
	}

	return { value: result.trim(), nextIndex: i };
}

/**
 * Parse AREA section
 */
function parseArea(lines: string[]): { area: AreaData; nextIndex: number } {
	let i = 0;

	// Find #AREA section
	while (i < lines.length && lines[i].trim() !== "#AREA") {
		i++;
	}

	if (i >= lines.length) {
		throw new Error("Expected #AREA section");
	}
	i++;

	const filename = parseTildeString(lines, i);
	i = filename.nextIndex;

	const areaName = parseTildeString(lines, i);
	i = areaName.nextIndex;

	const description = parseTildeString(lines, i);
	i = description.nextIndex;

	// Skip blank line
	if (i < lines.length && lines[i].trim() === "") {
		i++;
	}

	const vnumRange = lines[i].trim().split(/\s+/);
	const minVnum = parseInt(vnumRange[0], 10);
	const maxVnum = parseInt(vnumRange[1], 10);
	i++;

	// Skip blank line
	if (i < lines.length && lines[i].trim() === "") {
		i++;
	}

	return {
		area: {
			filename: filename.value,
			areaName: areaName.value,
			description: description.value,
			minVnum,
			maxVnum,
		},
		nextIndex: i,
	};
}

/**
 * Parse MOBILES section
 */
function parseMobiles(
	lines: string[],
	startIndex: number
): { mobiles: Mobile[]; nextIndex: number } {
	const mobiles: Mobile[] = [];
	let i = startIndex;

	// Find #MOBILES section
	while (i < lines.length && lines[i].trim() !== "#MOBILES") {
		i++;
	}

	if (i >= lines.length) {
		return { mobiles, nextIndex: startIndex };
	}
	i++;

	while (i < lines.length) {
		const line = lines[i].trim();

		// Check for section boundaries first (before vnum pattern)
		// This includes #0, #OBJECTS, #ROOMS, #RESETS, or any # followed by uppercase letters
		if (
			line === "#0" ||
			line === "#OBJECTS" ||
			line === "#ROOMS" ||
			line === "#RESETS" ||
			(line.startsWith("#") &&
				line.length > 1 &&
				/^[A-Z]/.test(line.substring(1)))
		) {
			// Don't advance i - leave it pointing to the section marker
			break;
		}

		// Check if this is a mobile vnum
		if (/^#\d+$/.test(line)) {
			const vnum = parseInt(line.substring(1), 10);
			i++;

			if (i >= lines.length) break;

			const keywords = parseTildeString(lines, i);
			i = keywords.nextIndex;

			if (i >= lines.length) break;

			const shortDescription = parseTildeString(lines, i);
			i = shortDescription.nextIndex;

			if (i >= lines.length) break;

			const longDescription = parseTildeString(lines, i);
			i = longDescription.nextIndex;

			if (i >= lines.length) break;

			const detailedDescription = parseTildeString(lines, i);
			i = detailedDescription.nextIndex;

			if (i >= lines.length) break;

			const race = parseTildeString(lines, i);
			i = race.nextIndex;

			if (i >= lines.length) break;

			// Parse stats line: <act flags> <affect flags> <alignment> <level>
			const statsLine = lines[i].trim().split(/\s+/);
			const actFlags = statsLine[0] || "";
			const affectFlags = statsLine[1] || "";
			const alignment = parseInt(statsLine[2] || "0", 10);
			const level = parseInt(statsLine[3] || "0", 10);
			i++;

			if (i >= lines.length) break;

			// Parse combat line: <armor class> <hitroll> <damage dice> <damage bonus> <damage type>
			const combatLine = lines[i].trim().split(/\s+/);
			const armorClass = parseInt(combatLine[0] || "0", 10);
			const hitroll = parseInt(combatLine[1] || "0", 10);
			const damageDice = combatLine[2] || "";
			const damageBonus = combatLine[3] || "";
			const damageType = combatLine[4] || "";
			i++;

			if (i >= lines.length) break;

			// Parse save modifiers: 4 values
			// Order matches AC types: AC_PIERCE(0), AC_BASH(1), AC_SLASH(2), AC_EXOTIC(3)
			const saveLine = lines[i].trim().split(/\s+/);
			const saveModifiers = {
				pierce: parseInt(saveLine[0] || "0", 10), // AC_PIERCE (index 0)
				bash: parseInt(saveLine[1] || "0", 10), // AC_BASH (index 1)
				slash: parseInt(saveLine[2] || "0", 10), // AC_SLASH (index 2)
				exotic: parseInt(saveLine[3] || "0", 10), // AC_EXOTIC (index 3)
			};
			i++;

			if (i >= lines.length) break;

			// Parse flags line: <resistance flags> <immunity flags> <vulnerability flags> <form flags>
			const flagsLine = lines[i].trim().split(/\s+/);
			const resistanceFlagsStr = flagsLine[0] || "";
			const immunityFlagsStr = flagsLine[1] || "";
			const vulnerabilityFlagsStr = flagsLine[2] || "";
			const formFlagsStr = flagsLine[3] || "";
			i++;

			// Convert flag strings to arrays using maps
			const resistanceFlags = parseFlags(
				resistanceFlagsStr,
				RESISTANCE_FLAG_MAP
			);
			const immunityFlags = parseFlags(immunityFlagsStr, IMMUNITY_FLAG_MAP);
			const vulnerabilityFlags = parseFlags(
				vulnerabilityFlagsStr,
				VULNERABILITY_FLAG_MAP
			);
			const formFlags = parseFlags(formFlagsStr, FORM_FLAG_MAP);

			if (i >= lines.length) break;

			// Parse position/sex/gold line: <default position> <default position> <sex> <gold>
			const posLine = lines[i].trim().split(/\s+/);
			const defaultPosition = posLine[0] || "";
			const defaultPosition2 = posLine[1] || "";
			const sex = posLine[2] || "";
			const gold = parseInt(posLine[3] || "0", 10);
			i++;

			if (i >= lines.length) break;

			// Parse experience/size/material line: <experience> <size> <material>
			const expLine = lines[i].trim().split(/\s+/);
			const experience = parseInt(expLine[0] || "0", 10);
			const size = expLine[1] || "";
			const material = parseInt(expLine[2] || "0", 10);
			i++;

			mobiles.push({
				vnum,
				keywords: keywords.value,
				shortDescription: shortDescription.value,
				longDescription: longDescription.value,
				detailedDescription: detailedDescription.value,
				race: race.value,
				actFlags,
				affectFlags,
				alignment,
				level,
				armorClass,
				hitroll,
				damageDice,
				damageBonus,
				damageType,
				saveModifiers,
				resistanceFlags,
				immunityFlags,
				vulnerabilityFlags,
				formFlags,
				defaultPosition,
				defaultPosition2,
				sex,
				gold,
				experience,
				size,
				material,
			});

			// After parsing a mobile, check if next line is a section boundary
			// This is critical - we need to check BEFORE the next loop iteration
			if (i < lines.length) {
				const nextLine = lines[i].trim();
				if (
					nextLine === "#0" ||
					nextLine === "#OBJECTS" ||
					nextLine === "#ROOMS" ||
					nextLine === "#RESETS"
				) {
					// Found section boundary - stop here
					break;
				}
			}
			// Continue to next iteration to check the line we just looked at
		} else if (
			line === "#0" ||
			line === "#OBJECTS" ||
			line === "#ROOMS" ||
			line === "#RESETS"
		) {
			// Hit section boundary
			break;
		} else if (line.startsWith("#") && line !== "#MOBILES") {
			// Hit next section
			break;
		} else {
			i++;
		}
	}

	return { mobiles, nextIndex: i };
}

/**
 * Parse OBJECTS section
 */
function parseObjects(
	lines: string[],
	startIndex: number
): { objects: Object[]; nextIndex: number } {
	const objects: Object[] = [];
	let i = startIndex;

	// Find #OBJECTS section
	while (i < lines.length && lines[i].trim() !== "#OBJECTS") {
		i++;
	}

	if (i >= lines.length) {
		return { objects, nextIndex: startIndex };
	}
	i++;

	while (i < lines.length) {
		const line = lines[i].trim();

		// Check for section terminator
		if (line === "#0") {
			i++;
			break;
		}

		// Check if this is an object vnum (must check before section check)
		if (/^#\d+$/.test(line)) {
			const vnum = parseInt(line.substring(1), 10);
			// Skip vnum 0 (section terminator)
			if (vnum === 0) {
				i++;
				break;
			}
			i++;

			if (i >= lines.length) break;

			const keywords = parseTildeString(lines, i);
			i = keywords.nextIndex;

			if (i >= lines.length) break;

			const shortDescription = parseTildeString(lines, i);
			i = shortDescription.nextIndex;

			if (i >= lines.length) break;

			const longDescription = parseTildeString(lines, i);
			i = longDescription.nextIndex;

			if (i >= lines.length) break;

			const itemType = parseTildeString(lines, i);
			i = itemType.nextIndex;

			if (i >= lines.length) break;

			// Parse item class and flags line: <item class> <extra flags> <wear flags> <value0> <value1> <value2> <value3> <value4>
			const classLine = lines[i].trim().split(/\s+/);
			const itemClass = classLine[0] || "";
			const extraFlags = classLine[1] || "";
			const wearFlags = classLine[2] || "";
			const value0 = classLine[3] || "";
			const value1 = classLine[4] || "";
			const value2 = classLine[5] || "";
			const value3 = classLine[6] || "";
			const value4 = classLine[7] || "";
			i++;

			if (i >= lines.length) break;

			// Parse weight/cost/rent/material line: <weight> <cost> <rent> <material>
			const weightLine = lines[i].trim().split(/\s+/);
			const weight = parseInt(weightLine[0] || "0", 10);
			const cost = parseInt(weightLine[1] || "0", 10);
			const rent = parseInt(weightLine[2] || "0", 10);
			const material = weightLine[3] || "";
			i++;

			// Check for extra description
			const extraDescriptions: ObjectExtraDescription[] = [];
			while (i < lines.length) {
				const currentLine = lines[i].trim();

				// Check if we hit the next object or section
				if (currentLine.startsWith("#") || currentLine === "S") {
					break;
				}

				// Check for extra description
				if (currentLine === "E") {
					i++;
					if (i >= lines.length) break;
					const extraKeywords = parseTildeString(lines, i);
					i = extraKeywords.nextIndex;
					if (i >= lines.length) break;
					const extraDesc = parseDescription(lines, i);
					i = extraDesc.nextIndex;

					extraDescriptions.push({
						keywords: extraKeywords.value,
						description: extraDesc.value,
					});
				} else {
					i++;
				}
			}

			objects.push({
				vnum,
				keywords: keywords.value,
				shortDescription: shortDescription.value,
				longDescription: longDescription.value,
				itemType: itemType.value,
				itemClass,
				extraFlags,
				wearFlags,
				value0,
				value1,
				value2,
				value3,
				value4,
				weight,
				cost,
				rent,
				material,
				extraDescriptions:
					extraDescriptions.length > 0 ? extraDescriptions : undefined,
			});
		} else if (line.startsWith("#") && line !== "#OBJECTS") {
			// Hit next section
			break;
		} else {
			i++;
		}
	}

	return { objects, nextIndex: i };
}

/**
 * Parse ROOMS section
 */
function parseRooms(
	lines: string[],
	startIndex: number
): { rooms: Room[]; nextIndex: number } {
	const rooms: Room[] = [];
	let i = startIndex;

	// Find #ROOMS section
	while (i < lines.length && lines[i].trim() !== "#ROOMS") {
		i++;
	}

	if (i >= lines.length) {
		return { rooms, nextIndex: startIndex };
	}
	i++;

	while (i < lines.length) {
		const line = lines[i].trim();

		// Check for section terminator
		if (line === "#0") {
			i++;
			break;
		}

		// Check if this is a room vnum (must check before section check)
		if (/^#\d+$/.test(line)) {
			const vnum = parseInt(line.substring(1), 10);
			// Skip vnum 0 (section terminator)
			if (vnum === 0) {
				i++;
				break;
			}
			i++;

			if (i >= lines.length) break;

			const roomName = parseTildeString(lines, i);
			i = roomName.nextIndex;

			if (i >= lines.length) break;

			const description = parseDescription(lines, i);
			i = description.nextIndex;

			if (i >= lines.length) break;

			// Room flags and sector type
			const flagsLine = lines[i].trim().split(/\s+/);
			const roomFlags = parseInt(flagsLine[0] || "0", 10);
			const sectorType = flagsLine[1] || "";
			const healRate = parseInt(flagsLine[2] || "0", 10);
			i++;

			// Parse exits
			const exits: RoomExit[] = [];
			const extraDescriptions: RoomExtraDescription[] = [];

			while (i < lines.length) {
				const currentLine = lines[i].trim();

				// Check if we hit the next room or section
				if (currentLine.startsWith("#") || currentLine === "S") {
					break;
				}

				// Check for extra description
				if (currentLine === "E") {
					i++;
					if (i >= lines.length) break;
					const extraKeywords = parseTildeString(lines, i);
					i = extraKeywords.nextIndex;
					if (i >= lines.length) break;
					const extraDesc = parseDescription(lines, i);
					i = extraDesc.nextIndex;

					extraDescriptions.push({
						keywords: extraKeywords.value,
						description: extraDesc.value,
					});
					continue;
				}

				// Check if this looks like a direction code (D0-D5 or diagonal)
				const dirMatch = currentLine.match(/^(D\d+|NE|NW|SE|SW)$/);
				if (dirMatch) {
					const dirCode = dirMatch[1];
					// Convert direction code to readable name
					const direction = DIRECTION_MAP[dirCode] || dirCode;
					i++;

					if (i >= lines.length) break;

					// Parse exit description
					const exitDesc = parseDescription(lines, i);
					i = exitDesc.nextIndex;

					// Parse exit data line (key vnum, exit flags, dest vnum)
					if (i < lines.length && lines[i].trim()) {
						const exitData = lines[i].trim().split(/\s+/);
						const keyVnum = parseInt(exitData[0] || "0", 10);
						const exitFlags = parseInt(exitData[1] || "-1", 10);
						const destVnum = parseInt(exitData[2] || "0", 10);
						i++;

						if (destVnum > 0) {
							exits.push({
								direction: direction,
								description: exitDesc.value,
								keyVnum,
								exitFlags,
								destVnum,
							});
						}
					} else {
						i++;
					}
				} else {
					i++;
				}
			}

			rooms.push({
				vnum,
				name: roomName.value,
				description: description.value,
				roomFlags,
				sectorType,
				healRate,
				exits,
				extraDescriptions,
			});
		} else if (line.startsWith("#") && line !== "#ROOMS") {
			// Hit next section
			break;
		} else {
			i++;
		}
	}

	return { rooms, nextIndex: i };
}

/**
 * Parse RESETS section
 */
function parseResets(
	lines: string[],
	startIndex: number
): { resets: Reset[]; nextIndex: number } {
	const resets: Reset[] = [];
	let i = startIndex;

	// Find #RESETS section
	while (i < lines.length && lines[i].trim() !== "#RESETS") {
		i++;
	}

	if (i >= lines.length) {
		return { resets, nextIndex: startIndex };
	}
	i++;

	while (i < lines.length) {
		const line = lines[i].trim();

		// Check if we hit the end marker
		if (line === "#$" || line === "S") {
			break;
		}

		// Check if we hit a new section
		if (line.startsWith("#") && line !== "#RESETS") {
			break;
		}

		// Skip empty lines
		if (!line) {
			i++;
			continue;
		}

		// Parse reset line
		// Format: <type> <if_flag> <limit> <arg1> <arg2> <arg3> [* <comment>]
		const parts = line.split(/\s+/);
		if (parts.length >= 6) {
			const typeStr = parts[0];
			// Convert string to ResetType enum
			const type = typeStr as ResetType;
			if (!Object.values(ResetType).includes(type)) {
				// Unknown type, skip or use as-is
				console.warn(`Unknown reset type: ${typeStr}`);
			}

			const ifFlag = parseInt(parts[1] || "0", 10);
			const limit = parseInt(parts[2] || "0", 10);
			const arg1 = parseInt(parts[3] || "0", 10);
			const arg2 = parseInt(parts[4] || "0", 10);
			const arg3 = parseInt(parts[5] || "0", 10);

			// Extract comment if present (after *)
			let comment: string | undefined;
			const commentIndex = line.indexOf("*");
			if (commentIndex !== -1) {
				comment = line.substring(commentIndex + 1).trim();
			}

			resets.push({
				type,
				ifFlag,
				limit,
				arg1,
				arg2,
				arg3,
				comment,
			});
		}

		i++;
	}

	return { resets, nextIndex: i };
}

/**
 * Main parsing function
 */
export function parseAreFile(filePath: string): AreFile {
	console.log(`Reading ${filePath}...`);
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split(/\r?\n/);

	console.log("Parsing AREA section...");
	const { area, nextIndex: areaNextIndex } = parseArea(lines);
	console.log(
		`  Area: ${area.areaName}, vnums: ${area.minVnum}-${area.maxVnum}`
	);

	console.log("Parsing MOBILES section...");
	const { mobiles, nextIndex: mobilesNextIndex } = parseMobiles(
		lines,
		areaNextIndex
	);
	console.log(`  Found ${mobiles.length} mobiles`);
	console.log(
		`  MOBILES ended at line ${mobilesNextIndex}: "${lines[
			mobilesNextIndex
		]?.trim()}"`
	);

	console.log("Parsing OBJECTS section...");
	// Skip past #0 if present
	let objectsStartIndex = mobilesNextIndex;
	if (
		objectsStartIndex < lines.length &&
		lines[objectsStartIndex].trim() === "#0"
	) {
		objectsStartIndex++; // Skip blank line after #0
		if (
			objectsStartIndex < lines.length &&
			lines[objectsStartIndex].trim() === ""
		) {
			objectsStartIndex++;
		}
	}
	console.log(
		`  Starting search from line ${objectsStartIndex}: "${lines[
			objectsStartIndex
		]?.trim()}"`
	);
	const { objects, nextIndex: objectsNextIndex } = parseObjects(lines, 0);
	console.log(`  Found ${objects.length} objects`);

	console.log("Parsing ROOMS section...");
	const { rooms, nextIndex: roomsNextIndex } = parseRooms(lines, 0);
	console.log(`  Found ${rooms.length} rooms`);

	console.log("Parsing RESETS section...");
	const { resets, nextIndex: resetsNextIndex } = parseResets(
		lines,
		roomsNextIndex
	);
	console.log(`  Found ${resets.length} resets`);

	return {
		area,
		mobiles,
		objects,
		rooms,
		resets,
	};
}

/**
 * Main function
 */
function main() {
	const filePath = process.argv[2] || "midgard.are";

	const areFile = parseAreFile(filePath);

	const outputPath = join(process.cwd(), filePath.replace(/\.are$/, ".json"));
	console.log(`Writing to ${outputPath}...`);

	const json = JSON.stringify(areFile, null, 2);
	writeFileSync(outputPath, json, "utf-8");

	console.log("Conversion complete!");
	console.log(`  Area: ${areFile.area.areaName}`);
	console.log(`  Mobiles: ${areFile.mobiles.length}`);
	console.log(`  Objects: ${areFile.objects.length}`);
	console.log(`  Rooms: ${areFile.rooms.length}`);
	console.log(`  Resets: ${areFile.resets.length}`);
}

// Run if executed directly
const scriptPath = new URL(import.meta.url).pathname;
const isMainModule =
	process.argv[1] === scriptPath ||
	process.argv[1]?.endsWith("analyze-are-file.ts");

if (isMainModule) {
	main();
}
