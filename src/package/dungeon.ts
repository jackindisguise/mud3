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
import archetypePkg from "./archetype.js";
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
	dir2text,
	text2dir,
	dir2reverse,
	DirectionText,
	RoomLink,
	getRoomByRef,
	getDungeonById,
} from "../dungeon.js";
import YAML from "js-yaml";
import { Package } from "package-loader";
import { setAbsoluteInterval, clearCustomInterval } from "accurate-intervals";
import { getSafeRootDirectory } from "../utils/path.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const DUNGEON_DIR = join(DATA_DIRECTORY, "dungeons");

/**
 * Pending room links to be processed after all dungeons are loaded.
 * Stores room coordinates and their roomLinks data.
 */
interface PendingRoomLink {
	roomRef: string; // Room reference for the source room
	direction: DirectionText; // Direction name
	targetRoomRef: string; // Room reference for the destination room
}

const pendingRoomLinks: PendingRoomLink[] = [];

/**
 * Serialized reset format (for YAML persistence).
 * Only includes fields that differ from defaults (minCount=1, maxCount=1).
 */
export interface SerializedReset {
	templateId: string;
	roomRef: string;
	minCount?: number;
	maxCount?: number;
	equipped?: string[];
	inventory?: string[];
}

/**
 * Serialized dungeon format structure.
 */
export interface SerializedDungeonFormat {
	dungeon: {
		id?: string;
		name?: string;
		description?: string;
		dimensions: MapDimensions;
		grid: number[][][]; // [z][y][x] - layers, rows, columns
		rooms: Array<Omit<RoomTemplate, "id" | "type">>; // Room templates without id/type
		templates?: DungeonObjectTemplate[]; // Optional array of object templates (for resets). In-file ids are local (no "@").
		resets?: SerializedReset[]; // Optional array of resets
		resetMessage?: string;
		exitOverrides?: Record<string, number>; // Dictionary: "x,y,z" -> allowedExits bitmask override
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
			`Created dungeon directory: ${relative(ROOT_DIRECTORY, DUNGEON_DIR)}`
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

function localizeTemplateId(
	globalOrLocalId: string,
	dungeonId: string
): string {
	// If already global and matches dungeon, strip prefix
	const m = globalOrLocalId.match(/^@([^:]+):(.+)$/);
	if (m) {
		const [, did, local] = m;
		return did === dungeonId ? local : globalOrLocalId;
	}
	return globalOrLocalId;
}

function globalizeTemplateId(
	globalOrLocalId: string,
	dungeonId: string
): string {
	// If missing '@', prefix with @<dungeonId>:
	if (!globalOrLocalId.includes("@")) {
		return `@${dungeonId}:${globalOrLocalId}`;
	}
	return globalOrLocalId;
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
		logger.debug(`Loading dungeon from ${relative(ROOT_DIRECTORY, filePath)}`);
		const content = await readFile(filePath, "utf-8");
		const data = YAML.load(content) as SerializedDungeonFormat;

		if (!data.dungeon) {
			throw new Error("Invalid dungeon format: missing 'dungeon' key");
		}

		const {
			dimensions,
			grid,
			rooms,
			templates,
			resets,
			resetMessage,
			name,
			description,
			exitOverrides,
		} = data.dungeon;

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
			name: name || data.dungeon.id || id,
			description,
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
					if (
						templateIndex === 0 ||
						templateIndex === null ||
						templateIndex === undefined ||
						isNaN(Number(templateIndex))
					) {
						// Empty cell - skip
						continue;
					}

					// Convert 1-based index to 0-based
					const templateArrayIndex = Number(templateIndex) - 1;
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

					const fullTemplate: RoomTemplate = {
						id: "", // Not used, but required by interface
						type: "Room",
						...roomTemplate,
						allowedExits:
							roomTemplate.allowedExits !== undefined
								? roomTemplate.allowedExits
								: DIRECTION.NORTH |
								  DIRECTION.SOUTH |
								  DIRECTION.EAST |
								  DIRECTION.WEST,
					};

					// Map YAML row index (top-first) to internal y coordinate (bottom-first)
					const targetY = dimensions.height - 1 - y;
					// Create room from template
					const room = Room.createFromTemplate(fullTemplate, {
						x,
						y,
						z,
					});

					// Apply exit override if present (before adding to dungeon)
					if (exitOverrides && typeof exitOverrides === "object") {
						const coordKey = `${x},${y},${z}`;
						const override = exitOverrides[coordKey];
						if (override !== undefined && typeof override === "number") {
							room.allowedExits = override;
						}
					}

					// Add room to dungeon
					if (!dungeon.addRoom(room)) {
						throw new Error(`Failed to add room at coordinates ${x},${y},${z}`);
					}

					// Collect roomLinks from template for later processing
					if (roomTemplate.roomLinks) {
						const roomRef = room.getRoomRef();
						if (roomRef) {
							for (const [directionText, targetRoomRef] of Object.entries(
								roomTemplate.roomLinks
							)) {
								pendingRoomLinks.push({
									roomRef,
									direction: directionText as DirectionText,
									targetRoomRef,
								});
							}
						}
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
				const hydrated: DungeonObjectTemplate = {
					...template,
					id: globalizeTemplateId(template.id, dungeon.id!),
				};
				dungeon.addTemplate(hydrated);
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
					templateId: globalizeTemplateId(resetData.templateId, dungeon.id!),
					roomRef: resetData.roomRef,
					minCount: resetData.minCount ?? 1,
					maxCount: resetData.maxCount ?? 1,
					equipped: resetData.equipped
						? resetData.equipped.map((id) =>
								globalizeTemplateId(id, dungeon.id!)
						  )
						: undefined,
					inventory: resetData.inventory
						? resetData.inventory.map((id) =>
								globalizeTemplateId(id, dungeon.id!)
						  )
						: undefined,
				});
				dungeon.addReset(reset);
			}
		}

		logger.debug(
			`Successfully loaded dungeon "${id}" from ${relative(
				ROOT_DIRECTORY,
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
 * Process all pending room links after all dungeons are loaded.
 * Detects bidirectional links and makes them two-way automatically.
 */
function processPendingRoomLinks(): void {
	if (pendingRoomLinks.length === 0) {
		logger.debug("No pending room links to process");
		return;
	}

	logger.debug(`Processing ${pendingRoomLinks.length} pending room link(s)`);

	// Track processed links to avoid duplicates
	const processedLinks = new Set<string>();
	let createdCount = 0;
	let skippedCount = 0;
	let oneWayCount = 0;
	let twoWayCount = 0;

	for (const pending of pendingRoomLinks) {
		logger.debug(
			`Processing room link: ${pending.roomRef} ${pending.direction} -> ${pending.targetRoomRef}`
		);

		const fromRoom = getRoomByRef(pending.roomRef);
		if (!fromRoom) {
			// Debug: check if dungeon exists
			const match = pending.roomRef.match(/^@([^{]+)\{(\d+),(\d+),(\d+)\}$/);
			if (match) {
				const [, dungeonId] = match;
				const dungeon = getDungeonById(dungeonId);
				logger.debug(
					`Source room lookup: dungeon "${dungeonId}" ${
						dungeon ? "exists" : "not found"
					}`
				);
			}
			logger.warn(
				`Failed to process room link: source room "${pending.roomRef}" not found`
			);
			continue;
		}

		const toRoom = getRoomByRef(pending.targetRoomRef);
		if (!toRoom) {
			logger.warn(
				`Failed to process room link: target room "${pending.targetRoomRef}" not found`
			);
			continue;
		}

		const direction = text2dir(pending.direction);
		if (!direction) {
			logger.warn(
				`Failed to process room link: invalid direction "${pending.direction}"`
			);
			continue;
		}

		// Create a unique key for this link (normalize by sorting room refs)
		const linkKey = `${pending.roomRef}:${pending.direction}:${pending.targetRoomRef}`;
		const reverseDirection = dir2reverse(direction);
		const reverseDirectionText = dir2text(reverseDirection);
		const reverseLinkKey = `${pending.targetRoomRef}:${reverseDirectionText}:${pending.roomRef}`;

		// Check if this link or its reverse has already been processed
		if (processedLinks.has(linkKey) || processedLinks.has(reverseLinkKey)) {
			// This is a duplicate or reverse of an already processed link
			// RoomLink.createTunnel already creates two-way links, so we skip the duplicate
			logger.debug(
				`Skipping duplicate room link: ${pending.roomRef} ${pending.direction} -> ${pending.targetRoomRef}`
			);
			skippedCount++;
			continue;
		}

		// Check if a reverse link exists in the pending list (bidirectional detection)
		// If both rooms have links pointing to each other, we'll create a two-way link
		const hasReverseLink = pendingRoomLinks.some(
			(p) =>
				p.roomRef === pending.targetRoomRef &&
				p.targetRoomRef === pending.roomRef &&
				p.direction === reverseDirectionText
		);

		// Determine if this should be a one-way or two-way link
		// If both rooms have links pointing to each other, make it two-way
		// Otherwise, make it one-way
		const oneWay = !hasReverseLink;

		if (hasReverseLink) {
			logger.debug(
				`Bidirectional link detected: ${pending.roomRef} ${pending.direction} <-> ${pending.targetRoomRef} ${reverseDirectionText}`
			);
			twoWayCount++;
		} else {
			logger.debug(
				`One-way link: ${pending.roomRef} ${pending.direction} -> ${pending.targetRoomRef}`
			);
			oneWayCount++;
		}

		// Create the link
		RoomLink.createTunnel(fromRoom, direction, toRoom, oneWay);
		createdCount++;

		// Mark both this link and its reverse as processed to avoid duplicates
		processedLinks.add(linkKey);
		processedLinks.add(reverseLinkKey);
	}

	// Clear pending links
	pendingRoomLinks.length = 0;

	logger.info(
		`Processed ${createdCount} room link(s): ${oneWayCount} one-way, ${twoWayCount} two-way${
			skippedCount > 0 ? ` (skipped ${skippedCount} duplicate(s))` : ""
		}`
	);
}

/**
 * Load all dungeons from disk.
 */
export async function loadDungeons(): Promise<Dungeon[]> {
	const ids = await getAllDungeonIds();
	logger.debug(`Found ${ids.length} dungeon file(s) to load`);
	const dungeons: Dungeon[] = [];

	for (const id of ids) {
		await logger.block(id, async () => {
			const dungeon = await loadDungeon(id);
			if (dungeon) {
				dungeons.push(dungeon);
			} else {
				logger.warn(`Failed to load dungeon with id: ${id}`);
			}
		});
	}

	// Process all pending room links after all dungeons are loaded
	processPendingRoomLinks();

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
	dependencies: [archetypePkg],
	loader: async () => {
		await logger.block("dungeon", async () => {
			const dungeons = await loadDungeons();
			logger.info(
				`Dungeon persistence package loaded: ${dungeons.length} dungeon(s)`
			);
		});
	},
} as Package;
