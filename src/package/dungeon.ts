/**
 * Package: dungeon - YAML persistence for Dungeons
 *
 * Persists `Dungeon` instances to `data/dungeons/<id>.yaml` and
 * restores them back, using a grid-based template system.
 *
 * Behavior
 * - Filenames are derived from the dungeon's id
 * - On save, directories are created as needed; YAML is written without
 *   references and with a wide line width for readability
 * - On load, returns `undefined` if the dungeon file doesn't exist
 * - Uses atomic writes (temp file + rename) to prevent corruption
 *
 * Format
 * - Dungeons are saved with a grid representation where each cell contains
 *   a number (0 = empty, 1+ = room template index)
 * - Room templates are stored in a `rooms` array and referenced by 1-based index
 * - Only differential fields are stored in templates (as per template system)
 *
 * @example
 * import dungeonPkg, { saveDungeon, loadDungeon } from './package/dungeon.js';
 * import { Dungeon } from '../dungeon.js';
 * await dungeonPkg.loader();
 * const dungeon = Dungeon.generateEmptyDungeon({ id: "test", dimensions: { width: 5, height: 5, layers: 1 } });
 * await saveDungeon(dungeon);
 * const reloaded = await loadDungeon("test");
 *
 * @module package/dungeon
 */
import { join, relative } from "path";
import {
	mkdir,
	readFile,
	writeFile,
	access,
	readdir,
	rename,
	unlink,
} from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import {
	Dungeon,
	Room,
	MapDimensions,
	Coordinates,
	DungeonObjectTemplate,
	RoomTemplate,
	DIRECTION,
	Reset,
	ResetOptions,
	DUNGEON_REGISTRY,
} from "../dungeon.js";
import YAML from "js-yaml";
import { Package } from "package-loader";
import { setAbsoluteInterval, clearCustomInterval } from "accurate-intervals";

const DUNGEON_DIR = join(process.cwd(), "data", "dungeons");

/**
 * Serialized reset format (for YAML persistence).
 * Only includes fields that differ from defaults (minCount=1, maxCount=1).
 */
export interface SerializedReset {
	templateId: string;
	roomRef: string;
	minCount?: number;
	maxCount?: number;
}

/**
 * Serialized dungeon format structure.
 */
export interface SerializedDungeonFormat {
	dungeon: {
		id?: string;
		dimensions: MapDimensions;
		grid: number[][][]; // [z][y][x] - layers, rows, columns
		rooms: Array<Omit<RoomTemplate, "id" | "type">>; // Room templates without id/type
		templates?: DungeonObjectTemplate[]; // Optional array of object templates (for resets)
		resets?: SerializedReset[]; // Optional array of resets
		resetMessage?: string;
	};
}

function sanitizeDungeonId(id: string): string {
	// Allow alphanumerics, underscore, hyphen. Replace others with underscore.
	return id
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/gi, "_");
}

function getDungeonFilePath(id: string): string {
	const safe = sanitizeDungeonId(id);
	return join(DUNGEON_DIR, `${safe}.yaml`);
}

async function ensureDir(): Promise<void> {
	try {
		await access(DUNGEON_DIR, FS_CONSTANTS.F_OK);
	} catch {
		await mkdir(DUNGEON_DIR, { recursive: true });
		logger.debug(
			`Created dungeon directory: ${relative(process.cwd(), DUNGEON_DIR)}`
		);
	}
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, FS_CONSTANTS.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Save a dungeon to disk using atomic write (temp file + rename).
 * This prevents corruption if the process is killed during the write.
 *
 * @param dungeon - The dungeon to save
 */
export async function saveDungeon(dungeon: Dungeon): Promise<void> {
	if (!dungeon.id) {
		throw new Error("Cannot save dungeon without an id");
	}

	await ensureDir();

	const filePath = getDungeonFilePath(dungeon.id);
	const tempPath = `${filePath}.tmp`;

	// Build room templates list by collecting unique room templates
	const roomTemplates: Array<Omit<RoomTemplate, "id" | "type">> = [];
	const roomToTemplateIndex = new Map<Room, number>(); // Maps room to its 1-based template index

	// Iterate through all rooms and collect unique templates
	for (let z = 0; z < dungeon.dimensions.layers; z++) {
		for (let y = 0; y < dungeon.dimensions.height; y++) {
			for (let x = 0; x < dungeon.dimensions.width; x++) {
				const room = dungeon.getRoom({ x, y, z });
				if (!room) continue;

				// Check if we've seen this template before
				let templateIndex = roomToTemplateIndex.get(room);
				if (templateIndex === undefined) {
					// Create template from room (without id/type)
					const fullTemplate = room.toTemplate("") as RoomTemplate; // We'll strip id/type
					const template: Omit<RoomTemplate, "id" | "type"> = {};
					if (fullTemplate.keywords !== undefined) {
						template.keywords = fullTemplate.keywords;
					}
					if (fullTemplate.display !== undefined) {
						template.display = fullTemplate.display;
					}
					if (fullTemplate.description !== undefined) {
						template.description = fullTemplate.description;
					}
					if (fullTemplate.allowedExits !== undefined) {
						template.allowedExits = fullTemplate.allowedExits;
					}
					// Note: baseWeight is not included for rooms

					// Check if this template already exists in our list
					templateIndex = roomTemplates.findIndex((t) => {
						return (
							t.keywords === template.keywords &&
							t.display === template.display &&
							t.description === template.description &&
							t.allowedExits === template.allowedExits
						);
					});

					if (templateIndex === -1) {
						// New template - add it
						templateIndex = roomTemplates.length;
						roomTemplates.push(template);
					}

					// Store mapping (convert to 1-based)
					roomToTemplateIndex.set(room, templateIndex + 1);
				}
			}
		}
	}

	// Build grid
	const grid: number[][][] = [];
	for (let z = 0; z < dungeon.dimensions.layers; z++) {
		const layer: number[][] = [];
		for (let y = 0; y < dungeon.dimensions.height; y++) {
			const row: number[] = [];
			for (let x = 0; x < dungeon.dimensions.width; x++) {
				const room = dungeon.getRoom({ x, y, z });
				if (room) {
					const templateIndex = roomToTemplateIndex.get(room);
					if (templateIndex === undefined) {
						throw new Error(
							`Room at ${x},${y},${z} not found in template index map`
						);
					}
					row.push(templateIndex);
				} else {
					row.push(0);
				}
			}
			layer.push(row);
		}
		grid.push(layer);
	}
	// Reverse the grid so that top floor appears first in YAML files
	const reversedGrid = [...grid].reverse();

	// Serialize resets (only include if there are any)
	const resets: SerializedReset[] = [];
	for (const reset of dungeon.resets) {
		const serialized: SerializedReset = {
			templateId: reset.templateId,
			roomRef: reset.roomRef,
		};
		// Only include minCount/maxCount if they differ from defaults (1)
		if (reset.minCount !== 1) {
			serialized.minCount = reset.minCount;
		}
		if (reset.maxCount !== 1) {
			serialized.maxCount = reset.maxCount;
		}
		resets.push(serialized);
	}

	// Serialize templates referenced by resets
	const templates: DungeonObjectTemplate[] = [];
	const templateIds = new Set<string>();
	for (const reset of dungeon.resets) {
		templateIds.add(reset.templateId);
	}
	for (const templateId of templateIds) {
		const template = dungeon.templates.get(templateId);
		if (template) {
			templates.push(template);
		} else {
			logger.warn(
				`Template "${templateId}" referenced by reset not found in dungeon's template registry`
			);
		}
	}

	const data: SerializedDungeonFormat = {
		dungeon: {
			id: dungeon.id,
			dimensions: dungeon.dimensions,
			grid: reversedGrid,
			rooms: roomTemplates,
			...(templates.length > 0 && { templates }),
			...(resets.length > 0 && { resets }),
			...(dungeon.resetMessage ? { resetMessage: dungeon.resetMessage } : {}),
		},
	};

	const yaml = YAML.dump(data as any, {
		noRefs: true,
		lineWidth: 120,
	});

	try {
		// Write to temporary file first
		await writeFile(tempPath, yaml, "utf-8");
		// Atomically rename temp file to final location
		await rename(tempPath, filePath);

		logger.debug(
			`Saved dungeon: ${relative(process.cwd(), filePath)} for ${dungeon.id}`
		);
	} catch (error) {
		// Clean up temp file if it exists
		try {
			await unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}

/**
 * Load a dungeon from disk.
 * Returns undefined if the dungeon file doesn't exist.
 */
export async function loadDungeon(id: string): Promise<Dungeon | undefined> {
	const filePath = getDungeonFilePath(id);

	const hasFile = await fileExists(filePath);

	if (!hasFile) {
		return undefined;
	}

	try {
		logger.debug(`Loading dungeon from ${relative(process.cwd(), filePath)}`);
		const content = await readFile(filePath, "utf-8");
		const data = YAML.load(content) as SerializedDungeonFormat;

		if (!data.dungeon) {
			throw new Error("Invalid dungeon format: missing 'dungeon' key");
		}

		const { dimensions, grid, rooms, templates, resets, resetMessage } =
			data.dungeon;

		// Validate dimensions
		if (
			!dimensions ||
			!dimensions.width ||
			!dimensions.height ||
			!dimensions.layers
		) {
			throw new Error("Invalid dungeon format: missing or invalid dimensions");
		}

		// Validate grid
		if (!grid || !Array.isArray(grid)) {
			throw new Error("Invalid dungeon format: missing or invalid grid");
		}

		if (grid.length !== dimensions.layers) {
			throw new Error(
				`Invalid dungeon format: grid has ${grid.length} layers but dimensions specify ${dimensions.layers}`
			);
		}

		// Validate rooms array
		if (!rooms || !Array.isArray(rooms)) {
			throw new Error("Invalid dungeon format: missing or invalid rooms array");
		}

		// Create dungeon
		const dungeon = new Dungeon({
			id: data.dungeon.id || id,
			dimensions,
			resetMessage,
		});

		// Create rooms from grid
		// Reverse the grid array so that YAML files can have top floor first
		// but we still assign correct z-coordinates (z=0 is ground floor)
		const reversedGrid = [...grid].reverse();
		for (let z = 0; z < reversedGrid.length; z++) {
			const layer = reversedGrid[z];
			if (!Array.isArray(layer)) {
				throw new Error(
					`Invalid dungeon format: grid layer ${z} is not an array`
				);
			}

			if (layer.length !== dimensions.height) {
				throw new Error(
					`Invalid dungeon format: grid layer ${z} has ${layer.length} rows but dimensions specify ${dimensions.height}`
				);
			}

			for (let y = 0; y < layer.length; y++) {
				const row = layer[y];
				if (!Array.isArray(row)) {
					throw new Error(
						`Invalid dungeon format: grid layer ${z}, row ${y} is not an array`
					);
				}

				if (row.length !== dimensions.width) {
					throw new Error(
						`Invalid dungeon format: grid layer ${z}, row ${y} has ${row.length} columns but dimensions specify ${dimensions.width}`
					);
				}

				for (let x = 0; x < row.length; x++) {
					const templateIndex = row[x];
					if (templateIndex === 0) {
						// Empty cell - skip
						continue;
					}

					// Convert 1-based index to 0-based
					const templateArrayIndex = templateIndex - 1;
					if (templateArrayIndex < 0 || templateArrayIndex >= rooms.length) {
						throw new Error(
							`Invalid dungeon format: template index ${templateIndex} is out of range (rooms array has ${rooms.length} templates)`
						);
					}

					const roomTemplate = rooms[templateArrayIndex];
					if (!roomTemplate) {
						throw new Error(
							`Invalid dungeon format: template at index ${templateArrayIndex} is undefined`
						);
					}

					// Create full template with type (required by Room.createFromTemplate)
					const fullTemplate: RoomTemplate = {
						id: "", // Not used, but required by interface
						type: "Room",
						...roomTemplate,
					};

					// Create room from template
					const room = Room.createFromTemplate(fullTemplate, { x, y, z });

					// Add room to dungeon
					if (!dungeon.addRoom(room)) {
						throw new Error(`Failed to add room at coordinates ${x},${y},${z}`);
					}
				}
			}
		}

		// Load templates if present
		if (templates && Array.isArray(templates)) {
			for (const template of templates) {
				if (!template.id) {
					logger.warn(
						`Skipping invalid template in dungeon "${id}": missing id`
					);
					continue;
				}
				dungeon.addTemplate(template);
			}
		}

		// Load resets if present
		if (resets && Array.isArray(resets)) {
			for (const resetData of resets) {
				if (!resetData.templateId || !resetData.roomRef) {
					logger.warn(
						`Skipping invalid reset in dungeon "${id}": missing templateId or roomRef`
					);
					continue;
				}

				const reset = new Reset({
					templateId: resetData.templateId,
					roomRef: resetData.roomRef,
					minCount: resetData.minCount ?? 1,
					maxCount: resetData.maxCount ?? 1,
				});
				dungeon.addReset(reset);
			}
		}

		logger.debug(
			`Successfully loaded dungeon "${id}" from ${relative(
				process.cwd(),
				filePath
			)}${
				resets && resets.length > 0 ? ` with ${resets.length} reset(s)` : ""
			}${
				templates && templates.length > 0
					? ` and ${templates.length} template(s)`
					: ""
			}`
		);
		return dungeon;
	} catch (error) {
		logger.error(`Failed to load dungeon ${id}: ${error}`);
		return undefined;
	}
}

/**
 * Check if a dungeon exists.
 */
export async function dungeonExists(id: string): Promise<boolean> {
	const filePath = getDungeonFilePath(id);
	return fileExists(filePath);
}

/**
 * Get all dungeon IDs from disk.
 * Looks for YAML files in the dungeons directory.
 */
export async function getAllDungeonIds(): Promise<string[]> {
	await ensureDir();
	try {
		const files = await readdir(DUNGEON_DIR);
		const dungeonIds: string[] = [];

		for (const file of files) {
			if (file.endsWith(".yaml")) {
				// Extract dungeon ID from filename
				const id = file.replace(/\.yaml$/, "");
				dungeonIds.push(id);
			}
		}

		return dungeonIds;
	} catch (error) {
		logger.error(`Failed to read dungeons directory: ${error}`);
		return [];
	}
}

/**
 * Load all dungeons from disk.
 */
export async function loadDungeons(): Promise<Dungeon[]> {
	const ids = await getAllDungeonIds();
	logger.debug(`Found ${ids.length} dungeon file(s) to load`);
	const dungeons: Dungeon[] = [];

	for (const id of ids) {
		const dungeon = await loadDungeon(id);
		if (dungeon) {
			dungeons.push(dungeon);
		} else {
			logger.warn(`Failed to load dungeon with id: ${id}`);
		}
	}

	return dungeons;
}

/**
 * Execute resets on all registered dungeons.
 */
export function executeAllDungeonResets(): void {
	let totalSpawned = 0;
	let dungeonCount = 0;

	for (const dungeon of DUNGEON_REGISTRY.values()) {
		const spawned = dungeon.executeResets();
		totalSpawned += spawned;
		dungeonCount++;
	}

	if (dungeonCount > 0) {
		logger.debug(
			`Dungeon reset cycle: ${dungeonCount} dungeon(s), ${totalSpawned} object(s) spawned`
		);
	}
}

export default {
	name: "dungeon",
	loader: async () => {
		await logger.block("dungeon", async () => {
			const dungeons = await loadDungeons();
			logger.info(
				`Dungeon persistence package loaded: ${dungeons.length} dungeon(s)`
			);
		});
	},
} as Package;
