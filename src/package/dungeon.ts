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
	DungeonOptions,
} from "../core/dungeon.js";
import YAML from "js-yaml";
import { Package } from "package-loader";
import { getSafeRootDirectory } from "../utils/path.js";
import { getNextObjectId } from "../registry/gamestate.js";
import { migrateDungeonData } from "../migrations/dungeon/runner.js";
import { migrateMobData } from "../migrations/mob/runner.js";
import { migrateItemData } from "../migrations/item/runner.js";
import { migrateEquipmentData } from "../migrations/equipment/runner.js";
import { migrateArmorData } from "../migrations/armor/runner.js";
import { migrateWeaponData } from "../migrations/weapon/runner.js";

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
			// Mob templates should have race/job resolved to objects by this point
			const race =
				typeof mobTemplate.race === "string"
					? getDefaultRace()
					: mobTemplate.race ?? getDefaultRace();
			const job =
				typeof mobTemplate.job === "string"
					? getDefaultJob()
					: mobTemplate.job ?? getDefaultJob();
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
		exitOverrides?: Record<
			string,
			| number // allowedExits bitmask override
			| { allowedExits?: number; roomLinks?: Record<DirectionText, string> } // allowedExits and/or roomLinks override
		>; // Dictionary: "x,y,z" -> bitmask, roomLinks object, or both
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
					logger.debug(
						`[${id}] Creating room at (${x},${y},${z}) from template index ${templateIndex}`
					);
					const room = createRoomFromTemplate(fullTemplate, {
						x,
						y,
						z,
					});
					totalRoomsCreated++;

					// Apply exit override if present (before adding to dungeon)
					// Store roomLinks from exitOverrides to process after room is added
					let exitOverrideRoomLinks: Record<DirectionText, string> | undefined;
					if (exitOverrides && typeof exitOverrides === "object") {
						const coordKey = `${x},${y},${z}`;
						const override = exitOverrides[coordKey];
						if (override !== undefined) {
							if (typeof override === "number") {
								// Integer bitmask override for allowedExits
								room.allowedExits = override;
							} else if (typeof override === "object" && override !== null) {
								// Object with allowedExits and/or roomLinks override
								if (
									"allowedExits" in override &&
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
			for (const template of templates) {
				if (!template.id) {
					logger.warn(`[${id}] Skipping invalid template: missing id`);
					continue;
				}
				logger.debug(
					`[${id}] Loading template "${template.id}" (type: ${template.type})`
				);
				const hydrated: DungeonObjectTemplate = {
					...template,
					id: globalizeTemplateId(template.id, dungeon.id!),
				};

				// For Mob templates, resolve race/job IDs to Race/Job objects before adding
				if (hydrated.type === "Mob") {
					const mobTemplate = hydrated as MobTemplate;
					if (mobTemplate.race && typeof mobTemplate.race === "string") {
						logger.debug(
							`[${id}] Resolving race "${mobTemplate.race}" for template "${template.id}"`
						);
						const race = getRaceById(mobTemplate.race);
						if (!race) {
							throw new Error(
								`Template "${template.id}": race "${mobTemplate.race}" not found in archetype registry`
							);
						}
						(mobTemplate as any).race = race;
					}
					if (mobTemplate.job && typeof mobTemplate.job === "string") {
						logger.debug(
							`[${id}] Resolving job "${mobTemplate.job}" for template "${template.id}"`
						);
						const job = getJobById(mobTemplate.job);
						if (!job) {
							throw new Error(
								`Template "${template.id}": job "${mobTemplate.job}" not found in archetype registry`
							);
						}
						(mobTemplate as any).job = job;
					}
				}

				// Generate baseSerialized for the template (package layer responsibility)
				if (!hydrated.baseSerialized) {
					logger.debug(
						`[${id}] Generating baseSerialized for template "${template.id}"`
					);
					if (hydrated.type === "Room") {
						const room = new Room({
							coordinates: { x: 0, y: 0, z: 0 },
							templateId: hydrated.id,
							oid: -1, // Baseline serialization uses -1
						});
						room.applyTemplate(hydrated as RoomTemplate);
						hydrated.baseSerialized = room.serialize();
					} else {
						const obj = createFromTemplate(hydrated);
						hydrated.baseSerialized = obj.serialize();
					}
				}

				try {
					dungeon.addTemplate(hydrated);
					logger.debug(`[${id}] Template "${template.id}" loaded successfully`);
				} catch (error) {
					logger.error(
						`[${id}] Failed to load template "${template.id}": ${error}`
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
	shouldMigrate: boolean = true
): Promise<DungeonObject> {
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

	// Delegate to type-specific deserializers (migrate: false since we already migrated)
	switch (type) {
		case "Room":
			return await deserializeRoom(normalized as SerializedRoom, true);
		case "Mob":
			return await deserializeMob(normalized as SerializedMob, true);
		case "Equipment":
			return await deserializeEquipment(
				normalized as SerializedEquipment,
				true
			);
		case "Armor":
			return await deserializeArmor(normalized as SerializedArmor, true);
		case "Weapon":
			return await deserializeWeapon(normalized as SerializedWeapon, true);
		case "Movable":
			return await deserializeMovable(normalized as SerializedMovable, true);
		case "Item":
			return await deserializeItem(normalized as SerializedItem, true);
		case "Prop":
			return await deserializeProp(normalized as SerializedProp);
		case "DungeonObject":
			// handled in main body
			break;
		default:
			throw new Error(`no valid type to deserialize: ${String(type)}`);
	}

	// DungeonObjects in particular
	let obj: DungeonObject = new DungeonObject(typed);

	// Handle contents for all object types
	if (typed.contents) {
		logger.debug(
			`Deserializing ${typed.contents.length} content object(s) for ${type}`
		);
		for (const contentData of typed.contents) {
			const contentObj = await deserializeDungeonObject(contentData);
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
	migrate: boolean = true
): Promise<Room> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as SerializedRoom & { version?: string };
		try {
			// Rooms don't have their own migration system yet, but we can add it here later
			migratedData = dataWithVersion;
		} catch (error) {
			logger.warn(`Migration failed for Room: ${error}`);
		}
	}

	const norm = normalizeSerializedData(migratedData);
	// allowedExits is mandatory, but handle legacy data that might not have it
	const defaultExits =
		DIRECTION.NORTH | DIRECTION.SOUTH | DIRECTION.EAST | DIRECTION.WEST;
	// Remove oid if present - Rooms don't use OIDs (identified by coordinates)
	const { oid, ...roomData } = norm;
	const room = new Room({
		...roomData,
		allowedExits: norm.allowedExits ?? defaultExits,
	});
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObject(contentData);
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
	migrate: boolean = true
): Promise<Movable> {
	const norm = normalizeSerializedData(data) as SerializedMovable;
	const movable = new Movable(norm);
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObject(contentData);
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
export async function deserializeProp(data: SerializedProp): Promise<Prop> {
	const norm = normalizeSerializedData(data);
	const prop = new Prop(norm);
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObject(contentData);
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
	migrate: boolean = true
): Promise<Item> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion: SerializedItem & { version?: string } = data;
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

	const norm = normalizeSerializedData(
		migratedData
	) as unknown as SerializedItem;
	const item = new Item(norm as SerializedItem);
	if (norm.contents && Array.isArray(norm.contents)) {
		for (const contentData of norm.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate
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
	migrate: boolean = true
): Promise<Equipment> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as any & { version?: string };
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

	const { type, ...equipmentData } = normalizeSerializedData(
		migratedData
	) as SerializedEquipment;
	const equipment = new Equipment({
		...equipmentData,
		slot: equipmentData.slot,
		attributeBonuses: equipmentData.attributeBonuses,
		resourceBonuses: equipmentData.resourceBonuses,
		secondaryAttributeBonuses: equipmentData.secondaryAttributeBonuses,
	});
	if (equipmentData.contents && Array.isArray(equipmentData.contents)) {
		for (const contentData of equipmentData.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate
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
	migrate: boolean = true
): Promise<Armor> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as any & { version?: string };
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

	const armorData = normalizeSerializedData(migratedData) as SerializedArmor;
	const armor = new Armor({
		...armorData,
		slot: armorData.slot,
		defense: armorData.defense ?? 0,
		attributeBonuses: armorData.attributeBonuses,
		resourceBonuses: armorData.resourceBonuses,
		secondaryAttributeBonuses: armorData.secondaryAttributeBonuses,
	});
	if (armorData.contents && Array.isArray(armorData.contents)) {
		for (const contentData of armorData.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate
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
	migrate: boolean = true
): Promise<Weapon> {
	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as any & { version?: string };
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

	const weaponData = normalizeSerializedData(
		migratedData
	) as unknown as SerializedWeapon;
	const weapon = new Weapon({
		...weaponData,
		slot: weaponData.slot,
		attackPower: weaponData.attackPower ?? 0,
		hitType: weaponData.hitType,
		type: weaponData.weaponType ?? "shortsword",
		attributeBonuses: weaponData.attributeBonuses,
		resourceBonuses: weaponData.resourceBonuses,
		secondaryAttributeBonuses: weaponData.secondaryAttributeBonuses,
	});
	if (weaponData.contents && Array.isArray(weaponData.contents)) {
		for (const contentData of weaponData.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate
			);
			weapon.add(contentObj);
		}
	}
	return weapon;
}

/**
 * Deserialize a SerializedMob into a Mob instance.
 * This handles the special case of looking up race, job, and abilities from package modules.
 *
 * @param data The serialized mob data
 * @param migrate Whether to apply migrations (default: true)
 */
export async function deserializeMob(
	data: SerializedMob,
	migrate: boolean = true
): Promise<Mob> {
	logger.debug(
		`Deserializing Mob${data.keywords ? `: "${data.keywords}"` : ""} (race: ${
			data.race
		}, job: ${data.job})`
	);

	// Apply migrations if requested
	let migratedData = data;
	if (migrate) {
		const dataWithVersion = data as any & { version?: string };
		try {
			migratedData = (await migrateMobData(
				dataWithVersion as any,
				data.keywords
			)) as any;
		} catch (error) {
			logger.warn(
				`Migration failed for Mob${
					data.keywords ? ` "${data.keywords}"` : ""
				}: ${error}`
			);
		}
	}

	const normalized = normalizeSerializedData(migratedData) as SerializedMob;
	const {
		race: raceId,
		job: jobId,
		equipped,
		learnedAbilities: learnedAbilitiesData,
		type,
		...rest
	} = normalized;

	// Explicitly remove race and job from rest to prevent string IDs from overwriting resolved objects
	const { race: _race, job: _job, ...mobOptions } = rest as any;

	const race = getRaceById(raceId);
	const job = getJobById(jobId);

	// Validate that race and job were found
	if (!race) {
		logger.error(`Race "${raceId}" not found in archetype registry`);
		throw new Error(
			`Failed to deserialize Mob: race "${raceId}" not found in archetype registry`
		);
	}
	if (!job) {
		logger.error(`Job "${jobId}" not found in archetype registry`);
		throw new Error(
			`Failed to deserialize Mob: job "${jobId}" not found in archetype registry`
		);
	}

	const mob = new Mob({
		race,
		job,
		...mobOptions,
	});
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
	if (normalized.contents && Array.isArray(normalized.contents)) {
		logger.debug(`Restoring ${normalized.contents.length} content object(s)`);
		for (const contentData of normalized.contents) {
			const contentObj = await deserializeDungeonObjectWithMigration(
				contentData,
				migrate
			);
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
					migrate
				)) as Equipment;
				(mob as any)._equipped.set(slot, equipment);
				if (!mob.contains(equipment)) {
					mob.add(equipment);
				}
			} else {
				const equipment = (await deserializeDungeonObjectWithMigration(
					equipmentData as unknown as AnySerializedDungeonObject,
					migrate
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
