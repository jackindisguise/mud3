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
import abilityPkg from "./ability.js";
import {
	getRaceById,
	getJobById,
	getDefaultRace,
	getDefaultJob,
} from "../registry/archetype.js";
import type { Race, Job } from "../core/archetype.js";
import { getAbilityById } from "../registry/ability.js";
import { Ability, getProficiencyAtUses } from "../core/ability.js";
import {
	registerDungeon,
	hasDungeon,
	addWanderingMob,
} from "../registry/dungeon.js";
import { join, relative } from "path";
import { mkdir, readFile, access, readdir } from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import {
	Dungeon,
	Room,
	MapDimensions,
	Coordinates,
	DungeonObjectTemplate,
	RoomTemplate,
	MobTemplate,
	ItemTemplate,
	DIRECTION,
	Reset,
	DUNGEON_REGISTRY,
	dir2text,
	text2dir,
	dir2reverse,
	DirectionText,
	RoomLink,
	getRoomByRef,
	getDungeonById,
	DungeonObject,
	DungeonObjectOptions,
	Mob,
	MobOptions,
	BEHAVIOR,
	Item,
	Prop,
	Equipment,
	EquipmentOptions,
	Armor,
	ArmorOptions,
	Weapon,
	WeaponOptions,
	RoomOptions,
	Movable,
	AnySerializedDungeonObject,
	SerializedDungeonObject,
	SerializedDungeonObjectType,
	SerializedRoom,
	SerializedMovable,
	SerializedMob,
	SerializedItem,
	SerializedProp,
	SerializedEquipment,
	SerializedArmor,
	SerializedWeapon,
	EQUIPMENT_SLOT,
	normalizeSerializedData,
	type EquipmentTemplate,
	type ArmorTemplate,
	type WeaponTemplate,
	type ItemType,
	type equipmentType,
	DungeonOptions,
} from "../core/dungeon.js";
import YAML from "js-yaml";
import { Package } from "package-loader";
import { getSafeRootDirectory } from "../utils/path.js";
import { getNextObjectId } from "../registry/gamestate.js";
import { migrateDungeonData } from "../migrations/dungeon/runner.js";
import { migrateRoomData } from "../migrations/room/runner.js";
import { migrateMobData } from "../migrations/mob/runner.js";
import { migrateItemData } from "../migrations/item/runner.js";
import { migrateEquipmentData } from "../migrations/equipment/runner.js";
import { migrateArmorData } from "../migrations/armor/runner.js";
import { migrateWeaponData } from "../migrations/weapon/runner.js";
import { COLOR_NAME_TO_COLOR } from "../core/color.js";
import assert from "assert";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const DUNGEON_DIR = join(DATA_DIRECTORY, "dungeons");

/**
 * Factory function to create a DungeonObject with an auto-generated OID.
 * This is the preferred way to create objects in package modules.
 */
export function createDungeonInstance(options: DungeonOptions): Dungeon {
	const dungeon = new Dungeon(options);
	if (dungeon.id) registerDungeonInstance(dungeon);
	return dungeon;
}

export function createDungeonObject(
	options?: Omit<DungeonObjectOptions, "oid">
): DungeonObject {
	return new DungeonObject({
		...options,
		oid: getNextObjectId(),
	});
}

/**
 * Register a dungeon in the registry.
 * This should be called after creating a dungeon with an id.
 *
 * @param dungeon The dungeon to register
 * @throws Error if the dungeon id is already in use
 */
export function registerDungeonInstance(dungeon: Dungeon): void {
	if (!dungeon.id) {
		throw new Error("Cannot register dungeon without an id");
	}
	if (hasDungeon(dungeon.id)) {
		throw new Error(`Dungeon id "${dungeon.id}" is already in use`);
	}
	registerDungeon(dungeon.id, dungeon);
	const roomCount =
		dungeon.dimensions.width *
		dungeon.dimensions.height *
		dungeon.dimensions.layers;
	logger.debug(
		`Registered dungeon "${dungeon.id}" with ${roomCount} cells (${dungeon.dimensions.width}x${dungeon.dimensions.height}x${dungeon.dimensions.layers})`
	);
}

/**
 * Factory function to create a Mob with an auto-generated OID.
 */
export function createMob(
	options?: Omit<MobOptions, "oid" | "race" | "job"> & {
		race?: Race;
		job?: Job;
	}
): Mob {
	const race = options?.race ?? getDefaultRace();
	const job = options?.job ?? getDefaultJob();
	const mob = new Mob({
		...options,
		race,
		job,
		oid: getNextObjectId(),
	});

	// Register in wandering mobs cache if wander behavior is enabled
	if (mob.hasBehavior(BEHAVIOR.WANDER) && !mob.character) {
		addWanderingMob(mob);
	}

	return mob;
}

/**
 * Factory function to create a Room.
 * Note: Rooms do not use OIDs as they are identified by coordinates.
 */
export function createRoom(options: Omit<RoomOptions, "oid">): Room {
	return new Room({
		...options,
	});
}

/**
 * Factory function to create an Item with an auto-generated OID.
 */
export function createItem(options?: Omit<DungeonObjectOptions, "oid">): Item {
	return new Item({
		...options,
		oid: getNextObjectId(),
	});
}

/**
 * Factory function to create a Prop with an auto-generated OID.
 */
export function createProp(options?: Omit<DungeonObjectOptions, "oid">): Prop {
	return new Prop({
		...options,
		oid: getNextObjectId(),
	});
}

/**
 * Factory function to create Equipment with an auto-generated OID.
 */
export function createEquipment(
	options?: Omit<EquipmentOptions, "oid">
): Equipment {
	return new Equipment({
		...options,
		oid: getNextObjectId(),
	});
}

/**
 * Factory function to create Armor with an auto-generated OID.
 */
export function createArmor(options?: Omit<ArmorOptions, "oid">): Armor {
	return new Armor({
		...options,
		oid: getNextObjectId(),
	});
}

/**
 * Factory function to create Weapon with an auto-generated OID.
 */
export function createWeapon(options?: Omit<WeaponOptions, "oid">): Weapon {
	return new Weapon({
		...options,
		oid: getNextObjectId(),
	});
}

/**
 * Creates a new DungeonObject instance from a template.
 * This is the package-layer implementation that handles OID assignment and
 * resolves runtime dependencies (like race/job for Mobs).
 *
 * @param template - The template to create an object from
 * @param oid - Optional OID to assign. If not provided, a new OID will be generated.
 * @returns A new DungeonObject instance with template properties applied
 */
function createFromTemplate(
	template: DungeonObjectTemplate,
	oid?: number
): DungeonObject {
	let obj: DungeonObject;
	const providedOid = oid ?? getNextObjectId();

	// Create the appropriate object type
	switch (template.type) {
		case "Room":
			throw new Error(
				"Room templates require coordinates - use createRoomFromTemplate() instead"
			);
		case "Mob": {
			const mobTemplate = template as MobTemplate;
			// Resolve race/job string IDs to Race/Job objects
			const race = mobTemplate.race
				? getRaceById(mobTemplate.race) ?? getDefaultRace()
				: getDefaultRace();
			const job = mobTemplate.job
				? getJobById(mobTemplate.job) ?? getDefaultJob()
				: getDefaultJob();
			obj = new Mob({
				templateId: template.id,
				oid: providedOid,
				race,
				job,
			});
			break;
		}
		case "Equipment": {
			const equipmentTemplate = template as EquipmentTemplate;
			obj = new Equipment({
				templateId: template.id,
				oid: providedOid,
				slot: equipmentTemplate.slot ?? EQUIPMENT_SLOT.HEAD,
				attributeBonuses: equipmentTemplate.attributeBonuses,
				resourceBonuses: equipmentTemplate.resourceBonuses,
				secondaryAttributeBonuses: equipmentTemplate.secondaryAttributeBonuses,
			});
			break;
		}
		case "Armor": {
			const armorTemplate = template as ArmorTemplate;
			obj = new Armor({
				templateId: template.id,
				oid: providedOid,
				slot: armorTemplate.slot ?? EQUIPMENT_SLOT.HEAD,
				defense: armorTemplate.defense ?? 0,
				attributeBonuses: armorTemplate.attributeBonuses,
				resourceBonuses: armorTemplate.resourceBonuses,
				secondaryAttributeBonuses: armorTemplate.secondaryAttributeBonuses,
			});
			break;
		}
		case "Weapon": {
			const weaponTemplate = template as WeaponTemplate;
			obj = new Weapon({
				templateId: template.id,
				oid: providedOid,
				slot: weaponTemplate.slot ?? EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: weaponTemplate.attackPower ?? 0,
				hitType: weaponTemplate.hitType,
				type: weaponTemplate.weaponType ?? "shortsword",
				attributeBonuses: weaponTemplate.attributeBonuses,
				resourceBonuses: weaponTemplate.resourceBonuses,
				secondaryAttributeBonuses: weaponTemplate.secondaryAttributeBonuses,
			});
			break;
		}
		case "Movable":
			obj = new Movable({ templateId: template.id, oid: providedOid });
			break;
		case "Item":
			obj = new Item({ templateId: template.id, oid: providedOid });
			break;
		case "Prop":
			obj = new Prop({ templateId: template.id, oid: providedOid });
			break;
		case "DungeonObject":
		default:
			obj = new DungeonObject({ templateId: template.id, oid: providedOid });
			break;
	}

	// Apply template properties
	obj.applyTemplate(template);

	return obj;
}

/**
 * Factory function to create a DungeonObject from a template with an auto-generated OID.
 * This is the preferred way to create objects from templates in package modules.
 */
export function createFromTemplateWithOid(
	template: DungeonObjectTemplate
): DungeonObject {
	return createFromTemplate(template, getNextObjectId());
}

/**
 * Factory function to create a Room from a template.
 * Note: Rooms do not use OIDs as they are identified by coordinates.
 */
export function createRoomFromTemplate(
	template: RoomTemplate,
	coordinates: Coordinates
): Room {
	const room = new Room({
		coordinates,
		templateId: template.id,
	});
	room.applyTemplate(template);
	return room;
}

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
	version?: string; // Project version when this file was saved
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
		exitOverrides?: Array<{
			coordinates: { x: number; y: number; z: number };
			allowedExits?: number; // allowedExits bitmask override
			roomLinks?: Record<DirectionText, string>; // roomLinks override
		}>; // Array of exit overrides with coordinate objects
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
		logger.debug(
			`[${id}] Stage 1: Reading dungeon file from ${relative(
				ROOT_DIRECTORY,
				filePath
			)}`
		);
		const content = await readFile(filePath, "utf-8");

		logger.debug(
			`[${id}] Stage 2: Parsing YAML content (${content.length} bytes)`
		);
		let data = YAML.load(content) as SerializedDungeonFormat;
		const originalVersion = data.version;

		if (!data.dungeon) {
			throw new Error("Invalid dungeon format: missing 'dungeon' key");
		}

		// Stage 2.5: Migrate data if needed
		logger.debug(`[${id}] Stage 2.5: Checking for migrations`);
		data = await migrateDungeonData(data, id);

		logger.debug(`[${id}] Stage 3: Extracting dungeon data`);
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
		logger.debug(`[${id}] Stage 4: Validating dimensions`);
		if (
			!dimensions ||
			!dimensions.width ||
			!dimensions.height ||
			!dimensions.layers
		) {
			throw new Error("Invalid dungeon format: missing or invalid dimensions");
		}
		logger.debug(
			`[${id}] Dimensions: ${dimensions.width}x${dimensions.height}x${dimensions.layers}`
		);

		// Validate grid
		logger.debug(`[${id}] Stage 5: Validating grid structure`);
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
		logger.debug(
			`[${id}] Grid validated: ${grid.length} layers, ${rooms.length} room template(s)`
		);

		// Stage 5.5: Deserialize room templates from rooms array
		// Room templates don't have type/id fields in YAML, so we need to add type for deserialization
		logger.debug(`[${id}] Stage 5.5: Deserializing room templates`);
		const deserializedRoomTemplates = await Promise.all(
			rooms.map(async (roomTemplate, index) => {
				// Add type and id for deserialization (rooms array omits these fields)
				const roomTemplateWithType = {
					...roomTemplate,
					type: "Room" as const,
					id: `room-template-${index}`, // Dummy ID for deserialization (not used in template registry)
				};
				try {
					// Use the formal template deserialization system
					const deserialized = await deserializeTemplate(
						roomTemplateWithType,
						`room-template-${index}`,
						id,
						originalVersion
					);
					return deserialized as RoomTemplate;
				} catch (error) {
					logger.error(
						`[${id}] Failed to deserialize room template ${index}: ${error}`
					);
					throw error;
				}
			})
		);

		// Create dungeon
		logger.debug(`[${id}] Stage 6: Creating dungeon instance`);
		const dungeonId = data.dungeon.id || id;
		const dungeon = new Dungeon({
			id: dungeonId,
			name: name || dungeonId,
			description,
			dimensions,
			resetMessage,
		});
		logger.debug(`[${id}] Dungeon instance created: "${dungeon.name}"`);

		// Register dungeon in registry
		registerDungeonInstance(dungeon);

		// Create rooms from grid
		// Reverse the grid array so that YAML files can have top floor first
		// but we still assign correct z-coordinates (z=0 is ground floor)
		logger.debug(`[${id}] Stage 7: Creating rooms from grid`);
		const reversedGrid = [...grid].reverse();
		let totalRoomsCreated = 0;
		for (let z = 0; z < reversedGrid.length; z++) {
			logger.debug(`[${id}] Processing layer ${z}/${reversedGrid.length - 1}`);
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

					const roomTemplate = deserializedRoomTemplates[templateArrayIndex];
					if (!roomTemplate) {
						throw new Error(
							`Invalid dungeon format: template at index ${templateArrayIndex} is undefined`
						);
					}

					// Map YAML row index (top-first) to internal y coordinate (bottom-first)
					const targetY = dimensions.height - 1 - y;
					const coordinates = { x, y, z };

					// Create room from template using the formal template system
					logger.debug(
						`[${id}] Creating room at (${x},${y},${z}) from template index ${templateIndex}`
					);
					const room = createRoomFromTemplate(roomTemplate, coordinates);
					totalRoomsCreated++;

					// Apply exit override if present (before adding to dungeon)
					// Store roomLinks from exitOverrides to process after room is added
					let exitOverrideRoomLinks: Record<DirectionText, string> | undefined;
					if (exitOverrides && Array.isArray(exitOverrides)) {
						const override = exitOverrides.find(
							(o) =>
								o.coordinates &&
								o.coordinates.x === x &&
								o.coordinates.y === y &&
								o.coordinates.z === z
						);
						if (override) {
							if (
								override.allowedExits !== undefined &&
								typeof override.allowedExits === "number"
							) {
								room.allowedExits = override.allowedExits;
							}
							if (override.roomLinks) {
								// Store roomLinks to process after room is added to dungeon
								exitOverrideRoomLinks = override.roomLinks;
							}
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

					// Collect roomLinks from exitOverrides for later processing (after room is added)
					if (exitOverrideRoomLinks) {
						const roomRef = room.getRoomRef();
						if (roomRef) {
							for (const [directionText, targetRoomRef] of Object.entries(
								exitOverrideRoomLinks
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
		logger.debug(
			`[${id}] Stage 7 complete: Created ${totalRoomsCreated} room(s)`
		);

		// Load templates if present
		logger.debug(`[${id}] Stage 8: Loading templates`);
		if (templates && Array.isArray(templates)) {
			logger.debug(`[${id}] Found ${templates.length} template(s) to load`);
			for (const rawTemplate of templates) {
				if (!rawTemplate.id) {
					logger.warn(`[${id}] Skipping invalid template: missing id`);
					continue;
				}
				logger.debug(
					`[${id}] Loading template "${rawTemplate.id}" (type: ${rawTemplate.type})`
				);

				try {
					// Use the formal template deserialization system
					const globalizedId = globalizeTemplateId(rawTemplate.id, dungeon.id!);
					const hydrated = await deserializeTemplate(
						rawTemplate,
						globalizedId,
						id,
						originalVersion
					);

					dungeon.addTemplate(hydrated);
					logger.debug(
						`[${id}] Template "${rawTemplate.id}" loaded successfully`
					);
				} catch (error) {
					logger.error(
						`[${id}] Failed to load template "${rawTemplate.id}": ${error}`
					);
					throw error;
				}
			}
			logger.debug(
				`[${id}] Stage 8 complete: Loaded ${templates.length} template(s)`
			);
		} else {
			logger.debug(`[${id}] Stage 8 complete: No templates to load`);
		}

		// Load resets if present
		logger.debug(`[${id}] Stage 9: Loading resets`);
		if (resets && Array.isArray(resets)) {
			logger.debug(`[${id}] Found ${resets.length} reset(s) to load`);
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
			logger.debug(
				`[${id}] Stage 9 complete: Loaded ${resets.length} reset(s)`
			);
		} else {
			logger.debug(`[${id}] Stage 9 complete: No resets to load`);
		}

		logger.debug(`[${id}] Stage 10: Processing room links`);
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
 * Migrate a template from YAML data before hydration.
 * This function handles type-safe migration of template data based on the template type.
 *
 * @param rawTemplateData - Raw template data from YAML (unknown type)
 * @param templateId - Template ID for logging
 * @param dungeonId - Dungeon ID for logging
 * @param dungeonVersion - Dungeon version (used if template doesn't have a version)
 * @returns Migrated template data (still as serialized format, not hydrated)
 */
export async function migrateTemplateData(
	rawTemplateData: unknown,
	templateId: string,
	dungeonId: string,
	dungeonVersion?: string
): Promise<unknown> {
	// Stage 1: Validate raw data has required fields
	if (!rawTemplateData || typeof rawTemplateData !== "object") {
		logger.warn(
			`[${dungeonId}] Template "${templateId}": Invalid template data, skipping migration`
		);
		return rawTemplateData;
	}

	const templateObj = rawTemplateData as Record<string, unknown>;
	const templateType = templateObj.type as
		| SerializedDungeonObjectType
		| undefined;
	let templateVersion = templateObj.version as string | undefined;

	// Stage 2: If template has no version, use dungeon's version or default to "1.0.0"
	if (!templateVersion) {
		if (dungeonVersion) {
			templateVersion = dungeonVersion;
			// Set the version on the template data so migration can use it
			templateObj.version = dungeonVersion;
			logger.debug(
				`[${dungeonId}] Template "${templateId}": No version field, using dungeon version ${dungeonVersion}`
			);
		} else {
			// Default to "1.0.0" for old files without version
			templateVersion = "1.0.0";
			templateObj.version = "1.0.0";
			logger.debug(
				`[${dungeonId}] Template "${templateId}": No version field and dungeon has no version, defaulting to 1.0.0`
			);
		}
	}

	// Stage 3: If no type, cannot migrate
	if (!templateType) {
		logger.warn(
			`[${dungeonId}] Template "${templateId}": No type field, skipping migration`
		);
		return rawTemplateData;
	}

	// Stage 4: Type-safe migration based on template type
	try {
		switch (templateType) {
			case "Room": {
				// Stage 4a: Cast to SerializedRoom type
				const serializedRoom = rawTemplateData as SerializedRoom & {
					version?: string;
				};
				// Stage 4b: Migrate using Room migration function
				const migratedRoom = await migrateRoomData(serializedRoom, templateId);
				// Stage 4c: Return migrated data
				return migratedRoom;
			}
			case "Mob": {
				// Stage 4a: Cast to SerializedMob type
				const serializedMob = rawTemplateData as SerializedMob & {
					version?: string;
				};
				// Stage 4b: Migrate using Mob migration function
				const migratedMob = await migrateMobData(serializedMob, templateId);
				// Stage 4c: Return migrated data
				return migratedMob;
			}
			case "Item": {
				// Stage 4a: Cast to SerializedItem type
				const serializedItem = rawTemplateData as SerializedItem & {
					version?: string;
				};
				// Stage 4b: Migrate using Item migration function
				const migratedItem = await migrateItemData(serializedItem, templateId);
				// Stage 4c: Return migrated data
				return migratedItem;
			}
			case "Equipment": {
				// Stage 4a: Cast to SerializedEquipment type
				const serializedEquipment = rawTemplateData as SerializedEquipment & {
					version?: string;
				};
				// Stage 4b: Migrate using Equipment migration function
				const migratedEquipment = await migrateEquipmentData(
					serializedEquipment,
					templateId
				);
				// Stage 4c: Return migrated data
				return migratedEquipment;
			}
			case "Armor": {
				// Stage 4a: Cast to SerializedArmor type
				const serializedArmor = rawTemplateData as SerializedArmor & {
					version?: string;
				};
				// Stage 4b: Migrate using Armor migration function
				const migratedArmor = await migrateArmorData(
					serializedArmor,
					templateId
				);
				// Stage 4c: Return migrated data
				return migratedArmor;
			}
			case "Weapon": {
				// Stage 4a: Cast to SerializedWeapon type
				const serializedWeapon = rawTemplateData as SerializedWeapon & {
					version?: string;
				};
				// Stage 4b: Migrate using Weapon migration function
				const migratedWeapon = await migrateWeaponData(
					serializedWeapon,
					templateId
				);
				// Stage 4c: Return migrated data
				return migratedWeapon;
			}
			case "Movable":
			case "Prop":
			case "DungeonObject":
			default:
				// Stage 4: No migration system for these types yet
				logger.debug(
					`[${dungeonId}] Template "${templateId}": Type "${templateType}" has no migration system, skipping migration`
				);
				return rawTemplateData;
		}
	} catch (error) {
		logger.warn(
			`[${dungeonId}] Template "${templateId}": Migration failed: ${error}`
		);
		// Return original data if migration fails
		return rawTemplateData;
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
		// Execute resets with OID assignment using factory function
		const spawned = dungeon.executeResets(createFromTemplateWithOid);
		totalSpawned += spawned;
		dungeonCount++;
	}

	if (dungeonCount > 0) {
		logger.debug(
			`Dungeon reset cycle: ${dungeonCount} dungeon(s), ${totalSpawned} object(s) spawned`
		);
	}
}

/**
 * Internal deserialization function with migration control.
 *
 * @param data The serialized object data
 * @param shouldMigrate Whether to apply migrations (default: true)
 * @returns New DungeonObject instance with restored hierarchy
 */
async function deserializeDungeonObjectWithMigration(
	data: AnySerializedDungeonObject,
	shouldMigrate: boolean = true,
	parentVersion?: string
): Promise<DungeonObject> {
	const version = data.version || parentVersion;
	const typed = data as SerializedDungeonObject;
	const type: SerializedDungeonObjectType =
		(typed.type as SerializedDungeonObjectType | undefined) ?? "DungeonObject";

	logger.debug(
		`Deserializing ${type} object${
			typed.keywords ? `: "${typed.keywords}"` : ""
		}`
	);

	// Normalize compressed data by overlaying onto the base serialization for the type.
	let normalized = normalizeSerializedData(data);

	// Delegate to type-specific deserializers
	switch (type) {
		case "Room":
			return await deserializeRoom(normalized as SerializedRoom, true, version);
		case "Mob":
			return await deserializeMob(normalized as SerializedMob, true, version);
		case "Equipment":
			return await deserializeEquipment(
				normalized as SerializedEquipment,
				true,
				version
			);
		case "Armor":
			return await deserializeArmor(
				normalized as SerializedArmor,
				true,
				version
			);
		case "Weapon":
			return await deserializeWeapon(
				normalized as SerializedWeapon,
				true,
				version
			);
		case "Movable":
			return await deserializeMovable(
				normalized as SerializedMovable,
				true,
				version
			);
		case "Item":
			return await deserializeItem(normalized as SerializedItem, true, version);
		case "Prop":
			return await deserializeProp(normalized as SerializedProp, version);
		case "DungeonObject":
			// handled in main body
			break;
		default:
			throw new Error(`no valid type to deserialize: ${String(type)}`);
	}

	// DungeonObjects in particular
	const options: DungeonObjectOptions = {
		...typed,
		mapColor:
			typed.mapColor !== undefined
				? COLOR_NAME_TO_COLOR[
						typed.mapColor as keyof typeof COLOR_NAME_TO_COLOR
				  ]
				: undefined,
	};

	let obj: DungeonObject = new DungeonObject(options);

	// Handle contents for all object types
	if (typed.contents) {
		logger.debug(
			`Deserializing ${typed.contents.length} content object(s) for ${type}`
		);
		for (const contentData of typed.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				shouldMigrate,
				version
			);
			obj.add(contentObj);
		}
	}

	return obj;
}

/**
 * Deserialize a serialized DungeonObject back into an instance.
 * This is the main entry point for deserializing any dungeon object type.
 * Migrations are applied automatically based on object type.
 *
 * @param data The serialized object data
 * @returns New DungeonObject instance with restored hierarchy
 */
export async function deserializeDungeonObject(
	data: AnySerializedDungeonObject
): Promise<DungeonObject> {
	return deserializeDungeonObjectWithMigration(data, true);
}

/**
 * Deserialize a SerializedRoom into a Room instance.
 *
 * @param data The serialized room data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeRoom(
	data: SerializedRoom,
	migrate: boolean = true,
	parentVersion?: string
): Promise<Room> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as SerializedRoom & { version?: string };
		// Use parentVersion if room doesn't have its own version
		if (!dataWithVersion.version && parentVersion) {
			dataWithVersion.version = parentVersion;
		}
		try {
			migratedData = await migrateRoomData(dataWithVersion, data.keywords);
		} catch (error) {
			logger.warn(`Migration failed for Room: ${error}`);
		}
	}

	const norm = normalizeSerializedData(migratedData) as SerializedRoom;
	const options = hydrateSerializedRoomData(norm);
	const room = new Room(options);
	// Determine version for nested objects
	const versionForNested =
		(migratedData as any & { version?: string }).version || parentVersion;
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate,
				versionForNested
			);
			room.add(contentObj);
		}
	}
	return room;
}

/**
 * Deserialize a SerializedMovable into a Movable instance.
 *
 * @param data The serialized movable data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeMovable(
	data: SerializedMovable,
	migrate: boolean = true,
	parentVersion?: string
): Promise<Movable> {
	// Apply parentVersion if object doesn't have its own version
	if (parentVersion && migrate) {
		const dataWithVersion = data as any & { version?: string };
		if (!dataWithVersion.version) {
			dataWithVersion.version = parentVersion;
		}
	}
	const norm = normalizeSerializedData(data) as SerializedMovable;
	const options = hydrateSerializedMovableData(norm);
	const movable = new Movable(options);
	// Determine version for nested objects
	const versionForNested =
		(norm as any & { version?: string }).version || parentVersion;
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate,
				versionForNested
			);
			movable.add(contentObj);
		}
	}
	return movable;
}

/**
 * Deserialize a SerializedProp into a Prop instance.
 *
 * @param data The serialized prop data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeProp(
	data: SerializedProp,
	parentVersion?: string
): Promise<Prop> {
	// Apply parentVersion if object doesn't have its own version
	if (parentVersion) {
		const dataWithVersion = data as any & { version?: string };
		if (!dataWithVersion.version) {
			dataWithVersion.version = parentVersion;
		}
	}
	const norm = normalizeSerializedData(data);
	const options = hydrateSerializedDungeonObjectData(norm);
	const prop = new Prop(options);
	// Determine version for nested objects
	const versionForNested =
		(norm as any & { version?: string }).version || parentVersion;
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				true,
				versionForNested
			);
			prop.add(contentObj);
		}
	}
	return prop;
}

/**
 * Deserialize a SerializedItem into an Item instance.
 *
 * @param data The serialized item data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeItem(
	data: SerializedItem,
	migrate: boolean = true,
	parentVersion?: string
): Promise<Item> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion: SerializedItem & { version?: string } = data;
		// Use parentVersion if item doesn't have its own version
		if (!dataWithVersion.version && parentVersion) {
			dataWithVersion.version = parentVersion;
		}
		try {
			migratedData = await migrateItemData(dataWithVersion, data.keywords);
		} catch (error) {
			logger.warn(
				`Migration failed for Item${
					(data as SerializedItem).keywords
						? ` "${(data as SerializedItem).keywords}"`
						: ""
				}: ${error}`
			);
		}
	}

	const norm = normalizeSerializedData(migratedData) as SerializedItem;
	// Determine version for nested objects
	const versionForNested =
		(migratedData as any & { version?: string }).version || parentVersion;
	const options = hydrateSerializedItemData(norm);
	const item = new Item(options);
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate,
				versionForNested
			);
			item.add(contentObj);
		}
	}
	return item;
}

/**
 * Deserialize a SerializedEquipment into an Equipment instance.
 *
 * @param data The serialized equipment data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeEquipment(
	data: SerializedEquipment,
	migrate: boolean = true,
	parentVersion?: string
): Promise<Equipment> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as any & { version?: string };
		// Use parentVersion if equipment doesn't have its own version
		if (!dataWithVersion.version && parentVersion) {
			dataWithVersion.version = parentVersion;
		}
		try {
			migratedData = (await migrateEquipmentData(
				dataWithVersion as any,
				data.keywords
			)) as any;
		} catch (error) {
			logger.warn(
				`Migration failed for Equipment${
					data.keywords ? ` "${data.keywords}"` : ""
				}: ${error}`
			);
		}
	}

	const norm = normalizeSerializedData(migratedData) as SerializedEquipment;
	// Determine version for nested objects
	const versionForNested =
		(migratedData as any & { version?: string }).version || parentVersion;
	const options = hydrateSerializedEquipmentData(norm);
	const equipment = new Equipment(options);
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate,
				versionForNested
			);
			equipment.add(contentObj);
		}
	}
	return equipment;
}

/**
 * Deserialize a SerializedArmor into an Armor instance.
 *
 * @param data The serialized armor data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeArmor(
	data: SerializedArmor,
	migrate: boolean = true,
	parentVersion?: string
): Promise<Armor> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as any & { version?: string };
		// Use parentVersion if armor doesn't have its own version
		if (!dataWithVersion.version && parentVersion) {
			dataWithVersion.version = parentVersion;
		}
		try {
			migratedData = (await migrateArmorData(
				dataWithVersion as any,
				data.keywords
			)) as any;
		} catch (error) {
			logger.warn(
				`Migration failed for Armor${
					data.keywords ? ` "${data.keywords}"` : ""
				}: ${error}`
			);
		}
	}

	const norm = normalizeSerializedData(migratedData) as SerializedArmor;
	// Determine version for nested objects
	const versionForNested =
		(migratedData as any & { version?: string }).version || parentVersion;
	const options = hydrateSerializedArmorData(norm);
	const armor = new Armor(options);
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate,
				versionForNested
			);
			armor.add(contentObj);
		}
	}
	return armor;
}

/**
 * Deserialize a SerializedWeapon into a Weapon instance.
 *
 * @param data The serialized weapon data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeWeapon(
	data: SerializedWeapon,
	migrate: boolean = true,
	parentVersion?: string
): Promise<Weapon> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as any & { version?: string };
		// Use parentVersion if weapon doesn't have its own version
		if (!dataWithVersion.version && parentVersion) {
			dataWithVersion.version = parentVersion;
		}
		try {
			migratedData = (await migrateWeaponData(
				dataWithVersion as any,
				data.keywords
			)) as any;
		} catch (error) {
			logger.warn(
				`Migration failed for Weapon${
					data.keywords ? ` "${data.keywords}"` : ""
				}: ${error}`
			);
		}
	}

	const norm = normalizeSerializedData(migratedData) as SerializedWeapon;
	// Determine version for nested objects
	const versionForNested =
		(migratedData as any & { version?: string }).version || parentVersion;
	const options = hydrateSerializedWeaponData(norm);
	// Apply defaults for required fields
	const weapon = new Weapon({
		...options,
		attackPower: options.attackPower ?? 0,
		type: options.type ?? "shortsword",
	});
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate,
				versionForNested
			);
			weapon.add(contentObj);
		}
	}
	return weapon;
}

/**
 * Helper function to remove undefined values from an object.
 */
function pruneUndefined<T>(obj: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
		if (v !== undefined) out[k] = v;
	}
	return out as Partial<T>;
}

/**
 * Type guard to assert that a Partial<MobOptions> has the required fields (race and job).
 * This allows TypeScript to narrow the type to MobOptions without a cast.
 */
function assertMobOptions(
	options: Partial<MobOptions>
): asserts options is MobOptions {
	assert.ok(options.race, "Race is a required field in MobOptions.");
	assert.ok(options.job, "Job is a required field in MobOptions.");
}

/**
 * Hydrates a SerializedDungeonObject into DungeonObjectOptions.
 * Handles conversion of serialized field formats (e.g., mapColor string -> COLOR enum).
 * This is the base hydration function that all other hydration functions call.
 */
function hydrateSerializedDungeonObjectData(
	data: SerializedDungeonObject
): DungeonObjectOptions {
	return pruneUndefined({
		oid: data.oid,
		keywords: data.keywords,
		display: data.display,
		description: data.description,
		roomDescription: data.roomDescription,
		mapText: data.mapText,
		mapColor:
			data.mapColor !== undefined
				? COLOR_NAME_TO_COLOR[data.mapColor as keyof typeof COLOR_NAME_TO_COLOR]
				: undefined,
		baseWeight: data.baseWeight,
		templateId: data.templateId,
	});
}

/**
 * Type alias for Movable options (currently same as DungeonObjectOptions).
 * Defined for type safety and future extensibility.
 */
type MovableOptions = DungeonObjectOptions;

/**
 * Type alias for Item options (currently same as DungeonObjectOptions).
 * Defined for type safety and future extensibility.
 */
type ItemOptions = MovableOptions;

/**
 * Hydrates a SerializedRoom into RoomOptions.
 * Calls DungeonObject hydration and adds Room-specific fields (coordinates, allowedExits, dense).
 * Follows the class hierarchy: Room -> DungeonObject.
 */
function hydrateSerializedRoomData(data: SerializedRoom): RoomOptions {
	const base = hydrateSerializedDungeonObjectData(data);
	// allowedExits is mandatory in serialized form, but handle legacy data
	const defaultExits =
		DIRECTION.NORTH |
		DIRECTION.SOUTH |
		DIRECTION.EAST |
		DIRECTION.WEST |
		DIRECTION.NORTHEAST |
		DIRECTION.NORTHWEST |
		DIRECTION.SOUTHEAST |
		DIRECTION.SOUTHWEST;
	// coordinates is required, so we can safely cast back to RoomOptions
	return pruneUndefined({
		...base,
		coordinates: data.coordinates,
		allowedExits: data.allowedExits ?? defaultExits,
		dense: data.dense,
	}) as RoomOptions;
}

/**
 * Hydrates a SerializedMovable into MovableOptions.
 * Currently just calls the base DungeonObject hydration, but exists for future extensibility.
 * Accepts SerializedDungeonObject since Movable doesn't add serialized fields beyond DungeonObject.
 */
function hydrateSerializedMovableData(
	data: SerializedDungeonObject
): MovableOptions {
	return hydrateSerializedDungeonObjectData(data);
}

/**
 * Hydrates a SerializedItem into ItemOptions.
 * Calls Movable hydration following the class hierarchy: Item -> Movable -> DungeonObject.
 * Accepts SerializedDungeonObject since SerializedItem doesn't add fields beyond base.
 */
function hydrateSerializedItemData(data: SerializedDungeonObject): ItemOptions {
	return hydrateSerializedMovableData(data);
}

/**
 * Hydrates a SerializedEquipment into EquipmentOptions.
 * Calls Item hydration and adds Equipment-specific fields (slot, bonuses).
 * Follows the class hierarchy: Equipment -> Item -> Movable -> DungeonObject.
 */
function hydrateSerializedEquipmentData(
	data: SerializedEquipment
): EquipmentOptions {
	const base = hydrateSerializedItemData(data);
	return pruneUndefined({
		...base,
		slot: data.slot,
		attributeBonuses: data.attributeBonuses,
		resourceBonuses: data.resourceBonuses,
		secondaryAttributeBonuses: data.secondaryAttributeBonuses,
	});
}

/**
 * Hydrates a SerializedArmor into ArmorOptions.
 * Calls Equipment hydration and adds Armor-specific field (defense).
 * Follows the class hierarchy: Armor -> Equipment -> Item -> Movable -> DungeonObject.
 */
function hydrateSerializedArmorData(data: SerializedArmor): ArmorOptions {
	const base = hydrateSerializedEquipmentData(data);
	return pruneUndefined({
		...base,
		defense: data.defense,
	});
}

/**
 * Hydrates a SerializedWeapon into WeaponOptions.
 * Calls Equipment hydration and adds Weapon-specific fields (attackPower, hitType, weaponType).
 * Follows the class hierarchy: Weapon -> Equipment -> Item -> Movable -> DungeonObject.
 */
function hydrateSerializedWeaponData(data: SerializedWeapon): WeaponOptions {
	const base = hydrateSerializedEquipmentData(data);
	return pruneUndefined({
		...base,
		attackPower: data.attackPower,
		hitType: data.hitType,
		type: data.weaponType,
	});
}

/**
 * Hydrates a SerializedMob into MobOptions.
 * Handles conversion of Mob-specific fields (behaviors, etc.) and resolves race/job from IDs.
 * This function requires runtime data (race/job registries) so it lives in the package layer.
 * Follows the class hierarchy: Mob -> Movable -> DungeonObject
 */
function hydrateSerializedMobData(data: SerializedMob): MobOptions {
	const base = hydrateSerializedMovableData(data);

	// Convert serialized behaviors (strings) back to enum keys
	const behaviors: Partial<Record<BEHAVIOR, boolean>> | undefined =
		data.behaviors
			? Object.fromEntries(
					Object.entries(data.behaviors)
						.filter(([key]) =>
							Object.values(BEHAVIOR).includes(key as BEHAVIOR)
						)
						.map(([key, value]) => [key as BEHAVIOR, !!value])
			  )
			: undefined;

	// Resolve race and job from string IDs to actual objects
	const race = getRaceById(data.race);
	const job = getJobById(data.job);

	if (!race) {
		throw new Error(
			`Failed to hydrate Mob: race "${data.race}" not found in archetype registry`
		);
	}
	if (!job) {
		throw new Error(
			`Failed to hydrate Mob: job "${data.job}" not found in archetype registry`
		);
	}

	const result: MobOptions = {
		...base,
		race,
		job,
		level: data.level,
		experience: data.experience,
		attributeBonuses: data.attributeBonuses,
		resourceBonuses: data.resourceBonuses,
		health: data.health,
		mana: data.mana,
		exhaustion: data.exhaustion,
		behaviors,
		// learnedAbilities will be handled separately during deserialization
		// (not passed through options since it needs Ability objects, not IDs)
	};

	/**
	 * Mob is the only DungeonObject with required fields in its constructor.
	 * Because of that, for type-safety, we need to assert that the options has the required fields.
	 * This is done by the assertMobOptions type guard.
	 */
	const pruned = pruneUndefined(result);
	assertMobOptions(pruned);
	return pruned;
}

/**
 * Template hydration functions convert migrated serialized data into proper template types.
 * Templates are essentially partial serialized objects with an id field, storing only differential fields.
 */

/**
 * Hydrates migrated serialized data into a DungeonObjectTemplate.
 * Removes runtime-only fields (oid, contents, location) and preserves template-specific fields.
 */
function hydrateTemplateData(
	data: SerializedDungeonObject,
	templateId: string
): DungeonObjectTemplate {
	// Extract only template-relevant fields (exclude runtime state)
	// id and type are required, so we don't prune them
	const pruned = pruneUndefined({
		keywords: data.keywords,
		display: data.display,
		description: data.description,
		roomDescription: data.roomDescription,
		mapText: data.mapText,
		mapColor: data.mapColor, // Keep as string (color name)
		baseWeight: data.baseWeight,
	});
	return {
		id: templateId,
		type: data.type,
		...pruned,
	};
}

/**
 * Hydrates migrated SerializedRoom data into a RoomTemplate.
 * Follows the class hierarchy: RoomTemplate -> DungeonObjectTemplate.
 */
function hydrateRoomTemplateData(
	data: SerializedRoom,
	templateId: string
): RoomTemplate {
	const base = hydrateTemplateData(data, templateId);
	const defaultExits =
		DIRECTION.NORTH |
		DIRECTION.SOUTH |
		DIRECTION.EAST |
		DIRECTION.WEST |
		DIRECTION.NORTHEAST |
		DIRECTION.NORTHWEST |
		DIRECTION.SOUTHEAST |
		DIRECTION.SOUTHWEST;
	return pruneUndefined({
		...base,
		type: "Room",
		allowedExits: data.allowedExits ?? defaultExits,
		dense: data.dense,
		// roomLinks is preserved from the original template data if present
		roomLinks: (
			data as SerializedRoom & { roomLinks?: Record<DirectionText, string> }
		).roomLinks,
	}) as RoomTemplate;
}

/**
 * Hydrates migrated SerializedMob data into a MobTemplate.
 * Keeps race/job as string IDs (not resolved to objects) since templates store IDs.
 * Follows the class hierarchy: MobTemplate -> DungeonObjectTemplate.
 */
function hydrateMobTemplateData(
	data: SerializedMob,
	templateId: string
): MobTemplate {
	const base = hydrateTemplateData(data, templateId);

	// Convert behaviors from serialized format (Record<string, boolean>) to template format
	const behaviors: Partial<Record<BEHAVIOR, boolean>> | undefined =
		data.behaviors
			? Object.fromEntries(
					Object.entries(data.behaviors)
						.filter(([key]) =>
							Object.values(BEHAVIOR).includes(key as BEHAVIOR)
						)
						.map(([key, value]) => [key as BEHAVIOR, !!value])
			  )
			: undefined;

	return pruneUndefined({
		...base,
		type: "Mob",
		race: data.race, // Keep as string ID
		job: data.job, // Keep as string ID
		level: data.level,
		experience: data.experience,
		attributeBonuses: data.attributeBonuses,
		resourceBonuses: data.resourceBonuses,
		health: data.health,
		mana: data.mana,
		exhaustion: data.exhaustion,
		behaviors,
	}) as MobTemplate;
}

/**
 * Hydrates migrated SerializedItem data into an ItemTemplate.
 * Follows the class hierarchy: ItemTemplate -> DungeonObjectTemplate.
 * Accepts SerializedItem or SerializedEquipment (which extends SerializedItem).
 */
function hydrateItemTemplateData(
	data: SerializedItem | SerializedEquipment,
	templateId: string
): ItemTemplate {
	const base = hydrateTemplateData(data, templateId);
	return {
		...base,
		type: data.type as ItemType,
	};
}

/**
 * Hydrates migrated SerializedEquipment data into an EquipmentTemplate.
 * Follows the class hierarchy: EquipmentTemplate -> ItemTemplate -> DungeonObjectTemplate.
 */
function hydrateEquipmentTemplateData(
	data: SerializedEquipment,
	templateId: string
): EquipmentTemplate {
	const base = hydrateItemTemplateData(data, templateId);
	return pruneUndefined({
		...base,
		type: data.type as equipmentType,
		slot: data.slot,
		attributeBonuses: data.attributeBonuses,
		resourceBonuses: data.resourceBonuses,
		secondaryAttributeBonuses: data.secondaryAttributeBonuses,
	}) as EquipmentTemplate;
}

/**
 * Hydrates migrated SerializedArmor data into an ArmorTemplate.
 * Follows the class hierarchy: ArmorTemplate -> EquipmentTemplate -> ItemTemplate -> DungeonObjectTemplate.
 */
function hydrateArmorTemplateData(
	data: SerializedArmor,
	templateId: string
): ArmorTemplate {
	const base = hydrateEquipmentTemplateData(data, templateId);
	return pruneUndefined({
		...base,
		type: "Armor",
		defense: data.defense,
	}) as ArmorTemplate;
}

/**
 * Hydrates migrated SerializedWeapon data into a WeaponTemplate.
 * Follows the class hierarchy: WeaponTemplate -> EquipmentTemplate -> ItemTemplate -> DungeonObjectTemplate.
 */
function hydrateWeaponTemplateData(
	data: SerializedWeapon,
	templateId: string
): WeaponTemplate {
	const base = hydrateEquipmentTemplateData(data, templateId);
	return pruneUndefined({
		...base,
		type: "Weapon",
		attackPower: data.attackPower,
		hitType: data.hitType,
		weaponType: data.weaponType,
	}) as WeaponTemplate;
}

/**
 * Generates the baseSerialized for a template by creating an instance and serializing it.
 * This is used to cache the baseline serialization for template compression.
 */
function generateTemplateBaseSerialized(
	template: DungeonObjectTemplate
): SerializedDungeonObject {
	if (template.type === "Room") {
		const roomTemplate = template as RoomTemplate;
		const room = new Room({
			coordinates: { x: 0, y: 0, z: 0 },
			templateId: template.id,
			oid: -1, // Baseline serialization uses -1
		});
		room.applyTemplate(roomTemplate);
		return room.serialize();
	} else {
		const obj = createFromTemplate(template, -1);
		return obj.serialize();
	}
}

/**
 * Deserializes a raw template (from YAML) into a proper DungeonObjectTemplate.
 * Handles the full pipeline: migration -> hydration -> baseSerialized generation.
 *
 * @param rawTemplate Raw template data from YAML (partial serialized object)
 * @param templateId The template ID (may need to be globalized)
 * @param dungeonId The dungeon ID for logging/error context
 * @param dungeonVersion The dungeon version (used if template has no version)
 * @returns A fully hydrated template with baseSerialized generated
 */
export async function deserializeTemplate(
	rawTemplate: unknown,
	templateId: string,
	dungeonId: string,
	dungeonVersion?: string
): Promise<DungeonObjectTemplate> {
	// Stage 1: Migrate template data
	const migratedData = await migrateTemplateData(
		rawTemplate,
		templateId,
		dungeonId,
		dungeonVersion
	);

	// Stage 2: Validate migrated data has a type
	if (!migratedData || typeof migratedData !== "object") {
		throw new Error(
			`[${dungeonId}] Template "${templateId}": Invalid template data after migration`
		);
	}

	const migratedObj = migratedData as Record<string, unknown>;
	const templateType = migratedObj.type as
		| SerializedDungeonObjectType
		| undefined;

	if (!templateType) {
		throw new Error(
			`[${dungeonId}] Template "${templateId}": Missing type field after migration`
		);
	}

	// Stage 3: Hydrate migrated data into proper template type
	let hydrated: DungeonObjectTemplate;
	switch (templateType) {
		case "Room": {
			hydrated = hydrateRoomTemplateData(
				migratedData as SerializedRoom,
				templateId
			);
			break;
		}
		case "Mob": {
			hydrated = hydrateMobTemplateData(
				migratedData as SerializedMob,
				templateId
			);
			break;
		}
		case "Item": {
			hydrated = hydrateItemTemplateData(
				migratedData as SerializedItem,
				templateId
			);
			break;
		}
		case "Equipment": {
			hydrated = hydrateEquipmentTemplateData(
				migratedData as SerializedEquipment,
				templateId
			);
			break;
		}
		case "Armor": {
			hydrated = hydrateArmorTemplateData(
				migratedData as SerializedArmor,
				templateId
			);
			break;
		}
		case "Weapon": {
			hydrated = hydrateWeaponTemplateData(
				migratedData as SerializedWeapon,
				templateId
			);
			break;
		}
		case "Prop": {
			hydrated = hydrateTemplateData(
				migratedData as SerializedProp,
				templateId
			);
			break;
		}
		case "Movable": {
			hydrated = hydrateTemplateData(
				migratedData as SerializedMovable,
				templateId
			);
			break;
		}
		case "DungeonObject": {
			hydrated = hydrateTemplateData(
				migratedData as SerializedDungeonObject,
				templateId
			);
			break;
		}
		default:
			throw new Error(
				`[${dungeonId}] Template "${templateId}": Unknown template type "${templateType}"`
			);
	}

	// Stage 4: Generate baseSerialized if not present
	if (!hydrated.baseSerialized) {
		hydrated.baseSerialized = generateTemplateBaseSerialized(hydrated);
	}

	return hydrated;
}

/**
 * Deserialize a SerializedMob into a Mob instance.
 * This handles the special case of looking up race, job, and abilities from package modules.
 *
 * @param data The serialized mob data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeMob(
	data: SerializedMob & { version?: string },
	migrate: boolean = true,
	parentVersion?: string
): Promise<Mob> {
	const version = data.version || parentVersion;
	logger.debug(
		`Deserializing Mob${data.keywords ? `: "${data.keywords}"` : ""} (race: ${
			data.race
		}, job: ${data.job})`
	);

	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		try {
			migratedData = await migrateMobData({ ...data, version }, data.keywords);
		} catch (error) {
			logger.warn(
				`Migration failed for Mob${
					data.keywords ? ` "${data.keywords}"` : ""
				}: ${error}`
			);
		}
	}

	const normalized = normalizeSerializedData(migratedData) as SerializedMob;
	const { equipped, learnedAbilities: learnedAbilitiesData, type } = normalized;

	// Use hydration function to convert serialized data to MobOptions
	const mobOptions = hydrateSerializedMobData(normalized);

	const mob = new Mob(mobOptions);
	logger.debug(`Mob instance created successfully`);

	// Restore learned abilities if provided
	if (learnedAbilitiesData) {
		logger.debug(
			`Restoring ${
				Object.keys(learnedAbilitiesData).length
			} learned ability/abilities`
		);
		const learnedAbilities = new Map<Ability, number>();
		for (const [abilityId, uses] of Object.entries(learnedAbilitiesData)) {
			const ability = getAbilityById(abilityId);
			if (ability) {
				learnedAbilities.set(ability, uses);
				mob._proficiencySnapshot.set(
					abilityId,
					getProficiencyAtUses(ability, uses)
				);
			} else {
				logger.warn(`Ability "${abilityId}" not found, skipping`);
			}
		}
		mob._learnedAbilities = learnedAbilities;
	}
	// Determine version to use for nested objects (mob's version or parent version)
	if (normalized.contents && Array.isArray(normalized.contents)) {
		logger.debug(`Restoring ${normalized.contents.length} content object(s)`);
		for (const contentData of normalized.contents) {
			const contentObj = await deserializeDungeonObject({
				...contentData,
				version,
			});
			mob.add(contentObj);
		}
	}
	// Restore equipped items
	if (equipped) {
		logger.debug(`Restoring ${Object.keys(equipped).length} equipped item(s)`);
		for (const [slotStr, equipmentData] of Object.entries(equipped)) {
			const slot = slotStr as EQUIPMENT_SLOT;
			// Handle both single items and arrays (for backward compatibility)
			if (Array.isArray(equipmentData)) {
				// Legacy format - take first item only
				const equipment = (await deserializeDungeonObjectWithMigration(
					equipmentData[0] as unknown as AnySerializedDungeonObject,
					migrate,
					version
				)) as Equipment;
				(mob as any)._equipped.set(slot, equipment);
				if (!mob.contains(equipment)) {
					mob.add(equipment);
				}
			} else {
				const equipment = (await deserializeDungeonObjectWithMigration(
					equipmentData as unknown as AnySerializedDungeonObject,
					migrate,
					version
				)) as Equipment;
				(mob as any)._equipped.set(slot, equipment);
				if (!mob.contains(equipment)) {
					mob.add(equipment);
				}
			}
		}
		// Recalculate attributes with equipment bonuses
		logger.debug(`Recalculating derived attributes with equipment bonuses`);
		mob.recalculateDerivedAttributes(mob.captureResourceRatios());
		logger.debug(`Mob deserialization complete`);
	}

	// Register in wandering mobs cache if wander behavior is enabled
	if (mob.hasBehavior(BEHAVIOR.WANDER) && !mob.character) {
		addWanderingMob(mob);
	}

	return mob;
}

export default {
	name: "dungeon",
	dependencies: [archetypePkg, abilityPkg],
	loader: async () => {
		await logger.block("dungeon", async () => {
			const dungeons = await loadDungeons();
			logger.info(
				`Dungeon persistence package loaded: ${dungeons.length} dungeon(s)`
			);
		});
	},
} as Package;
