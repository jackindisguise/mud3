/**
 * Three-dimensional dungeon/world model with rooms, movement, links, and serialization.
 *
 * Provides a grid-based `Dungeon` with `Room`s, movable entities,
 * a global dungeon registry, and helpers for resolving room references from strings.
 * This is the core world module.
 *
 * Note: Direction utilities have been moved to `../direction.js`.
 * They are re-exported here for backward compatibility.
 *
 * What you get
 *   `isNorthward`/`isSouthward`/`isEastward`/`isWestward`
 * - Core types: `Coordinates`, `MapDimensions`, `DungeonOptions`
 * - Registry and lookup: `DUNGEON_REGISTRY`, `getDungeonById(id)`, `ROOM_LINKS`
 * - Reference parsing: `getRoomByRef("@id{x,y,z}")`
 * - Classes: `Dungeon`, `DungeonObject`, `Room`, `Movable`, `Mob`, `Item`, `Prop`, `RoomLink`,
 *   `Equipment`, `Armor`, `Weapon`
 * - Attribute types: `PrimaryAttributeSet`, `SecondaryAttributeSet`, `ResourceCapacities`,
 *   `ResourceSnapshot`
 * - Equipment types: `EQUIPMENT_SLOT`, `EquipmentOptions`, `ArmorOptions`, `WeaponOptions`
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
 * import { createTunnel } from "../registry/dungeon.js";
 * const a = dungeon.getRoom({ x: 2, y: 2, z: 0 })!;
 * const b = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
 * createTunnel(a, DIRECTION.NORTH, b);
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
 * @module core/dungeon
 */

import { isDeepStrictEqual } from "node:util";
import { EventEmitter } from "events";
import { string } from "mud-ext";
import { color, COLOR, COLOR_NAMES, COLOR_NAME_TO_COLOR } from "./color.js";
import logger from "../utils/logger.js";
import { Race, Job, evaluateGrowthModifier } from "../core/archetype.js";
import { Character, MESSAGE_GROUP } from "../core/character.js";
import { act } from "../utils/act.js";
import { forEachCharacter } from "../game.js";
import {
	removeFromCombatQueue,
	handleDeath,
	initiateCombat,
	addToCombatQueue,
	processThreatSwitching,
	handleNPCLeavingCombat,
} from "../registry/combat.js";
import { setAbsoluteInterval, clearCustomInterval } from "accurate-intervals";
import {
	HitType,
	DEFAULT_HIT_TYPE,
	COMMON_HIT_TYPES,
	mergeDamageRelationships,
	DamageTypeRelationships,
	DAMAGE_TYPE,
} from "./damage-types.js";
import { Ability } from "./ability.js";
import { getProficiencyAtUses } from "./ability.js";
import { addToRegenerationSet } from "../registry/regeneration.js";
import {
	EffectInstance,
	EffectTemplate,
	EffectOverrides,
	isPassiveEffect,
	isDamageOverTimeEffect,
	isHealOverTimeEffect,
	isShieldEffect,
	isEffectExpired,
	SerializedEffect,
} from "./effect.js";
import {
	addToEffectsSet,
	removeFromEffectsSet,
	setupEffectTimers,
	clearEffectTimersForEffect,
} from "../registry/effects.js";
import {
	PrimaryAttributeSet,
	SecondaryAttributeSet,
	ResourceCapacities,
	ResourceSnapshot,
	HEALTH_PER_VITALITY,
	MANA_PER_WISDOM,
	ATTRIBUTE_ROUND_DECIMALS,
	clampNumber,
	roundTo,
	sumPrimaryAttributes,
	sumSecondaryAttributes,
	multiplyPrimaryAttributes,
	sumResourceCaps,
	multiplyResourceCaps,
	normalizePrimaryBonuses,
	normalizeResourceBonuses,
	prunePrimaryBonuses,
	pruneResourceBonuses,
	computeSecondaryAttributes,
	createPrimaryAttributesView,
	createSecondaryAttributesView,
	createResourceCapsView,
} from "./attribute.js";
import {
	DIRECTION,
	type DirectionText,
	dir2text,
	dir2reverse,
	isNorthward,
	isSouthward,
	isEastward,
	isWestward,
} from "../utils/direction.js";
import { checkMobArchetypeAbilities } from "../package/dungeon.js";
import { resolveTemplateById } from "../registry/dungeon.js";
import { ShopkeeperInventory } from "./shopkeeper.js";

const IS_TEST_MODE = Boolean(process.env.NODE_TEST_CONTEXT);
let testObjectIdCounter = -1;

/**
 * Threat expiration interval in milliseconds.
 * Threat entries expire every 10 seconds.
 */
const THREAT_EXPIRATION_INTERVAL_MS = 10 * 1000; // 10 seconds

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
	name?: string;
	dimensions: MapDimensions;
	resetMessage?: string;
	description?: string;
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
	 * Array of resets that define objects to spawn in this dungeon.
	 * @private
	 */
	private _resets: Reset[] = [];

	/**
	 * Registry of object templates used by resets in this dungeon.
	 * Maps template IDs to their template definitions.
	 * @private
	 */
	private _templates: Map<string, DungeonObjectTemplate> = new Map();
	private _resetMessage?: string;
	private _name: string;
	private _description?: string;

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
	static generateEmptyDungeon(
		options: DungeonOptions,
		roomOptions?: Partial<RoomOptions>
	) {
		const dungeon = new Dungeon(options);
		dungeon.generateRooms(roomOptions);
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
		const derivedName = (
			options.name ??
			options.id ??
			"Untitled Dungeon"
		).trim();
		this._name = derivedName;
		this._description = options.description?.trim();
		this._resetMessage = options.resetMessage?.trim();
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
	 * Set the persistent dungeon id.
	 * Note: Registration is handled by the package layer, not the core class.
	 */
	private set id(id: string) {
		this._id = id;
	}

	/**
	 * Gets the dimensions of this dungeon.
	 * Returns a copy of the dungeon's width, height, and layers.
	 *
	 * @returns The dungeon dimensions
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({ dimensions: { width: 10, height: 10, layers: 3 } });
	 * const dims = dungeon.dimensions;
	 * console.log(dims.width, dims.height, dims.layers); // 10, 10, 3
	 * ```
	 */
	get dimensions(): MapDimensions {
		return {
			width: this._dimensions.width,
			height: this._dimensions.height,
			layers: this._dimensions.layers,
		};
	}

	public get resetMessage(): string | undefined {
		return this._resetMessage;
	}

	public set resetMessage(message: string | undefined) {
		this._resetMessage = message?.trim();
	}

	public get name(): string {
		return this._name;
	}

	public set name(value: string) {
		const trimmed = value?.trim();
		if (!trimmed) {
			throw new Error("Dungeon name cannot be empty");
		}
		this._name = trimmed;
	}

	public get description(): string | undefined {
		return this._description;
	}

	public set description(value: string | undefined) {
		const trimmed = value?.trim();
		this._description = trimmed || undefined;
	}

	public broadcast(
		message: string,
		group: MESSAGE_GROUP = MESSAGE_GROUP.SYSTEM
	): void {
		forEachCharacter((character) => {
			if (character.mob!.dungeon !== this) return;
			character.sendMessage(message, group);
		});
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
	 * Completely destroy this dungeon, unregister it, and remove all its contents.
	 * This clears all rooms, objects, and the dungeon's registration from the global registry.
	 * After calling this method, the dungeon should not be used anymore.
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({
	 *   id: "temp-dungeon",
	 *   dimensions: { width: 5, height: 5, layers: 1 }
	 * });
	 *
	 * // Use the dungeon...
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * const mob = new Movable();
	 * room.add(mob);
	 *
	 * // Clean up when done
	 * dungeon.destroy();
	 *
	 * // Dungeon is now unregistered and empty
	 * console.log(getDungeonById("temp-dungeon")); // undefined
	 * console.log(dungeon.contents.length); // 0
	 * ```
	 */
	destroy() {
		// Remove any room links that reference this dungeon's rooms
		// Note: This requires registry access, so the actual cleanup is done
		// by the package layer or via removeDungeonRoomLinks() helper

		// Note: Unregistration is handled by the package layer if needed
		this._id = undefined;

		// Remove all objects from contents
		// Make a copy to avoid modifying array during iteration
		const allContents = [...this._contents];
		for (const obj of allContents) {
			// Unset the object's dungeon reference
			if (obj.dungeon === this) {
				obj.dungeon = undefined;
			}
		}

		// Clear the contents array
		this._contents = [];

		// Clear the rooms grid
		this._rooms = [];
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
	generateRooms(options?: Partial<RoomOptions>) {
		for (let z = 0; z < this._dimensions.layers; z++)
			for (let y = 0; y < this._dimensions.height; y++)
				for (let x = 0; x < this._dimensions.width; x++)
					this.createRoom({ coordinates: { x, y, z }, ...options });
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
		const room = this.getRoom(coordinates);
		// Don't return dense rooms
		if (room?.dense) return undefined;
		return room;
	}

	/**
	 * Gets a copy of the resets array.
	 *
	 * @returns Array of resets for this dungeon
	 *
	 * @example
	 * ```typescript
	 * const dungeon = Dungeon.generateEmptyDungeon({
	 *   dimensions: { width: 10, height: 10, layers: 1 }
	 * });
	 *
	 * const resets = dungeon.resets;
	 * console.log(`Dungeon has ${resets.length} resets`);
	 * ```
	 */
	get resets(): readonly Reset[] {
		return [...this._resets];
	}

	/**
	 * Adds a reset to this dungeon.
	 *
	 * @param reset The reset to add
	 *
	 * @example
	 * ```typescript
	 * const reset = createReset({
	 *   templateId: "coin-gold",
	 *   roomRef: "@tower{0,0,0}",
	 *   minCount: 2,
	 *   maxCount: 5
	 * });
	 * dungeon.addReset(reset);
	 * ```
	 */
	addReset(reset: Reset): void {
		if (this._resets.includes(reset)) return;
		this._resets.push(reset);
	}

	/**
	 * Removes a reset from this dungeon.
	 *
	 * @param reset The reset to remove
	 *
	 * @example
	 * ```typescript
	 * dungeon.removeReset(reset);
	 * ```
	 */
	removeReset(reset: Reset): void {
		const index = this._resets.indexOf(reset);
		if (index !== -1) {
			this._resets.splice(index, 1);
		}
	}

	/**
	 * Gets the template registry for this dungeon.
	 *
	 * @returns Map of template IDs to templates
	 *
	 * @example
	 * ```typescript
	 * const templates = dungeon.templates;
	 * const goblinTemplate = templates.get("goblin");
	 * ```
	 */
	get templates(): Map<string, DungeonObjectTemplate> {
		return this._templates;
	}

	/**
	 * Adds a template to this dungeon's template registry.
	 *
	 * @param template The template to add
	 *
	 * @example
	 * ```typescript
	 * dungeon.addTemplate({
	 *   id: "coin-gold",
	 *   type: "Item",
	 *   display: "Gold Coin"
	 * });
	 * ```
	 */
	addTemplate(template: DungeonObjectTemplate): void {
		// baseSerialized is populated by the package layer during dungeon loading
		// Core layer just stores the template
		this._templates.set(template.id, template);
	}

	/**
	 * Removes a template from this dungeon's template registry.
	 *
	 * @param templateId The ID of the template to remove
	 *
	 * @example
	 * ```typescript
	 * dungeon.removeTemplate("coin-gold");
	 * ```
	 */
	removeTemplate(templateId: string): void {
		this._templates.delete(templateId);
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
	oid?: number;
	keywords?: string;
	display?: string;
	description?: string;
	roomDescription?: string;
	mapText?: string;
	mapColor?: COLOR;
	dungeon?: Dungeon;
	baseWeight?: number;
	templateId?: string;
	value?: number;
	isContainer?: boolean;
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
	allowedExits?: DIRECTION; // Bitmask of allowed exit directions (defaults to NSEW + diagonals if not provided)
	dense?: boolean; // Whether this room is dense (solid/impassable)
}

export interface ItemOptions extends DungeonObjectOptions {
	isContainer?: boolean;
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
 * @property baseWeight - The intrinsic weight of the object (optional)
 * Note: currentWeight is not serialized as it is calculated at runtime from baseWeight and contents.
 */
export interface SerializedDungeonObject {
	type: SerializedDungeonObjectType;
	oid?: number; // Optional: present for instances, absent for templates
	version?: string; // Project version when this object was serialized
	keywords: string;
	display: string;
	templateId?: string;
	description?: string;
	roomDescription?: string;
	mapText?: string;
	mapColor?: string; // Color name string (e.g., "red", "blue")
	contents?: SerializedDungeonObject[];
	location?: string; // RoomRef value
	baseWeight?: number;
	value?: number;
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
	allowedExits: DIRECTION; // Mandatory field - always present
	dense?: boolean; // Whether this room is dense (solid/impassable)
}

/**
 * Serialized form for Movable objects.
 * Currently identical to base form but defined for type safety and future extensions.
 */
export interface SerializedMovable extends SerializedDungeonObject {
	type: "Movable";
}

export interface SerializedMob extends SerializedDungeonObject {
	type: "Mob";
	level: number;
	experience: number;
	race: string;
	job: string;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	health: number;
	mana: number;
	exhaustion: number;
	equipped?: Record<
		EQUIPMENT_SLOT,
		SerializedEquipment | SerializedArmor | SerializedWeapon
	>;
	/** Behavior flags serialized as strings (enum values) */
	behaviors?: Record<string, boolean>;
	/** Learned abilities map (ability id -> number of uses) */
	learnedAbilities?: Record<string, number>;
	/** Active effects (excluding archetype passives) */
	effects?: SerializedEffect[];
}

/**
 * Represents the changes that occurred when a mob leveled up.
 * Contains before/after comparisons of attributes, capacities, and newly learned abilities.
 */
export interface LevelUpChanges {
	oldPrimary: Readonly<PrimaryAttributeSet>;
	newPrimary: Readonly<PrimaryAttributeSet>;
	oldSecondary: Readonly<SecondaryAttributeSet>;
	newSecondary: Readonly<SecondaryAttributeSet>;
	oldMaxHealth: number;
	newMaxHealth: number;
	oldMaxMana: number;
	newMaxMana: number;
	newLevel: number;
	newlyLearnedAbilities: Ability[];
}

/**
 * Serialized form for Item objects.
 * Currently identical to base form but defined for type safety and future extensions.
 */
export interface SerializedItem extends SerializedDungeonObject {
	type: "Item" | equipmentType;
	isContainer?: boolean;
}

/**
 * Serialized form for Prop objects.
 * Currently identical to base form but defined for type safety and future extensions.
 */
export interface SerializedProp extends SerializedDungeonObject {
	type: "Prop";
}

/**
 * Type union representing the different equipment types.
 */
export type equipmentType = "Equipment" | "Armor" | "Weapon";

/**
 * Serialized form for Equipment objects.
 * Used for persistence and template storage. All equipment properties are included.
 *
 * @property type - The equipment type ("Equipment", "Armor", or "Weapon")
 * @property slot - The equipment slot this item occupies
 * @property defense - Defense value (0 for Weapons and base Equipment)
 * @property attributeBonuses - Optional primary attribute bonuses
 * @property resourceBonuses - Optional resource capacity bonuses
 * @property secondaryAttributeBonuses - Optional secondary attribute bonuses
 */
export interface SerializedEquipment extends SerializedItem {
	type: equipmentType;
	slot: EQUIPMENT_SLOT;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	secondaryAttributeBonuses?: Partial<SecondaryAttributeSet>;
}

export interface SerializedArmor extends SerializedEquipment {
	type: "Armor";
	defense: number;
}

export interface SerializedWeapon extends SerializedEquipment {
	type: "Weapon";
	attackPower: number;
	hitType?: string;
	weaponType?: WeaponType;
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
	| "Prop"
	| "Equipment"
	| "Armor"
	| "Weapon";

/**
 * Union type representing any valid serialized dungeon object form.
 */
export type AnySerializedDungeonObject =
	| SerializedDungeonObject
	| SerializedRoom
	| SerializedMovable
	| SerializedMob
	| SerializedItem
	| SerializedProp
	| SerializedEquipment
	| SerializedArmor
	| SerializedWeapon;

/**
 * Template definition for dungeon objects.
 * Templates store only fields that differ from the base object's default values.
 * This allows efficient storage and on-demand loading of object definitions.
 * Note: Contents are runtime state and are not stored in templates.
 *
 * @property id - Unique identifier for this template
 * @property type - The type of dungeon object this template creates
 * @property keywords - Optional keywords override (only included if different from default)
 * @property display - Optional display name override (only included if different from default)
 * @property description - Optional description override (only included if different from default)
 * @property baseWeight - Optional base weight override (only included if different from default 0)
 *
 * @example
 * ```typescript
 * // Template that only overrides display, description, and weight
 * const template: DungeonObjectTemplate = {
 *   id: "sword-basic",
 *   type: "Item",
 *   display: "Iron Sword",
 *   description: "A well-crafted iron sword.",
 *   baseWeight: 3.5
 *   // keywords not included - uses default "dungeon object"
 * };
 * ```
 */
export interface DungeonObjectTemplate {
	id: string;
	type: SerializedDungeonObjectType;
	keywords?: string;
	display?: string;
	description?: string;
	roomDescription?: string;
	mapText?: string;
	mapColor?: string; // Color name string (e.g., "red", "blue")
	baseWeight?: number;
	value?: number;
	/**
	 * Optional cached baseline serialization produced by this template.
	 * When present, compression/normalization can diff against this
	 * instead of a plain type baseline.
	 */
	baseSerialized?: SerializedDungeonObject;
}

/**
 * Template definition specifically for Room objects.
 * Extends DungeonObjectTemplate with room-specific properties.
 *
 * @property allowedExits - Bitmask of allowed exit directions (only for Room templates)
 */
export interface RoomTemplate extends DungeonObjectTemplate {
	type: "Room";
	allowedExits: DIRECTION; // Mandatory field - always present
	dense?: boolean; // Whether this room is dense (solid/impassable)
	/**
	 * Room links defined on this template.
	 * Keys are direction names (e.g., "north", "up") and values are room references (e.g., "@tower{0,0,1}").
	 * Links are processed after all dungeons are loaded, and bidirectional links are automatically detected.
	 */
	roomLinks?: Record<DirectionText, string>;
}

export type ItemType = "Item" | equipmentType;

export interface ItemTemplate extends DungeonObjectTemplate {
	type: ItemType;
	isContainer?: boolean;
}

/**
 * Template definition specifically for Equipment objects.
 * Extends DungeonObjectTemplate with equipment-specific properties.
 *
 * @property slot - The equipment slot this item occupies when equipped (required)
 * @property attributeBonuses - Optional primary attribute bonuses
 * @property resourceBonuses - Optional resource capacity bonuses
 * @property secondaryAttributeBonuses - Optional secondary attribute bonuses
 */
export interface EquipmentTemplate extends ItemTemplate {
	type: equipmentType;
	slot: EQUIPMENT_SLOT;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	secondaryAttributeBonuses?: Partial<SecondaryAttributeSet>;
}

/**
 * Template definition specifically for Armor objects.
 * Extends DungeonObjectTemplate with armor-specific properties.
 *
 * @property slot - The equipment slot this armor occupies when equipped (required)
 * @property defense - Defense value provided by this armor (required)
 * @property attributeBonuses - Optional primary attribute bonuses
 * @property resourceBonuses - Optional resource capacity bonuses
 * @property secondaryAttributeBonuses - Optional secondary attribute bonuses
 */
export interface ArmorTemplate extends EquipmentTemplate {
	type: "Armor";
	slot: EQUIPMENT_SLOT;
	defense: number;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	secondaryAttributeBonuses?: Partial<SecondaryAttributeSet>;
}

/**
 * Template definition specifically for Weapon objects.
 * Extends DungeonObjectTemplate with weapon-specific properties.
 *
 * @property slot - The equipment slot this weapon occupies when equipped (required)
 * @property attackPower - Attack power value provided by this weapon (required)
 * @property hitType - Optional hit type (verb and damage type)
 * @property attributeBonuses - Optional primary attribute bonuses
 * @property resourceBonuses - Optional resource capacity bonuses
 * @property secondaryAttributeBonuses - Optional secondary attribute bonuses
 */
export interface WeaponTemplate extends EquipmentTemplate {
	type: "Weapon";
	attackPower: number;
	hitType?: string;
	weaponType?: WeaponType;
}

/**
 * Template definition specifically for Mob objects.
 * Extends DungeonObjectTemplate with mob-specific properties.
 *
 * @property race - Race ID string (optional, uses default if not provided)
 * @property job - Job ID string (optional, uses default if not provided)
 * @property level - Starting level (optional, defaults to 1)
 * @property experience - Starting experience points (optional, defaults to 0)
 * @property attributeBonuses - Optional primary attribute bonuses
 * @property resourceBonuses - Optional resource capacity bonuses
 * @property health - Starting health points (optional, defaults to maxHealth)
 * @property mana - Starting mana points (optional, defaults to maxMana)
 * @property exhaustion - Starting exhaustion level (optional, defaults to 0)
 * @property behaviors - Optional behavior flags for NPCs
 *
 * @example
 * ```typescript
 * import { BEHAVIOR } from "./dungeon.js";
 *
 * const goblinTemplate: MobTemplate = {
 *   id: "goblin-warrior",
 *   type: "Mob",
 *   keywords: "goblin warrior",
 *   display: "A Fierce Goblin Warrior",
 *   description: "A small but aggressive goblin armed with a rusty sword.",
 *   race: "goblin",
 *   job: "warrior",
 *   level: 5,
 *   behaviors: {
 *     [BEHAVIOR.AGGRESSIVE]: true,
 *     [BEHAVIOR.WANDER]: true
 *   }
 * };
 * ```
 */
export interface MobTemplate extends DungeonObjectTemplate {
	type: "Mob";
	race?: string;
	job?: string;
	level?: number;
	experience?: number;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	health?: number;
	mana?: number;
	exhaustion?: number;
	behaviors?: Partial<Record<BEHAVIOR, boolean>>;
	/** Optional AI script for mob behavior. Can be inline code or file path (prefix with "file:") */
	aiScript?: string;
	/** Shopkeeper inventory ID (local or globalized @dungeon-id<inventory-id>) */
	shopkeeperInventoryId?: string;
}

/**
 * Options for creating a Reset.
 *
 * @property templateId - The ID of the template to spawn
 * @property roomRef - Room reference string in format "@dungeon-id{x,y,z}"
 * @property minCount - Minimum number of objects that should exist (default: 1)
 * @property maxCount - Maximum number of objects that can exist (default: 1)
 * @property equipped - Optional array of template IDs for equipment to spawn and equip on Mobs
 * @property inventory - Optional array of template IDs for items to spawn and add to Mob inventory
 */
export interface ResetOptions {
	templateId: string;
	roomRef: string;
	minCount?: number;
	maxCount?: number;
	equipped?: string[];
	inventory?: string[];
}

/**
 * A Reset defines an object that should spawn in a dungeon room.
 * Resets track minimum and maximum counts, and automatically spawn
 * objects when the count falls below the minimum.
 *
 * For Mob resets, you can specify `equipped` and `inventory` arrays:
 * - `equipped`: Template IDs for Equipment/Armor/Weapon that are spawned
 *   and automatically equipped on the mob.
 * - `inventory`: Template IDs for any items that are spawned and added
 *   to the mob's inventory.
 *
 * @example
 * ```typescript
 * // Create a reset that spawns 2-5 coins in a room
 * const reset = createReset({
 *   templateId: "coin-gold",
 *   roomRef: "@tower{0,0,0}",
 *   minCount: 2,
 *   maxCount: 5
 * });
 *
 * // Create a mob reset with equipment and inventory
 * const mobReset = createReset({
 *   templateId: "goblin-warrior",
 *   roomRef: "@dungeon{1,2,0}",
 *   equipped: ["sword-basic", "helmet-iron"],
 *   inventory: ["potion-healing", "coin-gold"]
 * });
 * ```
 */
export interface Reset {
	/**
	 * The ID of the template to spawn.
	 */
	readonly templateId: string;

	/**
	 * Room reference string in format "@dungeon-id{x,y,z}".
	 */
	readonly roomRef: string;

	/**
	 * Minimum number of objects that should exist.
	 * When resetting, if the count is below this, objects will be spawned.
	 * Default: 1
	 */
	readonly minCount: number;

	/**
	 * Maximum number of objects that can exist.
	 * When resetting, if the count is at or above this, no objects will be spawned.
	 * Default: 1
	 */
	readonly maxCount: number;

	/**
	 * Array of template IDs for equipment to spawn and equip on the mob.
	 * Only applies when spawning Mob objects.
	 */
	readonly equipped?: string[];

	/**
	 * Array of template IDs for items to spawn and add to the mob's inventory.
	 * Only applies when spawning Mob objects.
	 */
	readonly inventory?: string[];
}

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
	 * Unique object identifier (OID) assigned to every dungeon object.
	 * This ID persists across game instances and is tracked in gamestate.
	 */
	readonly oid: number;

	/**
	 * Space-separated list of words that can be used to identify this object.
	 * Used by the match() method for object identification and targeting.
	 */
	keywords: string = "dungeon object";

	/**
	 * If constructed from a template, this records the template id.
	 * Undefined for ad-hoc objects.
	 */
	templateId?: string;

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
	 * One-line description shown when this object appears in a room.
	 * If undefined, the room will display the object's display string instead.
	 * Used for contextual descriptions like "A shining, long piece of metal is here."
	 */
	roomDescription?: string;

	/**
	 * Text character to display on the minimap for this object.
	 * If undefined, the minimap will use default symbols (e.g., "!" for mobs).
	 */
	mapText?: string;

	/**
	 * Color to use when displaying this object on the minimap.
	 * If undefined, the minimap will use default colors.
	 */
	mapColor?: COLOR;

	/**
	 * The intrinsic weight of this object, not including contents.
	 * The currentWeight property tracks the total weight including contents.
	 */
	baseWeight: number = 0;

	/**
	 * Current total weight of this object including all contained objects.
	 * This is automatically managed through add() and remove() operations
	 * and propagates up the containment chain.
	 */
	currentWeight: number = 0;

	/**
	 * Monetary value of this object.
	 * Used for currency and items that have a gold value.
	 */
	value: number = 0;

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
	 * Reference to the Reset that spawned this object, if any.
	 * Used to notify the reset when this object is destroyed or moves to a different dungeon.
	 * Setting this property automatically adds/removes the object from the reset's tracking list.
	 * @private
	 */
	private _spawnedByReset?: Reset;

	/**
	 * Gets the Reset that spawned this object, if any.
	 */
	get spawnedByReset(): Reset | undefined {
		return this._spawnedByReset;
	}

	/**
	 * Sets the Reset that spawned this object.
	 * When set, the object will be added to the reset's tracking list.
	 * When unset, the object will be removed from the reset's tracking list.
	 *
	 * @param reset The reset to assign, or `undefined` to remove
	 *
	 * @example
	 * ```typescript
	 * const reset = createReset({ templateId: "goblin", roomRef: "@dungeon{0,0,0}" });
	 * const obj = new DungeonObject();
	 * obj.spawnedByReset = reset; // obj is now tracked in reset.spawned
	 * ```
	 */
	set spawnedByReset(reset: Reset | undefined) {
		if (this.spawnedByReset === reset) return;

		// Note: The actual tracking in the reset registry is handled by
		// the helper functions in registry/dungeon.ts (addResetSpawned/removeResetSpawned).
		// This setter only updates the local property. Callers should use the
		// helper functions to properly maintain both sides of the relationship.
		this._spawnedByReset = reset;
	}

	/**
	 * Create a new DungeonObject.
	 *
	 * @param options Optional initialization values
	 * @param options.keywords Space-delimited keywords
	 * @param options.display Human-readable display string
	 * @param options.description Longer descriptive text
	 * @param options.dungeon If provided, the object will be added to that dungeon
	 * @param options.baseWeight The intrinsic weight of the object (default: 0)
	 *
	 * @example
	 * ```typescript
	 * const sword = new DungeonObject({ keywords: "steel sword", display: "A Sword", baseWeight: 2.5 });
	 * const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
	 * sword.dungeon = dungeon; // adds sword to dungeon.contents
	 * ```
	 */
	constructor(options?: DungeonObjectOptions) {
		// Assign unique object ID (OID) - use provided oid if deserializing, otherwise default to -1
		// Package layer should provide OID via factory functions for new objects
		if (options?.oid !== undefined) {
			this.oid = options.oid;
		} else if (IS_TEST_MODE) {
			this.oid = testObjectIdCounter--;
		} else {
			// Default to -1 - package layer will provide OID via factory functions
			this.oid = -1;
		}

		if (!options) return;
		if (options.dungeon) this.dungeon = options.dungeon;
		if (options.keywords) this.keywords = options.keywords;
		if (options.display) this.display = options.display;
		if (options.description) this.description = options.description;
		if (options.roomDescription) this.roomDescription = options.roomDescription;
		if (options.mapText) this.mapText = options.mapText;
		if (options.mapColor !== undefined) this.mapColor = options.mapColor;
		if (options.baseWeight !== undefined) {
			this.baseWeight = options.baseWeight;
			this.currentWeight = options.baseWeight;
		}
		if (options.templateId) this.templateId = options.templateId;
		if (options.value !== undefined) this.value = options.value;
	}

	toString() {
		return this.display;
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

		// If we were spawned by a reset and are moving to a different dungeon (or being removed),
		// notify the reset to stop tracking us
		// Note: Room resolution requires registry access, so this is handled by package layer
		if (this.spawnedByReset && dungeon) {
			// If we have a location, check if it's in a different dungeon
			if (this.location?.dungeon && this.location.dungeon !== dungeon) {
				this.spawnedByReset = undefined;
			}
		}

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
	 * Weight changes are automatically propagated up the containment chain.
	 *
	 * @param dobjs The objects to add to this container
	 *
	 * @example
	 * ```typescript
	 * const chest = new DungeonObject({ keywords: "chest" });
	 * const coin = new Item({ keywords: "coin", baseWeight: 0.1 });
	 * const gem = new Item({ keywords: "gem", baseWeight: 0.2 });
	 *
	 * // Add multiple items at once
	 * chest.add(coin, gem);
	 *
	 * // Items are now in the chest
	 * console.log(chest.contains(coin)); // true
	 * console.log(coin.location === chest); // true
	 * // Weight is automatically updated
	 * console.log(chest.currentWeight); // 0.3 (coin + gem weights)
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

			// Add the object's current weight to this container's weight
			this._addWeight(obj.currentWeight);
		}
	}

	/**
	 * Remove objects from this container's contents.
	 * Also unsets each object's location if it points to this container.
	 * Objects not found in the contents are ignored. This method maintains
	 * containment consistency by ensuring both the contents array and location
	 * references are updated.
	 * Weight changes are automatically propagated up the containment chain.
	 *
	 * @param dobjs The objects to remove from this container
	 *
	 * @example
	 * ```typescript
	 * const chest = new DungeonObject({ keywords: "chest" });
	 * const coin = new Item({ keywords: "coin", baseWeight: 0.1 });
	 *
	 * // Add and then remove an item
	 * chest.add(coin);
	 * console.log(chest.contains(coin)); // true
	 * console.log(chest.currentWeight); // 0.1
	 *
	 * chest.remove(coin);
	 * console.log(chest.contains(coin)); // false
	 * console.log(coin.location === undefined); // true
	 * console.log(chest.currentWeight); // 0 (weight removed)
	 *
	 * // Removing an item that's not contained is ignored
	 * chest.remove(coin); // no effect
	 * ```
	 */
	remove(...dobjs: DungeonObject[]) {
		for (let obj of dobjs) {
			const index = this._contents.indexOf(obj);
			if (index === -1) continue;

			// Remove the object's current weight from this container's weight
			this._removeWeight(obj.currentWeight);

			this._contents.splice(index, 1);
			if (obj.location === this) obj.move(undefined);
		}
	}

	/**
	 * Internal method to add weight and propagate up the containment chain.
	 * @private
	 */
	private _addWeight(weight: number): void {
		this.currentWeight += weight;
		// Propagate weight change up to parent container
		if (this.location) {
			this.location._addWeight(weight);
		}
	}

	/**
	 * Internal method to remove weight and propagate up the containment chain.
	 * @private
	 */
	private _removeWeight(weight: number): void {
		this.currentWeight -= weight;
		// Propagate weight change up to parent container
		if (this.location) {
			this.location._removeWeight(weight);
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
	serialize(options?: {
		compress?: boolean;
		version?: string;
	}): SerializedDungeonObject {
		const locationRef =
			this.location instanceof Room ? this.location.getRoomRef() : undefined;
		const serializedContents = this._contents.map((obj) =>
			obj.serialize(options)
		);

		// Uncompressed/base form includes selected keys even when undefined
		const uncompressed: SerializedDungeonObject = {
			...(options?.version && { version: options.version }),
			type: this.constructor.name as SerializedDungeonObjectType,
			oid: this.oid, // Always include oid for instances
			keywords: this.keywords,
			display: this.display,
			...(this.templateId !== undefined && { templateId: this.templateId }),
			// Always include these keys in base serialization, even if undefined
			description: this.description,
			roomDescription: this.roomDescription,
			mapText: this.mapText,
			mapColor:
				this.mapColor !== undefined ? COLOR_NAMES[this.mapColor] : undefined,
			...(serializedContents.length > 0 && { contents: serializedContents }),
			...(locationRef && { location: locationRef }),
			...(this.baseWeight !== 0 && { baseWeight: this.baseWeight }),
			...(this.value !== 0 && { value: this.value }),
		};

		if (options?.compress) {
			return compressSerializedObject(uncompressed, this.templateId);
		}

		return uncompressed;
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

	/**
	 * Gets the serialized form of a base/default object of this type.
	 * Used as a reference for determining which fields differ from defaults.
	 *
	 * @returns Serialized form of a default object of this type
	 */
	private static getBaseSerialized(
		type: SerializedDungeonObjectType
	): SerializedDungeonObject {
		const baseSerialized = baseSerializedTypes[type];
		if (!baseSerialized) {
			throw new Error(`No base serialized data registered for type '${type}'.`);
		}

		return baseSerialized;
	}

	// templateId now lives as a public optional field on the instance

	/**
	 * Creates a template from this object, storing only fields that differ from defaults.
	 * This is useful for saving object definitions efficiently.
	 *
	 * @param id - Unique identifier for the template
	 * @returns A template containing only differential fields
	 *
	 * @example
	 * ```typescript
	 * const sword = new Item({
	 *   keywords: "iron sword",
	 *   display: "Iron Sword",
	 *   description: "A well-crafted iron sword."
	 * });
	 * const template = sword.toTemplate("sword-basic");
	 * // template only includes fields that differ from defaults
	 * ```
	 */
	toTemplate(id: string): DungeonObjectTemplate {
		// Serialize this object
		const serialized = this.serialize();

		// Get the base serialized object for comparison
		const baseSerialized = DungeonObject.getBaseSerialized(
			this.constructor.name as SerializedDungeonObjectType
		);

		// Start with id and type
		const template: DungeonObjectTemplate = {
			id,
			type: serialized.type,
		};

		// Only include fields that differ from the base
		for (const field in serialized) {
			// Skip contents, location, and oid - they are runtime state, not template data
			if (field === "contents" || field === "location" || field === "oid") {
				continue;
			}

			const serializedValue =
				serialized[field as keyof SerializedDungeonObject];
			const baseValue = baseSerialized[field as keyof SerializedDungeonObject];
			if (serializedValue !== baseValue) {
				template[field as keyof DungeonObjectTemplate] =
					serializedValue as unknown as never;
			}
		}

		return template;
	}

	/**
	 * Completely destroy this object, removing all references and clearing all relationships.
	 * This method:
	 * - Removes the object from its location/container
	 * - Removes the object from its dungeon
	 * - Destroys all contained objects recursively
	 * - Clears reset tracking
	 * - Clears all internal references
	 *
	 * After calling this method, the object should not be used anymore.
	 *
	 * @param destroyContents If true (default), recursively destroys all contained objects. If false, just clears the contents array.
	 *
	 * @example
	 * ```typescript
	 * const item = new DungeonObject({ keywords: "test item" });
	 * room.add(item);
	 * item.destroy(); // Removes from room, clears all references
	 * ```
	 */
	destroy(destroyContents: boolean = true): void {
		// Clear reset tracking first (before removing from location/dungeon)
		this.spawnedByReset = undefined;

		// Remove from location (this will remove from container's contents)
		this.location = undefined;

		// Remove from dungeon (this will remove from dungeon's contents)
		this.dungeon = undefined;

		// Destroy or clear all contained objects
		const contentsCopy = [...this._contents];
		this._contents = [];
		if (destroyContents) {
			for (const obj of contentsCopy) {
				obj.destroy(destroyContents);
			}
		}

		// Clear weight
		this.currentWeight = 0;
		this.baseWeight = 0;

		// Clear all properties to help with garbage collection
		this.keywords = "";
		this.display = "<DESTROYED OBJECT>";
		this.description = undefined;
		this.roomDescription = undefined;
		this.mapText = undefined;
		this.mapColor = undefined;
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
	 * Bitmask of allowed exit directions from this room.
	 * By default, only NSEW are allowed. UP and DOWN must be explicitly enabled.
	 * This is a mandatory field - when set to 0, no exits are allowed.
	 */
	allowedExits: DIRECTION;

	/**
	 * Whether this room is "dense" (solid/impassable).
	 * Dense rooms cannot be entered, are treated as if they don't exist,
	 * and cannot be looked into. Used for solid walls and barriers.
	 */
	dense: boolean;

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
		// Default allowedExits: NSEW + diagonals (not UP/DOWN)
		this.allowedExits =
			options.allowedExits ??
			DIRECTION.NORTH |
				DIRECTION.SOUTH |
				DIRECTION.EAST |
				DIRECTION.WEST |
				DIRECTION.NORTHEAST |
				DIRECTION.NORTHWEST |
				DIRECTION.SOUTHEAST |
				DIRECTION.SOUTHWEST;
		// Default dense to false
		this.dense = options.dense ?? false;
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
		// Links override allowedExits
		if (this._links) {
			for (const link of this._links) {
				const destination = getRoomLinkDestination(link, this, dir);
				if (destination) {
					// Don't return dense rooms
					if (destination.dense) return undefined;
					return destination;
				}
			}
		}
		// If no link handles this direction, check allowedExits
		// Only return a room if the direction is allowed
		if ((this.allowedExits & dir) === 0) {
			return undefined;
		}
		// Direction is allowed, use normal spatial navigation
		const targetRoom = this.dungeon?.getStep(this, dir);
		// Don't return dense rooms
		if (targetRoom?.dense) return undefined;
		return targetRoom;
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
		// Dense rooms cannot be entered
		if (this.dense) return false;
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
		if (direction === undefined) return true;

		// Links override allowedExits - if there's a link in this direction, allow exit
		if (this._links) {
			for (const link of this._links) {
				const destination = getRoomLinkDestination(link, this, direction);
				if (destination) {
					return true; // Link exists, allow exit regardless of allowedExits
				}
			}
		}

		// No link found, check if the direction is in the allowedExits bitmask
		return (this.allowedExits & direction) !== 0;
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
	onEnter(movable: Movable, direction?: DIRECTION) {
		// Process aggressive behavior: aggressive mobs attack character mobs that enter
		if (movable instanceof Mob) {
			const enterer = movable as Mob;

			// Emit entrance event for all existing mobs in room (they see someone enter)
			for (const obj of this.contents) {
				if (obj instanceof Mob && obj !== enterer) {
					const emitter = obj.aiEvents;
					if (emitter) {
						emitter.emit("entrance", enterer);
						emitter.emit("sight", enterer);
					}
				}
			}

			// Emit entrance event for the entering mob (they see existing mobs)
			const entererEmitter = enterer.aiEvents;
			if (entererEmitter) {
				// Emit entrance for each existing mob in the room
				for (const obj of this.contents) {
					if (obj instanceof Mob && obj !== enterer) {
						entererEmitter.emit("sight", obj);
					}
				}
			}
		}
	}

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
	onExit(movable: Movable, direction?: DIRECTION) {
		// Emit exit event for all mobs in room (they see someone leave)
		if (movable instanceof Mob) {
			const exiter = movable as Mob;
			for (const obj of this.contents) {
				if (obj instanceof Mob && obj !== exiter) {
					const emitter = obj.aiEvents;
					if (emitter) {
						emitter.emit("exit", exiter);
					}
				}
			}

			// Emit exit event for the exiting mob (they see existing mobs they're leaving behind)
			const exiterEmitter = exiter.aiEvents;
			if (exiterEmitter) {
				for (const obj of this.contents) {
					if (obj instanceof Mob && obj !== exiter) {
						exiterEmitter.emit("exit", obj);
					}
				}
			}
		}
	}

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
	serialize(options?: {
		compress?: boolean;
		version?: string;
	}): SerializedRoom {
		const base = {
			...(options?.version && { version: options.version }),
			...super.serialize(options),
		};
		// Remove oid from serialization - Rooms are identified by coordinates, not OIDs
		const { oid, ...baseDataWithoutOid } = base;
		const result: SerializedRoom = {
			...baseDataWithoutOid,
			type: "Room" as const,
			coordinates: this.coordinates,
			allowedExits: this.allowedExits, // Mandatory field
			...(this.dense && { dense: this.dense }), // Only include if true
		};
		return result;
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

/**
 * Options for the move() method.
 * Allows script injection at various points during movement.
 */
export interface MoveOptions {
	/** The destination location to move to */
	location: DungeonObject | undefined;
	/** Whether to trigger room entry/exit events (defaults to true) */
	triggerEvents?: boolean;
	/** Scripts to inject at various points during movement */
	scripts?: {
		/** Script to run before onExit is called */
		beforeOnExit?: (movable: Movable, room: Room) => void;
		/** Script to run after onExit is called */
		afterOnExit?: (movable: Movable, room: Room) => void;
		/** Script to run before onEnter is called */
		beforeOnEnter?: (movable: Movable, room: Room) => void;
		/** Script to run after onEnter is called */
		afterOnEnter?: (movable: Movable, room: Room) => void;
	};
}

/**
 * Options for the step() method.
 * Allows script injection at various points during movement.
 */
export interface StepOptions {
	/** The direction to step */
	direction: DIRECTION;
	/** Scripts to inject at various points during movement */
	scripts?: {
		/** Script to run before onExit is called */
		beforeOnExit?: (movable: Movable, room: Room, direction: DIRECTION) => void;
		/** Script to run after onExit is called */
		afterOnExit?: (movable: Movable, room: Room, direction: DIRECTION) => void;
		/** Script to run before onEnter is called */
		beforeOnEnter?: (
			movable: Movable,
			room: Room,
			direction: DIRECTION
		) => void;
		/** Script to run after onEnter is called */
		afterOnEnter?: (movable: Movable, room: Room, direction: DIRECTION) => void;
	};
}

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
	 * Hook called after a successful step.
	 * Override this method to implement custom behavior after movement.
	 *
	 * @param direction The direction that was moved
	 * @param destinationRoom The room that was entered
	 *
	 * @example
	 * ```typescript
	 * class TrackingMob extends Mob {
	 *   onStep(direction: DIRECTION, destinationRoom: Room) {
	 *     console.log(`Moved ${dir2text(direction)} to room at ${destinationRoom.x}, ${destinationRoom.y}`);
	 *   }
	 * }
	 * ```
	 */
	onStep(direction: DIRECTION, destinationRoom: Room): void {}

	/**
	 * Moves this object to a new container, triggering appropriate movement events.
	 * Supports both legacy and new options-based signatures.
	 *
	 * @overload
	 * @param options - MoveOptions object with location, triggerEvents, and optional scripts
	 * @returns void
	 *
	 * @overload
	 * @param location - The destination location (legacy signature)
	 * @param triggerEvents - Whether to trigger room entry/exit events (defaults to true, legacy signature)
	 * @returns void
	 */
	move(options: MoveOptions): void;
	move(location: DungeonObject | undefined, triggerEvents?: boolean): void;
	move(
		optionsOrLocation: MoveOptions | DungeonObject | undefined,
		triggerEvents?: boolean
	) {
		// Handle legacy signature: move(location, triggerEvents?)
		let options: MoveOptions;
		if (
			optionsOrLocation === undefined ||
			optionsOrLocation instanceof DungeonObject
		) {
			// Legacy signature
			options = {
				location: optionsOrLocation as DungeonObject | undefined,
				triggerEvents: triggerEvents !== undefined ? triggerEvents : true,
			};
		} else {
			// New options object signature
			options = optionsOrLocation as MoveOptions;
		}

		const oldLocation = this.location;
		const destination = options.location;
		const shouldTriggerEvents = options.triggerEvents !== false;

		// Call onExit if events should be triggered
		if (shouldTriggerEvents && oldLocation instanceof Room) {
			options.scripts?.beforeOnExit?.(this, oldLocation);
			oldLocation.onExit(this);
			options.scripts?.afterOnExit?.(this, oldLocation);
		}

		// Perform the actual move
		super.move(destination);

		// Call onEnter if events should be triggered
		if (
			shouldTriggerEvents &&
			this.location === destination &&
			destination instanceof Room
		) {
			options.scripts?.beforeOnEnter?.(this, destination);
			destination.onEnter(this);
			options.scripts?.afterOnEnter?.(this, destination);
		}
	}

	/**
	 * Moves this object one room in the specified direction.
	 * The move only occurs if canStep() returns true for that direction.
	 * Triggers appropriate exit/enter events on both rooms.
	 *
	 * @param optionsOrDirection Either a StepOptions object or a DIRECTION (legacy signature)
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
	 *
	 * @overload
	 * @param options - StepOptions object with direction and optional scripts
	 * @returns true if the move was successful, false otherwise
	 *
	 * @overload
	 * @param direction - The direction to move (legacy signature)
	 * @returns true if the move was successful, false otherwise
	 */
	step(options: StepOptions): boolean;
	step(direction: DIRECTION): boolean;
	step(optionsOrDirection: StepOptions | DIRECTION): boolean {
		// Handle legacy signature: step(direction)
		let options: StepOptions;
		if (typeof optionsOrDirection === "number") {
			// Legacy signature
			options = { direction: optionsOrDirection };
		} else {
			// New options object signature
			options = optionsOrDirection;
		}

		const dir = options.direction;
		if (!this.canStep(dir)) return false;

		const exit = this.getStep(dir);
		const sourceRoom =
			this.location instanceof Room ? this.location : undefined;

		// Execute beforeOnExit script if provided
		if (sourceRoom && options.scripts?.beforeOnExit) {
			options.scripts.beforeOnExit(this, sourceRoom, dir);
		}

		// Call onExit
		if (sourceRoom) {
			sourceRoom.onExit(this, dir);
			options.scripts?.afterOnExit?.(this, sourceRoom, dir);
		}

		// Move to destination (without triggering events, we handle them manually)
		this.move(exit, false);

		const destinationRoom =
			this.location instanceof Room ? this.location : undefined;
		if (destinationRoom) {
			const reverseDir = dir2reverse(dir);

			// Call onEnter
			options.scripts?.beforeOnEnter?.(this, destinationRoom, reverseDir);
			destinationRoom.onEnter(this, reverseDir);
			options.scripts?.afterOnEnter?.(this, destinationRoom, reverseDir);

			// Call onStep hook after successful movement
			this.onStep(dir, destinationRoom);
		}

		return true;
	}
}

/**
 * These are objects that are intended to occupy rooms but not much else.
 * They will be used to generate extra descriptions for the room, or they might
 * be a sign that is in the room that can be read.
 */
export class Prop extends DungeonObject {}

/**
 * There are items. They are the things that mobs pick up, equip, use, drop, throw, etc.
 */
export class Item extends Movable {
	/**
	 * Whether this item can act as a container for other items.
	 * Only items with isContainer=true can be targeted by "put x in container" and "get x from container" commands.
	 * Defaults to false.
	 */
	isContainer: boolean = false;

	/**
	 * Set the location (container) of this item.
	 * When an item's location changes, it clears reset tracking.
	 * This allows items to be picked up and moved without the reset system tracking them.
	 *
	 * @param dobj The container to move into, or undefined to remove from any container
	 */
	override set location(dobj: DungeonObject | undefined) {
		// Get the current location before it changes (access private field directly)
		const oldLocation = (this as any)._location;

		// Clear reset tracking when location changes (only if we had a previous location)
		if (oldLocation && this.spawnedByReset) {
			this.spawnedByReset = undefined;
		}

		// Call parent setter to handle the actual location change
		super.location = dobj;
	}

	/**
	 * Get the current location of this item.
	 * @returns The DungeonObject containing this item, or undefined
	 */
	override get location() {
		return super.location;
	}

	/**
	 * Constructor for Item.
	 * @param options Optional initialization values including isContainer flag
	 */
	constructor(options?: ItemOptions) {
		super(options);
		if (options?.isContainer !== undefined) {
			this.isContainer = options.isContainer;
		}
	}

	/**
	 * Serialize this item, including isContainer if it's true.
	 */
	override serialize(options?: {
		compress?: boolean;
		version?: string;
	}): SerializedItem {
		// Build uncompressed including subclass fields, then apply common compression if requested
		const base = {
			...(options?.version && { version: options.version }),
			...super.serialize(options),
		};
		const uncompressed: SerializedItem = {
			...base,
			type: "Item",
			...(this.isContainer && { isContainer: true }),
		};
		return options?.compress
			? compressSerializedObject(uncompressed, base.templateId)
			: uncompressed;
	}
}

/**
 * Currency is a special type of Item that only exists at runtime.
 * When picked up, its value is added to the mob's value property.
 * Currency items are not persisted - they are created on demand and
 * converted to mob value when picked up.
 *
 * @example
 * ```typescript
 * const gold = new Currency({ value: 100, keywords: "gold", display: "100 gold" });
 * room.add(gold);
 * // When mob picks it up, mob.value increases by 100 and the currency item is removed
 * ```
 */
export class Currency extends Item {
	constructor(options?: DungeonObjectOptions) {
		super(options);
		// Value is inherited from DungeonObject
	}

	/**
	 * Currency items are not persisted - they only exist at runtime.
	 * This override prevents serialization by throwing an error.
	 */
	override serialize(): never {
		throw new Error(
			"Currency items cannot be serialized - they only exist at runtime"
		);
	}
}

/**
 * Equipment slot types that items can be equipped to on a mob.
 * Each slot can hold one piece of equipment. Weapons can only be equipped in mainHand/offHand,
 * Armor cannot be equipped in mainHand/offHand, and base Equipment can be equipped in offHand
 * (but not mainHand).
 *
 * @example
 * ```typescript
 * import { EQUIPMENT_SLOT, Armor, Weapon } from "./dungeon.js";
 *
 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5 });
 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 10 });
 * const shield = new Armor({ slot: EQUIPMENT_SLOT.OFF_HAND, defense: 3 });
 *
 * mob.equip(helmet);
 * mob.equip(sword);
 * mob.equip(shield);
 * ```
 */

/**
 * Weapon type identifiers used to associate weapons with weapon skills.
 * The user's weapon skill for a specific type determines accuracy when using that weapon.
 */
export type WeaponType =
	| "shortsword"
	| "longsword"
	| "bastard sword"
	| "claymore"
	| "rapier"
	| "spear"
	| "halberd"
	| "trident"
	| "club"
	| "greatclub"
	| "warhammer"
	| "maul"
	| "morningstar"
	| "whip"
	| "tonfa"
	| "nunchaka"
	| "tessen"
	| "jutte"
	| "swordbreaker"
	| "chain-sickle"
	| "tanto"
	| "wakizashi"
	| "katana"
	| "tachi"
	| "uchigatana"
	| "naginata"
	| "nagamaki"
	| "sai"
	| "flail";

/**
 * Array of all valid weapon types.
 * Used for validation and UI dropdowns.
 */
export const WEAPON_TYPES: readonly WeaponType[] = [
	"shortsword",
	"longsword",
	"bastard sword",
	"claymore",
	"rapier",
	"spear",
	"halberd",
	"trident",
	"club",
	"greatclub",
	"warhammer",
	"maul",
	"morningstar",
	"whip",
	"tonfa",
	"nunchaka",
	"tessen",
	"jutte",
	"swordbreaker",
	"chain-sickle",
	"tanto",
	"wakizashi",
	"katana",
	"tachi",
	"uchigatana",
	"naginata",
	"nagamaki",
	"sai",
	"flail",
] as const;

export enum EQUIPMENT_SLOT {
	HEAD = "head",
	NECK = "neck",
	SHOULDERS = "shoulders",
	HANDS = "hands",
	MAIN_HAND = "mainHand",
	OFF_HAND = "offHand",
	FINGER = "finger",
	CHEST = "chest",
	WAIST = "waist",
	LEGS = "legs",
	FEET = "feet",
}

/**
 * Creation options for {@link Equipment}.
 * Base equipment can provide attribute bonuses, resource bonuses, and secondary attribute bonuses,
 * but does not provide defense or attack power (those are specific to Armor and Weapon).
 *
 * @property slot - The equipment slot this item occupies when equipped (required)
 * @property defense - Defense value (only used by Armor, defaults to 0 for base Equipment)
 * @property attributeBonuses - Primary attribute bonuses (e.g., +5 strength)
 * @property resourceBonuses - Resource capacity bonuses (e.g., +20 maxHealth)
 * @property secondaryAttributeBonuses - Secondary attribute bonuses (e.g., +3 critRate)
 *
 * @example
 * ```typescript
 * import { Equipment, EQUIPMENT_SLOT } from "./dungeon.js";
 *
 * // Create a rare ring with bonuses
 * const ring = new Equipment({
 *   slot: EQUIPMENT_SLOT.FINGER,
 *   keywords: "ring of power",
 *   display: "Ring of Power",
 *   attributeBonuses: { strength: 5, intelligence: 3 },
 *   resourceBonuses: { maxMana: 20 },
 *   secondaryAttributeBonuses: { critRate: 2 }
 * });
 * ```
 */
export interface EquipmentOptions extends ItemOptions {
	/** The equipment slot this item occupies when equipped. */
	slot?: EQUIPMENT_SLOT;
	/** Defense value provided by this equipment. */
	defense?: number;
	/** Attribute bonuses provided by this equipment (for rare equipment). */
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	/** Resource capacity bonuses provided by this equipment (for rare equipment). */
	resourceBonuses?: Partial<ResourceCapacities>;
	/** Secondary attribute bonuses provided by this equipment (for rare equipment). */
	secondaryAttributeBonuses?: Partial<SecondaryAttributeSet>;
}

/**
 * Base Equipment class that can be equipped to a Mob.
 * Equipment extends Item and can be equipped to specific slots on a mob. Base Equipment
 * provides attribute bonuses, resource bonuses, and secondary attribute bonuses, but does
 * not provide defense or attack power (those are specific to Armor and Weapon subclasses).
 *
 * Equipment can be used in offHand slots (for orbs, relics, etc.) but not in mainHand.
 * For combat equipment, use Armor (defense) or Weapon (attack power) instead.
 *
 * @example
 * ```typescript
 * import { Equipment, EQUIPMENT_SLOT, Mob } from "./dungeon.js";
 *
 * // Create a utility item (like an orb or relic)
 * const orb = new Equipment({
 *   slot: EQUIPMENT_SLOT.OFF_HAND,
 *   keywords: "orb power",
 *   display: "Orb of Power",
 *   attributeBonuses: { intelligence: 10 },
 *   resourceBonuses: { maxMana: 50 }
 * });
 *
 * const mob = new Mob();
 * mob.equip(orb);
 * console.log(mob.intelligence); // Increased by 10
 * console.log(mob.maxMana); // Increased by 50
 * ```
 */
export class Equipment extends Item {
	protected _slot: EQUIPMENT_SLOT;
	protected _attributeBonuses: Partial<PrimaryAttributeSet>;
	protected _resourceBonuses: Partial<ResourceCapacities>;
	protected _secondaryAttributeBonuses: Partial<SecondaryAttributeSet>;

	constructor(options?: EquipmentOptions) {
		super(options);
		this._slot = options?.slot ?? EQUIPMENT_SLOT.HEAD;
		this._attributeBonuses = options?.attributeBonuses ?? {};
		this._resourceBonuses = options?.resourceBonuses ?? {};
		this._secondaryAttributeBonuses = options?.secondaryAttributeBonuses ?? {};
	}

	/**
	 * Gets the equipment slot this item occupies when equipped.
	 *
	 * @returns The equipment slot enum value
	 *
	 * @example
	 * ```typescript
	 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5 });
	 * console.log(helmet.slot); // EQUIPMENT_SLOT.HEAD
	 * ```
	 */
	public get slot(): EQUIPMENT_SLOT {
		return this._slot;
	}

	/**
	 * Gets the defense value provided by this equipment.
	 * Overridden by Armor to return the actual defense value.
	 * Returns 0 for base Equipment and Weapon.
	 *
	 * @returns Defense value (0 for base Equipment)
	 *
	 * @example
	 * ```typescript
	 * const armor = new Armor({ slot: EQUIPMENT_SLOT.CHEST, defense: 10 });
	 * const equipment = new Equipment({ slot: EQUIPMENT_SLOT.FINGER });
	 *
	 * console.log(armor.defense); // 10
	 * console.log(equipment.defense); // 0
	 * ```
	 */
	public get defense(): number {
		return 0;
	}

	/**
	 * Gets the attack power value provided by this equipment.
	 * Overridden by Weapon to return the actual attack power value.
	 * Returns 0 for base Equipment and Armor.
	 *
	 * @returns Attack power value (0 for base Equipment)
	 *
	 * @example
	 * ```typescript
	 * const weapon = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 15 });
	 * const equipment = new Equipment({ slot: EQUIPMENT_SLOT.FINGER });
	 *
	 * console.log(weapon.attackPower); // 15
	 * console.log(equipment.attackPower); // 0
	 * ```
	 */
	public get attackPower(): number {
		return 0;
	}

	/**
	 * Gets the attribute bonuses provided by this equipment.
	 * These bonuses are added to the mob's primary attributes when equipped.
	 *
	 * @returns Readonly object containing primary attribute bonuses
	 *
	 * @example
	 * ```typescript
	 * const ring = new Equipment({
	 *   slot: EQUIPMENT_SLOT.FINGER,
	 *   attributeBonuses: { strength: 5, agility: 3 }
	 * });
	 *
	 * const bonuses = ring.attributeBonuses;
	 * console.log(bonuses.strength); // 5
	 * ```
	 */
	public get attributeBonuses(): Readonly<Partial<PrimaryAttributeSet>> {
		return this._attributeBonuses;
	}

	/**
	 * Gets the resource capacity bonuses provided by this equipment.
	 * These bonuses are added to the mob's max health/mana when equipped.
	 *
	 * @returns Readonly object containing resource capacity bonuses
	 *
	 * @example
	 * ```typescript
	 * const amulet = new Equipment({
	 *   slot: EQUIPMENT_SLOT.NECK,
	 *   resourceBonuses: { maxHealth: 50, maxMana: 30 }
	 * });
	 *
	 * const bonuses = amulet.resourceBonuses;
	 * console.log(bonuses.maxHealth); // 50
	 * ```
	 */
	public get resourceBonuses(): Readonly<Partial<ResourceCapacities>> {
		return this._resourceBonuses;
	}

	/**
	 * Gets the secondary attribute bonuses provided by this equipment.
	 * These bonuses are added directly to the mob's secondary attributes when equipped.
	 *
	 * @returns Readonly object containing secondary attribute bonuses
	 *
	 * @example
	 * ```typescript
	 * const boots = new Equipment({
	 *   slot: EQUIPMENT_SLOT.FEET,
	 *   secondaryAttributeBonuses: { critRate: 5, avoidance: 3 }
	 * });
	 *
	 * const bonuses = boots.secondaryAttributeBonuses;
	 * console.log(bonuses.critRate); // 5
	 * ```
	 */
	public get secondaryAttributeBonuses(): Readonly<
		Partial<SecondaryAttributeSet>
	> {
		return this._secondaryAttributeBonuses;
	}

	/**
	 * Serialize this Equipment instance to a serializable format.
	 * Includes all equipment-specific properties: slot, defense, and all bonus types.
	 *
	 * @returns Serialized equipment object suitable for JSON/YAML persistence
	 *
	 * @example
	 * ```typescript
	 * const equipment = new Equipment({
	 *   slot: EQUIPMENT_SLOT.FINGER,
	 *   attributeBonuses: { strength: 5 }
	 * });
	 *
	 * const serialized = equipment.serialize();
	 * // Can be saved to file or sent over network
	 * ```
	 */
	public serialize(options?: {
		compress?: boolean;
		version?: string;
	}): SerializedEquipment {
		// Build uncompressed including subclass fields, then apply common compression if requested
		const base = {
			...(options?.version && { version: options.version }),
			...super.serialize(options),
		};
		const uncompressed: SerializedEquipment = {
			...base,
			type: "Equipment",
			slot: this._slot,
			...(Object.keys(this._attributeBonuses).length > 0
				? { attributeBonuses: this._attributeBonuses }
				: {}),
			...(Object.keys(this._resourceBonuses).length > 0
				? { resourceBonuses: this._resourceBonuses }
				: {}),
			...(Object.keys(this._secondaryAttributeBonuses).length > 0
				? { secondaryAttributeBonuses: this._secondaryAttributeBonuses }
				: {}),
		};
		const etc = options?.compress
			? compressSerializedObject(uncompressed, base.templateId)
			: uncompressed;
		return etc;
	}
}

/**
 * Creation options for {@link Armor}.
 * Armor must have a defense value and cannot be equipped in mainHand or offHand slots.
 *
 * @property defense - Defense value provided by this armor (required)
 *
 * @example
 * ```typescript
 * import { Armor, EQUIPMENT_SLOT } from "./dungeon.js";
 *
 * const helmet = new Armor({
 *   slot: EQUIPMENT_SLOT.HEAD,
 *   defense: 5,
 *   keywords: "steel helmet",
 *   display: "Steel Helmet"
 * });
 * ```
 */
export interface ArmorOptions extends EquipmentOptions {
	/** Defense value provided by this armor. */
	defense?: number;
}

/**
 * Armor is a type of Equipment that provides defense.
 * Armor can only be equipped in armor slots (head, neck, shoulders, hands, chest, waist, legs, feet).
 * It cannot be equipped in mainHand or offHand slots. Defense from armor is added directly
 * to the mob's secondary defense attribute.
 *
 * @example
 * ```typescript
 * import { Armor, EQUIPMENT_SLOT, Mob } from "./dungeon.js";
 *
 * // Create and equip armor
 * const chestplate = new Armor({
 *   slot: EQUIPMENT_SLOT.CHEST,
 *   defense: 10,
 *   keywords: "plate chest",
 *   display: "Steel Chestplate"
 * });
 *
 * const mob = new Mob();
 * mob.equip(chestplate);
 *
 * console.log(mob.defense); // Includes +10 from chestplate
 * console.log(chestplate.defense); // 10
 * ```
 */
export class Armor extends Equipment {
	private _defense: number;

	constructor(options?: ArmorOptions) {
		super(options);
		this._defense = options?.defense ?? 0;
	}

	/**
	 * Gets the defense value provided by this armor.
	 * Overrides the base Equipment.defense getter to return the actual defense value.
	 *
	 * @returns Defense value provided by this armor
	 *
	 * @example
	 * ```typescript
	 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5 });
	 * console.log(helmet.defense); // 5
	 * ```
	 */
	public override get defense(): number {
		return this._defense;
	}

	/**
	 * Serialize this Armor instance to a serializable format.
	 * Returns SerializedArmor with type "Armor".
	 *
	 * @returns Serialized armor object
	 */
	public serialize(options?: {
		compress?: boolean;
		version?: string;
	}): SerializedArmor {
		// Build full uncompressed then compress against template baseline if requested
		const base = {
			...(options?.version && { version: options.version }),
			...super.serialize(options),
		};
		const uncompressed: SerializedArmor = {
			...(base as SerializedDungeonObject),
			type: "Armor",
			slot: this._slot,
			defense: this._defense,
		};
		return options?.compress
			? (compressSerializedObject(
					uncompressed,
					(base as SerializedDungeonObject).templateId
			  ) as SerializedArmor)
			: uncompressed;
	}
}

/**
 * Creation options for {@link Weapon}.
 * Weapons must have an attackPower value and can only be equipped in mainHand or offHand slots.
 *
 * @property attackPower - Attack power value provided by this weapon (required)
 *
 * @example
 * ```typescript
 * import { Weapon, EQUIPMENT_SLOT } from "./dungeon.js";
 *
 * const sword = new Weapon({
 *   slot: EQUIPMENT_SLOT.MAIN_HAND,
 *   attackPower: 15,
 *   keywords: "iron sword",
 *   display: "Iron Sword"
 * });
 * ```
 */
export interface WeaponOptions extends EquipmentOptions {
	/** Attack power value provided by this weapon. */
	attackPower?: number;
	/** Hit type for this weapon (verb and damage type). If not provided, uses default hit type. */
	hitType?: HitType | string;
	/** Weapon type identifier for skill association. Required for weapon templates. */
	type?: WeaponType;
}

/**
 * Weapon is a type of Equipment that provides attack power.
 * Weapons can only be equipped in mainHand or offHand slots. Attack power from weapons
 * is NOT added to the mob's base attackPower attribute. Instead, the weapon's attack power
 * is only used when that specific weapon is used in an attack (via oneHit()).
 *
 * @example
 * ```typescript
 * import { Weapon, EQUIPMENT_SLOT, Mob } from "./dungeon.js";
 *
 * // Create and equip a weapon
 * const sword = new Weapon({
 *   slot: EQUIPMENT_SLOT.MAIN_HAND,
 *   attackPower: 15,
 *   keywords: "sword blade",
 *   display: "Iron Sword"
 * });
 *
 * const mob = new Mob();
 * mob.equip(sword);
 *
 * console.log(mob.attackPower); // Base attack power from strength (doesn't include weapon)
 * console.log(sword.attackPower); // 15 (only used when sword is used in an attack)
 * ```
 */
export class Weapon extends Equipment {
	private _attackPower: number;
	private _hitType: HitType;
	private _type?: WeaponType;

	constructor(options?: WeaponOptions) {
		super(options);
		this._attackPower = options?.attackPower ?? 0;
		this._type = options?.type ?? "shortsword";

		// Resolve hit type
		if (options?.hitType) {
			if (typeof options.hitType === "string") {
				// Look up in common hit types
				const common = COMMON_HIT_TYPES.get(options.hitType.toLowerCase());
				if (!common)
					throw new Error(`Common hit type ${options.hitType} not found`);
				this._hitType = common;
			} else {
				this._hitType = options.hitType;
			}
		} else {
			this._hitType = DEFAULT_HIT_TYPE;
		}
	}

	/**
	 * Gets the attack power value provided by this weapon.
	 * Overrides the base Equipment.attackPower getter to return the actual attack power value.
	 *
	 * @returns Attack power value provided by this weapon
	 *
	 * @example
	 * ```typescript
	 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 15 });
	 * console.log(sword.attackPower); // 15
	 * ```
	 */
	public override get attackPower(): number {
		return this._attackPower;
	}

	/**
	 * Gets the hit type for this weapon.
	 * Returns the verb and damage type used when this weapon deals damage.
	 *
	 * @returns The hit type for this weapon
	 */
	public get hitType(): Readonly<HitType> {
		return this._hitType;
	}

	/**
	 * Gets the weapon type identifier for this weapon.
	 * Used to associate the weapon with a weapon skill.
	 *
	 * @returns The weapon type identifier, or undefined if not set
	 */
	public get type(): WeaponType | undefined {
		return this._type;
	}

	/**
	 * Serialize this Weapon instance to a serializable format.
	 * Returns SerializedWeapon with type "Weapon" and attackPower.
	 * Defense is explicitly set to 0.
	 *
	 * @returns Serialized weapon object
	 */
	public override serialize(options?: {
		compress?: boolean;
		version?: string;
	}): SerializedWeapon {
		// Build full uncompressed then compress against template baseline if requested
		const base = {
			...(options?.version && { version: options.version }),
			...super.serialize(options),
		};
		const uncompressed: SerializedWeapon = {
			...(base as SerializedDungeonObject),
			type: "Weapon",
			slot: this._slot,
			attackPower: this._attackPower,
			hitType: this._hitType.verb,
			weaponType: this._type,
		};
		return options?.compress
			? (compressSerializedObject(
					uncompressed,
					(base as SerializedDungeonObject).templateId
			  ) as SerializedWeapon)
			: uncompressed;
	}
}

/**
 * Creation options for {@link Mob}.
 * Mobs represent characters and NPCs in the game world with attributes, equipment, and resources.
 *
 * @property race - Resolved race definition (defaults to default race if not provided)
 * @property job - Resolved job definition (defaults to default job if not provided)
 * @property level - Starting level (defaults to 1)
 * @property experience - Starting experience points (defaults to 0)
 * @property attributeBonuses - Additional primary attribute bonuses
 * @property resourceBonuses - Additional resource capacity bonuses
 * @property health - Starting health (defaults to maxHealth if not provided)
 * @property mana - Starting mana (defaults to maxMana if not provided)
 * @property exhaustion - Starting exhaustion level (defaults to 0)
 *
 * @example
 * ```typescript
 * import { Mob, Race, Job } from "./dungeon.js";
 * import { getRaceById, getJobById } from "./package/archetype.js";
 *
 * const warrior = new Mob({
 *   race: getRaceById("human"),
 *   job: getJobById("warrior"),
 *   level: 5,
 *   attributeBonuses: { strength: 5 }
 * });
 *
 * console.log(warrior.level); // 5
 * console.log(warrior.strength); // Includes race/job/level bonuses + 5
 * ```
 */
/**
 * Behavior flags for NPCs (mobs without a character).
 * These behaviors control how NPCs act in the game world.
 *
 * @example
 * ```typescript
 * import { BEHAVIOR } from "./dungeon.js";
 *
 * const goblin = new Mob({
 *   behaviors: {
 *     [BEHAVIOR.AGGRESSIVE]: true,
 *     [BEHAVIOR.WANDER]: true
 *   }
 * });
 * ```
 */
export enum BEHAVIOR {
	/** Aggressive mobs attack any mobs that enter their room */
	AGGRESSIVE = "aggressive",
	/** Wimpy mobs randomly flee combat when health reaches 25% */
	WIMPY = "wimpy",
	/** Wandering mobs randomly move around their dungeon */
	WANDER = "wander",
	/** Shopkeeper mobs cannot take damage, cause damage, move, or engage in combat */
	SHOPKEEPER = "shopkeeper",
}

/**
 * Threat entry in a mob's threat table.
 * Tracks the threat value and whether it should expire in the next cycle.
 */
export interface ThreatEntry {
	/** The threat value for this entry */
	value: number;
	/** Whether this threat should expire in the next cycle */
	shouldExpire: boolean;
}

export interface MobOptions extends DungeonObjectOptions {
	/** Resolved race definition to use for this mob. */
	race: Race;
	/** Resolved job definition to use for this mob. */
	job: Job;
	level?: number;
	experience?: number;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	health?: number;
	mana?: number;
	exhaustion?: number;
	/** Behavior flags for NPCs (mobs without a character) */
	behaviors?: Partial<Record<BEHAVIOR, boolean>>;
	/** Learned abilities map (Ability object -> number of uses) */
	learnedAbilities?: Map<Ability, number>;
	/** AI script for this mob */
	aiScript?: string;
}

const MAX_EXHAUSTION = 100;
const EXPERIENCE_THRESHOLD = 100;

/**
 * Serialized form for Mob objects.
 * Used for persistence and template storage. Includes all mob-specific properties including
 * level, experience, race/job IDs, bonuses, resources, and equipped items.
 *
 * @property type - Always "Mob"
 * @property level - Current level
 * @property experience - Current experience points
 * @property race - Race ID string
 * @property job - Job ID string
 * @property attributeBonuses - Optional primary attribute bonuses
 * @property resourceBonuses - Optional resource capacity bonuses
 * @property health - Current health points
 * @property mana - Current mana points
 * @property exhaustion - Current exhaustion level
 * @property equipped - Optional record of equipped items by slot
 */
export interface SerializedMob extends SerializedDungeonObject {
	type: "Mob";
	level: number;
	experience: number;
	race: string;
	job: string;
	attributeBonuses?: Partial<PrimaryAttributeSet>;
	resourceBonuses?: Partial<ResourceCapacities>;
	health: number;
	mana: number;
	exhaustion: number;
	equipped?: Record<
		EQUIPMENT_SLOT,
		SerializedEquipment | SerializedArmor | SerializedWeapon
	>;
	/** Behavior flags serialized as strings (enum values) */
	behaviors?: Record<string, boolean>;
	/** Learned abilities map (ability id -> number of uses) */
	learnedAbilities?: Record<string, number>;
	/** Active effects (excluding archetype passives) */
	effects?: SerializedEffect[];
}

/**
 * Mob class representing characters and NPCs in the game world.
 * Mobs extend Movable and can move between rooms. They have:
 * - Primary attributes (strength, agility, intelligence) derived from race/job/level
 * - Secondary attributes (attackPower, defense, etc.) calculated from primary attributes
 * - Resource capacities (maxHealth, maxMana) affected by attributes and bonuses
 * - Current resources (health, mana, exhaustion) that can change during gameplay
 * - Equipment system allowing items to be equipped in various slots
 * - Experience and leveling system
 *
 * Attributes are automatically recalculated when equipment changes, level changes, or
 * bonuses are modified. Equipment bonuses are applied to attributes and resources.
 *
 * @example
 * ```typescript
 * import { Mob, Armor, Weapon, EQUIPMENT_SLOT } from "./dungeon.js";
 * import { getRaceById, getJobById } from "./package/archetype.js";
 *
 * // Create a warrior mob
 * const warrior = new Mob({
 *   race: getRaceById("human"),
 *   job: getJobById("warrior"),
 *   level: 10
 * });
 *
 * // Equip gear
 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 15 });
 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5 });
 * warrior.equip(sword);
 * warrior.equip(helmet);
 *
 * // Check stats
 * console.log(warrior.attackPower); // Includes weapon bonus
 * console.log(warrior.defense); // Includes armor bonus
 * console.log(warrior.maxHealth); // Calculated from race/job/level/vitality
 *
 * // Gain experience
 * warrior.gainExperience(150);
 * console.log(warrior.level); // May have leveled up
 * ```
 */

export class Mob extends Movable {
	/** Private storage for the Character reference */
	private _character?: Character;
	private _race: Race;
	private _job: Job;
	private _level: number;
	private _experience: number;
	private _attributeBonuses: PrimaryAttributeSet;
	private _resourceBonuses: ResourceCapacities;
	private _primaryAttributes: PrimaryAttributeSet;
	private _primaryAttributesView: Readonly<PrimaryAttributeSet>;
	private _secondaryAttributes: SecondaryAttributeSet;
	private _secondaryAttributesView: Readonly<SecondaryAttributeSet>;
	private _resourceCaps: ResourceCapacities;
	private _resourceCapsView: Readonly<ResourceCapacities>;
	private _health!: number;
	private _mana!: number;
	private _exhaustion!: number;
	protected _equipped: Map<EQUIPMENT_SLOT, Equipment>;
	private _combatTarget?: Mob;
	private _threatTable?: Map<Mob, ThreatEntry>;
	private _threatExpirationTimer?: number;
	private _behaviors: Map<BEHAVIOR, boolean>;
	/** Shopkeeper inventory reference (resolved from shopkeeperInventoryId) */
	private _shopkeeperInventory?: ShopkeeperInventory;
	/** EventEmitter for AI events (only for NPCs) */
	private _aiEventEmitter?: EventEmitter;
	/** AI script for this mob */
	private _aiScript?: string;
	/** Map of Ability objects to number of uses */
	/** @internal - Public for package deserializers */
	public _learnedAbilities: Map<Ability, number>;
	/** Map of ability ID to cached proficiency (0-100) */
	/** @internal - Public for package deserializers */
	public _proficiencySnapshot: Map<string, number>;
	/** Active effects on this mob */
	/** @internal - Public for package deserializers */
	public _effects: Set<EffectInstance>;
	constructor(options: MobOptions) {
		super(options);

		this._equipped = new Map<EQUIPMENT_SLOT, Equipment>();
		this._attributeBonuses = normalizePrimaryBonuses(options?.attributeBonuses);
		this._resourceBonuses = normalizeResourceBonuses(options?.resourceBonuses);
		this._primaryAttributes = sumPrimaryAttributes();
		this._primaryAttributesView = createPrimaryAttributesView(
			this._primaryAttributes
		);
		this._secondaryAttributes = computeSecondaryAttributes(
			this._primaryAttributes
		);
		this._secondaryAttributesView = createSecondaryAttributesView(
			this._secondaryAttributes
		);
		this._resourceCaps = sumResourceCaps();
		this._resourceCapsView = createResourceCapsView(this._resourceCaps);

		// Initialize effects before recalculateDerivedAttributes (which iterates over effects)
		this._effects = new Set<EffectInstance>();

		// Initialize learned abilities map BEFORE experience setter
		this._learnedAbilities = new Map<Ability, number>();
		this._proficiencySnapshot = new Map<string, number>();

		this._race = options.race;
		this._job = options.job;
		const providedLevel = Math.floor(Number(options?.level ?? 1));
		this._level = providedLevel > 0 ? providedLevel : 1;
		this._experience = 0;

		this.recalculateDerivedAttributes({ bootstrap: true });

		if (options?.experience !== undefined) {
			this.experience = Number(options.experience);
		}

		this.health = options?.health ?? this.maxHealth;
		this.mana = options?.mana ?? this.maxMana;
		this.exhaustion = options?.exhaustion ?? 0;

		// Initialize behavior dictionary (only for NPCs)
		this._behaviors = new Map<BEHAVIOR, boolean>();
		if (options?.behaviors) {
			for (const [key, value] of Object.entries(options.behaviors)) {
				// Validate that the key is a valid BEHAVIOR enum value
				if (Object.values(BEHAVIOR).includes(key as BEHAVIOR)) {
					// Use setBehavior to ensure cache is updated
					this.setBehavior(key as BEHAVIOR, !!value);
				}
			}
		}
		// Note: learnedAbilities from options should be provided as Map<Ability, number>
		// For deserialization, abilities are resolved in package layer
		if (options?.learnedAbilities) {
			// Copy the map if provided
			for (const [ability, uses] of options.learnedAbilities) {
				this._learnedAbilities.set(ability, uses);
				this._updateProficiencySnapshot(ability);
			}
		}

		// Initialize EventEmitter for AI events (only for NPCs)
		if (!this._character) {
			this._aiEventEmitter = new EventEmitter();
		}
		if (options?.aiScript) {
			this._aiScript = options.aiScript;
		}
	}
	/**
	 * Gets the Character that controls this mob (if any).
	 * Player-controlled mobs have a Character reference, NPCs do not.
	 *
	 * @returns The Character instance or undefined for NPCs
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * const character = new Character({ username: "player", password: "pass" });
	 * mob.character = character;
	 *
	 * console.log(mob.character === character); // true
	 * ```
	 */
	public get character(): Character | undefined {
		return this._character;
	}

	/**
	 * Gets the EventEmitter for AI events (only available for NPCs).
	 * Returns undefined for player-controlled mobs.
	 *
	 * @returns The EventEmitter instance or undefined if not initialized
	 */
	public get aiEvents(): EventEmitter | undefined {
		return this._aiEventEmitter;
	}

	/**
	 * Initialize the AI EventEmitter if it doesn't exist.
	 * This should only be called for NPCs (mobs without a character).
	 *
	 * @returns The EventEmitter instance (newly created or existing)
	 */
	public initializeAIEvents(): EventEmitter {
		if (!this._aiEventEmitter) {
			this._aiEventEmitter = new EventEmitter();
		}
		return this._aiEventEmitter;
	}

	/**
	 * Sets the Character that controls this mob and establishes bidirectional reference.
	 * When setting a character, the mob automatically updates the character's mob reference.
	 * When clearing (setting to undefined), the previous character's mob reference is cleared.
	 *
	 * @param char The Character instance to associate with this mob
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * const character = new Character({ username: "player", password: "pass" });
	 *
	 * mob.character = character;
	 * console.log(character.mob === mob); // true (bidirectional reference)
	 *
	 * mob.character = undefined;
	 * console.log(character.mob); // undefined (cleared)
	 * ```
	 */
	public set character(char: Character | undefined) {
		if (this.character === char) return;
		if (this.character && this.character.mob) this.character.mob = undefined;

		this._character = char;

		// Ensure the new character points to this mob
		if (char && char.mob !== this) {
			char.mob = this;
		}

		// Note: Wandering mob registration is handled by the package layer
	}

	/**
	 * Gets the current combat target of this mob.
	 * Returns undefined if the mob is not in combat.
	 *
	 * @returns The target Mob or undefined
	 */
	public get combatTarget(): Mob | undefined {
		return this._combatTarget;
	}

	/**
	 * Sets the combat target of this mob.
	 * Setting a target puts the mob in combat; setting to undefined removes it from combat.
	 *
	 * @param target The target Mob to engage, or undefined to disengage
	 */
	public set combatTarget(target: Mob | undefined) {
		// Prevent self-targeting
		if (target === this) {
			return;
		}
		const wasInCombat = this._combatTarget !== undefined;
		this._combatTarget = target;
		if (!this.character && target) this.addToThreatTable(target);
		if (!target) {
			removeFromCombatQueue(this);
			// If NPC was in combat and is now leaving, handle target switching and aggro behavior
			if (!this.character && wasInCombat) {
				handleNPCLeavingCombat(this);
			}
		} else {
			addToCombatQueue(this);
		}
	}

	/**
	 * Gets the threat table for this mob.
	 * Only NPCs (mobs without a character) have threat tables.
	 * Returns undefined for player-controlled mobs.
	 *
	 * @returns The threat table Map or undefined
	 */
	public get threatTable(): ReadonlyMap<Mob, ThreatEntry> | undefined {
		return this._threatTable;
	}

	/**
	 * Adds threat to the threat table for a specific attacker.
	 * Only works for NPCs (mobs without a character).
	 * The threat amount is added to any existing threat for that attacker.
	 * Sets the expiration flag to false (don't expire next cycle) and starts
	 * the threat expiration cycle if it's not already running.
	 *
	 * @param attacker The mob that generated the threat
	 * @param amount The amount of threat to add (typically damage dealt)
	 */
	public addThreat(attacker: Mob, amount: number): void {
		// Only NPCs (mobs without a character) can have threat tables
		if (this.character) {
			return;
		}

		// Initialize threat table if it doesn't existnpm
		if (!this._threatTable) {
			this._threatTable = new Map<Mob, ThreatEntry>();
		}

		let currentEntry = this._threatTable.get(attacker);
		if (!currentEntry) {
			currentEntry = {
				value: 0,
				shouldExpire: false,
			};
			this._threatTable.set(attacker, currentEntry);
		} else currentEntry.shouldExpire = false;

		// Add the amount to the current threat value
		currentEntry.value += amount;

		// Start threat expiration cycle if not already running
		this._startThreatExpirationCycle();

		// Process threat switching to potentially switch target
		processThreatSwitching(this);
	}

	public addToThreatTable(attacker: Mob): void {
		if (!this._threatTable) {
			this._threatTable = new Map<Mob, ThreatEntry>();
		}
		let currentEntry = this._threatTable.get(attacker);
		if (!currentEntry) {
			this.addThreat(attacker, 1);
		}
	}

	/**
	 * Gets the threat value for a specific attacker.
	 * Returns 0 if the attacker has no threat or this mob doesn't have a threat table.
	 *
	 * @param attacker The mob to check threat for
	 * @returns The threat value
	 */
	public getThreat(attacker: Mob): number {
		if (!this._threatTable) {
			return 0;
		}
		const entry = this._threatTable.get(attacker);
		return entry?.value ?? 0;
	}

	/**
	 * Gets the mob with the highest threat in the threat table.
	 * Returns undefined if there are no threats or this mob doesn't have a threat table.
	 *
	 * @returns The mob with highest threat or undefined
	 */
	public getHighestThreatTarget(): Mob | undefined {
		if (!this._threatTable || this._threatTable.size === 0) {
			return undefined;
		}

		let maxThreat = -1;
		let maxThreatMob: Mob | undefined;

		for (const [mob, entry] of this._threatTable.entries()) {
			if (entry.value > maxThreat) {
				maxThreat = entry.value;
				maxThreatMob = mob;
			}
		}

		return maxThreatMob;
	}

	/**
	 * Checks if this mob is in combat (has a target).
	 *
	 * @returns True if the mob has a combat target
	 */
	public isInCombat(): boolean {
		return !!this._combatTarget;
	}

	/**
	 * Clears the threat table for this mob.
	 * Only works for NPCs (mobs without a character).
	 */
	public clearThreatTable(): void {
		if (this._threatTable) {
			this._threatTable.clear();
		}
		this._stopThreatExpirationCycle();
	}

	/**
	 * Start the threat expiration cycle for this mob if it's not already running.
	 * Only works for NPCs (mobs without a character) with a threat table.
	 */
	private _startThreatExpirationCycle(): void {
		// Only NPCs have threat tables
		if (this.character || !this._threatTable) {
			return;
		}

		// Only start if not already running
		if (this._threatExpirationTimer !== undefined) {
			return;
		}

		this._threatExpirationTimer = setAbsoluteInterval(() => {
			this._processThreatExpiration();
		}, THREAT_EXPIRATION_INTERVAL_MS);
	}

	/**
	 * Stop the threat expiration cycle for this mob.
	 */
	private _stopThreatExpirationCycle(): void {
		if (this._threatExpirationTimer !== undefined) {
			clearCustomInterval(this._threatExpirationTimer);
			this._threatExpirationTimer = undefined;
		}
	}

	/**
	 * Process threat expiration for this mob's threat table.
	 * This is called every 10 seconds by the threat expiration timer.
	 *
	 * For each threat entry:
	 * 1. Remove destroyed mobs from threat table
	 * 2. Skip current combat target
	 * 3. If threat is not set to expire, set it to expire next cycle
	 * 4. If threat is set to expire, reduce by 33%
	 * 5. If threat < 100, remove from table
	 * 6. If table is empty, stop the cycle
	 */
	private _processThreatExpiration(): void {
		// Only NPCs have threat tables
		if (this.character || !this._threatTable) {
			this._stopThreatExpirationCycle();
			return;
		}

		const threatTable = this._threatTable;
		const currentTarget = this._combatTarget;
		const npcRoom = this.location instanceof Room ? this.location : undefined;

		// Process each threat entry
		const entriesToRemove: Mob[] = [];

		for (const [threatMob, entry] of threatTable.entries()) {
			// 1. Remove destroyed mobs (check if mob is no longer in a dungeon)
			if (!threatMob.dungeon) {
				entriesToRemove.push(threatMob);
				continue;
			}

			// 2. Skip current combat target
			if (threatMob === currentTarget) {
				continue;
			}

			// 2b. Skip mobs in the same room as the NPC
			if (npcRoom && threatMob.location === npcRoom) {
				continue;
			}

			// 3. If threat is not set to expire, set it to expire next cycle
			if (!entry.shouldExpire) {
				entry.shouldExpire = true;
				continue;
			}

			// 4. If threat is set to expire, reduce by 33%
			const newValue = Math.floor(entry.value * 0.67); // Reduce by 33%

			// 5. If threat < 100, remove from table
			if (newValue < 100) {
				entriesToRemove.push(threatMob);
			} else {
				entry.value = newValue;
			}
		}

		// Remove entries marked for removal
		for (const mobToRemove of entriesToRemove) {
			threatTable.delete(mobToRemove);
		}

		// 6. If table is empty, stop the cycle
		if (threatTable.size === 0) {
			this._stopThreatExpirationCycle();
		}
	}

	/**
	 * Removes a mob from this mob's threat table.
	 * Only works for NPCs (mobs without a character).
	 *
	 * @param mob The mob to remove from the threat table
	 */
	public removeThreat(mob: Mob): void {
		if (this._threatTable) {
			this._threatTable.delete(mob);
		}
	}

	/**
	 * Gets the behavior flags for this mob.
	 * Only NPCs (mobs without a character) have behavior flags.
	 * Returns a readonly map of behavior enum to boolean value.
	 *
	 * @returns Readonly map of behavior flags
	 *
	 * @example
	 * ```typescript
	 * import { BEHAVIOR } from "./dungeon.js";
	 *
	 * const mob = new Mob();
	 * mob.setBehavior(BEHAVIOR.AGGRESSIVE, true);
	 * mob.setBehavior(BEHAVIOR.WANDER, true);
	 *
	 * const behaviors = mob.behaviors;
	 * console.log(behaviors.get(BEHAVIOR.AGGRESSIVE)); // true
	 * console.log(behaviors.get(BEHAVIOR.WANDER)); // true
	 * ```
	 */
	public get behaviors(): ReadonlyMap<BEHAVIOR, boolean> {
		return this._behaviors;
	}

	/**
	 * Gets whether a specific behavior is enabled for this mob.
	 * Only NPCs (mobs without a character) can have behaviors.
	 *
	 * @param behavior The behavior enum to check
	 * @returns True if the behavior is enabled, false otherwise
	 *
	 * @example
	 * ```typescript
	 * import { BEHAVIOR } from "./dungeon.js";
	 *
	 * const mob = new Mob();
	 * mob.setBehavior(BEHAVIOR.AGGRESSIVE, true);
	 * console.log(mob.hasBehavior(BEHAVIOR.AGGRESSIVE)); // true
	 * console.log(mob.hasBehavior(BEHAVIOR.WANDER)); // false
	 * ```
	 */
	public hasBehavior(behavior: BEHAVIOR): boolean {
		if (this.character) {
			return false; // Only NPCs have behaviors
		}
		return this._behaviors.get(behavior) ?? false;
	}

	/**
	 * Sets a behavior flag for this mob.
	 * Only NPCs (mobs without a character) can have behaviors.
	 * Setting a behavior to false removes it from the map.
	 *
	 * @param behavior The behavior enum to set
	 * @param value True to enable the behavior, false to disable it
	 *
	 * @example
	 * ```typescript
	 * import { BEHAVIOR } from "./dungeon.js";
	 *
	 * const mob = new Mob();
	 * mob.setBehavior(BEHAVIOR.AGGRESSIVE, true);
	 * mob.setBehavior(BEHAVIOR.WANDER, true);
	 * mob.setBehavior(BEHAVIOR.WIMPY, false); // Removes wimpy behavior
	 * ```
	 */
	public setBehavior(behavior: BEHAVIOR, value: boolean): void {
		if (this.character) {
			return; // Only NPCs can have behaviors
		}
		if (value) {
			this._behaviors.set(behavior, true);
		} else {
			this._behaviors.delete(behavior);
		}
	}

	/**
	 * Gets the learned abilities map for this mob.
	 * Returns a readonly view of the abilities (ability id -> proficiency 0-100).
	 * Proficiency is calculated from uses based on the ability's proficiency curve.
	 *
	 * @returns Readonly map of learned abilities with proficiency values
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.addAbility("whirlwind", 250); // 250 uses
	 * const abilities = mob.learnedAbilities;
	 * console.log(abilities.get("whirlwind")); // 50 (proficiency at 250 uses)
	 * ```
	 */
	public get learnedAbilities(): ReadonlyMap<string, number> {
		return this._proficiencySnapshot;
	}

	/**
	 * Gets the number of uses for a specific ability.
	 *
	 * @param abilityId The ability ID to check
	 * @returns The number of uses, or 0 if the ability is not learned
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.addAbility("whirlwind", 100);
	 * console.log(mob.getAbilityUses("whirlwind")); // 100
	 * ```
	 */
	public getAbilityUses(abilityId: string): number {
		const ability = this._findAbilityById(abilityId);
		return ability ? this._learnedAbilities.get(ability) ?? 0 : 0;
	}

	/**
	 * Updates the proficiency snapshot for an ability based on its current uses.
	 * This is called automatically when uses change.
	 *
	 * @param abilityId The ability ID to update
	 * @private
	 */
	private _updateProficiencySnapshot(ability: Ability): void {
		const uses = this._learnedAbilities.get(ability) ?? 0;
		const proficiency = getProficiencyAtUses(ability, uses);
		this._proficiencySnapshot.set(ability.id, proficiency);
	}

	/**
	 * Checks if this mob knows a specific ability.
	 *
	 * @param abilityId The ability ID to check
	 * @returns True if the mob knows the ability, false otherwise
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.addAbility("whirlwind", 75);
	 * console.log(mob.knowsAbility("whirlwind")); // true
	 * console.log(mob.knowsAbility("fireball")); // false
	 * ```
	 */
	/**
	 * Helper method to find an ability by ID in the learned abilities map.
	 * @private
	 */
	private _findAbility(
		predicate: (ability: Ability, uses: number) => boolean
	): Ability | undefined {
		for (const [ability, uses] of this._learnedAbilities.entries()) {
			if (predicate(ability, uses)) {
				return ability;
			}
		}
		return undefined;
	}

	private _findAbilityById(abilityId: string): Ability | undefined {
		return this._findAbility((ability) => ability.id === abilityId);
	}

	public knowsAbilityById(abilityId: string): boolean {
		return this._findAbilityById(abilityId) !== undefined;
	}

	public knowsAbility(ability: Ability): boolean {
		return this._findAbility((ability) => ability === ability) !== undefined;
	}

	/**
	 * Adds or updates an ability for this mob.
	 * Sets the number of uses for the ability and updates the proficiency snapshot.
	 *
	 * @param abilityId The ability ID to add or update
	 * @param uses Number of times the ability has been used (defaults to 0)
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.addAbility("whirlwind", 250); // 250 uses
	 * // Proficiency will be calculated based on the ability's curve
	 * ```
	 */
	/**
	 * Adds or updates an ability for this mob.
	 * Sets the number of uses for the ability and updates the proficiency snapshot.
	 *
	 * @param ability The Ability object to add or update
	 * @param uses Number of times the ability has been used (defaults to 0)
	 */
	public addAbility(ability: Ability, uses: number = 0): void {
		const useCount = Math.max(0, Number(uses));
		this._learnedAbilities.set(ability, useCount);
		this._updateProficiencySnapshot(ability);
	}

	/**
	 * Adds or updates an ability by ID. This is a convenience method that requires
	 * the ability to be looked up. For better performance, use addAbility(ability, uses).
	 *
	 * @param abilityId The ability ID to add or update
	 * @param uses Number of times the ability has been used (defaults to 0)
	 * @param abilityLookup Optional function to look up ability by ID (for package layer)
	 * @deprecated Use addAbility(ability, uses) instead. This method will be removed.
	 */
	public addAbilityById(
		abilityId: string,
		uses: number = 0,
		abilityLookup?: (id: string) => Ability | undefined
	): void {
		if (!abilityLookup) {
			throw new Error(
				"addAbilityById requires abilityLookup parameter. Use addAbility(ability, uses) instead."
			);
		}
		const ability = abilityLookup(abilityId);
		if (!ability) {
			throw new Error(`Ability "${abilityId}" not found`);
		}
		this.addAbility(ability, uses);
	}

	/**
	 * Increments the use count for an ability and updates the proficiency snapshot.
	 * This should be called whenever an ability is used.
	 * Notifies the mob when proficiency increases.
	 *
	 * @param abilityId The ability ID to increment uses for
	 * @param amount The amount to increment by (defaults to 1)
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.addAbility("whirlwind", 0);
	 * mob.incrementAbilityUses("whirlwind"); // Now has 1 use
	 * mob.incrementAbilityUses("whirlwind", 5); // Now has 6 uses
	 * ```
	 */
	/**
	 * Increments the use count for an ability and updates the proficiency snapshot.
	 * This should be called whenever an ability is used.
	 * Notifies the mob when proficiency increases.
	 *
	 * @param ability The Ability object to increment uses for
	 * @param amount The amount to increment by (defaults to 1)
	 */
	public useAbility(ability: Ability, amount: number = 1): void {
		if (!this._learnedAbilities.has(ability)) {
			// If ability not learned, add it with the increment amount
			this.addAbility(ability, amount);
			return;
		}

		// Get old proficiency before updating
		const oldProficiency = this._proficiencySnapshot.get(ability.id) ?? 0;

		const currentUses = this._learnedAbilities.get(ability) ?? 0;
		const newUses = Math.max(0, currentUses + amount);
		this._learnedAbilities.set(ability, newUses);
		this._updateProficiencySnapshot(ability);

		// Get new proficiency and check if it increased
		const newProficiency = this._proficiencySnapshot.get(ability.id) ?? 0;
		if (newProficiency > oldProficiency) {
			this.sendMessage(
				`Your proficiency with ${ability.name} has increased to ${newProficiency}%!`,
				MESSAGE_GROUP.SYSTEM
			);
		}
	}

	/**
	 * Increments the use count for an ability by ID. This is a convenience method.
	 * For better performance, use useAbility(ability, amount).
	 *
	 * @param abilityId The ability ID to increment uses for
	 * @param amount The amount to increment by (defaults to 1)
	 * @param abilityLookup Optional function to look up ability by ID (for package layer)
	 * @deprecated Use useAbility(ability, amount) instead. This method will be removed.
	 */
	public useAbilityById(
		abilityId: string,
		amount: number = 1,
		abilityLookup?: (id: string) => Ability | undefined
	): void {
		if (!abilityLookup) {
			throw new Error(
				"useAbilityById requires abilityLookup parameter. Use useAbility(ability, amount) instead."
			);
		}
		const ability = abilityLookup(abilityId);
		if (!ability) {
			throw new Error(`Ability "${abilityId}" not found`);
		}
		this.useAbility(ability, amount);
	}

	/**
	 * Removes an ability from this mob.
	 *
	 * @param abilityId The ability ID to remove
	 * @returns True if the ability was removed, false if it wasn't learned
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.addAbility("whirlwind", 250);
	 * mob.removeAbility("whirlwind"); // Returns true
	 * mob.removeAbility("fireball"); // Returns false (not learned)
	 * ```
	 */
	/**
	 * Removes an ability from this mob.
	 *
	 * @param ability The Ability object to remove
	 * @returns True if the ability was removed, false if it wasn't learned
	 */
	public removeAbility(ability: Ability): boolean {
		const removed = this._learnedAbilities.delete(ability);
		if (removed) {
			this._proficiencySnapshot.delete(ability.id);
		}
		return removed;
	}

	/**
	 * Removes an ability by ID. This is a convenience method.
	 *
	 * @param abilityId The ability ID to remove
	 * @returns True if the ability was removed, false if it wasn't learned
	 */
	public removeAbilityById(abilityId: string): boolean {
		const ability = this._findAbilityById(abilityId);
		if (!ability) {
			return false;
		}
		return this.removeAbility(ability);
	}

	/** @internal - Public for package deserializers */
	public captureResourceRatios(): {
		healthRatio?: number;
		manaRatio?: number;
	} {
		return {
			healthRatio:
				this._resourceCaps.maxHealth > 0
					? this._health / this._resourceCaps.maxHealth
					: undefined,
			manaRatio:
				this._resourceCaps.maxMana > 0
					? this._mana / this._resourceCaps.maxMana
					: undefined,
		};
	}

	private clampResourceValue(value: number, maxValue: number): number {
		return Math.floor(clampNumber(value, 0, maxValue));
	}

	/** @internal - Public for package deserializers */
	public recalculateDerivedAttributes(
		opts: { bootstrap?: boolean; healthRatio?: number; manaRatio?: number } = {}
	): void {
		const race = this._race;
		const job = this._job;
		const levelStages = Math.max(0, this._level - 1);

		// Collect equipment bonuses
		const equipmentAttributeBonuses: Partial<PrimaryAttributeSet>[] = [];
		const equipmentResourceBonuses: Partial<ResourceCapacities>[] = [];
		const equipmentSecondaryAttributeBonuses: Partial<SecondaryAttributeSet>[] =
			[];
		let totalArmorDefense = 0;
		// Note: Weapon attack power is NOT added to base attackPower attribute
		// Weapons only contribute attack power when that specific weapon is used in an attack
		for (const equipment of this._equipped.values()) {
			if (equipment.attributeBonuses)
				equipmentAttributeBonuses.push(equipment.attributeBonuses);
			if (equipment.resourceBonuses)
				equipmentResourceBonuses.push(equipment.resourceBonuses);
			if (equipment.secondaryAttributeBonuses)
				equipmentSecondaryAttributeBonuses.push(
					equipment.secondaryAttributeBonuses
				);
			// Sum armor defense separately
			if (equipment instanceof Armor) {
				totalArmorDefense += equipment.defense;
			}
			// Weapons are handled separately - their attack power is only used when that weapon is used
		}

		// Collect effect bonuses (from passive effects)
		const effectAttributeBonuses: Partial<PrimaryAttributeSet>[] = [];
		const effectResourceBonuses: Partial<ResourceCapacities>[] = [];
		const effectSecondaryAttributeBonuses: Partial<SecondaryAttributeSet>[] =
			[];
		for (const effect of this._effects) {
			if (isPassiveEffect(effect.template)) {
				if (effect.template.primaryAttributeModifiers) {
					effectAttributeBonuses.push(
						effect.template.primaryAttributeModifiers
					);
				}
				if (effect.template.secondaryAttributeModifiers) {
					effectSecondaryAttributeBonuses.push(
						effect.template.secondaryAttributeModifiers
					);
				}
				if (effect.template.resourceCapacityModifiers) {
					effectResourceBonuses.push(effect.template.resourceCapacityModifiers);
				}
			}
		}

		const rawPrimary = sumPrimaryAttributes(
			race.startingAttributes,
			job.startingAttributes,
			multiplyPrimaryAttributes(race.attributeGrowthPerLevel, levelStages),
			multiplyPrimaryAttributes(job.attributeGrowthPerLevel, levelStages),
			this._attributeBonuses,
			...equipmentAttributeBonuses,
			...effectAttributeBonuses
		);
		this._primaryAttributes = {
			strength: roundTo(rawPrimary.strength, ATTRIBUTE_ROUND_DECIMALS),
			agility: roundTo(rawPrimary.agility, ATTRIBUTE_ROUND_DECIMALS),
			intelligence: roundTo(rawPrimary.intelligence, ATTRIBUTE_ROUND_DECIMALS),
		};
		this._primaryAttributesView = createPrimaryAttributesView(
			this._primaryAttributes
		);

		this._secondaryAttributes = computeSecondaryAttributes(
			this._primaryAttributes
		);

		// Add armor defense directly to secondary defense attribute
		if (totalArmorDefense > 0) {
			this._secondaryAttributes.defense = roundTo(
				this._secondaryAttributes.defense + totalArmorDefense,
				ATTRIBUTE_ROUND_DECIMALS
			);
		}

		// Note: Weapon attack power is NOT added to base attackPower attribute
		// The base attackPower only comes from strength-derived calculation
		// Weapons contribute their attack power only when that specific weapon is used in an attack

		// Apply equipment and effect secondary attribute bonuses
		const allSecondaryBonuses = [
			...equipmentSecondaryAttributeBonuses,
			...effectSecondaryAttributeBonuses,
		];
		if (allSecondaryBonuses.length > 0) {
			const combinedSecondaryBonuses = sumSecondaryAttributes(
				...allSecondaryBonuses
			);
			// Add each bonus to the corresponding secondary attribute
			(
				Object.keys(combinedSecondaryBonuses) as Array<
					keyof SecondaryAttributeSet
				>
			).forEach((key) => {
				const bonus = combinedSecondaryBonuses[key];
				if (bonus !== 0) {
					this._secondaryAttributes[key] = roundTo(
						this._secondaryAttributes[key] + bonus,
						ATTRIBUTE_ROUND_DECIMALS
					);
				}
			});
		}

		this._secondaryAttributesView = createSecondaryAttributesView(
			this._secondaryAttributes
		);

		const rawCaps = sumResourceCaps(
			race.startingResourceCaps,
			job.startingResourceCaps,
			multiplyResourceCaps(race.resourceGrowthPerLevel, levelStages),
			multiplyResourceCaps(job.resourceGrowthPerLevel, levelStages),
			this._resourceBonuses,
			...equipmentResourceBonuses,
			...effectResourceBonuses
		);

		this._resourceCaps = {
			maxHealth: roundTo(
				rawCaps.maxHealth +
					this._secondaryAttributes.vitality * HEALTH_PER_VITALITY,
				ATTRIBUTE_ROUND_DECIMALS
			),
			maxMana: roundTo(
				rawCaps.maxMana + this._secondaryAttributes.wisdom * MANA_PER_WISDOM,
				ATTRIBUTE_ROUND_DECIMALS
			),
		};
		this._resourceCapsView = createResourceCapsView(this._resourceCaps);

		if (opts.bootstrap) {
			this.resetResources();
			return;
		}

		if (opts.healthRatio !== undefined && Number.isFinite(opts.healthRatio)) {
			this.health = opts.healthRatio * this._resourceCaps.maxHealth;
		} else {
			this.health = this.health;
		}

		if (opts.manaRatio !== undefined && Number.isFinite(opts.manaRatio)) {
			this.mana = opts.manaRatio * this._resourceCaps.maxMana;
		} else {
			this.mana = this.mana;
		}

		this.exhaustion = this.exhaustion;
	}

	private applyLevelDelta(delta: number): LevelUpChanges | null {
		if (delta === 0) return null;

		// Capture displayed attributes and capacities before leveling (from view objects)
		const oldPrimary = { ...this.primaryAttributes };
		const oldSecondary = { ...this.secondaryAttributes };
		const oldMaxHealth = this.maxHealth;
		const oldMaxMana = this.maxMana;

		const ratios = this.captureResourceRatios();
		this._level = Math.max(1, this._level + delta);
		this.recalculateDerivedAttributes(ratios);

		// Note: Newly learned abilities are checked by package layer helper
		// (checkMobArchetypeAbilities) that has access to the registry
		const newlyLearnedAbilities: Ability[] = checkMobArchetypeAbilities(this);

		// Get new displayed values
		const newPrimary = this.primaryAttributes;
		const newSecondary = this.secondaryAttributes;
		const newMaxHealth = this.maxHealth;
		const newMaxMana = this.maxMana;

		return {
			oldPrimary,
			newPrimary,
			oldSecondary,
			newSecondary,
			oldMaxHealth,
			newMaxHealth,
			oldMaxMana,
			newMaxMana,
			newLevel: this._level,
			newlyLearnedAbilities,
		};
	}

	private sendLevelUpMessages(levelUpData: LevelUpChanges): void {
		const {
			oldPrimary,
			newPrimary,
			oldSecondary,
			newSecondary,
			oldMaxHealth,
			newMaxHealth,
			oldMaxMana,
			newMaxMana,
			newLevel,
			newlyLearnedAbilities,
		} = levelUpData;

		const messages: string[] = [];
		messages.push(color(`You have reached level ${newLevel}!`, COLOR.YELLOW));

		// Primary attribute changes (comparing displayed integer values)
		const primaryChanges: string[] = [];
		if (newPrimary.strength !== oldPrimary.strength) {
			const diff = newPrimary.strength - oldPrimary.strength;
			primaryChanges.push(`STR ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newPrimary.agility !== oldPrimary.agility) {
			const diff = newPrimary.agility - oldPrimary.agility;
			primaryChanges.push(`AGI ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newPrimary.intelligence !== oldPrimary.intelligence) {
			const diff = newPrimary.intelligence - oldPrimary.intelligence;
			primaryChanges.push(`INT ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (primaryChanges.length > 0) {
			messages.push(`Primary Attributes: ${primaryChanges.join(", ")}`);
		}

		// Secondary attribute changes (comparing displayed integer values)
		const secondaryChanges: string[] = [];
		if (newSecondary.attackPower !== oldSecondary.attackPower) {
			const diff = newSecondary.attackPower - oldSecondary.attackPower;
			secondaryChanges.push(`AP ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.defense !== oldSecondary.defense) {
			const diff = newSecondary.defense - oldSecondary.defense;
			secondaryChanges.push(`DEF ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.critRate !== oldSecondary.critRate) {
			const diff = newSecondary.critRate - oldSecondary.critRate;
			secondaryChanges.push(`CRIT ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.avoidance !== oldSecondary.avoidance) {
			const diff = newSecondary.avoidance - oldSecondary.avoidance;
			secondaryChanges.push(`AVO ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.accuracy !== oldSecondary.accuracy) {
			const diff = newSecondary.accuracy - oldSecondary.accuracy;
			secondaryChanges.push(`ACC ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.spellPower !== oldSecondary.spellPower) {
			const diff = newSecondary.spellPower - oldSecondary.spellPower;
			secondaryChanges.push(`SP ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.resilience !== oldSecondary.resilience) {
			const diff = newSecondary.resilience - oldSecondary.resilience;
			secondaryChanges.push(`RES ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.vitality !== oldSecondary.vitality) {
			const diff = newSecondary.vitality - oldSecondary.vitality;
			secondaryChanges.push(`VIT ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.wisdom !== oldSecondary.wisdom) {
			const diff = newSecondary.wisdom - oldSecondary.wisdom;
			secondaryChanges.push(`WIS ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.endurance !== oldSecondary.endurance) {
			const diff = newSecondary.endurance - oldSecondary.endurance;
			secondaryChanges.push(`END ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newSecondary.spirit !== oldSecondary.spirit) {
			const diff = newSecondary.spirit - oldSecondary.spirit;
			secondaryChanges.push(`SPI ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (secondaryChanges.length > 0) {
			messages.push(`Secondary Attributes: ${secondaryChanges.join(", ")}`);
		}

		// Capacity changes (comparing displayed integer values)
		const capacityChanges: string[] = [];
		if (newMaxHealth !== oldMaxHealth) {
			const diff = newMaxHealth - oldMaxHealth;
			capacityChanges.push(`MaxHP ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (newMaxMana !== oldMaxMana) {
			const diff = newMaxMana - oldMaxMana;
			capacityChanges.push(`MaxMP ${diff > 0 ? "+" : ""}${diff}`);
		}
		if (capacityChanges.length > 0) {
			messages.push(`Capacities: ${capacityChanges.join(", ")}`);
		}

		// Newly learned abilities
		if (newlyLearnedAbilities.length > 0) {
			const abilityNames = newlyLearnedAbilities
				.map((a) => color(a.name, COLOR.CYAN))
				.join(", ");
			messages.push(`New Abilities: ${abilityNames}`);
		}

		// Send level-up summary
		this.sendMessage(messages.join("\n"), MESSAGE_GROUP.INFO);

		// Send individual ability learning messages
		for (const ability of newlyLearnedAbilities) {
			this.sendMessage(
				`You have learned ${ability.name}! ${ability.description}`,
				MESSAGE_GROUP.INFO
			);
		}
	}

	public resolveGrowthModifier(): number {
		const raceModifier = evaluateGrowthModifier(
			this._race.growthModifier,
			this._level
		);
		const jobModifier = evaluateGrowthModifier(
			this._job.growthModifier,
			this._level
		);
		const combined = raceModifier * jobModifier;
		return combined > 0 ? combined : 1;
	}

	/**
	 * Calculates the total base experience required to reach the current level.
	 * This accounts for growth modifiers at each level, which reduce the effective
	 * experience gained. The calculation iterates through each level from 1 to
	 * current-1 and calculates how much base experience was needed to gain 100
	 * adjusted experience at each level.
	 *
	 * @returns Total base experience required to reach current level
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob({ level: 5, experience: 50 });
	 * const baseXP = mob.calculateTotalBaseExperience();
	 * console.log(`You've earned ${baseXP} base experience to reach level 5`);
	 * ```
	 */
	public calculateTotalBaseExperience(): number {
		const EXPERIENCE_THRESHOLD = 100;
		let totalBaseExperience = 0;

		// Calculate base experience for each level from 1 to current-1
		for (let level = 1; level < this._level; level++) {
			const raceModifier = evaluateGrowthModifier(
				this._race.growthModifier,
				level
			);
			const jobModifier = evaluateGrowthModifier(
				this._job.growthModifier,
				level
			);
			const combinedModifier = raceModifier * jobModifier;
			const modifier = combinedModifier > 0 ? combinedModifier : 1;

			// To gain 100 adjusted experience at this level, need baseExperience = 100 * modifier
			totalBaseExperience += EXPERIENCE_THRESHOLD * modifier;
		}

		// Add base experience for current level's current experience
		if (this._experience > 0) {
			const currentModifier = this.resolveGrowthModifier();
			totalBaseExperience += this._experience * currentModifier;
		}

		return Math.floor(totalBaseExperience);
	}

	/**
	 * Gets the current level of this mob.
	 * Level affects attribute growth and experience requirements.
	 *
	 * @returns Current level (minimum 1)
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob({ level: 5 });
	 * console.log(mob.level); // 5
	 * ```
	 */
	public get level(): number {
		return this._level;
	}

	/**
	 * Sets the level of this mob.
	 * Changing level automatically recalculates all derived attributes while preserving
	 * health/mana ratios.
	 *
	 * @param value - Target level (minimum 1)
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.level = 10; // Automatically recalculates attributes
	 * ```
	 */
	public set level(value: number) {
		const target = Math.max(1, Math.floor(Number(value) || 1));
		this.applyLevelDelta(target - this._level);
	}

	/**
	 * Gets the current experience points of this mob.
	 * Experience is rounded to 4 decimal places for precision.
	 *
	 * @returns Current experience points
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.gainExperience(50);
	 * console.log(mob.experience); // 50.0 (or less if modifiers applied)
	 * ```
	 */
	public get experience(): number {
		// Experience is always stored as an integer
		return Math.floor(this._experience);
	}

	/**
	 * Sets the experience points of this mob.
	 * Setting experience automatically handles level-ups if the threshold is reached.
	 *
	 * @param value - Experience points to set
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.experience = 150; // May level up if threshold reached
	 * ```
	 */
	public set experience(value: number) {
		let numeric = Number(value);
		if (!Number.isFinite(numeric) || numeric <= 0) {
			this._experience = 0;
			return;
		}

		// Only store experience as whole numbers
		numeric = Math.floor(numeric);

		let delta = 0;
		while (numeric >= EXPERIENCE_THRESHOLD) {
			numeric -= EXPERIENCE_THRESHOLD;
			delta += 1;
		}

		if (delta !== 0) {
			this.applyLevelDelta(delta);
		}

		// Store experience as integer
		this._experience = Math.floor(numeric);
	}

	/**
	 * Gets the experience points needed to reach the next level.
	 *
	 * @returns Experience points remaining until next level
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.experience = 75;
	 * console.log(mob.experienceToLevel); // 25 (100 - 75)
	 * ```
	 */
	public get experienceToLevel(): number {
		// Experience is always stored as an integer
		return Math.max(0, EXPERIENCE_THRESHOLD - Math.floor(this._experience));
	}

	/**
	 * Grant experience and automatically handle level-ups and overflow.
	 *
	 * @param amount Raw experience awarded before growth modifiers.
	 * @returns Adjusted experience actually applied after modifiers.
	 *
	 * @example
	 * const adjusted = mob.gainExperience(120);
	 * console.log(`Applied ${adjusted} XP, now level ${mob.level}`);
	 */
	public gainExperience(amount: number): number {
		const numeric = Number(amount);
		if (!Number.isFinite(numeric) || numeric <= 0) return 0;

		const modifier = this.resolveGrowthModifier();
		const adjusted = numeric / (modifier > 0 ? modifier : 1);
		// Only gain experience in whole numbers
		const adjustedInt = Math.floor(adjusted);

		let total = this._experience + adjustedInt;
		let levels = 0;
		while (total >= EXPERIENCE_THRESHOLD) {
			total -= EXPERIENCE_THRESHOLD;
			levels += 1;
		}

		// Store experience as integer
		this._experience = Math.floor(total);
		if (levels > 0) {
			const levelUpData = this.applyLevelDelta(levels);
			if (levelUpData && this.character) {
				this.sendLevelUpMessages(levelUpData);
			}
		}

		return adjustedInt;
	}

	/**
	 * Award the standard kill experience for defeating a target of a given level.
	 * Baseline is 10 XP, with bonuses for higher-level targets (+2 per level above)
	 * and penalties for lower-level targets. Experience is adjusted by growth modifiers.
	 *
	 * @param targetLevel - Level of the defeated target
	 * @returns Adjusted experience actually applied after modifiers
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob({ level: 5 });
	 * const xp = mob.awardKillExperience(7); // Higher level target
	 * console.log(`Gained ${xp} adjusted XP`); // More than base 10
	 * ```
	 */
	public awardKillExperience(targetLevel: number): number {
		const sanitizedTarget = Math.max(1, Math.floor(Number(targetLevel) || 1));
		const diff = sanitizedTarget - this._level;
		let amount = 10;
		if (diff > 0) amount += diff * 2;
		else if (diff < 0) amount = Math.max(1, amount + diff);
		return this.gainExperience(amount);
	}

	/**
	 * Gets the primary attributes (strength, agility, intelligence) of this mob.
	 * These are calculated from race/job starting values, level growth, bonuses, and equipment.
	 *
	 * @returns Readonly object containing primary attributes
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * const attrs = mob.primaryAttributes;
	 * console.log(`Str: ${attrs.strength}, Agi: ${attrs.agility}, Int: ${attrs.intelligence}`);
	 * ```
	 */
	public get primaryAttributes(): Readonly<PrimaryAttributeSet> {
		return this._primaryAttributesView;
	}

	/**
	 * Gets the race definition for this mob.
	 *
	 * @returns Race object
	 */
	public get race(): Race {
		return this._race;
	}

	/**
	 * Gets the job definition for this mob.
	 *
	 * @returns Job object
	 */
	public get job(): Job {
		return this._job;
	}

	/**
	 * Gets the strength attribute value.
	 * Shorthand for `mob.primaryAttributes.strength`.
	 *
	 * @returns Strength value
	 */
	public get strength(): number {
		return this._primaryAttributesView.strength;
	}

	/**
	 * Gets the agility attribute value.
	 * Shorthand for `mob.primaryAttributes.agility`.
	 *
	 * @returns Agility value
	 */
	public get agility(): number {
		return this._primaryAttributesView.agility;
	}

	/**
	 * Gets the intelligence attribute value.
	 * Shorthand for `mob.primaryAttributes.intelligence`.
	 *
	 * @returns Intelligence value
	 */
	public get intelligence(): number {
		return this._primaryAttributesView.intelligence;
	}

	/**
	 * Gets the secondary attributes (attackPower, defense, critRate, etc.) of this mob.
	 * These are calculated from primary attributes and modified by equipment bonuses.
	 *
	 * @returns Readonly object containing secondary attributes
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * const secAttrs = mob.secondaryAttributes;
	 * console.log(`Attack: ${secAttrs.attackPower}, Defense: ${secAttrs.defense}`);
	 * ```
	 */
	public get secondaryAttributes(): Readonly<SecondaryAttributeSet> {
		return this._secondaryAttributesView;
	}

	/**
	 * Gets the attack power secondary attribute.
	 * Includes base value from strength, weapon bonuses, and equipment secondary bonuses.
	 *
	 * @returns Attack power value
	 */
	public get attackPower(): number {
		return this._secondaryAttributesView.attackPower;
	}

	/**
	 * Gets the vitality secondary attribute.
	 * Affects max health (2 health per vitality point).
	 *
	 * @returns Vitality value
	 */
	public get vitality(): number {
		return this._secondaryAttributesView.vitality;
	}

	/**
	 * Gets the defense secondary attribute.
	 * Includes base value from strength, armor defense bonuses, and equipment secondary bonuses.
	 *
	 * @returns Defense value
	 */
	public get defense(): number {
		return this._secondaryAttributesView.defense;
	}

	/**
	 * Gets the crit rate secondary attribute.
	 * Critical hit chance percentage.
	 *
	 * @returns Crit rate value
	 */
	public get critRate(): number {
		return this._secondaryAttributesView.critRate;
	}

	/**
	 * Gets the avoidance secondary attribute.
	 * Dodge chance percentage.
	 *
	 * @returns Avoidance value
	 */
	public get avoidance(): number {
		return this._secondaryAttributesView.avoidance;
	}

	/**
	 * Gets the accuracy secondary attribute.
	 * Hit chance percentage.
	 *
	 * @returns Accuracy value
	 */
	public get accuracy(): number {
		return this._secondaryAttributesView.accuracy;
	}

	/**
	 * Gets the endurance secondary attribute.
	 * Stamina/energy capacity.
	 *
	 * @returns Endurance value
	 */
	public get endurance(): number {
		return this._secondaryAttributesView.endurance;
	}

	/**
	 * Gets the spell power secondary attribute.
	 * Magical damage output.
	 *
	 * @returns Spell power value
	 */
	public get spellPower(): number {
		return this._secondaryAttributesView.spellPower;
	}

	/**
	 * Gets the wisdom secondary attribute.
	 * Affects max mana (2 mana per wisdom point).
	 *
	 * @returns Wisdom value
	 */
	public get wisdom(): number {
		return this._secondaryAttributesView.wisdom;
	}

	/**
	 * Gets the resilience secondary attribute.
	 * Magical resistance.
	 *
	 * @returns Resilience value
	 */
	public get resilience(): number {
		return this._secondaryAttributesView.resilience;
	}

	/**
	 * Gets the spirit secondary attribute.
	 * Does not scale with primary attributes, only modified by bonuses.
	 *
	 * @returns Spirit value
	 */
	public get spirit(): number {
		return this._secondaryAttributesView.spirit;
	}

	/**
	 * Gets the runtime attribute bonuses for this mob.
	 * These are runtime-only bonuses (e.g., from temporary effects) that are excluded
	 * from serialization and must be rebuilt after login. Equipment bonuses are handled
	 * separately and automatically applied.
	 *
	 * @returns Readonly object containing runtime attribute bonuses
	 */
	public get attributeBonuses(): Readonly<PrimaryAttributeSet> {
		return this._attributeBonuses;
	}

	/**
	 * Replace the runtime attribute bonus totals and refresh all derived stats.
	 * This is used for temporary effects or runtime modifications. Equipment bonuses
	 * are automatically calculated and do not need to be set here.
	 *
	 * @param bonuses - Partial primary attribute bonuses to apply
	 *
	 * @example
	 * ```typescript
	 * const warrior = new Mob();
	 * // Apply temporary buff
	 * warrior.setAttributeBonuses({ strength: 5 });
	 * console.log(warrior.primaryAttributes.strength); // Includes +5 bonus
	 * ```
	 */
	public setAttributeBonuses(bonuses: Partial<PrimaryAttributeSet>): void {
		this._attributeBonuses = normalizePrimaryBonuses(bonuses);
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	/**
	 * Gets the runtime resource bonuses for this mob.
	 * These are runtime-only bonuses (e.g., from temporary effects) that are excluded
	 * from serialization. Equipment bonuses are handled separately and automatically applied.
	 *
	 * @returns Readonly object containing runtime resource bonuses
	 */
	public get resourceBonuses(): Readonly<ResourceCapacities> {
		return this._resourceBonuses;
	}

	/**
	 * Replace the runtime resource bonus totals and refresh max health/mana.
	 * This is used for temporary effects or runtime modifications. Equipment bonuses
	 * are automatically calculated and do not need to be set here.
	 *
	 * @param bonuses - Partial resource capacity bonuses to apply
	 *
	 * @example
	 * ```typescript
	 * const cleric = new Mob();
	 * // Apply temporary buff
	 * cleric.setResourceBonuses({ maxMana: 25 });
	 * console.log(cleric.maxMana); // Includes +25 bonus
	 * ```
	 */
	public setResourceBonuses(bonuses: Partial<ResourceCapacities>): void {
		this._resourceBonuses = normalizeResourceBonuses(bonuses);
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	/**
	 * Gets the maximum health capacity for this mob.
	 * Calculated from race/job starting values, level growth, resource bonuses,
	 * equipment bonuses, and vitality (2 health per vitality point).
	 *
	 * @returns Maximum health points
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * console.log(`Max HP: ${mob.maxHealth}`);
	 * ```
	 */
	public get maxHealth(): number {
		return this._resourceCapsView.maxHealth;
	}

	/**
	 * Gets the maximum mana capacity for this mob.
	 * Calculated from race/job starting values, level growth, resource bonuses,
	 * equipment bonuses, and wisdom (2 mana per wisdom point).
	 *
	 * @returns Maximum mana points
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * console.log(`Max MP: ${mob.maxMana}`);
	 * ```
	 */
	public get maxMana(): number {
		return this._resourceCapsView.maxMana;
	}

	/**
	 * Gets the current health points of this mob.
	 * Value is clamped between 0 and maxHealth.
	 *
	 * @returns Current health points
	 */
	public get health(): number {
		return this._health;
	}

	/**
	 * Sets the current health points of this mob.
	 * Value is automatically clamped between 0 and maxHealth.
	 *
	 * @param value - Health points to set
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.health = 50; // Sets health to 50
	 * mob.health = 9999; // Clamped to maxHealth
	 * ```
	 */
	public set health(value: number) {
		this._health = this.clampResourceValue(value, this.maxHealth);
		// Add to regeneration set if health decreased
		if (this._health < this.maxHealth) {
			addToRegenerationSet(this);
		}
	}

	/**
	 * Gets the current mana points of this mob.
	 * Value is clamped between 0 and maxMana.
	 *
	 * @returns Current mana points
	 */
	public get mana(): number {
		return this._mana;
	}

	/**
	 * Sets the current mana points of this mob.
	 * Value is automatically clamped between 0 and maxMana.
	 *
	 * @param value - Mana points to set
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.mana = 30; // Sets mana to 30
	 * mob.mana = 9999; // Clamped to maxMana
	 * ```
	 */
	public set mana(value: number) {
		this._mana = this.clampResourceValue(value, this.maxMana);
		// Add to regeneration set if mana decreased
		if (this._mana < this.maxMana) {
			addToRegenerationSet(this);
		}
	}

	/**
	 * Gets the current exhaustion level of this mob.
	 * Value is clamped between 0 and 100.
	 *
	 * @returns Current exhaustion level (0-100)
	 */
	public get exhaustion(): number {
		return this._exhaustion;
	}

	/**
	 * Sets the current exhaustion level of this mob.
	 * Value is automatically clamped between 0 and 100.
	 *
	 * @param value - Exhaustion level to set (0-100)
	 */
	public set exhaustion(value: number) {
		this._exhaustion = clampNumber(value, 0, MAX_EXHAUSTION);
		// Add to regeneration set if exhaustion increased
		if (this._exhaustion > 0) {
			addToRegenerationSet(this);
		}
	}

	/**
	 * Gets the maximum exhaustion level (always 100).
	 *
	 * @returns Maximum exhaustion value
	 */
	public get maxExhaustion(): number {
		return MAX_EXHAUSTION;
	}

	/**
	 * Gains exhaustion, adding the specified amount to the current exhaustion level.
	 * The exhaustion is automatically clamped to the maximum (100).
	 * The mob is automatically added to the regeneration set.
	 *
	 * @param amount The amount of exhaustion to gain (must be >= 0)
	 * @returns The actual amount of exhaustion gained (may be less if already at max)
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.exhaustion = 50;
	 * const gained = mob.gainExhaustion(30);
	 * console.log(mob.exhaustion); // 80
	 * console.log(gained); // 30
	 *
	 * // If already at max, no exhaustion is gained
	 * mob.exhaustion = 100;
	 * const gained2 = mob.gainExhaustion(20);
	 * console.log(mob.exhaustion); // 100 (clamped)
	 * console.log(gained2); // 0
	 * ```
	 */
	public gainExhaustion(amount: number): number {
		const numeric = Number(amount);
		if (!Number.isFinite(numeric) || numeric < 0) {
			return 0;
		}

		const oldExhaustion = this._exhaustion;
		this.exhaustion = oldExhaustion + numeric;
		return this._exhaustion - oldExhaustion;
	}

	/**
	 * Resets all resources to their maximum values.
	 * Sets health to maxHealth, mana to maxMana, and exhaustion to 0.
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.health = 10;
	 * mob.mana = 5;
	 * mob.exhaustion = 50;
	 *
	 * mob.resetResources();
	 * console.log(mob.health); // maxHealth
	 * console.log(mob.mana); // maxMana
	 * console.log(mob.exhaustion); // 0
	 * ```
	 */
	public resetResources(): void {
		this.health = this.maxHealth;
		this.mana = this.maxMana;
		this._exhaustion = 0;
	}

	/**
	 * Snapshot of current mutable resources used by UI and persistence layers.
	 *
	 * @example
	 * const { health, mana } = mob.resources;
	 * console.log(`HP: ${health}/${mob.maxHealth}`);
	 */
	public get resources(): ResourceSnapshot {
		return {
			health: this._health,
			mana: this._mana,
			exhaustion: this._exhaustion,
		};
	}
	/**
	 * Send text to the controlling character's client, if any.
	 * If this mob is not controlled by a player, nothing happens.
	 *
	 * @param text - Text to send to the character's client
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.character = character;
	 * mob.send("Hello, player!");
	 * ```
	 */
	public send(text: string): void {
		this.character?.send(text);
	}

	/**
	 * Send a line to the controlling character's client, if any.
	 * Adds a newline after the text. If this mob is not controlled by a player, nothing happens.
	 *
	 * @param text - Text to send as a line to the character's client
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob();
	 * mob.character = character;
	 * mob.sendLine("You see a goblin!");
	 * ```
	 */
	public sendLine(text: string): void {
		this.character?.sendLine(text);
	}

	/**
	 * Send a message to the controlling character's client with a message group.
	 * Message groups are used for categorizing different types of messages (command responses,
	 * combat messages, etc.). If this mob is not controlled by a player, nothing happens.
	 *
	 * @param text - Message text to send
	 * @param group - Message group category
	 *
	 * @example
	 * ```typescript
	 * import { MESSAGE_GROUP } from "./character.js";
	 *
	 * const mob = new Mob();
	 * mob.character = character;
	 * mob.sendMessage("You attack the goblin!", MESSAGE_GROUP.COMBAT);
	 * ```
	 */
	public sendMessage(text: string, group: MESSAGE_GROUP) {
		this.character?.sendMessage(text, group);
	}

	/**
	 * Get the shopkeeper inventory for this mob, if it is a shopkeeper.
	 *
	 * @returns The shopkeeper inventory if this mob is a shopkeeper, undefined otherwise
	 */
	public getShopkeeperInventory(): ShopkeeperInventory | undefined {
		return this._shopkeeperInventory;
	}

	/**
	 * Set the shopkeeper inventory for this mob.
	 * This is typically called during deserialization.
	 *
	 * @param inventory - The shopkeeper inventory to set
	 */
	public setShopkeeperInventory(
		inventory: ShopkeeperInventory | undefined
	): void {
		this._shopkeeperInventory = inventory;
	}

	/**
	 * @overload
	 * @param options - StepOptions object with direction and optional scripts
	 * @returns true if the move was successful, false otherwise
	 *
	 * @overload
	 * @param direction - The direction to move (legacy signature)
	 * @returns true if the move was successful, false otherwise
	 */
	public override step(options: StepOptions): boolean;
	public override step(direction: DIRECTION): boolean;
	public override step(optionsOrDirection: StepOptions | DIRECTION): boolean {
		// Shopkeepers cannot move
		if (this.hasBehavior(BEHAVIOR.SHOPKEEPER)) {
			return false;
		}
		// Handle legacy signature: step(direction)
		let options: StepOptions;
		if (typeof optionsOrDirection === "number") {
			// Legacy signature
			options = { direction: optionsOrDirection };
		} else {
			// New options object signature
			options = optionsOrDirection;
		}

		const direction = options.direction;
		const sourceRoom =
			this.location instanceof Room ? this.location : undefined;
		const directionText = dir2text(direction);
		const reverseDirection = dir2reverse(direction);
		const reverseDirectionText = dir2text(reverseDirection);

		const tellSourceRoomWeLeft = (
			movable: Movable,
			room: Room,
			direction: DIRECTION
		) => {
			act(
				{
					room: `{User} leaves to the ${directionText}.`,
				},
				{
					user: this,
					room: sourceRoom!,
				},
				{ excludeUser: true }
			);

			options.scripts?.beforeOnExit?.(this, sourceRoom!, direction);
		};

		const tellDestinationRoomWeEntered = (
			movable: Movable,
			room: Room,
			direction: DIRECTION
		) => {
			act(
				{
					room: `{User} arrives from the ${reverseDirectionText}.`,
				},
				{
					user: this,
					room: this.location as Room,
				},
				{ excludeUser: true }
			);

			options.scripts?.beforeOnEnter?.(
				this,
				this.location as Room,
				reverseDirection
			);
		};

		const moved = super.step({
			...options,
			scripts: {
				...options.scripts,
				...(sourceRoom ? { beforeOnExit: tellSourceRoomWeLeft } : {}),
				...{ beforeOnEnter: tellDestinationRoomWeEntered },
			},
		});
		return true;
	}

	/**
	 * Equip an item to the appropriate slot.
	 * The equipment is moved to the mob's inventory if not already there, and all
	 * attributes are automatically recalculated to include the equipment's bonuses.
	 * If an item is already equipped in that slot, it is replaced (but not returned).
	 *
	 * @param equipment - The equipment item to equip
	 *
	 * @example
	 * ```typescript
	 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5 });
	 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 10 });
	 *
	 * mob.equip(helmet);
	 * mob.equip(sword);
	 *
	 * // Attributes automatically updated
	 * console.log(mob.defense); // Includes +5 from helmet
	 * console.log(mob.attackPower); // Includes +10 from sword
	 * ```
	 */
	public equip(equipment: Equipment) {
		const slot = equipment.slot;
		this._equipped.set(slot, equipment);

		// Move equipment to mob's inventory if not already there
		if (equipment.location !== this) {
			this.add(equipment);
		}

		// Recalculate attributes with new equipment bonuses
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	/**
	 * Unequip an item by its Equipment object.
	 * Removes the equipment from the slot and recalculates attributes. The equipment
	 * remains in the mob's inventory.
	 *
	 * @param equipment - The equipment item to unequip
	 * @returns The unequipped equipment, or undefined if not found/equipped in that slot
	 *
	 * @example
	 * ```typescript
	 * const helmet = mob.getEquipped(EQUIPMENT_SLOT.HEAD);
	 * if (helmet) {
	 *   mob.unequip(helmet);
	 *   // Attributes automatically updated (defense reduced)
	 * }
	 * ```
	 */
	public unequip(equipment: Equipment) {
		const slot = equipment.slot;
		const currentEquipment = this._equipped.get(slot);

		if (currentEquipment !== equipment) {
			return undefined; // Equipment not found in this slot
		}

		this._equipped.delete(slot);

		// Recalculate attributes without this equipment's bonuses
		this.recalculateDerivedAttributes(this.captureResourceRatios());
	}

	/**
	 * Unequip an item from a slot by slot enum.
	 * Removes the equipment from the specified slot and recalculates attributes.
	 * The equipment remains in the mob's inventory.
	 *
	 * @param slot - The equipment slot to unequip
	 * @returns The unequipped equipment, or undefined if slot is empty
	 *
	 * @example
	 * ```typescript
	 * const helmet = mob.unequipBySlot(EQUIPMENT_SLOT.HEAD);
	 * if (helmet) {
	 *   console.log(`Unequipped ${helmet.display}`);
	 *   // Attributes automatically updated
	 * }
	 * ```
	 */
	public unequipBySlot(slot: EQUIPMENT_SLOT): Equipment | undefined {
		const equipment = this._equipped.get(slot);
		if (!equipment) {
			return undefined;
		}

		this._equipped.delete(slot);

		// Recalculate attributes without this equipment's bonuses
		this.recalculateDerivedAttributes(this.captureResourceRatios());

		return equipment;
	}

	/**
	 * Get the equipment currently equipped in a slot.
	 *
	 * @param slot - The equipment slot to check
	 * @returns The equipped equipment, or undefined if slot is empty
	 *
	 * @example
	 * ```typescript
	 * const helmet = mob.getEquipped(EQUIPMENT_SLOT.HEAD);
	 * if (helmet) {
	 *   console.log(`Wearing ${helmet.display}`);
	 * }
	 * ```
	 */
	public getEquipped(slot: EQUIPMENT_SLOT): Equipment | undefined {
		return this._equipped.get(slot);
	}

	/**
	 * Get all equipped items as an array.
	 * Returns a copy of all equipped items (order is not guaranteed).
	 *
	 * @returns Array of all equipped items
	 *
	 * @example
	 * ```typescript
	 * const allEquipment = mob.getAllEquipped();
	 * console.log(`Wearing ${allEquipment.length} pieces of equipment`);
	 * for (const item of allEquipment) {
	 *   console.log(`- ${item.display}`);
	 * }
	 * ```
	 */
	public getAllEquipped(): Equipment[] {
		return [...this._equipped.values()];
	}

	/**
	 * Get total defense from all equipped armor pieces.
	 * Only counts Armor instances, not base Equipment or Weapons.
	 *
	 * @returns Total defense value from all equipped armor
	 *
	 * @example
	 * ```typescript
	 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5 });
	 * const chest = new Armor({ slot: EQUIPMENT_SLOT.CHEST, defense: 10 });
	 * mob.equip(helmet);
	 * mob.equip(chest);
	 *
	 * console.log(mob.getTotalDefense()); // 15
	 * ```
	 */
	public getTotalDefense(): number {
		let total = 0;
		for (const equipment of this._equipped.values()) {
			if (equipment instanceof Armor) {
				total += equipment.defense;
			}
		}
		return total;
	}

	/**
	 * Get total attack power from all equipped weapons.
	 * Only counts Weapon instances, not base Equipment or Armor.
	 *
	 * @returns Total attack power value from all equipped weapons
	 *
	 * @example
	 * ```typescript
	 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 15 });
	 * const dagger = new Weapon({ slot: EQUIPMENT_SLOT.OFF_HAND, attackPower: 8 });
	 * mob.equip(sword);
	 * mob.equip(dagger);
	 *
	 * console.log(mob.getTotalAttackPower()); // 23
	 * ```
	 */
	public getTotalAttackPower(): number {
		let total = 0;
		for (const equipment of this._equipped.values()) {
			if (equipment instanceof Weapon) {
				total += equipment.attackPower;
			}
		}
		return total;
	}

	/**
	 * Gets the merged damage type relationships for this mob.
	 * Merges damage relationships from race and job with priority:
	 * IMMUNE > RESIST > VULNERABLE
	 *
	 * @returns Merged damage type relationships
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob({
	 *   race: fireImmuneRace,
	 *   job: fireVulnerableJob
	 * });
	 * const relationships = mob.getDamageRelationships();
	 * // Fire will be IMMUNE (race takes priority)
	 * ```
	 */
	public getDamageRelationships(): DamageTypeRelationships {
		return mergeDamageRelationships(
			this._race.damageRelationships,
			this._job.damageRelationships
		);
	}

	/**
	 * Takes damage from an attacker, reducing health and handling death if necessary.
	 * Generates threat for NPCs and handles all death-related cleanup.
	 * Shield effects are checked and can absorb damage before it reaches health.
	 *
	 * @param attacker The mob dealing the damage
	 * @param amount The amount of damage to take
	 * @param damageType Optional damage type for shield filtering
	 *
	 * @example
	 * ```typescript
	 * const attacker = new Mob();
	 * const defender = new Mob();
	 * defender.damage(attacker, 25);
	 * // Defender's health is reduced, threat is generated, death is handled if needed
	 * ```
	 */
	public damage(attacker: Mob, amount: number, damageType?: DAMAGE_TYPE): void {
		if (amount <= 0) {
			return;
		}

		// Shopkeepers cannot take damage
		if (this.hasBehavior(BEHAVIOR.SHOPKEEPER)) {
			return;
		}

		let remainingDamage = amount;
		const room = this.location instanceof Room ? this.location : undefined;

		// Check for shield effects that can absorb this damage
		const shieldEffects = Array.from(this._effects).filter((effect) =>
			isShieldEffect(effect.template)
		);

		// Process shields in order (first shield absorbs first)
		for (const shieldEffect of shieldEffects) {
			if (remainingDamage <= 0) {
				break; // All damage absorbed
			}

			const shieldTemplate = shieldEffect.template;
			if (!isShieldEffect(shieldTemplate)) {
				continue;
			}

			// Check if shield applies to this damage type
			if (
				shieldTemplate.damageType !== undefined &&
				shieldTemplate.damageType !== damageType
			) {
				continue; // Shield doesn't apply to this damage type
			}

			const remainingAbsorption =
				shieldEffect.remainingAbsorption ?? shieldTemplate.absorption;
			if (remainingAbsorption <= 0) {
				continue; // Shield is depleted
			}

			// Calculate how much this shield can absorb
			// First, apply absorption rate to determine how much damage the shield will try to absorb
			const absorptionRate = shieldTemplate.absorptionRate ?? 1.0;
			const effectiveDamageToAbsorb = remainingDamage * absorptionRate;

			// Then, limit by remaining absorption capacity
			let maxAbsorbable = remainingAbsorption;
			// Then, limit by maxAbsorptionPerHit if specified
			if (shieldTemplate.maxAbsorptionPerHit !== undefined) {
				maxAbsorbable = Math.min(
					maxAbsorbable,
					shieldTemplate.maxAbsorptionPerHit
				);
			}
			// Finally, limit by effective damage to absorb
			const absorbed = Math.min(effectiveDamageToAbsorb, maxAbsorbable);
			remainingDamage -= absorbed;

			// Update shield absorption
			shieldEffect.remainingAbsorption = remainingAbsorption - absorbed;

			// Send damage message for shield absorption
			if (room) {
				const shieldName = color(shieldTemplate.name, COLOR.CYAN);
				const damageStr = color(String(absorbed), COLOR.CRIMSON);
				act(
					{
						user: `Your ${shieldName} absorbs ${damageStr} damage!`,
						room: `{User}'s  ${shieldName} absorbs some damage.`,
					},
					{
						user: this,
						room: room,
					},
					{ messageGroup: MESSAGE_GROUP.COMBAT }
				);
			}

			// Remove shield if depleted
			if (shieldEffect.remainingAbsorption <= 0) {
				this.removeEffect(shieldEffect, true);
			}
		}

		// Apply remaining damage to health
		if (remainingDamage > 0) {
			this.health = Math.max(0, this.health - remainingDamage);
		}

		// Generate threat for NPCs (use original amount for threat calculation)
		if (!this.character) {
			this.addThreat(attacker, Math.max(amount, 1));
		} else if (
			!this.isInCombat() &&
			attacker.location === this.location &&
			this.location instanceof Room
		) {
			initiateCombat(this, attacker, true);
		}

		// Handle death
		if (this.health <= 0) {
			handleDeath(this, attacker);
			return; // Don't initiate combat if target died
		}
	}

	/**
	 * Gets all active effects on this mob.
	 *
	 * @returns Readonly set of effect instances
	 */
	public getEffects(): ReadonlySet<EffectInstance> {
		return this._effects;
	}

	/**
	 * Checks if this mob has an effect with the given ID.
	 *
	 * @param effectId The effect ID to check for
	 * @returns True if the mob has an active effect with this ID
	 */
	public hasEffect(effectId: string): boolean {
		for (const effect of this._effects) {
			if (effect.template.id === effectId) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Gets all effects with the given ID.
	 *
	 * @param effectId The effect ID to find
	 * @returns Array of effect instances with this ID
	 */
	public getEffectsById(effectId: string): EffectInstance[] {
		const results: EffectInstance[] = [];
		for (const effect of this._effects) {
			if (effect.template.id === effectId) {
				results.push(effect);
			}
		}
		return results;
	}

	/**
	 * Adds an effect to this mob.
	 * If the effect is not stackable and an instance already exists, it replaces the old one.
	 * For stackable effects, multiple instances can coexist.
	 *
	 * @param template The effect template to instantiate
	 * @param caster The mob that applied this effect
	 * @param overrides Optional overrides for effect properties (e.g., custom damage/heal amounts)
	 * @returns The created effect instance
	 */
	public addEffect(
		template: EffectTemplate,
		caster: Mob,
		overrides?: EffectOverrides
	): EffectInstance {
		const now = Date.now();

		// Handle non-stackable effects: remove existing instances
		if (!template.stackable) {
			const existing = this.getEffectsById(template.id);
			for (const effect of existing) {
				this._effects.delete(effect);
			}
		}

		// Create effect instance
		const instance: EffectInstance = {
			template,
			caster,
			appliedAt: overrides?.appliedAt ?? now,
			expiresAt: overrides?.expiresAt ?? now,
		};

		// Set up duration and expiration
		// If restoration fields are provided, use them; otherwise calculate from template
		if (isDamageOverTimeEffect(template)) {
			if (overrides?.expiresAt !== undefined) {
				// Restoration mode: use provided values
				instance.expiresAt = overrides.expiresAt;
				if (overrides.nextTickAt !== undefined) {
					instance.nextTickAt = overrides.nextTickAt;
				}
				if (overrides.ticksRemaining !== undefined) {
					instance.ticksRemaining = overrides.ticksRemaining;
				}
				if (overrides.tickAmount !== undefined) {
					instance.tickAmount = overrides.tickAmount;
				}
			} else {
				// Normal mode: calculate from template
				const duration = overrides?.duration ?? template.duration;
				const intervalMs = template.interval * 1000;
				const ticks = Math.floor(duration / template.interval);
				instance.expiresAt = now + duration * 1000;
				instance.nextTickAt = now + intervalMs;
				instance.ticksRemaining = ticks;
				instance.tickAmount = overrides?.damage ?? template.damage;
			}
		} else if (isHealOverTimeEffect(template)) {
			if (overrides?.expiresAt !== undefined) {
				// Restoration mode: use provided values
				instance.expiresAt = overrides.expiresAt;
				if (overrides.nextTickAt !== undefined) {
					instance.nextTickAt = overrides.nextTickAt;
				}
				if (overrides.ticksRemaining !== undefined) {
					instance.ticksRemaining = overrides.ticksRemaining;
				}
				if (overrides.tickAmount !== undefined) {
					instance.tickAmount = overrides.tickAmount;
				}
			} else {
				// Normal mode: calculate from template
				const duration = overrides?.duration ?? template.duration;
				const intervalMs = template.interval * 1000;
				const ticks = Math.floor(duration / template.interval);
				instance.expiresAt = now + duration * 1000;
				instance.nextTickAt = now + intervalMs;
				instance.ticksRemaining = ticks;
				instance.tickAmount = overrides?.heal ?? template.heal;
			}
		} else if (isShieldEffect(template)) {
			// Shield effects don't expire (duration is infinite)
			// They are removed when absorption is depleted
			instance.expiresAt = overrides?.expiresAt ?? Number.MAX_SAFE_INTEGER;
			instance.remainingAbsorption =
				overrides?.remainingAbsorption ?? template.absorption;
		} else {
			// Passive effects: check if duration is provided via overrides
			// If expiresAt is explicitly provided (restoration), use it
			// If duration is provided, calculate expiresAt from it
			// Otherwise, effect is permanent (never expires)
			if (overrides?.expiresAt !== undefined) {
				// Restoration mode: use provided expiresAt
				instance.expiresAt = overrides.expiresAt;
			} else if (overrides?.duration !== undefined) {
				// Normal mode with duration: calculate expiresAt
				instance.expiresAt = now + overrides.duration * 1000;
			} else {
				// No duration provided: effect is permanent
				instance.expiresAt = Number.MAX_SAFE_INTEGER;
			}
		}

		// Add to effects set
		this._effects.add(instance);
		addToEffectsSet(this);

		// Set up timers for this effect
		setupEffectTimers(this, instance);

		// Check if this is a restoration (appliedAt is in the past or explicitly set)
		const isRestoration =
			overrides?.appliedAt !== undefined && overrides.appliedAt < now;

		// Send onApply act message if template has one (skip during restoration)
		if (!isRestoration && template.onApply && this.location instanceof Room) {
			act(
				template.onApply,
				{
					user: this, // The mob affected by the effect
					room: this.location,
				},
				{ messageGroup: MESSAGE_GROUP.INFO }
			);
		}

		// Recalculate attributes if this is a passive effect with modifiers
		if (isPassiveEffect(template)) {
			this.recalculateDerivedAttributes(this.captureResourceRatios());
		}

		// If this is an offensive effect and target is not in combat, initiate combat
		// Check for offensive flag on both passive and DoT effects
		// Skip combat initiation during restoration
		if (!isRestoration) {
			const isOffensive =
				(isPassiveEffect(template) && template.isOffensive) ||
				(isDamageOverTimeEffect(template) && template.isOffensive);
			if (
				isOffensive &&
				!this.isInCombat() &&
				this.location instanceof Room &&
				caster.location === this.location &&
				caster !== this
			) {
				initiateCombat(this, caster, true);
			}
		}

		return instance;
	}

	/**
	 * Removes an effect instance from this mob.
	 *
	 * @param effect The effect instance to remove
	 * @param showExpireMessage Whether to show the expiration message (defaults to checking if effect has expired)
	 */
	public removeEffect(
		effect: EffectInstance,
		showExpireMessage?: boolean
	): void {
		if (this._effects.delete(effect)) {
			// Send onExpire act message if template has one
			// Show message if explicitly requested, or if effect has expired naturally
			const now = Date.now();
			const shouldShowMessage =
				showExpireMessage !== undefined
					? showExpireMessage
					: isEffectExpired(effect, now);
			if (
				shouldShowMessage &&
				effect.template.onExpire &&
				this.location instanceof Room
			) {
				act(
					effect.template.onExpire,
					{
						user: this, // The mob affected by the effect
						room: this.location,
					},
					{ messageGroup: MESSAGE_GROUP.INFO }
				);
			}

			// Clear timers for this effect
			clearEffectTimersForEffect(effect);

			// Recalculate attributes if this was a passive effect with modifiers
			if (isPassiveEffect(effect.template)) {
				this.recalculateDerivedAttributes(this.captureResourceRatios());
			}

			// If no effects remain, remove from effects set
			if (this._effects.size === 0) {
				removeFromEffectsSet(this);
			}
		}
	}

	/**
	 * Removes all effects with the given ID from this mob.
	 *
	 * @param effectId The effect ID to remove
	 * @returns Number of effects removed
	 */
	public removeEffectsById(effectId: string): number {
		const toRemove = this.getEffectsById(effectId);
		let removed = 0;
		for (const effect of toRemove) {
			// Remove effect without showing expiration message (manual removal)
			if (this._effects.delete(effect)) {
				// Clear timers for this effect
				clearEffectTimersForEffect(effect);
				removed++;
			}
		}
		if (removed > 0) {
			// Recalculate attributes in case any were passive effects with modifiers
			this.recalculateDerivedAttributes();

			// If no effects remain, remove from effects set
			if (this._effects.size === 0) {
				removeFromEffectsSet(this);
			}
		}
		return removed;
	}

	/**
	 * Removes all effects from this mob.
	 */
	public clearEffects(): void {
		const hadPassiveEffects = Array.from(this._effects).some((e) =>
			isPassiveEffect(e.template)
		);
		this._effects.clear();
		if (hadPassiveEffects) {
			this.recalculateDerivedAttributes();
		}
	}

	/**
	 * Applies passive effects from the mob's race and job archetypes.
	 * Archetype passive effects are self-applied (caster is the mob itself)
	 * and have no expiration. They are not serialized and will be re-applied
	 * when the mob is deserialized.
	 *
	 * @internal - Public for package deserializers
	 */
	/**
	 * Remove existing archetype passive effects.
	 * This is called before applying new passives when race/job changes.
	 * @internal
	 */
	public removeArchetypePassives(): void {
		// Remove any existing archetype passives first (in case race/job changed)
		const archetypePassiveIds = new Set<string>();
		for (const passiveId of this._race.passives) {
			archetypePassiveIds.add(passiveId);
		}
		for (const passiveId of this._job.passives) {
			archetypePassiveIds.add(passiveId);
		}

		// Remove existing archetype passives (identified by caster being self)
		const toRemove: EffectInstance[] = [];
		for (const effect of this._effects) {
			if (
				effect.caster === this &&
				archetypePassiveIds.has(effect.template.id)
			) {
				toRemove.push(effect);
			}
		}
		for (const effect of toRemove) {
			this._effects.delete(effect);
		}
	}

	/**
	 * Apply a single archetype passive effect template.
	 * This method is called by package layer helpers that have registry access.
	 * @internal
	 */
	public applyArchetypePassive(template: EffectTemplate): void {
		// Archetype passives are self-applied and never expire
		this.addEffect(template, this);
	}

	/**
	 * Get the list of archetype ability definitions that should be learned
	 * at the current level or below.
	 * Returns ability definitions (id and level) that haven't been learned yet.
	 * @internal
	 */
	public getUnlearnedArchetypeAbilities(): Array<{
		id: string;
		level: number;
	}> {
		const currentLevel = this._level;
		const allAbilities: Array<{ id: string; level: number }> = [];
		const unlearned: Array<{ id: string; level: number }> = [];

		// Collect abilities from race
		for (const abilityDef of this._race.abilities) {
			allAbilities.push(abilityDef);
		}

		// Collect abilities from job
		for (const abilityDef of this._job.abilities) {
			allAbilities.push(abilityDef);
		}

		// Check each ability to see if it should be learned at current level
		for (const abilityDef of allAbilities) {
			// Skip if the ability level requirement is higher than current level
			if (abilityDef.level > currentLevel) {
				continue;
			}

			// Skip if already learned
			if (this.knowsAbilityById(abilityDef.id)) {
				continue;
			}

			unlearned.push(abilityDef);
		}

		return unlearned;
	}

	/**
	 * Teach an ability to this mob.
	 * This method is called by package layer helpers that have registry access.
	 * @internal
	 */
	public learnArchetypeAbility(ability: Ability): void {
		this.addAbility(ability, 0);
	}

	/**
	 * Serialize this Mob instance to a serializable format.
	 * Includes all mob-specific properties: level, experience, race/job IDs,
	 * bonuses, resources, and equipped items. Used for persistence and network transfer.
	 *
	 * @returns Serialized mob object suitable for JSON/YAML persistence
	 *
	 * @example
	 * ```typescript
	 * const mob = new Mob({ level: 10 });
	 * const serialized = mob.serialize();
	 * // Can be saved to file or sent over network
	 * ```
	 */
	public serialize(options?: {
		compress?: boolean;
		version?: string;
	}): SerializedMob {
		// Always build from an uncompressed base so compression can compare against template baselines
		const base = super.serialize(options); // uncompressed base shape
		const uncompressed = {
			...(base as SerializedDungeonObject),
		} as SerializedMob;
		if (this._equipped.size > 0 && uncompressed.contents) {
			const equipped = this.getAllEquipped();
			const filteredContents = this.contents
				.filter((obj) => !(obj instanceof Equipment) || !equipped.includes(obj))
				.map((obj) => obj.serialize(options));
			if (filteredContents.length > 0) {
				uncompressed.contents = filteredContents;
			} else {
				delete uncompressed.contents;
			}
		}
		const equipped: Record<
			EQUIPMENT_SLOT,
			SerializedEquipment | SerializedArmor | SerializedWeapon
		> = {} as Record<
			EQUIPMENT_SLOT,
			SerializedEquipment | SerializedArmor | SerializedWeapon
		>;
		for (const [slot, equipment] of this._equipped.entries()) {
			equipped[slot] = equipment.serialize(options);
		}

		// Serialize effects (excluding archetype passives)
		// Build set of archetype passive IDs from race and job
		const archetypePassiveIds = new Set<string>();
		for (const passiveId of this._race.passives) {
			archetypePassiveIds.add(passiveId);
		}
		for (const passiveId of this._job.passives) {
			archetypePassiveIds.add(passiveId);
		}

		const serializedEffects: SerializedEffect[] = [];
		const now = Date.now();
		for (const effect of this._effects) {
			// Skip archetype passives (identified by template ID being in race/job passives)
			if (archetypePassiveIds.has(effect.template.id)) {
				continue;
			}
			const serialized: SerializedEffect = {
				effectId: effect.template.id,
				casterOid: effect.caster.oid,
			};

			// Calculate remaining duration (undefined for permanent effects)
			if (effect.expiresAt !== Number.MAX_SAFE_INTEGER) {
				const remaining = effect.expiresAt - now;
				if (remaining > 0) {
					serialized.remainingDuration = remaining;
				}
				// If remaining <= 0, effect is expired, skip serializing it
				else {
					continue;
				}
			}

			// Calculate time until next tick for DoT/HoT effects
			if (effect.nextTickAt !== undefined) {
				const nextTickIn = effect.nextTickAt - now;
				if (nextTickIn > 0) {
					serialized.nextTickIn = nextTickIn;
				}
			}

			// Include other optional fields
			if (effect.ticksRemaining !== undefined) {
				serialized.ticksRemaining = effect.ticksRemaining;
			}
			if (effect.tickAmount !== undefined) {
				serialized.tickAmount = effect.tickAmount;
			}
			if (effect.remainingAbsorption !== undefined) {
				serialized.remainingAbsorption = effect.remainingAbsorption;
			}

			serializedEffects.push(serialized);
		}

		const full: SerializedMob = {
			...(uncompressed as SerializedDungeonObject),
			type: "Mob",
			level: this._level,
			experience: this._experience,
			race: this._race.id,
			job: this._job.id,
			...(this._attributeBonuses &&
			Object.keys(this._attributeBonuses).length > 0
				? { attributeBonuses: prunePrimaryBonuses(this._attributeBonuses) }
				: {}),
			...(this._resourceBonuses && Object.keys(this._resourceBonuses).length > 0
				? { resourceBonuses: pruneResourceBonuses(this._resourceBonuses) }
				: {}),
			health: this._health,
			mana: this._mana,
			exhaustion: this._exhaustion,
			...(equipped && Object.keys(equipped).length > 0 ? { equipped } : {}),
			...(this._behaviors.size > 0
				? {
						behaviors: Object.fromEntries(
							Array.from(this._behaviors.entries()).map(([key, value]) => [
								key as string,
								value,
							])
						) as Record<string, boolean>,
				  }
				: {}),
			...(this._learnedAbilities.size > 0
				? {
						learnedAbilities: Object.fromEntries(
							Array.from(this._learnedAbilities.entries()).map(
								([ability, uses]) => [ability.id, uses]
							)
						) as Record<string, number>,
				  }
				: {}),
			...(serializedEffects.length > 0 ? { effects: serializedEffects } : {}),
		};

		// If compressing, prefer template-aware compression and also prune equipped entries
		if (options?.compress) {
			// Compress the mob object against its baseline (template or type)
			const compressed = compressSerializedObject(full, base.templateId);
			// Always preserve effects if they exist (compression might remove them if baseline has no effects)
			if (serializedEffects.length > 0) {
				(compressed as any).effects = serializedEffects;
			}
			return compressed;
		}

		return full;
	}

	/**
	 * Override destroy to handle Mob-specific cleanup:
	 * - Clear character reference
	 * - Clear equipped items
	 * - Stop threat expiration timer
	 */
	override destroy(destroyContents: boolean = true): void {
		logger.debug("Mob being destroyed", {
			mob: this.display,
			mobId: this.oid,
			isCharacter: !!this.character,
			destroyContents,
		});

		// Stop threat expiration timer
		this._stopThreatExpirationCycle();

		// Clear character reference (this will also clear character.mob)
		this.character = undefined;

		// Clear equipped items map
		this._equipped.clear();

		// Clear combat state
		this._combatTarget = undefined;
		if (this._threatTable) {
			this._threatTable.clear();
		}

		// Clean up AI system (if initialized)
		if (this._aiEventEmitter) {
			// Dynamic import to avoid circular dependency
			import("../registry/mob-ai.js").then((module) => {
				module.cleanupMobAI(this);
			});
		}

		// Call parent destroy
		super.destroy(destroyContents);
	}
}

/**
 * Represents a bidirectional portal between two rooms.
 * Links override normal spatial relationships to connect arbitrary rooms.
 *
 * @example
 * ```typescript
 * import { Dungeon, DIRECTION } from "./dungeon.js";
 * import { createTunnel } from "../registry/dungeon.js";
 *
 * const midgar = Dungeon.generateEmptyDungeon({ dimensions: { width: 6, height: 6, layers: 1 } });
 * const sector7 = Dungeon.generateEmptyDungeon({ dimensions: { width: 1, height: 1, layers: 1 } });
 * const midgarRoom = midgar.getRoom({ x: 5, y: 5, z: 0 })!;
 * const sectorRoom = sector7.getRoom({ x: 0, y: 0, z: 0 })!;
 *
 * createTunnel(midgarRoom, DIRECTION.NORTH, sectorRoom);
 *
 * // The rooms are now connected via these directions
 * console.log(midgarRoom.getStep(DIRECTION.NORTH) === sectorRoom); // true
 * console.log(sectorRoom.getStep(DIRECTION.SOUTH) === midgarRoom); // true
 * ```
 */
export interface RoomLink {
	/**
	 * The originating endpoint for this link.
	 *
	 * Contains the source `room` instance and the `direction` (a DIRECTION
	 * flag) that, when used with Room.getStep() from that room, should resolve
	 * to the other endpoint.
	 *
	 * Example: `{ room: roomA, direction: DIRECTION.NORTH }` means "from
	 * roomA moving NORTH you arrive at the other endpoint".
	 */
	from: { room: Room; direction: DIRECTION };

	/**
	 * The destination endpoint for this link.
	 *
	 * Contains the target `room` and the `direction` on the target room that
	 * represents the return traversal (the reverse direction). For two-way
	 * links the Room.getStep() call on the destination room using this
	 * direction will resolve back to the originating room.
	 */
	to: { room: Room; direction: DIRECTION };

	/**
	 * When true the link only functions in the `from` -> `to` direction.
	 *
	 * A one-way link will be registered only on the `from.room` so calls to
	 * `getStep()` on the `to.room` will not consider this link when resolving
	 * movements.
	 */
	oneWay: boolean;
}

/**
 * Check if a room link references a room in the specified dungeon.
 * Returns true if either endpoint of the link is in the given dungeon.
 *
 * @param link The room link to check
 * @param dungeon The dungeon to check against
 * @returns true if either the from or to room is in the dungeon
 *
 * @example
 * ```typescript
 * const dungeon1 = Dungeon.generateEmptyDungeon({ dimensions: { width: 3, height: 3, layers: 1 } });
 * const dungeon2 = Dungeon.generateEmptyDungeon({ dimensions: { width: 3, height: 3, layers: 1 } });
 * const room1 = dungeon1.getRoom({ x: 0, y: 0, z: 0 });
 * const room2 = dungeon2.getRoom({ x: 0, y: 0, z: 0 });
 * const link = createTunnel(room1, DIRECTION.NORTH, room2);
 *
 * console.log(roomLinkReferencesDungeon(link, dungeon1)); // true
 * console.log(roomLinkReferencesDungeon(link, dungeon2)); // true
 * ```
 */
export function roomLinkReferencesDungeon(
	link: RoomLink,
	dungeon: Dungeon
): boolean {
	return link.from.room.dungeon === dungeon || link.to.room.dungeon === dungeon;
}

/**
 * Resolve the linked destination when moving from `fromRoom` in `direction`.
 *
 * The Room class calls this function while evaluating `getStep()` so it can
 * discover linked rooms that override spatial adjacency. The resolution
 * rules are straightforward:
 * - If `fromRoom` matches the link's `from.room` and `direction` equals
 *   `from.direction`, return `to.room`.
 * - If the link is two-way and `fromRoom` matches `to.room` with
 *   `direction === to.direction`, return `from.room`.
 * - Otherwise return `undefined` to indicate this link does not handle the
 *   requested traversal.
 *
 * This function does not perform permission checks (canEnter/canExit) - it
 * only resolves spatial/linked connectivity. Permission checks are done
 * by the calling code (e.g., Movable.canStep).
 *
 * @param link The room link to check
 * @param fromRoom The room where traversal begins
 * @param direction The direction of traversal
 * @returns The destination `Room` if this link handles the traversal, otherwise `undefined`
 */
export function getRoomLinkDestination(
	link: RoomLink,
	fromRoom: Room,
	direction: DIRECTION
): Room | undefined {
	// Check from -> to
	if (fromRoom === link.from.room && direction === link.from.direction) {
		return link.to.room;
	}
	// Check to -> from (only if link is not one-way)
	if (
		!link.oneWay &&
		fromRoom === link.to.room &&
		direction === link.to.direction
	) {
		return link.from.room;
	}
	return undefined;
}

const baseSerializedTypes: Partial<
	Record<SerializedDungeonObjectType, SerializedDungeonObject>
> = {
	Movable: new Movable({ oid: -1 }).serialize(),
	Mob: new Mob({
		race: {
			id: "race",
			name: "Race",
			startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
			attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
			startingResourceCaps: { maxHealth: 0, maxMana: 0 },
			resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
			abilities: [],
			passives: [],
			growthModifier: {
				base: 1.0,
			},
		},
		job: {
			id: "job",
			name: "Job",
			startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
			attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
			startingResourceCaps: { maxHealth: 0, maxMana: 0 },
			resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
			abilities: [],
			passives: [],
			growthModifier: {
				base: 1.0,
			},
		},
		oid: -1,
	}).serialize(),
	Equipment: new Equipment({ oid: -1 }).serialize(),
	Armor: new Armor({ oid: -1 }).serialize(),
	Weapon: new Weapon({ oid: -1 }).serialize(),
	Item: new Item({ oid: -1 }).serialize(),
	Prop: new Prop({ oid: -1 }).serialize(),
	Room: new Room({ oid: -1, coordinates: { x: 0, y: 0, z: 0 } }).serialize(),
	DungeonObject: new DungeonObject({ oid: -1 }).serialize(),
};

/**
 * Returns the baseline serialization for a given type and optional templateId.
 * Prefers the template baseline when available; falls back to type baseline.
 */
function getCompressionBaseline(
	type: SerializedDungeonObjectType,
	templateId?: string,
	template?: DungeonObjectTemplate
): SerializedDungeonObject {
	let base: SerializedDungeonObject | undefined = undefined;
	if (templateId && template) {
		// Template is provided by package layer (has registry access)
		if (template.baseSerialized) {
			base = template.baseSerialized;
		} else {
			// baseSerialized should be set by package layer during template loading
			// If missing, fall back to type defaults
			base = baseSerializedTypes[type];
		}
	} else if (templateId) {
		const cached = resolveTemplateById(templateId);
		if (cached) base = cached as SerializedDungeonObject;
	}
	return (base ?? baseSerializedTypes[type]) as SerializedDungeonObject;
}

/**
 * Produces a compressed serialized object by removing keys equal to baseline.
 * Always preserves 'type', 'oid' (if present), and includes 'templateId' when provided.
 *
 * @param uncompressed The full serialized object to compress
 * @param templateId Optional template ID to use as baseline for compression
 * @returns Compressed serialized object with only fields that differ from baseline
 */
export function compressSerializedObject<T extends SerializedDungeonObject>(
	uncompressed: T,
	templateId?: string,
	template?: DungeonObjectTemplate
): T {
	const type = uncompressed.type;
	const base = getCompressionBaseline(type, templateId, template);
	const compressed: Partial<SerializedDungeonObject> = {
		type,
		...(uncompressed.oid !== undefined && { oid: uncompressed.oid }), // Include oid if present (instances only)
		...(templateId ? { templateId } : {}),
		...(uncompressed.version !== undefined && {
			version: uncompressed.version,
		}), // Always preserve version
	};
	for (const [key, value] of Object.entries(uncompressed) as Array<
		[keyof SerializedDungeonObject, unknown]
	>) {
		if (key === "type") continue;
		if (key === "templateId") continue;
		if (key === "oid") continue;
		if (key === "version") continue;
		const baseValue = (base as any)?.[key];
		// if the value is an object and the base value is an object and the values are deep equal -- compress
		if (
			typeof value === "object" &&
			typeof baseValue === "object" &&
			isDeepStrictEqual(value, baseValue)
		)
			continue;
		if (value !== baseValue) {
			(compressed as any)[key] = value;
		}
	}
	return compressed as T;
}

/**
 * Creates a normalized, uncompressed serialized object by overlaying the provided
 * data on top of the base serialization for its declared type. Contents are normalized
 * recursively. The original input is not mutated.
 *
 * Exported for use by package layer deserializers.
 */
export function normalizeSerializedData<T extends AnySerializedDungeonObject>(
	data: T,
	template?: DungeonObjectTemplate
): T {
	const hasTemplate = data.templateId;
	let base: Record<string, unknown> | undefined = undefined;
	if (hasTemplate && template) {
		// Template is provided by package layer (has registry access)
		// Prefer cached template baseline when available
		if (template.baseSerialized) {
			base = { ...template.baseSerialized } as Record<string, unknown>;
		} else {
			// baseSerialized should be set by package layer during template loading
			// If missing, fall back to type defaults
			base = (baseSerializedTypes[template.type] ?? {}) as unknown as Record<
				string,
				unknown
			>;
		}
	} else if (hasTemplate) {
		// Fallback to global cache when template not provided

		const cached = resolveTemplateById(data.templateId!);
		if (cached) base = { ...cached } as Record<string, unknown>;
	}

	const type: SerializedDungeonObjectType =
		(data.type as SerializedDungeonObjectType | undefined) ?? "DungeonObject";
	if (!base) {
		base = (baseSerializedTypes[type] ?? {}) as unknown as Record<
			string,
			unknown
		>;
	}

	// Shallow overlay: input overrides base
	const merged: Record<string, unknown> = {
		...(base ?? {}),
		...data,
	};

	// Normalize contents recursively if present
	if (Array.isArray((merged as any).contents)) {
		(merged as any).contents = (merged as any).contents.map((c: unknown) =>
			normalizeSerializedData(c as AnySerializedDungeonObject)
		);
	}

	return merged as T;
}

export function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v !== undefined) out[k] = v;
	}
	return out as T;
}
