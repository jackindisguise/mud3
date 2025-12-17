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
import effectPkg from "./effect.js";
import {
	getRaceById,
	getJobById,
	getDefaultRace,
	getDefaultJob,
} from "../registry/archetype.js";
import { initializeMobAI, cacheAIScript } from "../registry/mob-ai.js";
import { getAbilityById } from "../registry/ability.js";
import { getEffectTemplateById } from "../registry/effect.js";
import { Ability, getProficiencyAtUses } from "../core/ability.js";
import {
	registerDungeon,
	hasDungeon,
	createTunnel,
	getRoomByRef,
	resolveTemplateById,
	getAllDungeons,
	getDungeonById,
	createReset,
	countResetExisting,
	addResetSpawned,
} from "../registry/dungeon.js";
import { join, relative } from "path";
import { mkdir, readFile, access, readdir } from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../utils/logger.js";
import {
	Dungeon,
	Room,
	MapDimensions,
	Coordinates,
	DungeonObjectTemplate,
	RoomTemplate,
	MobTemplate,
	ItemTemplate,
	Reset,
	RoomLink,
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
import {
	ShopkeeperInventory,
	SerializedShopkeeperInventory,
	RestockRule,
} from "../core/shopkeeper.js";
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
import { COLOR_NAME_TO_COLOR, COLOR_NAMES, COLOR } from "../core/color.js";
import assert from "assert";
import {
	DIRECTION,
	dir2text,
	text2dir,
	dir2reverse,
	DirectionText,
} from "../utils/direction.js";
import { EffectOverrides } from "../core/effect.js";
import {
	getShopkeeperInventoryById,
	globalizeShopkeeperInventoryId,
	registerShopkeeperInventory,
} from "../registry/shopkeeper.js";
import { cycleInventory } from "../registry/shopkeeper.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const DUNGEON_DIR = join(DATA_DIRECTORY, "dungeons");

/**
 * Pending room links to be processed after all dungeons are loaded.
 */
const pendingRoomLinks: PendingRoomLink[] = [];

/**
 * Pending shopkeeper inventories to be processed after all dungeons are loaded.
 */
interface PendingShopkeeperInventory {
	dungeonId: string;
	serializedInv: SerializedShopkeeperInventory;
}

const pendingShopkeeperInventories: PendingShopkeeperInventory[] = [];

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
	version?: string;
	dungeon: {
		id?: string;
		name?: string;
		description?: string;
		dimensions: MapDimensions;
		grid: number[][][];
		rooms: Array<Omit<RoomTemplate, "id" | "type">>;
		templates?: DungeonObjectTemplate[];
		resets?: SerializedReset[];
		resetMessage?: string;
		exitOverrides?: Array<{
			coordinates: { x: number; y: number; z: number };
			allowedExits?: number;
			roomLinks?: Record<DirectionText, string>;
		}>;
		shopkeeperInventories?: SerializedShopkeeperInventory[];
	};
}

/**
 * Pending room links to be processed after all dungeons are loaded.
 * Stores room coordinates and their roomLinks data.
 */
interface PendingRoomLink {
	roomRef: string;
	direction: DirectionText;
	targetRoomRef: string;
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
type ItemOptions = MovableOptions & {
	isContainer?: boolean;
};

/**
 * Factory function to create a DungeonObject with an auto-generated OID.
 * This is the preferred way to create objects in package modules.
 */
export function createDungeonInstance(options: DungeonOptions): Dungeon {
	const dungeon = new Dungeon(options);
	if (dungeon.id) registerDungeonInstance(dungeon);
	return dungeon;
}

/**
 * Factory function to create a DungeonObject with an auto-generated OID.
 */
export function createDungeonObject(
	options?: DungeonObjectOptions
): DungeonObject {
	return new DungeonObject({
		...options,
		oid: options?.oid ?? getNextObjectId(),
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
 * Apply archetype passive effects to a mob.
 * This helper has access to the effect template registry.
 */
export function applyMobArchetypePassives(mob: Mob): void {
	mob.removeArchetypePassives();

	// Apply race passives
	for (const passiveId of mob.race.passives) {
		const template = getEffectTemplateById(passiveId);
		if (template) {
			mob.applyArchetypePassive(template);
		} else {
			logger.warn(
				`Race "${mob.race.id}" references passive effect "${passiveId}" which was not found in effect template registry`
			);
		}
	}

	// Apply job passives
	for (const passiveId of mob.job.passives) {
		const template = getEffectTemplateById(passiveId);
		if (template) {
			mob.applyArchetypePassive(template);
		} else {
			logger.warn(
				`Job "${mob.job.id}" references passive effect "${passiveId}" which was not found in effect template registry`
			);
		}
	}
}

/**
 * Check and teach archetype abilities to a mob based on current level.
 * This helper has access to the ability registry.
 * Returns an array of newly learned abilities.
 */
export function checkMobArchetypeAbilities(mob: Mob): Ability[] {
	const unlearned = mob.getUnlearnedArchetypeAbilities();
	const newlyLearned: Ability[] = [];

	for (const abilityDef of unlearned) {
		const ability = getAbilityById(abilityDef.id);
		if (!ability) {
			logger.warn(
				`Archetype references ability "${abilityDef.id}" which was not found in ability registry`
			);
			continue;
		}

		mob.learnArchetypeAbility(ability);
		newlyLearned.push(ability);
	}

	return newlyLearned;
}

/**
 * Factory function to create a Mob with an auto-generated OID.
 */
export function createMob(options?: MobOptions): Mob {
	const oid = options?.oid ?? getNextObjectId();
	const race = options?.race ?? getDefaultRace();
	const job = options?.job ?? getDefaultJob();
	const mob = new Mob({
		...options,
		race,
		job,
		oid,
	});

	// Apply archetype passives and abilities (requires registry access)
	applyMobArchetypePassives(mob);
	// Recalculate attributes after applying passives (passives can modify health/mana)
	// Preserve health/mana ratios when recalculating
	checkMobArchetypeAbilities(mob);

	// Initialize AI for NPC mobs (mobs without character)
	// Skip AI initialization for temporary template instances (OID -1) used for baseSerialized
	if (!mob.character && oid >= 0) {
		try {
			initializeMobAI(mob);
		} catch (error) {
			logger.error(`Failed to initialize AI for mob ${mob.oid}: ${error}`);
		}
	}

	return mob;
}

/**
 * Factory function to create a Room.
 * Note: Rooms do not use OIDs as they are identified by coordinates.
 */
export function createRoom(options: RoomOptions): Room {
	return new Room(options);
}

/**
 * Factory function to create a Movable with an auto-generated OID.
 */
export function createMovable(options?: MovableOptions): Movable {
	return new Movable({
		...options,
		oid: options?.oid ?? getNextObjectId(),
	});
}

/**
 * Factory function to create an Item with an auto-generated OID.
 */
export function createItem(options?: ItemOptions): Item {
	return new Item({
		...options,
		oid: options?.oid ?? getNextObjectId(),
	});
}

/**
 * Factory function to create a Prop with an auto-generated OID.
 */
export function createProp(options?: DungeonObjectOptions): Prop {
	return new Prop({
		...options,
		oid: options?.oid ?? getNextObjectId(),
	});
}

/**
 * Factory function to create Equipment with an auto-generated OID.
 */
export function createEquipment(options?: EquipmentOptions): Equipment {
	return new Equipment({
		...options,
		oid: options?.oid ?? getNextObjectId(),
	});
}

/**
 * Factory function to create Armor with an auto-generated OID.
 */
export function createArmor(options?: ArmorOptions): Armor {
	return new Armor({
		...options,
		oid: options?.oid ?? getNextObjectId(),
	});
}

/**
 * Factory function to create Weapon with an auto-generated OID.
 */
export function createWeapon(options?: WeaponOptions): Weapon {
	return new Weapon({
		...options,
		oid: options?.oid ?? getNextObjectId(),
	});
}

function dungeonObjectTemplateToOptions(
	template: DungeonObjectTemplate,
	oid: number
): DungeonObjectOptions {
	return {
		templateId: template.id,
		oid,
		keywords: template.keywords,
		display: template.display,
		description: template.description,
		roomDescription: template.roomDescription,
		mapText: template.mapText,
		mapColor: template.mapColor
			? COLOR_NAME_TO_COLOR[
					template.mapColor as keyof typeof COLOR_NAME_TO_COLOR
			  ]
			: undefined,
		baseWeight: template.baseWeight,
		value: template.value,
	};
}

/**
 * Convert a MobTemplate to MobOptions for use with createMob.
 */
function mobTemplateToOptions(template: MobTemplate, oid: number): MobOptions {
	// Resolve race/job string IDs to Race/Job objects
	const race = template.race
		? getRaceById(template.race) ?? getDefaultRace()
		: getDefaultRace();
	const job = template.job
		? getJobById(template.job) ?? getDefaultJob()
		: getDefaultJob();
	return {
		...dungeonObjectTemplateToOptions(template, oid),
		templateId: template.id,
		oid,
		behaviors: template.behaviors,
		aiScript: template.aiScript,
		level: template.level,
		experience: template.experience,
		attributeBonuses: template.attributeBonuses,
		resourceBonuses: template.resourceBonuses,
		health: template.health,
		mana: template.mana,
		exhaustion: template.exhaustion,
		race,
		job,
	};
}

function itemTemplateToOptions(
	template: ItemTemplate,
	oid: number
): ItemOptions {
	return {
		...dungeonObjectTemplateToOptions(template, oid),
		templateId: template.id,
		oid,
		isContainer: template.isContainer,
	};
}

/**
 * Convert an EquipmentTemplate to EquipmentOptions for use with createEquipment.
 */
function equipmentTemplateToOptions(
	template: EquipmentTemplate,
	oid: number
): EquipmentOptions {
	return {
		...itemTemplateToOptions(template, oid),
		templateId: template.id,
		oid,
		slot: template.slot ?? EQUIPMENT_SLOT.HEAD,
		attributeBonuses: template.attributeBonuses,
		resourceBonuses: template.resourceBonuses,
		secondaryAttributeBonuses: template.secondaryAttributeBonuses,
	};
}

/**
 * Convert an ArmorTemplate to ArmorOptions for use with createArmor.
 */
function armorTemplateToOptions(
	template: ArmorTemplate,
	oid: number
): ArmorOptions {
	return {
		...equipmentTemplateToOptions(template, oid),
		templateId: template.id,
		oid,
		defense: template.defense ?? 0,
	};
}

/**
 * Convert a WeaponTemplate to WeaponOptions for use with createWeapon.
 */
function weaponTemplateToOptions(
	template: WeaponTemplate,
	oid: number
): WeaponOptions {
	return {
		...equipmentTemplateToOptions(template, oid),
		templateId: template.id,
		oid,
		attackPower: template.attackPower ?? 0,
		hitType: template.hitType,
		type: template.weaponType ?? "shortsword",
	};
}

/**
 * Creates a new DungeonObject instance from a template.
 * This routes to the appropriate createEtc() function to avoid duplication.
 *
 * @param template - The template to create an object from
 * @param oid - Optional OID to assign. If not provided, a new OID will be generated.
 * @returns A new DungeonObject instance with template properties applied
 */
function createFromTemplate(
	template: DungeonObjectTemplate,
	oid?: number
): DungeonObject {
	const providedOid = oid ?? getNextObjectId();
	let obj: DungeonObject;

	// Route to the appropriate createEtc() function
	switch (template.type) {
		case "Room":
			throw new Error(
				"Room templates require coordinates - use createRoomFromTemplate() instead"
			);
		case "Mob": {
			const mobTemplate = template as MobTemplate;
			const options = mobTemplateToOptions(mobTemplate, providedOid);
			obj = createMob(options);
			// Resolve shopkeeper inventory if this mob template has one
			// Skip for temporary instances (OID -1) used for baseSerialized generation
			if (
				mobTemplate.shopkeeperInventoryId &&
				obj instanceof Mob &&
				providedOid !== -1
			) {
				logger.debug(
					`[createFromTemplate] Mob template "${mobTemplate.id}" has shopkeeperInventoryId: "${mobTemplate.shopkeeperInventoryId}"`
				);
				const inventory = getShopkeeperInventoryById(
					mobTemplate.shopkeeperInventoryId
				);
				if (inventory) {
					obj.setShopkeeperInventory(inventory);
					logger.debug(
						`[createFromTemplate] Successfully resolved and assigned shopkeeper inventory "${mobTemplate.shopkeeperInventoryId}" to mob ${obj.oid} from template "${mobTemplate.id}"`
					);
				} else {
					logger.warn(
						`[createFromTemplate] Shopkeeper inventory "${mobTemplate.shopkeeperInventoryId}" not found for mob ${obj.oid} from template "${mobTemplate.id}"`
					);
				}
			} else if (obj instanceof Mob && providedOid !== -1) {
				logger.debug(
					`[createFromTemplate] Mob ${obj.oid} from template "${mobTemplate.id}" has no shopkeeperInventoryId`
				);
			}
			break;
		}
		case "Equipment": {
			const equipmentTemplate = template as EquipmentTemplate;
			const options = equipmentTemplateToOptions(
				equipmentTemplate,
				providedOid
			);
			obj = createEquipment(options);
			break;
		}
		case "Armor": {
			const armorTemplate = template as ArmorTemplate;
			const options = armorTemplateToOptions(armorTemplate, providedOid);
			obj = createArmor(options);
			break;
		}
		case "Weapon": {
			const weaponTemplate = template as WeaponTemplate;
			const options = weaponTemplateToOptions(weaponTemplate, providedOid);
			obj = createWeapon(options);
			break;
		}
		case "Movable": {
			const options = dungeonObjectTemplateToOptions(template, providedOid);
			obj = createMovable(options);
			break;
		}
		case "Item": {
			const itemTemplate = template as ItemTemplate;
			const options = itemTemplateToOptions(itemTemplate, providedOid);
			obj = createItem(options);
			break;
		}
		case "Prop": {
			const options = dungeonObjectTemplateToOptions(template, providedOid);
			obj = createProp(options);
			break;
		}
		case "DungeonObject":
		default:
			const options = dungeonObjectTemplateToOptions(template, providedOid);
			obj = createDungeonObject(options);
			break;
	}

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
	const options = roomTemplateToOptions(template, coordinates);
	const room = new Room({
		...options,
	});
	return room;
}

function roomTemplateToOptions(
	template: RoomTemplate,
	coordinates: Coordinates
): RoomOptions {
	return {
		...dungeonObjectTemplateToOptions(template, -1),
		dense: template.dense,
		coordinates,
	};
}

/**
 * Sanitize dungeon ID for use as filename.
 * Allows alphanumerics, underscore, hyphen. Replaces others with underscore.
 */
function sanitizeDungeonId(id: string): string {
	return id
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/gi, "_");
}

/**
 * Get the file path for a dungeon by its ID.
 */
function getDungeonFilePath(id: string): string {
	const safe = sanitizeDungeonId(id);
	return join(DUNGEON_DIR, `${safe}.yaml`);
}

/**
 * Ensure the dungeon directory exists, creating it if needed.
 */
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

/**
 * Check if a file exists at the given path.
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, FS_CONSTANTS.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Convert a global template ID to a local one if it matches the dungeon.
 * If already global and matches dungeon, strip prefix.
 */
function localizeTemplateId(
	globalOrLocalId: string,
	dungeonId: string
): string {
	const m = globalOrLocalId.match(/^@([^:]+):(.+)$/);
	if (m) {
		const [, did, local] = m;
		return did === dungeonId ? local : globalOrLocalId;
	}
	return globalOrLocalId;
}

/**
 * Convert a local template ID to a global one by prefixing with dungeon ID.
 * If missing '@', prefix with @<dungeonId>:.
 */
function globalizeTemplateId(
	globalOrLocalId: string,
	dungeonId: string
): string {
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
			shopkeeperInventories,
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

					// Cache AI script if this is a Mob template with an AI script
					if (hydrated.type === "Mob") {
						const mobTemplate = hydrated as MobTemplate;
						const aiScript = mobTemplate.aiScript;
						if (aiScript) {
							let scriptToCache: string | undefined;
							if (aiScript.startsWith("file:")) {
								const filePath = aiScript.slice(5);
								const fullPath = join(getSafeRootDirectory(), "data", filePath);
								try {
									scriptToCache = await readFile(fullPath, "utf-8");
								} catch (error) {
									logger.error(
										`Failed to load AI script file for template ${globalizedId}: ${error}`
									);
								}
							} else {
								// Inline script
								scriptToCache = aiScript;
							}
							if (scriptToCache) {
								cacheAIScript(globalizedId, scriptToCache);
							}
						}
					}

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

				const reset = createReset({
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

		// Stage 10: Queue shopkeeper inventories for processing after all dungeons are loaded
		logger.debug(`[${id}] Stage 10: Queuing shopkeeper inventories`);
		if (shopkeeperInventories && Array.isArray(shopkeeperInventories)) {
			for (const serializedInv of shopkeeperInventories) {
				pendingShopkeeperInventories.push({
					dungeonId,
					serializedInv,
				});
				logger.debug(
					`[${id}] Queued shopkeeper inventory: ${serializedInv.id}`
				);
			}
			logger.debug(
				`[${id}] Stage 10 complete: Queued ${shopkeeperInventories.length} shopkeeper inventory/inventories`
			);
		} else {
			logger.debug(
				`[${id}] Stage 10 complete: No shopkeeper inventories to load`
			);
		}

		logger.debug(`[${id}] Stage 11: Processing room links`);
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
function processPendingShopkeeperInventories(): void {
	if (pendingShopkeeperInventories.length === 0) {
		logger.debug("No pending shopkeeper inventories to process");
		return;
	}

	logger.debug(
		`Processing ${pendingShopkeeperInventories.length} pending shopkeeper inventory/inventories`
	);

	for (const pending of pendingShopkeeperInventories) {
		const { dungeonId, serializedInv } = pending;
		try {
			// Globalize the inventory ID
			const globalizedId = globalizeShopkeeperInventoryId(
				serializedInv.id,
				dungeonId
			);

			// Resolve restock rule templates (now all dungeons are loaded, so templates should be available)
			const rules: RestockRule[] = [];
			for (const serializedRule of serializedInv.rules) {
				const template = resolveTemplateById(serializedRule.templateId);
				if (
					!template ||
					(template.type !== "Item" &&
						template.type !== "Equipment" &&
						template.type !== "Armor" &&
						template.type !== "Weapon")
				) {
					logger.warn(
						`[${dungeonId}] Shopkeeper inventory "${serializedInv.id}": template "${serializedRule.templateId}" not found or not an Item template, skipping rule`
					);
					continue;
				}

				rules.push({
					template: template as ItemTemplate,
					minimum: serializedRule.minimum,
					maximum: serializedRule.maximum,
					cycleDelay: serializedRule.cycleDelay,
					// cycleDelayRemaining is runtime-only, not loaded
				});
			}

			// Create inventory instance
			const inventory: ShopkeeperInventory = {
				id: globalizedId,
				buyPriceMultiplier: serializedInv.buyPriceMultiplier ?? 1.25,
				sellPriceMultiplier: serializedInv.sellPriceMultiplier ?? 0.75,
				stock: [], // Runtime only, will be populated by restock cycle
				rules,
			};

			// Register inventory
			try {
				registerShopkeeperInventory(inventory);
				logger.debug(
					`[${dungeonId}] Registered shopkeeper inventory: ${globalizedId}`
				);

				// Cycle inventory initially to populate stock
				cycleInventory(inventory);
			} catch (error) {
				logger.warn(
					`[${dungeonId}] Failed to register shopkeeper inventory "${globalizedId}": ${error}`
				);
			}
		} catch (error) {
			logger.warn(
				`[${dungeonId}] Failed to load shopkeeper inventory "${serializedInv.id}": ${error}`
			);
		}
	}

	logger.debug(
		`Processed ${pendingShopkeeperInventories.length} shopkeeper inventory/inventories`
	);
	// Clear the queue
	pendingShopkeeperInventories.length = 0;
}

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
			// createTunnel already creates two-way links, so we skip the duplicate
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
		createTunnel(fromRoom, direction, toRoom, oneWay);
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

	// Process all pending shopkeeper inventories after all dungeons are loaded
	processPendingShopkeeperInventories();

	return dungeons;
}

/**
 * Execute a reset with pre-resolved room and template.
 * This is the package-layer implementation that handles reset execution logic.
 *
 * @param reset The reset to execute
 * @param targetRoom The room to spawn objects in
 * @param template The template to create objects from
 * @returns Array of newly spawned objects
 */
function executeResetWithResolved(
	reset: Reset,
	targetRoom: Room,
	template: DungeonObjectTemplate
): DungeonObject[] {
	// Count existing spawned objects (anywhere in the game world)
	const existingCount = countResetExisting(reset);

	// If we're at or above max, don't spawn
	if (existingCount >= reset.maxCount) {
		return [];
	}

	// Calculate how many to spawn
	// We need at least minCount, but can spawn up to maxCount
	const needed = Math.max(
		reset.minCount - existingCount, // Need to reach minimum
		0
	);
	const canSpawn = reset.maxCount - existingCount; // Can spawn up to max

	// Spawn the needed objects (up to maxCount)
	const spawned: DungeonObject[] = [];
	const toSpawn = Math.min(needed, canSpawn);
	for (let i = 0; i < toSpawn; i++) {
		const obj = createFromTemplate(template);
		// Track which reset spawned this object BEFORE adding to room
		// This ensures spawnedByReset is set before location changes
		targetRoom.add(obj);
		spawned.push(obj);
		addResetSpawned(reset, obj);

		// If this is a Mob, handle equipped and inventory items
		if (obj instanceof Mob) {
			// Spawn and equip equipment templates
			if (reset.equipped) {
				for (const equipmentTemplateId of reset.equipped) {
					const equipmentTemplate = resolveTemplateById(equipmentTemplateId);
					if (!equipmentTemplate) {
						logger.warn(
							`Reset for template "${reset.templateId}" failed: equipment template "${equipmentTemplateId}" not found`
						);
						continue;
					}

					// Verify template is Equipment, Armor, or Weapon
					if (
						equipmentTemplate.type !== "Equipment" &&
						equipmentTemplate.type !== "Armor" &&
						equipmentTemplate.type !== "Weapon"
					) {
						logger.warn(
							`Reset for template "${reset.templateId}" failed: equipment template "${equipmentTemplateId}" is not an Equipment, Armor, or Weapon type (got "${equipmentTemplate.type}")`
						);
						continue;
					}

					const equipment = createFromTemplate(equipmentTemplate) as Equipment;
					obj.equip(equipment);
				}
			}

			// Spawn and add inventory item templates
			if (reset.inventory) {
				for (const itemTemplateId of reset.inventory) {
					const itemTemplate = resolveTemplateById(itemTemplateId);
					if (!itemTemplate) {
						logger.warn(
							`Reset for template "${reset.templateId}" failed: inventory template "${itemTemplateId}" not found`
						);
						continue;
					}

					const item = createFromTemplate(itemTemplate);
					obj.add(item);
				}
			}
		}
	}

	return spawned;
}

/**
 * Execute a single reset with template and room resolution.
 * This helper has access to the registry for resolving templates and rooms.
 *
 * @param reset The reset to execute
 * @param dungeon The dungeon containing the reset
 * @returns Array of newly spawned objects
 */
function executeReset(reset: Reset, dungeon: Dungeon): DungeonObject[] {
	// Resolve template
	const template = resolveTemplateById(reset.templateId);
	if (!template) {
		logger.warn(
			`Reset for template "${reset.templateId}" in dungeon "${dungeon.id}" failed: template not found`
		);
		return [];
	}

	// Resolve target room
	const targetRoom = getRoomByRef(reset.roomRef);
	if (!targetRoom) {
		logger.warn(
			`Reset for template "${reset.templateId}" in dungeon "${dungeon.id}" failed: room "${reset.roomRef}" not found`
		);
		return [];
	}

	// Execute reset with resolved dependencies
	return executeResetWithResolved(reset, targetRoom, template);
}

/**
 * Execute all resets for a dungeon.
 * This helper has access to the registry for resolving templates and rooms.
 *
 * @param dungeon The dungeon whose resets to execute
 * @returns Total number of objects spawned
 */
function executeDungeonResets(dungeon: Dungeon): number {
	let totalSpawned = 0;

	for (const reset of dungeon.resets) {
		const spawned = executeReset(reset, dungeon);
		totalSpawned += spawned.length;
	}

	return totalSpawned;
}

/**
 * Execute resets on all registered dungeons.
 */
export function executeAllDungeonResets(): void {
	let totalSpawned = 0;
	let dungeonCount = 0;

	for (const dungeon of getAllDungeons()) {
		// Execute resets - createFromTemplate auto-generates OIDs when not provided
		const spawned = executeDungeonResets(dungeon);
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
		value: data.value,
	});
}

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
	const base = hydrateSerializedMovableData(data);
	const itemData = data as SerializedItem;
	return {
		...base,
		...(itemData.isContainer !== undefined && {
			isContainer: itemData.isContainer,
		}),
	};
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
 * Filters and converts serialized behaviors to valid BEHAVIOR enum keys.
 * Removes any invalid behavior keys and ensures values are boolean.
 */
function filterBehaviors(
	behaviors: Record<string, boolean> | undefined
): Partial<Record<BEHAVIOR, boolean>> | undefined {
	return behaviors
		? Object.fromEntries(
				Object.entries(behaviors)
					.filter(([key]) => Object.values(BEHAVIOR).includes(key as BEHAVIOR))
					.map(([key, value]) => [key as BEHAVIOR, !!value])
		  )
		: undefined;
}

/**
 * Hydrates a SerializedMob into MobOptions.
 * Handles conversion of Mob-specific fields (behaviors, etc.) and resolves race/job from IDs.
 * This function requires runtime data (race/job registries) so it lives in the package layer.
 * Follows the class hierarchy: Mob -> Movable -> DungeonObject
 */
function hydrateSerializedMobData(data: SerializedMob): MobOptions {
	const base = hydrateSerializedMovableData(data);

	// filter out invalid behaviors
	const behaviors = filterBehaviors(data.behaviors);

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
		mapColor:
			data.mapColor !== undefined
				? typeof data.mapColor === "number"
					? COLOR_NAMES[data.mapColor as COLOR] // Convert integer to string
					: data.mapColor // Already a string
				: undefined,
		baseWeight: data.baseWeight,
		value: data.value,
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
	const base = hydrateTemplateData(data, templateId) as MobTemplate;

	// filter out invalid behaviors
	const behaviors = filterBehaviors(data.behaviors);

	// Extract shopkeeperInventoryId from raw data (it's not in SerializedMob but may be in YAML)
	const rawData = data as SerializedMob;

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
		aiScript: (data as any).aiScript, // AI script from template (if present)
		shopkeeperInventoryId: (data as any).shopkeeperInventoryId,
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
	const itemData = data as SerializedItem;
	return pruneUndefined({
		...base,
		type: data.type as ItemType,
		isContainer: itemData.isContainer,
		value: itemData.value,
	}) as ItemTemplate;
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
		const room = createRoomFromTemplate(roomTemplate, { x: 0, y: 0, z: 0 });
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
	logger.debug(`Deserializing Mob`, data);
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

	logger.debug(`Migrated data`, migratedData);
	const normalized = normalizeSerializedData(migratedData) as SerializedMob;
	logger.debug(`Normalized data`, normalized);
	const { equipped, learnedAbilities: learnedAbilitiesData, type } = normalized;

	// Use hydration function to convert serialized data to MobOptions
	const mobOptions = hydrateSerializedMobData(normalized);
	logger.debug(`Mob options`, mobOptions);

	const mob = createMob(mobOptions);
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

	// Learn archetype abilities
	checkMobArchetypeAbilities(mob);

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
		mob.recalculateDerivedAttributes();
	}

	// Re-apply archetype passive effects (race and job passives)
	// These are not serialized and must be re-applied on deserialization
	applyMobArchetypePassives(mob);

	// Restore effects (excluding archetype passives which are re-applied above)
	if (normalized.effects && Array.isArray(normalized.effects)) {
		logger.debug(`Restoring ${normalized.effects.length} effect(s)`);
		for (const serializedEffect of normalized.effects) {
			const template = getEffectTemplateById(serializedEffect.effectId);
			if (!template) {
				logger.warn(
					`Effect template "${serializedEffect.effectId}" not found, skipping effect`
				);
				continue;
			}

			// Find caster by OID (search through all dungeons)
			let caster: Mob | undefined;
			for (const dungeon of getAllDungeons()) {
				// Search through all objects in the dungeon
				for (const obj of dungeon.contents) {
					if (obj.oid === serializedEffect.casterOid && obj instanceof Mob) {
						caster = obj;
						break;
					}
				}
				if (caster) break;
			}

			// If caster not found, use the mob itself as fallback (shouldn't happen for non-archetype effects)
			if (!caster) {
				logger.warn(
					`Caster with OID ${serializedEffect.casterOid} not found for effect "${serializedEffect.effectId}", using mob itself as fallback`
				);
				caster = mob;
			}

			// Restore effect using addEffect with restoration overrides
			// This ensures proper initialization, timer setup, and type safety
			const now = Date.now();
			const overrides: EffectOverrides = {};

			// Calculate expiresAt from remainingDuration
			if (serializedEffect.remainingDuration !== undefined) {
				overrides.expiresAt = now + serializedEffect.remainingDuration;
			} else {
				// Permanent effect
				overrides.expiresAt = Number.MAX_SAFE_INTEGER;
			}

			// Calculate nextTickAt from nextTickIn
			if (serializedEffect.nextTickIn !== undefined) {
				overrides.nextTickAt = now + serializedEffect.nextTickIn;
			}

			// Include other optional fields
			if (serializedEffect.ticksRemaining !== undefined) {
				overrides.ticksRemaining = serializedEffect.ticksRemaining;
			}
			if (serializedEffect.tickAmount !== undefined) {
				overrides.tickAmount = serializedEffect.tickAmount;
			}
			if (serializedEffect.remainingAbsorption !== undefined) {
				overrides.remainingAbsorption = serializedEffect.remainingAbsorption;
			}

			mob.addEffect(template, caster, overrides);
		}
		mob.recalculateDerivedAttributes();
	}

	mob.health = mobOptions.health ?? mob.maxHealth;
	mob.mana = mobOptions.mana ?? mob.maxMana;
	mob.exhaustion = mobOptions.exhaustion ?? 0;
	return mob;
}

export default {
	name: "dungeon",
	dependencies: [archetypePkg, abilityPkg, effectPkg],
	loader: async () => {
		await logger.block("dungeon", async () => {
			const dungeons = await loadDungeons();
			logger.info(
				`Dungeon persistence package loaded: ${dungeons.length} dungeon(s)`
			);
		});
	},
} as Package;
